/**
 * Carbon Emission Domain Types
 * 탄소 배출 도메인의 핵심 타입 정의
 */

/**
 * 배출 스코프 (GHG Protocol 기준)
 * - scope1: 직접 연소 (LNG, 경유 등)
 * - scope2_location: 전력망 지역기반 (한전 연간 배출계수)
 * - scope2_market: 전력망 시장기반 (REC, PPA 반영)
 * - scope3: 간접 배출 (운송, 공급망)
 */
export type EmissionScope =
  | 'scope1'
  | 'scope2_location'
  | 'scope2_market'
  | 'scope3';

/**
 * 활동 데이터 출처
 * - sensor: 센서로부터 자동 수집
 * - manual: 사용자 수동 입력
 * - invoice: 청구서 기반 입력
 */
export type DataSource = 'sensor' | 'manual' | 'invoice';

/**
 * 배출계수 변경 유형 (감사 로그용)
 * - CREATED: 신규 버전 생성 (승인 대기)
 * - UPDATED: 기존 버전 수정
 * - APPROVED: 버전 승인 (활성화)
 * - DEPRECATED: 버전 폐지
 */
export type ChangeType = 'CREATED' | 'UPDATED' | 'APPROVED' | 'DEPRECATED';

/**
 * 배출량 계산 방식
 * - location-based: 지역 전력망 평균 배출계수 사용
 * - market-based: 재생에너지 인증서 등 반영
 */
export type CalculationMethod = 'location-based' | 'market-based';

/**
 * 데이터 품질 등급
 * - good: 검증된 신뢰도 높은 데이터
 * - uncertain: 추정 또는 부분적 데이터
 */
export type DataQuality = 'good' | 'uncertain';

/**
 * 배출계수 활성화 상태
 * - draft: 작성 중 (아직 승인 전)
 * - pending: 승인 대기 중
 * - active: 활성화 (사용 중)
 * - deprecated: 폐지됨
 */
export type EmissionFactorStatus = 'draft' | 'pending' | 'active' | 'deprecated';

/**
 * 계산 결과 상태
 * - completed: 정상 완료
 * - error: 오류 발생
 * - archived: 아카이브됨 (재계산으로 인한 이전 기록)
 */
export type CalculationStatus = 'completed' | 'error' | 'archived';

/**
 * 보고서 타입
 * - compliance: 규제 준수 보고서 (정부 제출용)
 * - sustainability: ESG 지속가능성 보고서 (외부 공시)
 * - annual: 연간 종합 보고서
 */
export type ReportType = 'compliance' | 'sustainability' | 'annual';

/**
 * 배출계수 근거 문서
 */
export interface EmissionFactorSource {
  /** 출처 기관 (환경부, 한전, IPCC 등) */
  source: string;
  /** 근거 연도 */
  year: number;
  /** 지역 (KR, US, EU 등) */
  region: string;
  /** 출처 설명 */
  description?: string;
  /** 근거 문서 URL */
  documentUrl?: string;
}

/**
 * 배출계수 값 및 단위
 */
export interface EmissionFactorValue {
  /** 배출계수 값 (수치) */
  value: number;
  /** 배출 단위 (tCO2eq/MWh, tCO2eq/L 등) */
  emissionUnit: string;
  /** 입력 단위 (MWh, L, km 등) */
  inputUnit: string;
}

/**
 * 배출계수 유효기간
 */
export interface EffectivePeriod {
  /** 유효 시작일 */
  from: Date;
  /** 유효 종료일 (null이면 무한대) */
  to?: Date | null;
}

/**
 * 배출계수 버전 정보 (Semantic Versioning)
 * 예: 1.0.0 (major.minor.patch)
 * - major: 규제 변경 등으로 인한 체계 변경
 * - minor: 배출계수 값 변경
 * - patch: 설명/메타 정보 변경
 */
export interface VersionInfo {
  /** Semantic Version (1.0.0, 1.1.0, 2.0.0) */
  version: string;
  /** 이전 버전 ID (버전 체인 추적) */
  parentVersionId?: string;
  /** 변경 사유 */
  changeReason?: string;
}

/**
 * 배출계수 승인 워크플로우
 */
export interface ApprovalWorkflow {
  /** 생성자 User ID */
  createdBy?: string;
  /** 생성 시간 */
  createdAt: Date;
  /** 승인자 User ID (null이면 아직 승인 안 됨) */
  approvedBy?: string | null;
  /** 승인 시간 */
  approvedAt?: Date | null;
}

/**
 * 배출계수 카테고리 분류
 */
