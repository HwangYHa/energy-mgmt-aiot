/**
 * ReportDataCollector
 * ReportEngine에서 데이터 수집 책임을 분리한 독립 서비스
 *
 * 역할:
 * - EmissionsRecord 조회 (기간 기반)
 * - 조직 경계 수집 (TenantComplianceSetting)
 * - 배출계수 스냅샷 빌드
 * - 활동 데이터 스냅샷 빌드
 * - 계산 엔진 버전 스냅샷 빌드
 *
 * 기존 ReportEngine과 병렬 운영 — 기존 코드 무수정
 */

import { prisma } from '@/lib/db/prisma';
import type {
  EmissionFactorSnapshot,
  EngineVersionSnapshot,
  BoundarySnapshot,
  ActivityDataSnapshot,
} from '../types/esg-report.types';

const db = prisma as any; // eslint-disable-line @typescript-eslint/no-explicit-any

export class ReportDataCollector {
  /**
   * 기간 내 EmissionsRecord 조회 (emissionFactor + engineVersion 포함)
   */
  static async collectEmissionsRecords(
    tenantId: string,
    periodStart: string,
    periodEnd: string
  ) {
    return db.emissionsRecord.findMany({
      where: {
        tenantId,
        period: { gte: periodStart, lte: periodEnd },
        isArchived: false,
      },
      include: {
        emissionFactor: true,
        engineVersion: true,
      },
    });
  }

  /**
   * 조직/운영 경계 스냅샷 수집
   */
  static async collectBoundary(
    tenantId: string,
    opts: { scope2Method?: string; scope3Categories?: number[]; baseYear?: number } = {}
  ): Promise<BoundarySnapshot> {
    const [complianceSetting, tenant] = await Promise.all([
      db.tenantComplianceSetting.findUnique({ where: { tenantId } }),
      db.tenant.findUnique({ where: { id: tenantId }, include: { sites: true } }),
    ]);

    return {
      organizationalBoundary: {
        approach: 'operational-control',
        consolidationMethod: 'Operational Control',
        includedEntities: tenant?.sites?.map((s: any) => s.name) ?? [],
        excludedEntities: [],
      },
      operationalBoundary: {
        scope1Included: true,
        scope2Method: (opts.scope2Method ?? 'location-based') as any,
        scope3Categories: opts.scope3Categories ?? [4],
        exclusions: [],
      },
      reportingYear: new Date().getFullYear(),
      baseYear: complianceSetting?.baseYear ?? opts.baseYear ?? 2020,
    };
  }

  /**
   * 배출계수 스냅샷 (중복 제거, version 포함)
   */
  static buildFactorSnapshot(records: any[]): EmissionFactorSnapshot[] {
    const factorMap = new Map<string, EmissionFactorSnapshot>();
    for (const r of records) {
      if (!factorMap.has(r.emissionFactorId)) {
        const f = r.emissionFactor as any;
        factorMap.set(r.emissionFactorId, {
          factorId: f.id,
          code: f.code ?? f.factorCode ?? '',
          category: f.category,
          sourceType: f.sourceType ?? f.source_type ?? '',
          factor: Number(f.factor),
          unit: f.unit,
          version: String(f.version ?? '1.0.0'),
          source: f.source ?? f.sourceName ?? '',
          year: f.year ?? new Date().getFullYear(),
          validFrom: f.validFrom ? new Date(f.validFrom).toISOString().slice(0, 10) : '',
          validTo: f.validTo ? new Date(f.validTo).toISOString().split('T')[0] : undefined,
          approvedAt: f.approvedAt ? new Date(f.approvedAt).toISOString() : undefined,
          isCustom: f.isCustom ?? f.is_custom ?? false,
        });
      }
    }
    return Array.from(factorMap.values());
  }

  /**
   * 계산 엔진 버전 스냅샷 (최신 버전)
   */
  static buildEngineSnapshot(records: any[]): EngineVersionSnapshot {
    const versionMap = new Map<string, any>();
    for (const r of records) {
      if (!versionMap.has(r.engineVersionId)) {
        versionMap.set(r.engineVersionId, r.engineVersion);
      }
    }
    const latest = Array.from(versionMap.values())[0] ?? {
      id: 'default',
      version: '1.0.0',
      name: 'Default Engine',
      methodology: 'GHG Protocol',
      releasedAt: new Date(),
    };

    return {
      versionId: latest.id ?? 'default',
      version: latest.version,
      name: latest.name,
      methodology: latest.methodology,
      releasedAt: new Date(latest.releasedAt).toISOString(),
    };
  }

  /**
   * 활동 데이터 스냅샷 빌드
   */
  static buildActivitySnapshot(records: any[], period: string): ActivityDataSnapshot {
    let scope1Total = 0;
    let electricityMwh = 0;
    let locationFactor = 0;
    let marketFactor: number | undefined;
    let totalDataPoints = 0;
    let sensorCount = 0;
    let manualCount = 0;

    const scope1Sources = new Map<string, { activityData: number; unit: string; factor: number; emissions: number }>();
    const scope3Categories = new Map<number, { name: string; emissions: number }>();

    for (const r of records) {
      const emissions = Number(r.emissions);
      const dataSource = r.dataSource ?? r.data_source ?? 'manual';
      totalDataPoints++;
      if (dataSource === 'sensor' || dataSource === 'SENSOR') sensorCount++;
      else manualCount++;

      if (r.scope === 'scope1') {
        scope1Total += Number(r.activityData);
        const key = r.sourceType;
        const ex = scope1Sources.get(key) ?? { activityData: 0, unit: r.activityUnit, factor: Number(r.emissionFactorValue), emissions: 0 };
        ex.activityData += Number(r.activityData);
        ex.emissions += emissions;
        scope1Sources.set(key, ex);
      } else if (r.scope === 'scope2_location') {
        electricityMwh += Number(r.activityData);
        locationFactor = Number(r.emissionFactorValue);
      } else if (r.scope === 'scope2_market') {
        marketFactor = Number(r.emissionFactorValue);
      } else if (r.scope === 'scope3') {
        const catNo = extractCatNo(r.sourceType);
        const ex = scope3Categories.get(catNo) ?? { name: r.sourceType, emissions: 0 };
        ex.emissions += emissions;
        scope3Categories.set(catNo, ex);
      }
    }

    return {
      scope1: {
        totalActivityData: scope1Total,
        sourceBreakdown: Array.from(scope1Sources.entries()).map(([sourceType, v]) => ({
          sourceType, activityData: v.activityData, unit: v.unit, emissionsFactor: v.factor, emissions: v.emissions,
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
      period,
      dataQualitySummary: {
        totalDataPoints,
        sensorData: sensorCount,
        manualData: manualCount,
        estimatedData: 0,
        completenessScore: totalDataPoints > 0
          ? Math.min(100, Math.round((sensorCount + manualCount) / totalDataPoints * 100))
          : 0,
      },
    };
  }
}

function extractCatNo(sourceType: string): number {
  const m = sourceType.match(/cat(\d+)/i);
  return m ? parseInt(m[1]!) : 4;
}
