/**
 * Strategy Registry - 배출량 계산기 팩토리
 *
 * 사용법:
 *   const calculator = getCalculator('scope1');
 *   const output = calculator.calculate(input, factorValue);
 *
 * Scope 2는 방식(location/market)에 따라 다른 계산기를 사용:
 *   getCalculator('scope2_location') → Scope2LocationCalculator
 *   getCalculator('scope2_market')   → Scope2MarketCalculator
 */

import { Scope1Calculator } from './scope1.calculator';
import { Scope2LocationCalculator } from './scope2-location.calculator';
import { Scope2MarketCalculator } from './scope2-market.calculator';
import { Scope3Calculator } from './scope3.calculator';
import type { IEmissionCalculator } from './types';
import type { EmissionScope } from '../types/carbon.types';

// ─── 싱글톤 인스턴스 ──────────────────────────────────────────────────────────

const CALCULATORS: Record<EmissionScope, IEmissionCalculator> = {
  scope1: new Scope1Calculator(),
  scope2_location: new Scope2LocationCalculator(),
  scope2_market: new Scope2MarketCalculator(),
  scope3: new Scope3Calculator(),
};

// ─── 팩토리 함수 ─────────────────────────────────────────────────────────────

/**
 * Scope에 맞는 계산기 인스턴스 반환
 * @throws Error 미지원 scope인 경우
 */
export function getCalculator(scope: EmissionScope): IEmissionCalculator {
  const calculator = CALCULATORS[scope];
  if (!calculator) {
    throw new Error(
      `지원하지 않는 Scope입니다: ${scope}. ` +
      `지원 Scope: ${Object.keys(CALCULATORS).join(', ')}`
    );
  }
  return calculator;
}

/**
 * 모든 계산기 버전 정보 반환
 * (감사 보고서용: 어떤 버전의 계산 엔진이 사용되었는지 기록)
 */
export function getCalculatorVersions(): Record<EmissionScope, string> {
  return {
    scope1: CALCULATORS.scope1.version,
    scope2_location: CALCULATORS.scope2_location.version,
    scope2_market: CALCULATORS.scope2_market.version,
    scope3: CALCULATORS.scope3.version,
  };
}

// ─── Re-exports ──────────────────────────────────────────────────────────────

export { Scope1Calculator } from './scope1.calculator';
export { Scope2LocationCalculator } from './scope2-location.calculator';
export { Scope2MarketCalculator } from './scope2-market.calculator';
export { Scope3Calculator } from './scope3.calculator';
export type {
  IEmissionCalculator,
  CalculateEmissionsInput,
  CalculationOutput,
  ValidationResult,
} from './types';
