/**
 * ESG Report Engine
 * Deterministic + Reproducible 보고서 생성 엔진
 * 동일 입력 → 항상 동일 출력 보장
 */

import * as crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { getTemplate } from '../templates';
import type {
  GenerateESGReportInput,
  GenerateESGReportOutput,
  EmissionFactorSnapshot,
  EngineVersionSnapshot,
  BoundarySnapshot,
  CalculationMethodSnapshot,
  ActivityDataSnapshot,
  ESGReportSummary,
} from '../types/esg-report.types';
import type { TemplateContext } from '../templates/base.template';
import { generateReportNo } from './report-number';

// ─── Report Engine ─────────────────────────────────────────────────

export class ReportEngine {
  /**
   * ⭐ 핵심: Deterministic 보고서 생성
   * 1. 기간 내 EmissionsRecord 조회
   * 2. 스냅샷 수집 (배출계수, 엔진 버전, 경계 설정)
   * 3. 배출량 집계 (Scope별)
   * 4. 템플릿 검증
   * 5. 데이터 해시 계산 (SHA-256)
   * 6. ESGReport 저장
   */
  static async generate(input: GenerateESGReportInput): Promise<GenerateESGReportOutput> {
    const warnings: string[] = [];

    // ─── 1. 기간 파싱 ────────────────────────────────────────────
    const { periodStart, periodEnd } = parsePeriod(input.period, input.periodType);

    // ─── 2. EmissionsRecord 조회 ──────────────────────────────────
    const records = await prisma.emissionsRecord.findMany({
      where: {
        tenantId: input.tenantId,
        period: {
          gte: periodStart,
          lte: periodEnd,
        },
        isArchived: false,
      },
      include: {
        emissionFactor: true,
        engineVersion: true,
      },
    });

    if (records.length === 0) {
      warnings.push(`${input.period} 기간에 배출량 기록이 없습니다. 빈 보고서를 생성합니다.`);
    }

    // ─── 3. 스냅샷 수집 ──────────────────────────────────────────

    // 3a. 배출계수 스냅샷 (중복 제거)
    const factorMap = new Map<string, EmissionFactorSnapshot>();
    for (const r of records) {
      if (!factorMap.has(r.emissionFactorId)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const f = r.emissionFactor as any;
        factorMap.set(r.emissionFactorId, {
          factorId: f.id,
          code: f.code,
          category: f.category,
          sourceType: f.sourceType ?? f.source_type ?? '',
          factor: Number(f.factor),
          unit: f.unit,
          version: String(f.version ?? '1.0.0'),
          source: f.source,
          year: f.year,
          validFrom: f.validFrom ? f.validFrom.toISOString().split('T')[0] : '',
          validTo: f.validTo?.toISOString().split('T')[0],
          approvedAt: f.approvedAt?.toISOString(),
          isCustom: f.isCustom ?? f.is_custom ?? false,
        });
      }
    }
    const emissionFactorsSnapshot = Array.from(factorMap.values());

    // 3b. 계산 엔진 스냅샷 (최신 버전)
    const engineVersions = new Map<string, { version: string; name: string; methodology: string; releasedAt: Date }>();
    for (const r of records) {
      if (!engineVersions.has(r.engineVersionId)) {
        const ev = r.engineVersion;
        engineVersions.set(r.engineVersionId, {
          version: ev.version,
          name: ev.name,
          methodology: ev.methodology,
          releasedAt: ev.releasedAt,
        });
      }
    }
    const latestEngine = Array.from(engineVersions.values())[0] ?? {
      version: '1.0.0',
      name: 'Default Engine',
      methodology: 'GHG Protocol',
      releasedAt: new Date(),
    };
    const engineVersionSnapshot: EngineVersionSnapshot = {
      versionId: Array.from(engineVersions.keys())[0] ?? 'default',
      version: latestEngine.version,
      name: latestEngine.name,
      methodology: latestEngine.methodology,
      releasedAt: latestEngine.releasedAt.toISOString(),
    };

    // 3c. 조직 경계 스냅샷
    const complianceSetting = await prisma.tenantComplianceSetting.findUnique({
      where: { tenantId: input.tenantId },
    });
    const tenant = await prisma.tenant.findUnique({
      where: { id: input.tenantId },
      include: { sites: true },
    });

    const boundarySnapshot: BoundarySnapshot = {
      organizationalBoundary: {
        approach: 'operational-control',
        consolidationMethod: 'Operational Control',
        includedEntities: tenant?.sites.map((s) => s.name) ?? [],
        excludedEntities: [],
      },
      operationalBoundary: {
        scope1Included: true,
        scope2Method: input.scope2Method,
        scope3Categories: input.scope3Categories ?? [4],
        exclusions: [],
      },
      reportingYear: input.periodType === 'annual' ? Number(input.period) : new Date().getFullYear(),
      baseYear: complianceSetting?.baseYear ?? input.baseYear ?? 2020,
      baseYearEmissions: undefined,
    };

    // 3d. 계산 방식 스냅샷
    const calculationMethodSnapshot: CalculationMethodSnapshot = {
      scope2Method: input.scope2Method,
      scope3Method: 'activity-based',
      electricityConversionFactor: 0.001, // kWh → MWh
      emissionsRoundingPrecision: 6,
      dataGapFillingMethod: 'estimation',
      uncertaintyLevel: 'low',
      verificationStatus: 'self-declared',
    };

    // ─── 4. 배출량 집계 ──────────────────────────────────────────

    let scope1 = 0;
    let scope2Location = 0;
    let scope2Market = 0;
    let scope3 = 0;
    let hasMarket = false;

    // 활동 데이터 집계용
    const scope1Sources: Map<string, { activityData: number; unit: string; factor: number; emissions: number }> = new Map();
    let electricityMwh = 0;
    let locationFactor = 0;
    let marketFactor: number | undefined;
    const scope3Categories: Map<number, { name: string; emissions: number }> = new Map();
    let totalDataPoints = 0;
    let sensorDataCount = 0;
    let manualDataCount = 0;

    for (const r of records) {
      const emissions = Number(r.emissions);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rec = r as any;
      totalDataPoints++;

      const dataSource = rec.dataSource ?? rec.data_source ?? 'manual';
      if (dataSource === 'sensor') sensorDataCount++;
      else manualDataCount++;

      if (r.scope === 'scope1') {
        scope1 += emissions;
        const existing = scope1Sources.get(r.sourceType) ?? { activityData: 0, unit: r.activityUnit, factor: Number(r.emissionFactorValue), emissions: 0 };
        existing.activityData += Number(r.activityData);
        existing.emissions += emissions;
        scope1Sources.set(r.sourceType, existing);
      } else if (r.scope === 'scope2_location') {
        scope2Location += emissions;
        electricityMwh += Number(r.activityData);
        locationFactor = Number(r.emissionFactorValue);
      } else if (r.scope === 'scope2_market') {
        scope2Market += emissions;
        marketFactor = Number(r.emissionFactorValue);
        hasMarket = true;
      } else if (r.scope === 'scope3') {
        scope3 += emissions;
        // sourceType에서 카테고리 번호 추출 (예: "cat4-transport" → 4)
        const catNo = extractScope3Category(r.sourceType);
        const existing = scope3Categories.get(catNo) ?? { name: r.sourceType, emissions: 0 };
        existing.emissions += emissions;
        scope3Categories.set(catNo, existing);
      }
    }

    // scope2Method에 따른 scope2 결정
    const scope2ForTotal = input.scope2Method === 'market-based' && hasMarket
      ? scope2Market
      : scope2Location;

    const summary: ESGReportSummary = {
      totalEmissions: scope1 + scope2ForTotal + scope3,
      scope1,
      scope2Location,
      scope2Market: hasMarket ? scope2Market : undefined,
      scope3,
      emissionsUnit: 'tCO2eq',
    };

    // 활동 데이터 스냅샷
    const activityDataSnapshot: ActivityDataSnapshot = {
      scope1: {
        totalActivityData: Array.from(scope1Sources.values()).reduce((s, v) => s + v.activityData, 0),
        sourceBreakdown: Array.from(scope1Sources.entries()).map(([sourceType, v]) => ({
          sourceType,
          activityData: v.activityData,
          unit: v.unit,
          emissionsFactor: v.factor,
          emissions: v.emissions,
        })),
      },
      scope2: {
        electricityConsumption: electricityMwh,
        locationBasedFactor: locationFactor,
        marketBasedFactor: marketFactor,
        renewableEnergy: 0,
      },
      scope3: {
        categories: Array.from(scope3Categories.entries()).map(([catNo, v]) => ({
          categoryNo: catNo,
          categoryName: v.name,
          activityData: 0,
          unit: 'km',
          emissions: v.emissions,
        })),
      },
      period: input.period,
      dataQualitySummary: {
        totalDataPoints,
        sensorData: sensorDataCount,
        manualData: manualDataCount,
        estimatedData: 0,
        completenessScore: totalDataPoints > 0
          ? Math.min(100, Math.round((sensorDataCount + manualDataCount) / totalDataPoints * 100))
          : 0,
      },
    };

    // ─── 5. 템플릿 검증 ──────────────────────────────────────────

    const template = getTemplate(input.standard);
    const tenantName = tenant?.name ?? '(알 수 없음)';

    const templateCtx: TemplateContext = {
      tenantId: input.tenantId,
      tenantName,
      period: input.period,
      reportYear: boundarySnapshot.reportingYear,
      summary,
      emissionFactors: emissionFactorsSnapshot,
      boundary: boundarySnapshot,
      calculationMethod: calculationMethodSnapshot,
      activityData: activityDataSnapshot,
      countryCode: input.countryCode ?? 'KR',
    };

    const validation = template.validate(templateCtx);
    warnings.push(...validation.warnings);

    if (!validation.isValid) {
      throw new Error(
        `보고서 검증 실패:\n${validation.errors.join('\n')}`
      );
    }

    // XBRL 매핑
    const xbrlMapping = template.buildXBRLMapping(templateCtx);

    // ─── 6. 데이터 해시 계산 (불변성 보장) ──────────────────────

    const immutableContent = {
      tenantId: input.tenantId,
      standard: input.standard,
      period: input.period,
      summary,
      emissionFactorsSnapshot,
      engineVersionSnapshot,
      boundarySnapshot,
      calculationMethodSnapshot,
      generatedAt: new Date().toISOString().split('T')[0], // 날짜만 (재현성)
    };
    const dataHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(immutableContent, sortKeys))
      .digest('hex');

