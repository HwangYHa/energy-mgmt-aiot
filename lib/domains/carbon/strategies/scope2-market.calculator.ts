/**
 * Scope 2 Market-based Calculator - 시장 기반 배출량 계산기
 *
 * 대상: 구매 전력 사용 (재생에너지 인증서 PPA/REC 반영)
 *
 * 계산식 (GHG Protocol Scope 2 Guidance - Market-based):
 *   그리드분 배출량 = max(0, (전력사용량 - 재생에너지량)) × 그리드 계수
 *   재생에너지분 배출량 = 재생에너지량 × 0  (PPA/REC = 0 tCO2eq)
 *   총 배출량 = 그리드분 + 재생에너지분 = 그리드분
 *
 * 특징:
 *   - PPA(Power Purchase Agreement) 또는 REC(Renewable Energy Certificate) 반영
 *   - 재생에너지분은 배출계수 0 적용 (GHG Protocol 허용)
 *   - 결과가 음수가 되지 않도록 max(0, ...) 처리
 *   - Location-based와 함께 보고 권장 (CDP 이중 보고)
 */

import type {
  IEmissionCalculator,
  CalculateEmissionsInput,
  CalculationOutput,
  ValidationResult,
} from './types';
import { ENERGY_CONVERSION, convertUnit } from './types';
import type { EmissionScope } from '../types/carbon.types';

export class Scope2MarketCalculator implements IEmissionCalculator {
  readonly scope: EmissionScope = 'scope2_market';
  readonly version = '1.0.0';

  validate(input: CalculateEmissionsInput): ValidationResult {
    const errors: string[] = [];

    if (input.scope !== 'scope2_market') {
      errors.push(`Scope 2 Market 계산기에 잘못된 scope가 전달됨: ${input.scope}`);
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

    if (input.renewableEnergy !== undefined) {
      if (input.renewableEnergy < 0) {
        errors.push(`재생에너지량은 0 이상이어야 합니다. 입력값: ${input.renewableEnergy}`);
      }
      if (!Number.isFinite(input.renewableEnergy)) {
        errors.push(`재생에너지량이 유효하지 않습니다: ${input.renewableEnergy}`);
      }
      // 재생에너지 > 전력 사용량은 논리적 오류 (경고)
      if (input.renewableEnergy > input.activityData) {
        errors.push(
          `재생에너지량(${input.renewableEnergy})이 전력 사용량(${input.activityData})을 초과합니다. ` +
          `시장기반 계산에서 초과분은 0으로 처리됩니다.`
        );
      }
    }

    return { valid: errors.length === 0, errors };
  }

  calculate(input: CalculateEmissionsInput, factorValue: number): CalculationOutput {
    // 재생에너지 과초과 경고는 에러로 처리하지 않음 (max(0,...) 처리)
    const validationErrors = this.validate(input).errors.filter(
      (e) => !e.includes('초과합니다')
    );
    if (validationErrors.length > 0) {
      throw new Error(`[Scope2MarketCalculator] 입력 검증 실패: ${validationErrors.join('; ')}`);
    }

    // 단위 변환: 입력 → kWh
    const { convertedValue: totalKWh, conversionFactor } = convertUnit(
      input.activityData,
      input.activityUnit,
      ENERGY_CONVERSION
    );

    // 재생에너지량 (kWh 기준, 미입력 시 0)
    const renewableKWh = input.renewableEnergy ?? 0;

    // 그리드 전력 = 총 사용 - 재생에너지 (음수 불가)
    const gridKWh = Math.max(0, totalKWh - renewableKWh);

    // 배출량 계산
    const gridEmissions = gridKWh * factorValue;
    const renewableEmissions = 0; // PPA/REC = 0 tCO2eq
    const totalEmissions = gridEmissions + renewableEmissions;

    // 계산식 문자열
    const conversionNote =
      conversionFactor !== 1
        ? ` (${input.activityData.toFixed(4)} ${input.activityUnit} × ${conversionFactor} = ${totalKWh.toFixed(4)} kWh)`
        : '';

    const formula =
      `총 전력 ${totalKWh.toFixed(4)} kWh${conversionNote}` +
      ` - 재생에너지 ${renewableKWh.toFixed(4)} kWh` +
      ` = 그리드 ${gridKWh.toFixed(4)} kWh` +
      ` × ${factorValue.toFixed(6)} tCO2eq/kWh` +
      ` = ${totalEmissions.toFixed(6)} tCO2eq [market-based]`;

    return {
      emissions: Math.round(totalEmissions * 1_000_000) / 1_000_000,
      unit: 'tCO2eq',
      factorValueUsed: factorValue,
      calculationMethod: 'scope2-market-based',
      formula,
      conversionFactor,
    };
  }
}
