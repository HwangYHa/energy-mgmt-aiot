/**
 * ESG Report Base Template
 * 모든 표준 템플릿의 공통 인터페이스 및 기본 구현
 */

import type {
  ESGStandard,
  ESGReportSummary,
  EmissionFactorSnapshot,
  BoundarySnapshot,
  CalculationMethodSnapshot,
  ActivityDataSnapshot,
  XBRLMapping,
} from '../types/esg-report.types';
import type { ESGTemplateDTO } from '../dtos/esg-report.dto';

// ─── 템플릿 입력 컨텍스트 ────────────────────────────────────────

export interface TemplateContext {
  tenantId: string;
  tenantName: string;
  period: string;
  reportYear: number;
  summary: ESGReportSummary;
  emissionFactors: EmissionFactorSnapshot[];
  boundary: BoundarySnapshot;
  calculationMethod: CalculationMethodSnapshot;
  activityData?: ActivityDataSnapshot;
  countryCode: string;
  baseYearEmissions?: number;
}

// ─── 검증 결과 ───────────────────────────────────────────────────

export interface TemplateValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  completenessScore: number; // 0-100%
}

// ─── 보고서 섹션 ─────────────────────────────────────────────────

export interface ReportSection {
  sectionId: string;
  title: string;
  subsections?: ReportSection[];
  fields: ReportField[];
}

export interface ReportField {
  fieldId: string;
  label: string;
  value: string | number | null;
  unit?: string;
  required: boolean;
  xbrlElement?: string;
  notes?: string;
}

// ─── 추상 기반 템플릿 ─────────────────────────────────────────────

export abstract class BaseReportTemplate {
  abstract readonly standard: ESGStandard;
  abstract readonly version: string;
  abstract readonly displayName: string;
  abstract readonly countryCode: string; // '*' = 다국가

  /**
   * 보고서 섹션 생성 (각 표준마다 다름)
   */
  abstract buildSections(ctx: TemplateContext): ReportSection[];

  /**
   * 데이터 완전성 검증
   */
  abstract validate(ctx: TemplateContext): TemplateValidationResult;

  /**
   * XBRL 매핑 생성 (선택 - ISSB/CDP만 필수 구현)
   */
  buildXBRLMapping(_ctx: TemplateContext): XBRLMapping | null {
    return null; // 기본값: XBRL 없음
  }

  /**
   * 템플릿 구조 반환 (필드 정의 + 계산값 포함)
   */
  toDTO(ctx: TemplateContext): ESGTemplateDTO {
    const sections = this.buildSections(ctx);
    return {
      standard: this.standard,
      version: this.version,
      sections: sections.map((s) => ({
        sectionId: s.sectionId,
        sectionName: s.title,
        fields: s.fields.map((f) => ({
          fieldId: f.fieldId,
          fieldName: f.fieldId,
          label: f.label,
          dataType: typeof f.value === 'number' ? 'number' : 'string',
          unit: f.unit,
          required: f.required,
          value: f.value ?? undefined,
          xbrlElement: f.xbrlElement,
        })),
      })),
    };
  }

  // ─── 공통 헬퍼 ────────────────────────────────────────────────

  protected formatEmissions(value: number, precision = 3): string {
    return value.toFixed(precision);
  }

  protected calcScope2Total(summary: ESGReportSummary, method: 'location' | 'market'): number {
    if (method === 'market' && summary.scope2Market != null) {
      return summary.scope2Market;
    }
    return summary.scope2Location;
  }

  protected calcTotalWithMethod(
    summary: ESGReportSummary,
    method: 'location' | 'market'
  ): number {
    const scope2 = this.calcScope2Total(summary, method);
    return summary.scope1 + scope2 + summary.scope3;
  }

  protected requiredField(value: string | number | null, label: string): TemplateValidationResult {
    if (value === null || value === undefined || value === '') {
      return { isValid: false, errors: [`필수 항목 누락: ${label}`], warnings: [], completenessScore: 0 };
    }
    return { isValid: true, errors: [], warnings: [], completenessScore: 100 };
  }
}