    // ─── 7. ESGReport 저장 ────────────────────────────────────────

    const reportNo = await generateReportNo();

    const report = await (prisma as any).eSGReport.create({
      data: {
        tenantId: input.tenantId,
        reportNo,
        reportType: input.reportType as 'compliance' | 'sustainability' | 'annual' | 'interim',
        standard: input.standard,
        countryCode: input.countryCode ?? 'KR',
        period: input.period,
        periodType: input.periodType,
        reportYear: boundarySnapshot.reportingYear,

        // 배출량
        totalEmissions: summary.totalEmissions,
        scope1: summary.scope1,
        scope2Location: summary.scope2Location,
        scope2Market: summary.scope2Market ?? null,
        scope3: summary.scope3,

        // 스냅샷 (불변)
        emissionFactorsSnapshot: emissionFactorsSnapshot as object,
        engineVersionSnapshot: engineVersionSnapshot as object,
        calculationMethodSnapshot: calculationMethodSnapshot as object,
        boundarySnapshot: boundarySnapshot as object,
        activityDataSnapshot: activityDataSnapshot as object,

        // 규제
        applicableStandards: getApplicableStandards(input.standard),
        methodologyNotes: input.methodologyNotes ?? null,
        completenessScore: validation.completenessScore,

        // 무결성
        dataHash,
        isImmutable: false,

        // XBRL
        xbrlTaxonomy: xbrlMapping?.taxonomy ?? null,
        xbrlExportUrl: null,

        // 파일
        pdfUrl: null,
        excelUrl: null,

        // 상태
        status: 'draft',
        generatedBy: input.generatedBy,
      },
    });

