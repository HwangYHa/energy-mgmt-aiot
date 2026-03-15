/**
 * Scope 3 Calculator - 간접 배출량 계산기 (GHG Protocol 카테고리 1-15)
 *
 * 두 가지 계산 방식 지원:
 *
 * 1. Activity-based (권장):
 *    emissions = activityData(km/kg/L...) × factor(tCO2eq/단위)
 *    예: 비행 거리(km) × 항공 배출계수
 *
 * 2. Spend-based (간편):
 *    emissions = spendAmount(KRW) × intensityFactor(tCO2eq/백만원)
 *    예: 원자재 구매비(KRW) × 공급망 배출 집약도
 *
 * 카테고리별 기본 방식:
 *   - CAT01, CAT02: spend-or-activity
 *   - CAT03~CAT14: activity
 *   - CAT15: spend
 */

import type {
  IEmissionCalculator,
  CalculateEmissionsInput,
  CalculationOutput,
  ValidationResult,
} from './types';
import { ENERGY_CONVERSION, VOLUME_CONVERSION, MASS_CONVERSION, DISTANCE_CONVERSION, convertUnit } from './types';
import {
  SCOPE3_CATEGORIES,
  isValidScope3Category,
  getCategoryNo,
} from '../constants/scope3-categories';
import type { EmissionScope } from '../types/carbon.types';

// Scope 3에서 지원하는 모든 단위
const ALL_SUPPORTED_UNITS = new Set([
  ...Object.keys(ENERGY_CONVERSION),
  ...Object.keys(VOLUME_CONVERSION),
  ...Object.keys(MASS_CONVERSION),
  ...Object.keys(DISTANCE_CONVERSION),
  'KRW', 'USD', 'EUR', // 통화 (spend-based)
  'pkm',               // passenger-kilometer (항공, 철도 등)
  'tkm',               // tonne-kilometer (화물 운송)
  'unit', 'item',      // 개수 기반
]);

/** 통화 단위 목록 (spend-based 방식 감지) */
const CURRENCY_UNITS = new Set(['KRW', 'USD', 'EUR']);

export class Scope3Calculator implements IEmissionCalculator {
  readonly scope: EmissionScope = 'scope3';
  readonly version = '1.0.0';

  validate(input: CalculateEmissionsInput): ValidationResult {
    const errors: string[] = [];

    if (input.scope !== 'scope3') {
      errors.push(`Scope 3 계산기에 잘못된 scope가 전달됨: ${input.scope}`);
    }

    // 카테고리 검증 (sourceType 또는 scope3CategoryNo에서 추출)
    const categoryNo = input.scope3CategoryNo ?? getCategoryNo(input.sourceType);
    if (categoryNo !== null && !isValidScope3Category(categoryNo)) {
      errors.push(`유효하지 않은 Scope 3 카테고리 번호입니다: ${categoryNo} (1-15 범위)`);
    }

    // Spend-based 방식
    if (CURRENCY_UNITS.has(input.activityUnit)) {
      if ((input.spendAmount ?? input.activityData) <= 0) {
        errors.push(`지출액은 양수여야 합니다.`);
      }
    } else {
      // Activity-based 방식
      if (input.activityData < 0) {
        errors.push(`활동량은 0 이상이어야 합니다. 입력값: ${input.activityData}`);
      }
      if (!ALL_SUPPORTED_UNITS.has(input.activityUnit)) {
        errors.push(
          `지원하지 않는 단위입니다: ${input.activityUnit}. ` +
          `지원 단위: ${Array.from(ALL_SUPPORTED_UNITS).join(', ')}`
        );
      }
    }

    if (!Number.isFinite(input.activityData)) {
      errors.push(`활동량이 유효하지 않습니다: ${input.activityData}`);
    }

    return { valid: errors.length === 0, errors };
  }

