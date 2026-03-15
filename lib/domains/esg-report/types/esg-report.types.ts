/**
 * ESG Report Domain Types
 * Big4 감사 대응 엔터프라이즈급 탄소 보고 시스템
 */

// ─── 보고서 유형 ───────────────────────────────────────────────────

export type ESGReportType = 'compliance' | 'sustainability' | 'annual' | 'interim';

export type ESGReportStatus = 'draft' | 'in_review' | 'approved' | 'published' | 'withdrawn';

// 지원 표준
export type ESGStandard =
  | 'GHG_PROTOCOL'   // GHG Protocol Corporate Standard
  | 'K_MRV'          // 한국 환경부 K-MRV (온실가스 명세서)
  | 'CDP'            // CDP Climate Disclosure
  | 'ISSB'           // ISSB IFRS S2 (기후 공시)
  | 'ISO_14064'      // KS I ISO 14064-1
  | 'K_ETS'          // 한국 배출권 거래제 (K-ETS)
  | 'TCFD'           // TCFD (Task Force on Climate-related Financial Disclosures) 11개 권고공시
  | 'CSRD'           // EU CSRD / ESRS E1 (European Sustainability Reporting Standards)
  | 'US_SEC';        // US SEC Climate Disclosure Rules (2024 Final Rules)

// 8대 표준 섹션 ID (모든 템플릿 공통 구조)
export type StandardSectionId =
  | 'company_profile'           // 1. 기업 프로필
  | 'organizational_boundary'   // 2. 조직 경계
  | 'operational_boundary'      // 3. 운영 경계
  | 'emission_summary'          // 4. 배출량 요약
  | 'emission_factors'          // 5. 배출계수
  | 'activity_data_source'      // 6. 활동 데이터 출처
  | 'calculation_methodology'   // 7. 계산 방법론
  | 'reduction_target';         // 8. 감축 목표

// 보고 기간 유형
export type PeriodType = 'annual' | 'quarterly' | 'monthly';

// Scope 2 계산 방식
export type Scope2Method = 'location-based' | 'market-based' | 'dual'; // dual = 둘 다 보고

// ─── 스냅샷 타입 (Audit Evidence) ─────────────────────────────────

/**
 * 사용된 배출계수 스냅샷 (보고서 생성 시점 불변 기록)
 */
export interface EmissionFactorSnapshot {
  factorId: string;
  code: string;
  category: string;
  sourceType: string;
  factor: number;
  unit: string;
  version: string;
  source: string;         // 출처 (환경부, IPCC 등)
  year: number;
  validFrom: string;      // ISO Date string
  validTo?: string;
  approvedAt?: string;
  isCustom: boolean;
}

/**
 * 계산 엔진 버전 스냅샷
 */
export interface EngineVersionSnapshot {
  versionId: string;
  version: string;        // e.g., "2.1.0"
  name: string;
  methodology: string;    // GHG Protocol, K-MRV, etc.
  releasedAt: string;
  formula?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
}

/**
 * 조직 경계 & 운영 경계 스냅샷
 */
export interface BoundarySnapshot {
  organizationalBoundary: {
    approach: 'equity-share' | 'financial-control' | 'operational-control';
    consolidationMethod: string;
    includedEntities: string[];     // Tenant의 사업장 목록
    excludedEntities: string[];
  };
  operationalBoundary: {
    scope1Included: boolean;
    scope2Method: Scope2Method;
    scope3Categories: number[];     // Category 1-15
    exclusions: string[];           // 제외된 emission source
    exclusionReason?: string;
  };
  reportingYear: number;
  baseYear: number;
  baseYearEmissions?: number;
}

/**
 * 활동 데이터 집계 스냅샷 (원본 데이터 요약)
 */