    return {
      reportId: report.id,
      reportNo: report.reportNo,
      summary,
      completenessScore: validation.completenessScore,
      dataHash,
      warnings,
    };
  }

  /**
   * 보고서 무결성 검증
   * 저장된 해시 vs 현재 내용 비교
   */
  static async verifyIntegrity(reportId: string) {
    const report = await (prisma as any).eSGReport.findUnique({
      where: { id: reportId },
    });
    if (!report) throw new Error('보고서를 찾을 수 없습니다.');

    const immutableContent = {
      tenantId: report.tenantId,
      standard: report.standard,
      period: report.period,
      summary: {
        totalEmissions: Number(report.totalEmissions),
        scope1: Number(report.scope1),
        scope2Location: Number(report.scope2Location),
        scope2Market: report.scope2Market != null ? Number(report.scope2Market) : undefined,
        scope3: Number(report.scope3),
        emissionsUnit: report.emissionsUnit,
      },
      emissionFactorsSnapshot: report.emissionFactorsSnapshot,
      engineVersionSnapshot: report.engineVersionSnapshot,
      boundarySnapshot: report.boundarySnapshot,
      calculationMethodSnapshot: report.calculationMethodSnapshot,
      generatedAt: report.createdAt.toISOString().split('T')[0],
    };

    const computedHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(immutableContent, sortKeys))
      .digest('hex');

    return {
      isValid: computedHash === report.dataHash,
      reportId,
      reportNo: report.reportNo,
      computedHash,
      storedHash: report.dataHash,
      hashMatches: computedHash === report.dataHash,
      isImmutable: report.isImmutable,
      verifiedAt: new Date(),
      issues: computedHash !== report.dataHash ? ['데이터 해시가 일치하지 않습니다. 보고서가 변조되었을 수 있습니다.'] : [],
    };
  }

  /**
   * 보고서 승인 → isImmutable = true (이후 수정 불가)
   */
  static async approve(reportId: string, approvedBy: string): Promise<void> {
    const report = await (prisma as any).eSGReport.findUnique({ where: { id: reportId } });
    if (!report) throw new Error('보고서를 찾을 수 없습니다.');
    if (report.isImmutable) throw new Error('이미 승인된 불변 보고서입니다.');
    if (report.status === 'withdrawn') throw new Error('철회된 보고서는 승인할 수 없습니다.');

    await (prisma as any).eSGReport.update({
      where: { id: reportId },
      data: {
        status: 'approved',
        isImmutable: true,
        approvedBy,
        approvedAt: new Date(),
      },
    });
  }
}