  calculate(input: CalculateEmissionsInput, factorValue: number): CalculationOutput {
    const validation = this.validate(input);
    if (!validation.valid) {
      throw new Error(`[Scope3Calculator] 입력 검증 실패: ${validation.errors.join('; ')}`);
    }

    // 카테고리 정보 조회
    const categoryNo = input.scope3CategoryNo ?? getCategoryNo(input.sourceType);
    const category = categoryNo != null ? SCOPE3_CATEGORIES[categoryNo] : null;
    const categoryLabel = category
      ? `[CAT${String(categoryNo).padStart(2, '0')} ${category.nameKo}]`
      : '[카테고리 미분류]';

    // Spend-based vs Activity-based 분기
    if (CURRENCY_UNITS.has(input.activityUnit)) {
      return this._calculateSpendBased(input, factorValue, categoryLabel);
    } else {
      return this._calculateActivityBased(input, factorValue, categoryLabel);
    }
  }

  private _calculateActivityBased(
    input: CalculateEmissionsInput,
    factorValue: number,
    categoryLabel: string
  ): CalculationOutput {
    // 단위 변환
    const conversionTable = this._getConversionTable(input.activityUnit);
    const { convertedValue, conversionFactor } = convertUnit(
      input.activityData,
      input.activityUnit,
      conversionTable
    );

    const emissions = convertedValue * factorValue;
    const standardUnit = this._getStandardUnit(input.activityUnit);

    const conversionNote =
      conversionFactor !== 1
        ? ` (${input.activityData.toFixed(4)} ${input.activityUnit} × ${conversionFactor} = ${convertedValue.toFixed(4)} ${standardUnit})`
        : '';

    const formula =
      `${categoryLabel} ` +
      `${convertedValue.toFixed(6)} ${standardUnit}${conversionNote}` +
      ` × ${factorValue.toFixed(6)} tCO2eq/${standardUnit}` +
      ` = ${emissions.toFixed(6)} tCO2eq [activity-based]`;

    return {
      emissions: Math.round(emissions * 1_000_000) / 1_000_000,
      unit: 'tCO2eq',
      factorValueUsed: factorValue,
      calculationMethod: 'scope3-activity-based',
      formula,
      conversionFactor,
    };
  }

  private _calculateSpendBased(
    input: CalculateEmissionsInput,
    factorValue: number,
    categoryLabel: string
  ): CalculationOutput {
    // spend-based: spendAmount(KRW) × intensityFactor(tCO2eq/백만원)
    const spend = input.spendAmount ?? input.activityData;
    const spendInMillions = spend / 1_000_000; // KRW → 백만 KRW

    // 배출계수 단위: tCO2eq/백만KRW (spend-based 배출 집약도)
    const emissions = spendInMillions * factorValue;

    const formula =
      `${categoryLabel} ` +
      `${spend.toFixed(0)} ${input.activityUnit}` +
      ` ÷ 1,000,000 = ${spendInMillions.toFixed(6)} 백만KRW` +
      ` × ${factorValue.toFixed(6)} tCO2eq/백만KRW` +
      ` = ${emissions.toFixed(6)} tCO2eq [spend-based]`;

    return {
      emissions: Math.round(emissions * 1_000_000) / 1_000_000,
      unit: 'tCO2eq',
      factorValueUsed: factorValue,
      calculationMethod: 'scope3-spend-based',
      formula,
      conversionFactor: 1 / 1_000_000,
    };
  }

  private _getConversionTable(unit: string): Record<string, number> {
    if (unit in ENERGY_CONVERSION) return ENERGY_CONVERSION;
    if (unit in VOLUME_CONVERSION) return VOLUME_CONVERSION;
    if (unit in MASS_CONVERSION) return MASS_CONVERSION;
    if (unit in DISTANCE_CONVERSION) return DISTANCE_CONVERSION;
    return { [unit]: 1 };
  }

  private _getStandardUnit(unit: string): string {
    if (unit in ENERGY_CONVERSION) return 'kWh';
    if (unit in VOLUME_CONVERSION) return 'L';
    if (unit in MASS_CONVERSION) return 'kg';
    if (unit in DISTANCE_CONVERSION) return 'km';
    return unit;
  }
}