export interface ActivityDataSnapshot {
  scope1: {
    totalActivityData: number;
    sourceBreakdown: Array<{
      sourceType: string;
      activityData: number;
      unit: string;
      emissionsFactor: number;
      emissions: number;
    }>;
  };
  scope2: {
    electricityConsumption: number; // MWh
    locationBasedFactor: number;
    marketBasedFactor?: number;
    renewableEnergy?: number;       // MWh (PPA/REC)
  };
  scope3: {
    categories: Array<{
      categoryNo: number;           // 1-15 (GHG Protocol Category)
      categoryName: string;
      activityData: number;
      unit: string;
      emissions: number;
    }>;
  };
  period: string;                   // YYYY or YYYY-MM
  dataQualitySummary: {
    totalDataPoints: number;
    sensorData: number;             // count
    manualData: number;
    estimatedData: number;
    completenessScore: number;      // 0-100%
  };
}

// ─── 계산 방식 스냅샷 ─────────────────────────────────────────────

export interface CalculationMethodSnapshot {
  scope2Method: Scope2Method;
  scope3Method: 'activity-based' | 'spend-based' | 'hybrid';
  electricityConversionFactor: number;   // kWh → MWh
  emissionsRoundingPrecision: number;    // 소수점 자리
  dataGapFillingMethod: 'interpolation' | 'estimation' | 'exclusion';
  uncertaintyLevel: 'low' | 'medium' | 'high';
  verificationStatus: 'self-declared' | 'third-party-verified' | 'limited-assurance' | 'reasonable-assurance';
}

// ─── 보고서 내용 구조 ─────────────────────────────────────────────

export interface ESGReportSummary {
  totalEmissions: number;     // tCO2eq
  scope1: number;
  scope2Location: number;
  scope2Market?: number;
  scope3: number;
  emissionsUnit: 'tCO2eq';
  yoyChangePercent?: number;  // 전년 대비 변화율
}

export interface ESGReportMetadata {
  id: string;
  reportNo: string;
  reportType: ESGReportType;
  standard: ESGStandard;
  countryCode: string;
  period: string;
  periodType: PeriodType;
  reportYear: number;
  status: ESGReportStatus;
  isImmutable: boolean;
  completenessScore?: number;
  applicableStandards: string;
  revisionNumber: number;
  generatedBy: string;
  approvedBy?: string;
  createdAt: Date;
  approvedAt?: Date;
}

// ─── XBRL 타입 ───────────────────────────────────────────────────

export interface XBRLMappingEntry {
  xbrlElement: string;        // e.g., "ifrs-full:GrossEmissionsScope1"
  taxonomy: string;           // e.g., "ifrs-full"
  value: number | string;
  unit?: string;
  period: string;
  contextRef?: string;
}

export interface XBRLMapping {
  taxonomy: string;           // 'ifrs-full' | 'ghg-protocol' | 'cdp'
  version: string;
  entries: XBRLMappingEntry[];
}

// ─── 보고서 생성 입력 ─────────────────────────────────────────────

export interface GenerateESGReportInput {
  tenantId: string;
  reportType: ESGReportType;
  standard: ESGStandard;
  period: string;             // YYYY or YYYY-MM
  periodType: PeriodType;
  scope2Method: Scope2Method;
  scope3Categories?: number[];
  countryCode?: string;
  baseYear?: number;
  methodologyNotes?: string;
  generatedBy: string;        // userId
}

export interface GenerateESGReportOutput {
  reportId: string;
  reportNo: string;
  summary: ESGReportSummary;
  completenessScore: number;
  dataHash: string;
  pdfUrl?: string;
  excelUrl?: string;
  warnings: string[];         // 데이터 품질 경고
}

// ─── 검증 결과 ───────────────────────────────────────────────────

export interface IntegrityVerificationResult {
  isValid: boolean;
  reportId: string;
  reportNo: string;
  computedHash: string;
  storedHash: string;
  hashMatches: boolean;
  isImmutable: boolean;
  verifiedAt: Date;
  issues: string[];           // 무결성 이슈 목록
}