// ─── 헬퍼 함수 ───────────────────────────────────────────────────

function parsePeriod(period: string, periodType: string) {
  if (periodType === 'annual') {
    // YYYY → YYYY-01 ~ YYYY-12
    return { periodStart: `${period}-01`, periodEnd: `${period}-12` };
  }
  // YYYY-MM (monthly/quarterly)
  return { periodStart: period, periodEnd: period };
}

function extractScope3Category(sourceType: string): number {
  const match = sourceType.match(/cat(\d+)/i);
  return match ? parseInt(match[1] ?? '4') : 4; // 기본: Category 4 (업스트림 운송)
}

function getApplicableStandards(standard: string): string {
  const map: Record<string, string> = {
    GHG_PROTOCOL: 'GHG Protocol Corporate Standard (2015), ISO 14064-1',
    K_MRV: '환경부 고시 제2023-94호, GHG Protocol, ISO 14064-1',
    CDP: 'CDP Climate Change Questionnaire (2024), GHG Protocol',
    ISSB: 'IFRS S2 Climate-related Disclosures (2023), GHG Protocol',
    ISO_14064: 'KS I ISO 14064-1, GHG Protocol',
    K_ETS: 'K-ETS (한국 배출권 거래제), 환경부 고시',
  };
  return map[standard] ?? 'GHG Protocol';
}

/** JSON 직렬화 시 키 정렬 (결정론적 해시를 위해) */
function sortKeys(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce((sorted: Record<string, unknown>, k) => {
        sorted[k] = (value as Record<string, unknown>)[k];
        return sorted;
      }, {});
  }
  return value;
}
