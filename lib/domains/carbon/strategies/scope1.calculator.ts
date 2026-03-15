/**
 * Scope 1 Calculator - 직접 연소 배출량 계산기
 *
 * 대상: 사업장 내 연료 직접 연소 (LNG, 경유, 휘발유, 중유 등)
 *
 * 계산식:
 *   emissions(tCO2eq) = 연료량(표준단위) × 배출계수(tCO2eq/표준단위)
 *
 * 표준단위:
 *   - 액체 연료 (경유, 휘발유): L
 *   - 기체 연료 (LNG): m3 또는 kg
 *   - 에너지 기준: TJ, MJ
 */

import type {
  IEmissionCalculator,
  CalculateEmissionsInput,
  CalculationOutput,
  ValidationResult,
} from './types';
import { VOLUME_CONVERSION, MASS_CONVERSION, ENERGY_CONVERSION, convertUnit } from './types';
import type { EmissionScope } from '../types/carbon.types';

// Scope 1에서 지원하는 단위 목록
const SUPPORTED_UNITS = new Set([
  ...Object.keys(VOLUME_CONVERSION),
  ...Object.keys(MASS_CONVERSION),
  ...Object.keys(ENERGY_CONVERSION),
]);

export class Scope1Calculator implements IEmissionCalculator {
  readonly scope: EmissionScope = 'scope1';
  readonly version = '1.0.0';

  validate(input: CalculateEmissionsInput): ValidationResult {
    const errors: string[] = [];

    if (input.scope !== 'scope1') {
      errors.push(`Scope 1 계산기에 잘못된 scope가 전달됨: ${input.scope}`);
    }

    if (input.activityData <= 0) {
      errors.push(`연료량은 양수여야 합니다. 입력값: ${input.activityData}`);
    }

    if (!Number.isFinite(input.activityData)) {
      errors.push(`연료량이 유효하지 않습니다: ${input.activityData}`);
    }

    if (!SUPPORTED_UNITS.has(input.activityUnit)) {
      errors.push(
        `지원하지 않는 단위입니다: ${input.activityUnit}. ` +
        `지원 단위: ${Array.from(SUPPORTED_UNITS).join(', ')}`
      );
    }

    if (!input.sourceType) {
      errors.push('sourceType은 필수입니다 (예: diesel, lng, gasoline)');
    }

    return { valid: errors.length === 0, errors };
  }

  calculate(input: CalculateEmissionsInput, factorValue: number): CalculationOutput {
    const validation = this.validate(input);
    if (!validation.valid) {
      throw new Error(`[Scope1Calculator] 입력 검증 실패: ${validation.errors.join('; ')}`);
    }

    // 단위 변환: 입력 단위 → 표준 단위 (L, kg, kWh 등)
    const conversionTable = this._getConversionTable(input.activityUnit);
    const { convertedValue, conversionFactor } = convertUnit(
      input.activityData,
      input.activityUnit,
      conversionTable
    );

    // 배출량 계산
    const emissions = convertedValue * factorValue;

    // 계산식 문자열 (재현 가능성 증거)
    const standardUnit = this._getStandardUnit(input.activityUnit);
    const conversionNote =
      conversionFactor !== 1
        ? ` (${input.activityData.toFixed(4)} ${input.activityUnit} × ${conversionFactor} = ${convertedValue.toFixed(4)} ${standardUnit})`
        : '';

    const formula =
      `${convertedValue.toFixed(6)} ${standardUnit}` +
      `${conversionNote} × ${factorValue.toFixed(6)} tCO2eq/${standardUnit}` +
      ` = ${emissions.toFixed(6)} tCO2eq`;

    return {
      emissions: Math.round(emissions * 1_000_000) / 1_000_000, // 소수점 6자리
      unit: 'tCO2eq',
      factorValueUsed: factorValue,
      calculationMethod: 'scope1-combustion',
      formula,
      conversionFactor,
    };
  }

  private _getConversionTable(unit: string): Record<string, number> {
    if (unit in VOLUME_CONVERSION) return VOLUME_CONVERSION;
    if (unit in MASS_CONVERSION) return MASS_CONVERSION;
    if (unit in ENERGY_CONVERSION) return ENERGY_CONVERSION;
    return { [unit]: 1 };
  }

  private _getStandardUnit(unit: string): string {
    if (unit in VOLUME_CONVERSION) return 'L';
    if (unit in MASS_CONVERSION) return 'kg';
    if (unit in ENERGY_CONVERSION) return 'kWh';
    return unit;
  }
}
