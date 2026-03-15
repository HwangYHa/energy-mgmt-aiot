/**
 * Strategy Pattern: 배출량 계산기 인터페이스 및 공통 타입
 *
 * Big4 감사 요건:
 * - Deterministic: 동일 입력 → 항상 동일 출력
 * - Traceable: 계산식(formula) 문자열로 재현 가능성 증명
 * - Validatable: validate()로 사전 입력 검증 후 calculate() 호출
 */

import type { EmissionScope, DataSource, DataQuality } from '../types/carbon.types';

// ─── 계산기 입출력 타입 ─────────────────────────────────────────────────────

/**
 * 계산기 입력 파라미터 (모든 Scope 공통)
 */
export interface CalculateEmissionsInput {
  /** 테넌트 ID */
  tenantId: string;

  /** 배출 스코프 */
  scope: EmissionScope;

  /** 배출원 타입 (예: 'diesel', 'grid-korea') */
  sourceType: string;

  /** 활동량 (양수) */
  activityData: number;

  /** 활동 단위 (kWh, L, km, kg 등) */
  activityUnit: string;

  /** 보고 기간 (YYYY-MM 형식) */
  period: string;

  /** 데이터 출처 */
  dataSource: DataSource;

  /** 계산 주체 ('system' = 자동, userId = 수동) */
  calculatedBy: string;

  /** 데이터 품질 등급 */
  dataQuality?: DataQuality;

  // ── Scope 2 Market-based 전용 ──

  /**
   * 재생에너지 사용량 (kWh)
   * PPA/REC를 통해 구매한 재생에너지. 이 만큼은 0 tCO2eq 적용.
   */
  renewableEnergy?: number;

  // ── Scope 3 전용 ──

  /**
   * Scope 3 카테고리 번호 (1-15, GHG Protocol)
   * undefined이면 sourceType에서 자동 추론
   */
  scope3CategoryNo?: number;

  /**
   * Spend-based 방식용 지출액 (KRW)
   * activity-based 방식이면 activityData 사용
   */
  spendAmount?: number;

  // ── 메타 ──

  /** 원본 활동 데이터 스냅샷 (감사 추적용) */
  snapshot?: Record<string, unknown>;
}

/**
 * 계산기 출력 (중간 결과)
 * EmissionsRecord 저장 전 서비스 레이어에서 받는 결과
 */
export interface CalculationOutput {
  /** 계산된 배출량 (tCO2eq) */
  emissions: number;

  /** 배출 단위 (항상 tCO2eq) */
  unit: 'tCO2eq';

  /** 실제 계산에 사용된 계수 값 */
  factorValueUsed: number;

  /** 계산 방식 식별자 */
  calculationMethod: string;

  /**
   * 재현 가능성 증거: 계산식 문자열
   * 예: "1000.00 L × 2.664000 tCO2eq/L = 2664.00 tCO2eq"
   */
  formula: string;

  /** 단위 변환 계수 (입력 단위 → 표준 단위) */
  conversionFactor?: number;
}

/**
 * 입력 검증 결과
 */
export interface ValidationResult {
  /** 검증 통과 여부 */
  valid: boolean;

  /** 검증 실패 메시지 목록 */
  errors: string[];
}

// ─── 계산기 인터페이스 ────────────────────────────────────────────────────────

/**
 * IEmissionCalculator: 모든 Scope 계산기가 구현해야 하는 인터페이스
 *
 * Strategy Pattern의 ConcreteStrategy 역할.
 * 새로운 계산 방식 추가 시 이 인터페이스를 구현한 클래스를 추가.
 */
export interface IEmissionCalculator {
  /**
   * 이 계산기가 담당하는 Scope
   * Scope 2는 방식별로 별도 계산기를 가짐 (location/market)
   */
  readonly scope: EmissionScope;

  /**
   * 계산기 버전 (calculateNextVersion 호환)
   * 계산 로직 변경 시 버전 업데이트
   */
  readonly version: string;

  /**
   * 배출량 계산
   *
   * @param input 계산 입력
   * @param factorValue 배출계수 값 (EmissionFactorService.findEffective()로 조회)
   * @returns 계산 결과 (emissions, formula 포함)
   *
   * IMPORTANT: 이 메서드는 순수 함수여야 함 (부작용 없음, DB 접근 없음)
   */
  calculate(input: CalculateEmissionsInput, factorValue: number): CalculationOutput;

  /**
   * 입력 사전 검증
   * calculate() 호출 전 반드시 validate() 통과 확인
   */
  validate(input: CalculateEmissionsInput): ValidationResult;
}

// ─── 단위 변환 유틸 ─────────────────────────────────────────────────────────

/**
 * 에너지 단위 변환 계수 (→ kWh 기준)
 */
export const ENERGY_CONVERSION: Record<string, number> = {
  kWh: 1,
  MWh: 1_000,
  GWh: 1_000_000,
  TJ: 277_777.78,  // 1 TJ = 277,777.78 kWh
  MJ: 0.277778,    // 1 MJ = 0.277778 kWh
  GJ: 277.778,     // 1 GJ = 277.778 kWh
};

/**
 * 연료 부피 단위 변환 계수 (→ L 기준)
 */
export const VOLUME_CONVERSION: Record<string, number> = {
  L: 1,
  kL: 1_000,
  mL: 0.001,
  m3: 1_000,        // 1 m³ = 1,000 L
  ft3: 28.3168,     // 1 ft³ ≈ 28.3 L
};

/**
 * 질량 단위 변환 계수 (→ kg 기준)
 */
export const MASS_CONVERSION: Record<string, number> = {
  kg: 1,
  t: 1_000,
  mt: 1_000,        // metric ton
  g: 0.001,
  lb: 0.453592,
};

/**
 * 거리 단위 변환 계수 (→ km 기준)
 */
export const DISTANCE_CONVERSION: Record<string, number> = {
  km: 1,
  m: 0.001,
  mile: 1.60934,
  nmi: 1.852,       // nautical mile
};

/**
 * 단위 변환 함수
 * @param value 입력값
 * @param fromUnit 입력 단위
 * @param conversionTable 단위 변환표
 * @returns 변환된 값 및 변환 계수
 */
export function convertUnit(
  value: number,
  fromUnit: string,
  conversionTable: Record<string, number>
): { convertedValue: number; conversionFactor: number } {
  const factor = conversionTable[fromUnit];
  if (factor === undefined) {
    throw new Error(`지원하지 않는 단위입니다: ${fromUnit}. 지원 단위: ${Object.keys(conversionTable).join(', ')}`);
  }
  return {
    convertedValue: value * factor,
    conversionFactor: factor,
  };
}

/**
 * 활동 단위에 맞는 변환표 자동 선택
 */
export function getConversionTable(unit: string): Record<string, number> {
  if (unit in ENERGY_CONVERSION) return ENERGY_CONVERSION;
  if (unit in VOLUME_CONVERSION) return VOLUME_CONVERSION;
  if (unit in MASS_CONVERSION) return MASS_CONVERSION;
  if (unit in DISTANCE_CONVERSION) return DISTANCE_CONVERSION;
  return { [unit]: 1 }; // 알 수 없는 단위: 변환 없음 (1:1)
}
