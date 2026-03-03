/**
 * ESG Report DTOs
 * API 입출력 강 타입 정의
 */

import type {
  ESGReportType,
  ESGReportStatus,
  ESGStandard,
  PeriodType,
  Scope2Method,
  ESGReportSummary,
  ESGReportMetadata,
  EmissionFactorSnapshot,
  EngineVersionSnapshot,
  BoundarySnapshot,
  CalculationMethodSnapshot,
  ActivityDataSnapshot,
  IntegrityVerificationResult,
} from '../types/esg-report.types';

// ─── 보고서 생성 DTO ─────────────────────────────────────────────

export interface CreateESGReportDTO {
  reportType: ESGReportType;
  standard: ESGStandard;
  period: string;
  periodType: PeriodType;
  scope2Method: Scope2Method;
  scope3Categories?: number[];
  countryCode?: string;
  methodologyNotes?: string;
}

// ─── 보고서 응답 DTO ─────────────────────────────────────────────

export interface ESGReportListItemDTO {
  id: string;
  reportNo: string;
  reportType: ESGReportType;
  standard: ESGStandard;
  period: string;
  reportYear: number;
  status: ESGReportStatus;
  totalEmissions: number;
  scope1: number;
  scope2Location: number;
  scope2Market?: number;
  scope3: number;
  completenessScore?: number;
  isImmutable: boolean;
  pdfUrl?: string;
  excelUrl?: string;
  generatedBy: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
}

export interface ESGReportDetailDTO {
  // 기본 메타
  metadata: ESGReportMetadata;

  // 배출량 요약
  summary: ESGReportSummary;

  // ⭐ 스냅샷 (감사 추적)
  snapshots: {
    emissionFactors: EmissionFactorSnapshot[];
    engineVersion: EngineVersionSnapshot;
    calculationMethod: CalculationMethodSnapshot;
    boundary: BoundarySnapshot;
    activityData?: ActivityDataSnapshot;
  };

  // 파일 링크
  files: {
    pdfUrl?: string;
    excelUrl?: string;
    xbrlUrl?: string;
  };

  // 버전 이력
  revisionHistory?: ESGReportListItemDTO[];
}

// ─── 보고서 승인 DTO ─────────────────────────────────────────────

export interface ApproveESGReportDTO {
  approvedBy: string;
  approvalNotes?: string;
}

// ─── 보고서 검토 DTO ─────────────────────────────────────────────

export interface ReviewESGReportDTO {
  reviewedBy: string;
  reviewNotes?: string;
  issues?: string[];
}

// ─── 보고서 재발행 DTO ────────────────────────────────────────────

export interface ReissueESGReportDTO {
  reason: string;                 // 재발행 사유 (필수)
  updatedMethodologyNotes?: string;
  scope2Method?: Scope2Method;
}

// ─── 무결성 검증 응답 DTO ────────────────────────────────────────

export interface VerifyIntegrityResponseDTO extends IntegrityVerificationResult {
  reportNo: string;
  standard: string;
  period: string;
  status: ESGReportStatus;
}

// ─── 보고서 목록 조회 쿼리 DTO ──────────────────────────────────

export interface ESGReportListQueryDTO {
  reportYear?: number;
  standard?: ESGStandard;
  status?: ESGReportStatus;
  reportType?: ESGReportType;
  page?: number;
  pageSize?: number;
}

// ─── 표준별 필드 매핑 (Template 응답) ────────────────────────────

export interface ESGTemplateFieldDTO {
  fieldId: string;
  fieldName: string;              // 표준 내 필드명 (e.g., "C6.1")
  label: string;                  // 한국어 레이블
  dataType: 'number' | 'string' | 'percentage' | 'date';
  unit?: string;
  required: boolean;
  value?: number | string;        // 계산된 값
  xbrlElement?: string;          // XBRL 매핑 (ISSB/CDP)
}

export interface ESGTemplateDTO {
  standard: ESGStandard;
  version: string;
  sections: Array<{
    sectionId: string;
    sectionName: string;
    fields: ESGTemplateFieldDTO[];
  }>;
}
