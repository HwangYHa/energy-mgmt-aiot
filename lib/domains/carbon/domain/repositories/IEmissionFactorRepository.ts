/**
 * IEmissionFactorRepository — 배출계수 Repository 인터페이스
 *
 * DDD 원칙:
 * - 도메인 계층에 인터페이스 정의 (구현 없음)
 * - 인프라 계층(Prisma)이 이 인터페이스를 구현
 * - 도메인 로직은 구체 DB에 의존하지 않음
 */

// ─── 도메인 레코드 타입 ─────────────────────────────────────────────────────────

export interface EmissionFactorRecord {
  id: string;
  tenantId: string | null;

  // 분류
  factorCode: string;      // 표준화 식별자 (필수, 없으면 code 사용)
  code: string;
  category: string;
  countryCode: string;     // KR, US, EU
  energyType: string;      // electricity, diesel, lng
  calculationType: string; // location, market, activity, spend

  // 계수 값
  factorValue: number;
  unit: string;
  inputUnit: string;

  // 출처
  sourceName: string;
  sourceVersion: string | null;
  sourceUrl: string | null;
  factorSourceType: string; // official|international|tenant_custom

  // 버전
  version: string;
  parentId: string | null;

  // 상태
  isActive: boolean;
  isCustom: boolean;
  isDefault: boolean;
  approvalStatus: string; // DRAFT|PENDING_REVIEW|APPROVED|REJECTED

  // 유효기간
  validFrom: Date;
  validTo: Date | null;

  // 승인
  approvedBy: string | null;
  approvedAt: Date | null;
  rejectedBy: string | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;

  // 감사
  createdBy: string;
  createdAt: Date;
  changeReason: string | null;
  recordHash: string | null;
}

// ─── 쿼리 타입 ─────────────────────────────────────────────────────────────────

/**
 * 유효 배출계수 조회 쿼리 (3-tier lookup)
 */
export interface FindEffectiveQuery {
  tenantId: string;
  /** 분류 기반 조회 */
  countryCode?: string;
  energyType?: string;
  scope?: 1 | 2 | 3;
  calculationType?: string;
  /** 코드 기반 조회 (factorCode 또는 code) */
  factorCode?: string;
  code?: string;
  /** 이 시점에 유효한 계수 조회 */
  asOf: Date;
}

export interface FindVersionChainQuery {
  factorCode: string;
  tenantId: string | null;
  limit?: number;
}

export interface ListFactorsQuery {
  tenantId?: string | null;
  countryCode?: string;
  energyType?: string;
  calculationType?: string;
  category?: string;
  approvalStatus?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

export interface ListFactorsResult {
  items: EmissionFactorRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateFactorData {
  tenantId: string | null;
  factorCode: string;
  code: string;
  category: string;
  sourceType: string;
  countryCode: string;
  energyType: string;
  calculationType: string;
  factorValue: number;
  unit: string;
  inputUnit: string;
  sourceName: string;
  sourceVersion: string | null;
  sourceUrl: string | null;
  factorSourceType: string;
  source: string;           // 하위호환
  year: number;
  region: string;
  version: string;
  parentId: string | null;
  isCustom: boolean;
  isDefault: boolean;
  isActive: boolean;
  approvalStatus: string;
  validFrom: Date;
  validTo: Date | null;
  createdBy: string;
  changeReason: string | null;
  recordHash: string | null;
}

// ─── Repository 인터페이스 ─────────────────────────────────────────────────────

export interface IEmissionFactorRepository {
  /**
   * 유효 배출계수 조회 (3-tier: 테넌트 커스텀 → 글로벌 → null)
   * @returns null이면 찾지 못함 (호출부에서 에러 처리)
   */
  findEffective(query: FindEffectiveQuery): Promise<EmissionFactorRecord | null>;

  /** 버전 체인 전체 조회 (감사 보고서용) */
  findVersionChain(query: FindVersionChainQuery): Promise<EmissionFactorRecord[]>;

  /** ID로 단건 조회 */
  findById(id: string): Promise<EmissionFactorRecord | null>;

  /** 목록 조회 (필터 + 페이지네이션) */
  list(query: ListFactorsQuery): Promise<ListFactorsResult>;

  /**
   * 유효기간 중복 확인
   * @returns 겹치는 계수가 있으면 해당 레코드, 없으면 null
   */
  findOverlapping(params: {
    factorCode: string;
    tenantId: string | null;
    validFrom: Date;
    validTo: Date | null;
    excludeId?: string;
  }): Promise<EmissionFactorRecord | null>;

  /** Append-only 생성 (한 번 생성 후 UPDATE 불가) */
  create(data: CreateFactorData): Promise<EmissionFactorRecord>;

  /**
   * 승인 상태 업데이트 (approve/reject/deprecate 전용)
   * NOTE: 계수 값(factor, unit 등) 변경 불가 — 새 버전 생성으로만 가능
   */
  updateApprovalStatus(params: {
    id: string;
    approvalStatus: string;
    isActive: boolean;
    approvedBy?: string;
    approvedAt?: Date;
    rejectedBy?: string;
    rejectedAt?: Date;
    rejectionReason?: string;
  }): Promise<void>;
}
