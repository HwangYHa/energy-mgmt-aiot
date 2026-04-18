/**
 * GET /api/analytics/benchmark
 * 업종별 에너지 효율 벤치마킹 — 같은 업종 평균 대비 순위
 *
 * 반환:
 *   tenantIntensity    : number  — 테넌트 에너지 원단위 (kWh/m²/월)
 *   industryAvg        : number  — 업종 평균 에너지 원단위
 *   industryBest       : number  — 업종 최우수 (상위 10%)
 *   percentile         : number  — 테넌트 백분위 (높을수록 우수)
 *   rating             : string  — A+ / A / B / C / D
 *   industryType       : string  — 업종 코드
 *   savings_potential  : number  — 업종 평균 달성 시 절감액 (원/월)
 *   benchmark_items    : Array   — 항목별 비교
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify';
import { successResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

// 업종별 에너지 원단위 벤치마크 (kWh/m²/월) — 한국에너지공단 2023 자료 기준
const INDUSTRY_BENCHMARK: Record<string, { avg: number; best: number; unit: string; label: string }> = {
  manufacturing:      { avg: 42.0,  best: 21.0,  unit: 'kWh/m²/월', label: '제조업' },
  building:           { avg: 18.5,  best: 9.5,   unit: 'kWh/m²/월', label: '일반 건물' },
  industrial_complex: { avg: 55.0,  best: 28.0,  unit: 'kWh/m²/월', label: '산업단지' },
  datacenter:         { avg: 120.0, best: 65.0,  unit: 'kWh/m²/월', label: '데이터센터' },
  other:              { avg: 25.0,  best: 12.0,  unit: 'kWh/m²/월', label: '기타' },
};

// 등급 판정 — 원단위가 낮을수록 우수
function getRating(pct: number): string {
  if (pct >= 90) return 'A+';
  if (pct >= 75) return 'A';
  if (pct >= 50) return 'B';
  if (pct >= 25) return 'C';
  return 'D';
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const { tenantId } = auth;

    // ── 테넌트 업종 + 사이트 면적 ─────────────────────────────────────
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { industryType: true },
    });

    const sites = await prisma.site.findMany({
      where: { tenantId },
      select: { areaSqm: true },
    });

    const totalArea = sites.reduce((s, site) => s + (Number(site.areaSqm) || 0), 0);
    const industryType = (tenant?.industryType ?? 'other').toLowerCase();
    const bench = (INDUSTRY_BENCHMARK[industryType] ?? INDUSTRY_BENCHMARK['other'])!;

    // ── 최근 1개월 에너지 사용량 ─────────────────────────────────────
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthEnd   = new Date(now.getFullYear(), now.getMonth(),     0, 23, 59, 59);

    const metrics = await prisma.metric.findMany({
      where: { tenantId, OR: [{ unit: 'kWh' }, { key: { contains: 'energy' } }] },
      select: { id: true },
    });
    const metricIds = metrics.map(m => m.id);

    let monthlyKwh = 0;
    if (metricIds.length > 0) {
      const agg = await prisma.measurement.aggregate({
        where: { tenantId, metricId: { in: metricIds }, time: { gte: monthStart, lte: monthEnd }, quality: 'good' },
        _sum: { value: true },
      });
      monthlyKwh = Number(agg._sum.value ?? 0);
    }

    // ── 원단위 계산 ───────────────────────────────────────────────────
    const effectiveArea  = totalArea > 0 ? totalArea : 1000;  // 면적 미등록 시 1000m² 가정
    const tenantIntensity = monthlyKwh > 0 ? Math.round((monthlyKwh / effectiveArea) * 10) / 10 : null;

    // 백분위: 원단위가 낮을수록 좋음. 평균 대비 비율로 추정
    let percentile = 50;
    if (tenantIntensity !== null) {
      const ratio = tenantIntensity / bench.avg;
      if (ratio <= 0.5)       percentile = 95;
      else if (ratio <= 0.7)  percentile = 85;
      else if (ratio <= 0.9)  percentile = 70;
      else if (ratio <= 1.0)  percentile = 55;
      else if (ratio <= 1.2)  percentile = 40;
      else if (ratio <= 1.5)  percentile = 25;
      else                    percentile = 10;
    }

    // 절감 잠재액: 평균 달성 시
    const avgKwh = bench.avg * effectiveArea;
    const UNIT_PRICE = 130; // 평균 전력단가 원/kWh
    const savingsPotential = monthlyKwh > avgKwh
      ? Math.round((monthlyKwh - avgKwh) * UNIT_PRICE)
      : 0;

    // ── 항목별 비교 ───────────────────────────────────────────────────
    const benchmarkItems = [
      {
        label: '에너지 원단위',
        tenant: tenantIntensity ?? bench.avg,
        avg: bench.avg,
        best: bench.best,
        unit: bench.unit,
        better: tenantIntensity !== null && tenantIntensity < bench.avg,
      },
      {
        label: '월간 사용량',
        tenant: Math.round(monthlyKwh),
        avg: Math.round(bench.avg * effectiveArea),
        best: Math.round(bench.best * effectiveArea),
        unit: 'kWh',
        better: monthlyKwh > 0 && monthlyKwh < bench.avg * effectiveArea,
      },
    ];

    // ── 6개월 추이 (원단위) ────────────────────────────────────────────
    const monthlyTrend: Array<{ month: string; intensity: number | null; avg: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d   = new Date(now.getFullYear(), now.getMonth() - i - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i,     0, 23, 59, 59);
      const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      let kwh = 0;
      if (metricIds.length > 0) {
        const a = await prisma.measurement.aggregate({
          where: { tenantId, metricId: { in: metricIds }, time: { gte: d, lte: end }, quality: 'good' },
          _sum: { value: true },
        });
        kwh = Number(a._sum.value ?? 0);
      }
      monthlyTrend.push({
        month: label,
        intensity: kwh > 0 ? Math.round((kwh / effectiveArea) * 10) / 10 : null,
        avg: bench.avg,
      });
    }

    return successResponse({
      tenantIntensity,
      industryAvg:       bench.avg,
      industryBest:      bench.best,
      industryLabel:     bench.label,
      industryType,
      unit:              bench.unit,
      percentile,
      rating:            getRating(percentile),
      effectiveArea,
      monthlyKwh:        Math.round(monthlyKwh),
      savingsPotential,
      benchmarkItems,
      monthlyTrend,
      dataAvailable:     metricIds.length > 0 && monthlyKwh > 0,
    });
  } catch (error) {
    console.error('[API] 벤치마크 오류:', error);
    return serverErrorResponse();
  }
}