export const EMISSION_CATEGORIES = {
  ELECTRICITY: 'electricity',
  FUEL_COMBUSTION: 'fuel_combustion',
  TRANSPORTATION: 'transportation',
  WASTE: 'waste',
  AGRICULTURE: 'agriculture',
  PROCESS: 'process',
} as const;

export type EmissionCategory = typeof EMISSION_CATEGORIES[keyof typeof EMISSION_CATEGORIES];

/**
 * 배출계수 하위 분류 (sourceType)
 * 예: electricity → 한전 그리드, 자가발전 등
 */
export const EMISSION_SOURCE_TYPES = {
  // Electricity
  GRID_KOREA: 'grid-korea',
  GRID_EU: 'grid-eu',
  GRID_CHINA: 'grid-china',
  RENEWABLE_PPA: 'renewable-ppa',
  REC_CERTIFICATE: 'rec-certificate',

  // Fuel
  LNG: 'lng',
  DIESEL: 'diesel',
  GASOLINE: 'gasoline',
  COAL: 'coal',
  BIOMASS: 'biomass',

  // Transportation
  AIR_DOMESTIC: 'air-domestic',
  AIR_INTERNATIONAL: 'air-international',
  CAR_SEDAN: 'car-sedan',
  CAR_SUV: 'car-suv',
  BUS: 'bus',
  TRAIN: 'train',
  SHIP: 'ship',
  TRUCK: 'truck',

  // Waste
  WASTE_LANDFILL: 'waste-landfill',
  WASTE_INCINERATION: 'waste-incineration',
  WASTE_RECYCLING: 'waste-recycling',
} as const;

export type EmissionSourceType = typeof EMISSION_SOURCE_TYPES[keyof typeof EMISSION_SOURCE_TYPES];

/**
 * 테넌트별 커스텀 배출계수 식별
 */
export interface TenantCustomFactor {
  /** 테넌트 ID */
  tenantId: string;
  /** 글로벌 기본값 여부 (false면 테넌트 커스텀) */
  isGlobal: boolean;
  /** 우선순위 (높을수록 먼저 사용됨) */
  priority: number;
}

/**
 * 배출량 계산 활동 데이터
 */
export interface ActivityData {
  /** 활동량 (수치) */
  value: number;
  /** 활동 단위 (kWh, L, km, kg 등) */
  unit: string;
  /** 데이터 출처 */
  source: DataSource;
  /** 데이터 수집 시간 */
  collectedAt: Date;
  /** 원본 활동 데이터 스냅샷 (감사 추적용) */
  snapshot?: Record<string, any>;
}

/**
 * 배출량 계산 결과
 */
export interface CalculationResult {
  /** 계산된 배출량 */
  emissions: number;
  /** 배출 단위 (항상 tCO2eq) */
  unit: 'tCO2eq';
  /** 계산에 사용된 배출계수 버전 */
  factorVersion: string;
  /** 계산에 사용된 엔진 버전 */
  engineVersion: string;
  /** 계산 방식 */
  calculationMethod: CalculationMethod;
  /** 계산 시간 */
  calculatedAt: Date;
  /** 재현성을 위한 모든 입력 파라미터 저장 */
  inputSnapshot: Record<string, any>;
}

/**
 * 해시 체인 감사 로그 엔트리
 */
export interface AuditLogEntry {
  /** 로그 ID */
  id: string;
  /** 배출계수 ID */
  emissionFactorId: string;
  /** 변경 유형 */
  changeType: ChangeType;
  /** 변경 사유 */
  reason?: string;
  /** 이전 값 (null이면 신규 생성) */
  oldValue?: number;
  /** 새 값 */
  newValue?: number;
  /** 이전 로그의 해시값 (null이면 첫 로그) */
  previousHash?: string;
  /** 현재 로그의 SHA-256 해시 */
  currentHash: string;
  /** 요청자 */
  requestedBy: string;
  /** 요청 시간 */
  requestedAt: Date;
  /** 승인자 (null이면 미승인) */
  approvedBy?: string | null;
  /** 승인 시간 */
  approvedAt?: Date | null;
}

/**
 * 계산 엔진 버전 메타정보
 */
export interface CalculationEngineMetadata {
  /** 엔진 버전 (1.0.0, 1.1.0 등) */
  version: string;
  /** 방법론 이름 (GHG Protocol, ISO 14064, K-ETS 등) */
  methodology: string;
  /** 릴리스 일자 */
  releasedAt: Date;
  /** 폐지 일자 (null이면 현재 유효) */
  deprecatedAt?: Date | null;
  /** 계산 로직 설명 */
  description?: string;
  /** 적용 가능한 Scope 범위 */
  applicableScopes: EmissionScope[];
}
