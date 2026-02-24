/**
 * GET /api/analytics/carbon/compliance-report
 *
 * 한국 환경부 MRV 기준 온실가스 명세서 (GHG Inventory) 생성
 * - Scope 1 (직접배출): 연료 연소 / 냉매 누출
 * - Scope 2 (간접배출): 구매 전력 / 스팀
 * - Scope 3 (기타): 운송 / 폐기물
 *
 * 출력: JSON → 클라이언트에서 PDF 생성 또는 엑셀 내보내기에 활용
 *
 * 쿼리 파라미터:
 *   year  — 보고 연도 (기본: 현재 연도)
 *   siteId — 특정 사업장만 (없으면 전체)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify';
import { unauthorizedResponse } from '@/lib/api/response';
import { EmissionsService } from '@/lib/services/emissions.service';
import { ALL_EMISSION_FACTORS } from '@/lib/constants/emission-factors';

export const dynamic = 'force-dynamic';

// ──────────────────────────────────────────────────────────────
// 타입 정의
// ──────────────────────────────────────────────────────────────

interface ReportEmissionSource {
  id: string;
  facility: string;
  emissionType: 'scope1' | 'scope2' | 'scope3';
  category: string;   // fuel | electricity | transport | refrigerant
  sourceType: string; // diesel | lng | grid | truck | …
  period: string;     // YYYY-MM
  amount: number;
  unit: string;
  emissionFactor: number;
  factorUnit: string;
  emission: number;   // tCO₂eq
  methodology: string;
  dataSource: string;
}

interface ComplianceReport {
  meta: {
    reportType: 'GHG_INVENTORY';
    standard: 'K-MRV' | 'GHG_PROTOCOL' | 'ISO_14064';
    reportingYear: number;
    generatedAt: string;
    version: string;
  };
  company: {
    name: string;
    tenantId: string;
    industryType: string;
    reportingPeriod: {
      start: string;
      end: string;
    };
  };
  summary: {
    scope1Total: number;
    scope2Total: number;
    scope3Total: number;
    grandTotal: number;
    unit: string;
    comparedToPreviousYear?: number; // % 변화
  };
  scope1: {
    total: number;
    sources: ReportEmissionSource[];
    methodologies: string[];
  };
  scope2: {
    total: number;
    sources: ReportEmissionSource[];
    electricityFactor: number;
    electricityFactorVersion: string;
    electricityFactorUnit: string;
  };
  scope3: {
    total: number;
    sources: ReportEmissionSource[];
    categories: string[];
  };
  monthlyTrend: Array<{
    month: number;
    monthName: string;
    scope1: number;
    scope2: number;
    scope3: number;
    total: number;
  }>;
  emissionFactorsUsed: Array<{
    id: string;
    category: string;
    sourceType: string;
    factor: number;
    unit: string;
    version: string;
    source: string;
  }>;
  verification: {
    status: 'unverified' | 'self-declared' | 'verified';
    notes: string;
  };
}

// ──────────────────────────────────────────────────────────────
// GET 핸들러
// ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
  const siteId = searchParams.get('siteId') || undefined;

  const tenantId = auth.tenantId;

  try {
    // ── 1. 테넌트 정보 ──────────────────────────────────────
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, industryType: true },
    });

    if (!tenant) {
      return NextResponse.json({ success: false, error: '테넌트 없음' }, { status: 404 });
    }

    const reportStart = `${year}-01-01`;
    const reportEnd   = `${year}-12-31`;

    // ── 2. Scope 1 상세 데이터 ──────────────────────────────
    const scope1Data = await prisma.emissionsData.findMany({
      where: {
        tenantId,
        emissionType: 'scope1',
        period: { gte: `${year}-01`, lte: `${year}-12` },
      },
      select: {
        id: true,
        sourceType: true,
        amount: true,
        unit: true,
        emissionFactor: true,
        calculatedEmission: true,
        period: true,
        calculationMethod: true,
        dataSource: true,
        deviceId: true,
      },
      orderBy: [{ period: 'asc' }],
    });

    // ── 3. Scope 3 상세 데이터 ──────────────────────────────
    const scope3Data = await prisma.emissionsData.findMany({
      where: {
        tenantId,
        emissionType: 'scope3',
        period: { gte: `${year}-01`, lte: `${year}-12` },
      },
      select: {
        id: true,
        sourceType: true,
        amount: true,
        unit: true,
        emissionFactor: true,
        calculatedEmission: true,
        period: true,
        calculationMethod: true,
        dataSource: true,
      },
      orderBy: [{ period: 'asc' }],
    });

    // ── 4. Scope 2 전력 배출량 계산 ─────────────────────────
    const startDate = new Date(year, 0, 1);
    const endDate   = new Date(year, 11, 31);
    const scope2Total = await EmissionsService.calculateScope2Electricity(
      tenantId,
      startDate,
      endDate,
      siteId
    );

    // 사용된 전력 배출계수
    const elecFactor = ALL_EMISSION_FACTORS.find(
      (f) => f.category === 'electricity' && f.sourceType === 'grid' && f.version === String(year)
    ) ?? ALL_EMISSION_FACTORS.find(
      (f) => f.category === 'electricity' && f.sourceType === 'grid'
    );

    // ── 5. 월간 추이 ────────────────────────────────────────
    const monthlyData = await EmissionsService.getMonthlyEmissions(tenantId, year, siteId);

    // ── 6. 이전 연도 비교 ───────────────────────────────────
    const prevYear = year - 1;
    const prevScope1 = await EmissionsService.calculateScope1Fuel(
      tenantId, new Date(prevYear, 0, 1), new Date(prevYear, 11, 31)
    );
    const prevScope2 = await EmissionsService.calculateScope2Electricity(
      tenantId, new Date(prevYear, 0, 1), new Date(prevYear, 11, 31)
    );
    const prevScope3 = await EmissionsService.calculateScope3Transport(
      tenantId, new Date(prevYear, 0, 1), new Date(prevYear, 11, 31)
    );

    const scope1Total = scope1Data.reduce(
      (s, d) => s + parseFloat(d.calculatedEmission.toString()), 0
    );
    const scope3Total = scope3Data.reduce(
      (s, d) => s + parseFloat(d.calculatedEmission.toString()), 0
    );
    const grandTotal   = scope1Total + scope2Total + scope3Total;
    const prevTotal    = prevScope1  + prevScope2  + prevScope3;
    const yoyChange    = prevTotal > 0 ? ((grandTotal - prevTotal) / prevTotal) * 100 : 0;

    // ── 7. 사용된 배출계수 목록 ─────────────────────────────
    const usedSourceTypes = new Set([
      ...scope1Data.map((d) => `fuel:${d.sourceType}`),
      ...scope3Data.map((d) => `transport:${d.sourceType}`),
      'electricity:grid',
    ]);

    const factorsUsed = ALL_EMISSION_FACTORS.filter((f) =>
      usedSourceTypes.has(`${f.category}:${f.sourceType}`)
    ).map((f) => ({
      id: f.id,
      category: f.category,
      sourceType: f.sourceType,
      factor: f.factor,
      unit: f.unit,
      version: f.version,
      source: f.source,
    }));

    // ── 8. 리포트 조립 ──────────────────────────────────────
    const report: ComplianceReport = {
      meta: {
        reportType: 'GHG_INVENTORY',
        standard: 'K-MRV',
        reportingYear: year,
        generatedAt: new Date().toISOString(),
        version: '1.0',
      },
      company: {
        name: tenant.name,
        tenantId,
        industryType: tenant.industryType,
        reportingPeriod: { start: reportStart, end: reportEnd },
      },
      summary: {
        scope1Total: Math.round(scope1Total * 1000) / 1000,
        scope2Total: Math.round(scope2Total * 1000) / 1000,
        scope3Total: Math.round(scope3Total * 1000) / 1000,
        grandTotal:  Math.round(grandTotal  * 1000) / 1000,
        unit: 'tCO₂eq',
        comparedToPreviousYear: prevTotal > 0
          ? Math.round(yoyChange * 10) / 10
          : undefined,
      },
      scope1: {
        total: Math.round(scope1Total * 1000) / 1000,
        sources: scope1Data.map((d) => ({
          id: d.id,
          facility: d.deviceId ?? '미상',
          emissionType: 'scope1',
          category: 'fuel',
          sourceType: d.sourceType,
          period: d.period,
          amount: parseFloat(d.amount.toString()),
          unit: d.unit,
          emissionFactor: parseFloat(d.emissionFactor.toString()),
          factorUnit: 'tCO₂/kL or ton',
          emission: parseFloat(d.calculatedEmission.toString()),
          methodology: d.calculationMethod === 'auto' ? 'Tier 2 (배출계수법)' : '직접 측정',
          dataSource: d.dataSource,
        })),
        methodologies: ['Tier 2 (배출계수법)', 'GHG Protocol Corporate Standard'],
      },
      scope2: {
        total: Math.round(scope2Total * 1000) / 1000,
        sources: scope2Total > 0 ? [{
          id: 'scope2-electricity',
          facility: '전체 사업장',
          emissionType: 'scope2',
          category: 'electricity',
          sourceType: 'grid',
          period: `${year}-01~${year}-12`,
          amount: 0,
          unit: 'MWh',
          emissionFactor: elecFactor?.factor ?? 0.4593,
          factorUnit: 'tCO₂/MWh',
          emission: Math.round(scope2Total * 1000) / 1000,
          methodology: 'Scope 2 Location-Based (한국전력 계통 배출계수)',
          dataSource: '전력계량기 자동수집',
        }] : [],
        electricityFactor: elecFactor?.factor ?? 0.4593,
        electricityFactorVersion: elecFactor?.version ?? '2024',
        electricityFactorUnit: elecFactor?.unit ?? 'tCO₂/MWh',
      },
      scope3: {
        total: Math.round(scope3Total * 1000) / 1000,
        sources: scope3Data.map((d) => ({
          id: d.id,
          facility: '사업장 외부',
          emissionType: 'scope3',
          category: 'transport',
          sourceType: d.sourceType,
          period: d.period,
          amount: parseFloat(d.amount.toString()),
          unit: d.unit,
          emissionFactor: parseFloat(d.emissionFactor.toString()),
          factorUnit: 'tCO₂/km',
          emission: parseFloat(d.calculatedEmission.toString()),
          methodology: 'Scope 3 Category 4 (운송 및 배송)',
          dataSource: d.dataSource,
        })),
        categories: ['Category 4: 운송 및 배송 (업스트림)'],
      },
      monthlyTrend: monthlyData.map((m) => ({
        month: m.month,
        monthName: `${m.month}월`,
        scope1: m.scope1,
        scope2: m.scope2,
        scope3: m.scope3,
        total: m.total,
      })),
      emissionFactorsUsed: factorsUsed,
      verification: {
        status: 'self-declared',
        notes: '본 명세서는 탄소이음 플랫폼에서 자동 생성되었습니다. 제3자 검증이 필요한 경우 공인 검증기관에 의뢰하세요.',
      },
    };

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error) {
    console.error('[ComplianceReport] 오류:', error);
    return NextResponse.json(
      { success: false, error: '명세서 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
