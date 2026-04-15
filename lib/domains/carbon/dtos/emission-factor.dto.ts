/**
 * 배출계수(Emission Factor) DTO
 * 조회, 생성, 승인 입출력 정의
 *
 * Role: Service 계층과 Controller/API 계층 간 데이터 전달 계약서
 * 목적: Prisma 모델과 비즈니스 로직을 분리하여 변경 영향도 최소화
 */


/**
 * 유효한 배출계수 조회 입력
 * 3단계 lookup을 위한 필수 파라미터
 */
export interface FindEffectiveEmissionFactorInput {
  /** 테넌트 ID (null이면 글로벌 기본값 조회 불가) */
  tenantId: string;

  /** 배출계수 코드 (예: 'electricity-kr-grid', 'diesel-combustion') */
  code: string;

  /** 카테고리 (예: 'electricity', 'fuel_combustion') */
  category: string;

  /** 배출원 타입 (예: 'grid-korea', 'diesel') */
  sourceType: string;

  /** 기준 시점 (null = 현재 시각, 감사용으로 과거 버전 검색 가능) */
  validAsOf?: Date | null;

  /** 버전 체인 포함 여부 (true면 parentVersionId ~ childVersions 모두 포함) */
  requireVersion?: boolean;
}

/**
 * 배출계수 조회 응답 DTO
 * 배출계수의 현재 상태를 완전히 나타냄
 */
export interface EmissionFactorDTO {
  /** 배출계수 ID */
  id: string;

  /** 배출계수 코드 */
  code: string;

  /** Semantic 버전 (1.0.0, 1.1.0, 2.0.0) */
  version: string;

  // ── 계수 값 ──

  /** 배출계수 숫자값 (예: 0.4567) */
  factor: number;

  /** 배출 단위 (tCO2eq/MWh, tCO2eq/L 등) */
  unit: string;

  /** 입력 단위 (MWh, L, kg 등) */
  inputUnit: string;

  // ── 유효기간 ──

  /** 유효 시작일 */
  validFrom: Date;

  /** 유효 종료일 (null = 무한대) */
  validTo: Date | null;

  // ── 출처 ──

  /** 출처 (예: '국가 온실가스 인벤토리', '한전') */
  source: string;

  /** 근거 연도 */
  year: number;

  /** 지역 코드 (KR, EU, CN 등) */
  region: string;

  // ── 상태 ──

  /** 활성화 여부 */
  isActive: boolean;

  /** 테넌트 커스텀 여부 (false = 글로벌 기본값) */
  isCustom: boolean;

  /** 시스템 기본값 여부 */
  isDefault: boolean;

  // ── 버전 체인 ──

  /** 부모 버전 ID (이전 버전) */
  parentVersionId: string | null;

  /** 자식 버전들 (선택적, requireVersion=true일 때만) */
  childVersions?: EmissionFactorDTO[];

  // ── 승인 워크플로우 ──

  /** 승인자 (null = 미승인) */
  approvedBy: string | null;

  /** 승인 시각 (null = 미승인) */
  approvedAt: Date | null;

  /** 생성자 */
  createdBy: string;

  /** 생성 시각 */
  createdAt: Date;
}

/**
 * 배출계수 신규 버전 생성 입력
 */
export interface CreateEmissionFactorInput {
  /** 배출계수 코드 */
  code: string;

  /** 계수명 */
  name?: string;

  /** 버전 체인 코드 (factorCode) */
  factorCode?: string;

  /** 카테고리 */
  category: string;

  /** 배출원 타입 */
  sourceType: string;

  /** 에너지 타입 (선택) */
  energyType?: string;

  /** 산정 방식 */
  calculationType?: string;

  /** 배출계수 값 (양수만 허용) */
  factor: number;

  /** 배출 단위 */
  unit: string;

  /** 입력 단위 */
  inputUnit: string;

  /** 유효 시작일 */
  validFrom: Date;

  /** 유효 종료일 (null = 무한대) */
  validTo: Date | null;

  /** 출처 */
  source: string;

  /** 출처 기관명 */
  sourceName?: string;

  /** 출처 버전 */
  sourceVersion?: string;

  /** 출처 URL */
  sourceUrl?: string;

  /** 출처 유형 (official | international | tenant_custom) */
  factorSourceType?: string;

  /** 근거 연도 */
  year: number;

  /** 지역 코드 */
  region: string;

  /** 국가 코드 */
  countryCode?: string;

  /** 변경 사유 (선택, '규제 변경', '데이터 재검증' 등) */
  changeReason?: string;

  /** 부모 버전 ID (버전 체인 추적용, 미지정 시 v1.0.0) */
  parentVersionId?: string;

  /** 테넌트 ID (null = 글로벌 기본값) */
  tenantId?: string | null;
}

/**
 * 배출계수 승인 입력
 * 만드 후 isActive=false로 생성, 이후 승인 시 활성화
 */
export interface ApproveEmissionFactorInput {
  /** 승인할 배출계수 ID */
  factorId: string;

  /** 승인자 User ID */
  approvedBy: string;

  /** 승인 사유 (선택) */
  approvalReason?: string;
}

/**
 * 배출계수 DTO 변환 유틸
 * Prisma 모델 → DTO
 */
export function mapEmissionFactorToDTO(
  model: any,
  includeChildren: boolean = false
): EmissionFactorDTO {
  return {
    id: model.id,
    code: model.code,
    version: model.version,
    factor: Number(model.factor),
    unit: model.unit,
    inputUnit: model.inputUnit,
    validFrom: model.validFrom,
    validTo: model.validTo,
    source: model.source,
    year: model.year,
    region: model.region,
    isActive: model.isActive,
    isCustom: model.isCustom,
    isDefault: model.isDefault,
    parentVersionId: model.parentId,
    childVersions: includeChildren && model.children
      ? model.children.map((child: any) => mapEmissionFactorToDTO(child, true))
      : undefined,
    approvedBy: model.approvedBy,
    approvedAt: model.approvedAt,
    createdBy: model.createdBy || '',
    createdAt: model.createdAt,
  };
}

/**
 * Semantic Versioning 계산 유틸
 * 부모 버전을 기반으로 새 버전 계산
 *
 * @param parentVersion 부모 버전 (예: "1.0.0")
 * @param isValueChange 값 변경 여부 (true = minor 증가, false = patch 증가)
 * @returns 새 버전
 */
export function calculateNextVersion(parentVersion: string | undefined, isValueChange: boolean): string {
  if (!parentVersion) return '1.0.0';

  const parts = parentVersion.split('.').map(Number);
  if (parts.length < 3) return parentVersion; // Invalid format, return as is

  const [major, minor, patch] = parts as [number, number, number];

  if (isValueChange) {
    // 값 변경: minor 증가
    return `${major}.${minor + 1}.0`;
  } else {
    // 메타 변경: patch 증가
    return `${major}.${minor}.${patch + 1}`;
  }
}
