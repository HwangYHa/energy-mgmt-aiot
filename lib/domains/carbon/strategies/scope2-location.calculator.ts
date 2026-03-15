/**
 * Scope 2 Location-based Calculator - 지역 전력망 기반 배출량 계산기
 *
 * 대상: 구매 전력 사용 (한전 그리드, 지역 전력망)
 *
 * 계산식 (GHG Protocol Scope 2 Guidance):
 *   emissions(tCO2eq) = 전력사용량(kWh) × 지역 배출계수(tCO2eq/kWh)
 *
 * 지역 배출계수 예시:
 *   - 한국 (2023): 0.4567 tCO2eq/kWh (한전 발표)
 *   - EU 평균: 0.2770 tCO2eq/kWh
 *
 * 특징:
 *   - 재생에너지(PPA/REC) 별도 차감 없음 (Location-based의 특성)
 *   - Market-based와 이중 보고 가능 (CDP, TCFD 권장)
 */

import type {
  IEmissionCalculator,
  CalculateEmissionsInput,
  CalculationOutput,
  ValidationResult,
} from './types';
import { ENERGY_CONVERSION, convertUnit } from './types';
import type { EmissionScope } from '../types/carbon.types';

export class Scope2LocationCalculator implements IEmissionCalculator {
  readonly scope: EmissionScope = 'scope2_location';
  readonly version = '1.0.0';

  validate(input: CalculateEmissionsInput): ValidationResult {
    const errors: string[] = [];

    if (input.scope !== 'scope2_location') {
      errors.push(`Scope 2 Location 계산기에 잘못된 scope가 전달됨: ${input.scope}`);
    }

    if (input.activityData < 0) {
      errors.push(`전력 사용량은 0 이상이어야 합니다. 입력값: ${input.activityData}`);
    }

    if (!Number.isFinite(input.activityData)) {
      errors.push(`전력 사용량이 유효하지 않습니다: ${input.activityData}`);
    }

    if (!(input.activityUnit in ENERGY_CONVERSION)) {
      errors.push(
        `지원하지 않는 에너지 단위입니다: ${input.activityUnit}. ` +
        `지원 단위: ${Object.keys(ENERGY_CONVERSION).join(', ')}`
      );
    }

    return { valid: errors.length === 0, errors };
  }

  calculate(input: CalculateEmissionsInput, factorValue: number): CalculationOutput {
    const validation = this.validate(input);
    if (!validation.valid) {
      throw new Error(`[Scope2LocationCalculator] 입력 검증 실패: ${validation.errors.join('; ')}`);
    }

    // 단위 변환: 입력 → kWh
    const { convertedValue: kWh, conversionFactor } = convertUnit(
      input.activityData,
      input.activityUnit,
      ENERGY_CONVERSION
    );

    // 배출량 계산 (location-based: 재생에너지 차감 없음)
    const emissions = kWh * factorValue;

    const conversionNote =
      conversionFactor !== 1
        ? ` (${input.activityData.toFixed(4)} ${input.activityUnit} × ${conversionFactor} = ${kWh.toFixed(4)} kWh)`
        : '';

    const formula =
      `${kWh.toFixed(6)} kWh${conversionNote}` +
      ` × ${factorValue.toFixed(6)} tCO2eq/kWh` +
      ` = ${emissions.toFixed(6)} tCO2eq [location-based]`;

    return {
      emissions: Math.round(emissions * 1_000_000) / 1_000_000,
      unit: 'tCO2eq',
      factorValueUsed: factorValue,
      calculationMethod: 'scope2-location-based',
      formula,
      conversionFactor,
    };
  }
}
