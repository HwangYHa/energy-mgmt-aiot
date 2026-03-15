/**
 * ESGJsonExporter
 * 리포트를 JSON 형식으로 내보내기
 *
 * 출력 구조:
 * {
 *   formatVersion: "1.0"
 *   exportedAt: ISO 8601
 *   metadata: { reportNo, standard, period, status, ... }
 *   summary: { scope1, scope2Location, scope2Market, scope3, total }
 *   sections: [ { sectionId, title, fields: [...] } ]
 *   snapshots: { emissionFactors, engineVersion, boundary, calculationMethod, activityData }
 *   integrity: { dataHash, isImmutable, verifiedAt }
 * }
 *
 * Big4 감사 활용:
 * - JSON 형식으로 감사관에게 직접 제공 가능
 * - 스냅샷 포함으로 계산 재현 가능
 * - dataHash로 무결성 검증 가능
 */

import type { ReportSection } from '../templates/base.template';
import type {
  EmissionFactorSnapshot,
  EngineVersionSnapshot,
  BoundarySnapshot,
  CalculationMethodSnapshot,
  ActivityDataSnapshot,
} from '../types/esg-report.types';

// ─── 출력 타입 ──────────────────────────────────────────────────────────────

export interface ESGReportJsonExport {
  /** 형식 버전 — 변경 시 breaking change */
  formatVersion: '1.0';
  exportedAt: string;    // ISO 8601

  /** 보고서 메타데이터 */
  metadata: {
    reportId: string;
    reportNo: string;
    standard: string;
    period: string;
    periodType: string;
    reportYear: number;
    countryCode: string;
    reportType: string;
    status: string;
    isImmutable: boolean;
    revisionNumber: number;
    generatedBy: string;
    approvedBy: string | null;
    approvedAt: string | null;
    createdAt: string;
  };

  /** 배출량 요약 (tCO2eq) */
  summary: {
    totalEmissions: number;
    scope1: number;
    scope2Location: number;
    scope2Market: number | null;
    scope3: number;
    unit: 'tCO2eq';
    completenessScore: number | null;
  };

  /** 보고서 섹션 (템플릿별 구조) */
  sections: Array<{
    sectionId: string;
    title: string;
    fields: Array<{
      fieldId: string;
      label: string;
      value: string | number | null;
      unit?: string;
      required: boolean;
    }>;
  }>;

  /** 감사 스냅샷 (계산 재현용 불변 증거) */
  snapshots: {
    emissionFactors: EmissionFactorSnapshot[];
    engineVersion: EngineVersionSnapshot | null;
    boundary: BoundarySnapshot | null;
    calculationMethod: CalculationMethodSnapshot | null;
    activityData: ActivityDataSnapshot | null;
  };

  /** 무결성 */
  integrity: {
    dataHash: string;
    isImmutable: boolean;
    hashAlgorithm: 'SHA-256';
  };
}

// ─── Exporter ───────────────────────────────────────────────────────────────

export class ESGJsonExporter {
  /**
   * 리포트 DB 레코드 + 섹션 → JSON export 생성
   * @param report  Prisma ESGReport 레코드 (any 타입으로 처리)
   * @param sections  템플릿에서 생성된 ReportSection[]
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static export(report: any, sections: ReportSection[]): ESGReportJsonExport {
    const summary: ESGReportJsonExport['summary'] = {
      totalEmissions: Number(report.totalEmissions),
      scope1: Number(report.scope1),
      scope2Location: Number(report.scope2Location),
      scope2Market: report.scope2Market != null ? Number(report.scope2Market) : null,
      scope3: Number(report.scope3),
      unit: 'tCO2eq',
      completenessScore: report.completenessScore != null ? Number(report.completenessScore) : null,
    };

    return {
      formatVersion: '1.0',
      exportedAt: new Date().toISOString(),

      metadata: {
        reportId: report.id,
        reportNo: report.reportNo,
        standard: report.standard,
        period: report.period,
        periodType: report.periodType,
        reportYear: report.reportYear,
        countryCode: report.countryCode,
        reportType: report.reportType,
        status: report.status,
        isImmutable: report.isImmutable,
        revisionNumber: report.revisionNumber,
        generatedBy: report.generatedBy,
        approvedBy: report.approvedBy ?? null,
        approvedAt: report.approvedAt ? new Date(report.approvedAt).toISOString() : null,
        createdAt: new Date(report.createdAt).toISOString(),
      },

      summary,

      sections: sections.map((s) => ({
        sectionId: s.sectionId,
        title: s.title,
        fields: s.fields.map((f) => ({
          fieldId: f.fieldId,
          label: f.label,
          value: f.value,
          unit: f.unit,
          required: f.required,
        })),
      })),

      snapshots: {
        emissionFactors: (report.emissionFactorsSnapshot as EmissionFactorSnapshot[]) ?? [],
        engineVersion: (report.engineVersionSnapshot as EngineVersionSnapshot) ?? null,
        boundary: (report.boundarySnapshot as BoundarySnapshot) ?? null,
        calculationMethod: (report.calculationMethodSnapshot as CalculationMethodSnapshot) ?? null,
        activityData: (report.activityDataSnapshot as ActivityDataSnapshot) ?? null,
      },

      integrity: {
        dataHash: report.dataHash,
        isImmutable: report.isImmutable,
        hashAlgorithm: 'SHA-256',
      },
    };
  }
}
