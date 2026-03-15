/**
 * ReportDataSourceService
 * 리포트에 사용된 원본 데이터 출처 추적 (데이터 계보/Lineage)
 *
 * Big4 감사 대응:
 * - 어떤 EmissionsRecord가 이 보고서에 사용됐는가
 * - 데이터 품질 등급 (sensor/manual/estimated)
 * - 스코프별 활동 데이터 집계
 */

import { prisma } from '@/lib/db/prisma';

const db = prisma as any; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface DataSourceRecord {
  reportId: string;
  tenantId: string;
  sourceType: 'emissions_record' | 'manual_input' | 'invoice' | 'meter_reading';
  sourceId: string;
  scope: string;
  period: string;
  activityData: number;
  activityUnit: string;
  emissions: number;
  dataQuality: 'sensor' | 'manual' | 'estimated';
  metadata?: Record<string, unknown>;
}

export interface ReportDataSource {
  id: string;
  reportId: string;
  tenantId: string;
  sourceType: string;
  sourceId: string;
  scope: string;
  period: string;
  activityData: number;
  activityUnit: string;
  emissions: number;
  dataQuality: string;
  metadata: unknown;
  createdAt: Date;
}

export class ReportDataSourceService {
  /**
   * EmissionsRecord 목록을 ReportDataSource로 일괄 기록
   */
  static async recordSources(
    reportId: string,
    tenantId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    records: any[]
  ): Promise<void> {
    if (records.length === 0) return;

    const data = records.map((r) => ({
      reportId,
      tenantId,
      sourceType: 'emissions_record',
      sourceId: r.id,
      scope: r.scope,
      period: r.period,
      activityData: Number(r.activityData),
      activityUnit: r.activityUnit,
      emissions: Number(r.emissions),
      dataQuality: (r.dataSource ?? r.data_source ?? 'manual') as string,
    }));

    // createMany: MySQL 지원
    await db.reportDataSource.createMany({ data });
  }

  /**
   * 보고서의 데이터 출처 조회
   */
  static async getSources(reportId: string): Promise<ReportDataSource[]> {
    const rows = await db.reportDataSource.findMany({
      where: { reportId },
      orderBy: [{ scope: 'asc' }, { createdAt: 'asc' }],
    });

    return rows.map((r: any) => ({
      ...r,
      activityData: Number(r.activityData),
      emissions: Number(r.emissions),
    }));
  }

  /**
   * 스코프별 집계
   */
  static async getSummaryByScope(reportId: string) {
    const sources = await ReportDataSourceService.getSources(reportId);
    const byScope = new Map<string, { count: number; emissions: number; sensorCount: number }>();

    for (const s of sources) {
      const existing = byScope.get(s.scope) ?? { count: 0, emissions: 0, sensorCount: 0 };
      existing.count++;
      existing.emissions += s.emissions;
      if (s.dataQuality === 'sensor') existing.sensorCount++;
      byScope.set(s.scope, existing);
    }

    return Object.fromEntries(byScope.entries());
  }
}
