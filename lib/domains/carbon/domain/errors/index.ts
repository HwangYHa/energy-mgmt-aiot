/**
 * Carbon Domain — 도메인 에러 클래스
 *
 * 원칙:
 * - 각 에러는 HTTP 상태코드가 아닌 비즈니스 의미를 가짐
 * - Presentation layer에서 HTTP 에러로 변환
 * - name 필드로 instanceof 없이도 타입 구분 가능
 */

// ─── 기본 도메인 에러 ─────────────────────────────────────────────────────────

export class CarbonDomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'CarbonDomainError';
  }
}

// ─── 배출계수 에러 ────────────────────────────────────────────────────────────

/**
 * 유효한 배출계수를 찾을 수 없음 (3-tier lookup 실패)
 * → HTTP 404 또는 계산 중단
 */
export class EmissionFactorNotFoundError extends CarbonDomainError {
  constructor(
    public readonly query: {
      tenantId: string;
      countryCode?: string;
      energyType?: string;
      scope?: number;
      calculationType?: string;
      code?: string;
      asOf?: Date;
    }
  ) {
    const desc = query.code
      ? `code=${query.code}`
      : `${query.countryCode}/${query.energyType}/scope${query.scope}/${query.calculationType}`;
    super(
      `유효한 배출계수를 찾을 수 없습니다. [${desc}] tenantId=${query.tenantId}, ` +
      `asOf=${query.asOf?.toISOString() ?? '현재'}. ` +
      `배출계수 등록 및 승인 필요.`,
      'EMISSION_FACTOR_NOT_FOUND'
    );
    this.name = 'EmissionFactorNotFoundError';
  }
}

/**
 * 유효기간 충돌 — 동일 조건에 겹치는 활성 계수 존재
 * → HTTP 409 Conflict
 */
export class EmissionFactorOverlapError extends CarbonDomainError {
  constructor(
    public readonly factorCode: string,
    public readonly existingPeriod: { from: Date; to: Date | null },
    public readonly newPeriod: { from: Date; to: Date | null }
  ) {
    const fmt = (d: Date | null) => d?.toISOString().split('T')[0] ?? '∞';
    super(
      `유효기간 충돌: factorCode=${factorCode}. ` +
      `기존=[${fmt(existingPeriod.from)}, ${fmt(existingPeriod.to)}], ` +
      `신규=[${fmt(newPeriod.from)}, ${fmt(newPeriod.to)}]`,
      'EMISSION_FACTOR_OVERLAP'
    );
    this.name = 'EmissionFactorOverlapError';
  }
}

/**
 * 이미 승인된 배출계수에 대한 재승인 시도
 * → HTTP 409 Conflict
 */
export class EmissionFactorAlreadyApprovedError extends CarbonDomainError {
  constructor(public readonly factorId: string) {
    super(`이미 승인된 배출계수입니다. factorId=${factorId}`, 'ALREADY_APPROVED');
    this.name = 'EmissionFactorAlreadyApprovedError';
  }
}

/**
 * 부모 버전을 찾을 수 없음
 */
export class ParentVersionNotFoundError extends CarbonDomainError {
  constructor(public readonly parentVersionId: string) {
    super(`부모 버전을 찾을 수 없습니다. parentVersionId=${parentVersionId}`, 'PARENT_NOT_FOUND');
    this.name = 'ParentVersionNotFoundError';
  }
}

// ─── 계산 에러 ────────────────────────────────────────────────────────────────

/**
 * 지원하지 않는 Scope/계산 방식 조합
 * → HTTP 400 또는 500
 */
export class UnsupportedCalculationError extends CarbonDomainError {
  constructor(public readonly strategyKey: string) {
    super(`지원하지 않는 계산 방식입니다: ${strategyKey}`, 'UNSUPPORTED_CALCULATION');
    this.name = 'UnsupportedCalculationError';
  }
}

/**
 * 계산 입력 검증 실패
 * → HTTP 400
 */
export class CalculationValidationError extends CarbonDomainError {
  constructor(public readonly errors: string[]) {
    super(`계산 입력 검증 실패: ${errors.join('; ')}`, 'CALCULATION_VALIDATION');
    this.name = 'CalculationValidationError';
  }
}

/**
 * 단위 변환 불가
 */
export class UnsupportedUnitError extends CarbonDomainError {
  constructor(public readonly unit: string, supported: string[]) {
    super(
      `지원하지 않는 단위: ${unit}. 지원 단위: ${supported.join(', ')}`,
      'UNSUPPORTED_UNIT'
    );
    this.name = 'UnsupportedUnitError';
  }
}

// ─── 감사 에러 ────────────────────────────────────────────────────────────────

/**
 * Hash Chain 무결성 위반 — 변조 탐지
 * → 즉시 보안팀 보고 필요 (HTTP 500 또는 별도 처리)
 */
export class ChainIntegrityViolationError extends CarbonDomainError {
  constructor(
    public readonly emissionFactorId: string,
    public readonly tamperedLogIds: string[]
  ) {
    super(
      `Hash Chain 무결성 위반 탐지! emissionFactorId=${emissionFactorId}, ` +
      `변조 의심 로그: [${tamperedLogIds.join(', ')}]. 즉시 보안팀 보고 필요.`,
      'CHAIN_INTEGRITY_VIOLATION'
    );
    this.name = 'ChainIntegrityViolationError';
  }
}

// ─── 에러 타입 가드 ────────────────────────────────────────────────────────────

export function isEmissionFactorNotFound(e: unknown): e is EmissionFactorNotFoundError {
  return e instanceof EmissionFactorNotFoundError;
}

export function isEmissionFactorOverlap(e: unknown): e is EmissionFactorOverlapError {
  return e instanceof EmissionFactorOverlapError;
}

export function isAlreadyApproved(e: unknown): e is EmissionFactorAlreadyApprovedError {
  return e instanceof EmissionFactorAlreadyApprovedError;
}

export function isChainViolation(e: unknown): e is ChainIntegrityViolationError {
  return e instanceof ChainIntegrityViolationError;
}

/** HTTP 상태코드 매핑 */
export function errorToHttpStatus(e: CarbonDomainError): number {
  switch (e.code) {
    case 'EMISSION_FACTOR_NOT_FOUND':
    case 'PARENT_NOT_FOUND':
      return 404;
    case 'EMISSION_FACTOR_OVERLAP':
    case 'ALREADY_APPROVED':
      return 409;
    case 'CALCULATION_VALIDATION':
    case 'UNSUPPORTED_UNIT':
    case 'UNSUPPORTED_CALCULATION':
      return 400;
    case 'CHAIN_INTEGRITY_VIOLATION':
      return 500;
    default:
      return 500;
  }
}
