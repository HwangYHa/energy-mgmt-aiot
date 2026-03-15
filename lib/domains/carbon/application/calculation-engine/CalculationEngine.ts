/**
 * CalculationEngine v2
 * 배출량 계산의 단일 진입점 (Application Service)
 *
 * Big4 감사 요건:
 * - emissionFactorId: 어떤 DB 행의 계수를 사용했는가
 * - emissionFactorVersion: 어떤 버전의 계수인가
 * - calculationEngineVersion: 어떤 버전의 계산 로직인가
 * - calculationTimestamp: 언제 계산했는가 (고정값 — 재현 가능)
 * - formula: 계산식 문자열 (감사관이 수동 검증 가능)
 * - verifySnapshot: 계산 당시 모든 입력값 스냅샷
 *
 * Deterministic 원칙:
 * - Math.random() 사용 금지
 * - 현재 시각은 외부에서 주입 (테스트 시 고정 가능)
 * - 동일 입력 → 항상 동일 출력
 */

import type { IEmissionFactorRepository, FindEffectiveQuery } from '../../domain/repositories/IEmissionFactorRepository';
import type { IEmissionCalculator as IEmissionStrategy } from '../../strategies/types';
import { getCalculator } from '../../strategies/index';
import {
  EmissionFactorNotFoundError,
  UnsupportedCalculationError,
  CalculationValidationError,
} from '../../domain/errors';
import type { EmissionScope } from '../../types/carbon.types';

// ─── 입출력 타입 ─────────────────────────────────────────────────────────────

export interface CalculationInput {
  tenantId: string;
  scope: EmissionScope;
  countryCode: string;          // KR, US, EU
  energyType: string;           // electricity, diesel, lng
  calculationType: string;      // location, market, activity, spend
  activityData: number;
  activityUnit: string;
  period: string;               // YYYY-MM
  dataSource: 'sensor' | 'manual' | 'invoice';
  calculatedBy: string;
  // Scope 2 Market-based
  renewableEnergy?: number;
  // Scope 3
  scope3CategoryNo?: number;
  spendAmount?: number;
  // 재현성: 계산 시각 외부 주입 (테스트 시 고정)
  calculationTimestamp?: Date;
  // 스냅샷
  snapshot?: Record<string, unknown>;
}

export interface CalculationResult {
  // ── 계산 결과 ──
  emissions: number;
  emissionsUnit: 'tCO2eq';

  // ── Big4 감사 필수 추적 필드 ──
  emissionFactorId: string;
  emissionFactorVersion: string;
  emissionFactorCode: string;
  emissionFactorValue: number;
  calculationEngineVersion: string;
  calculationTimestamp: Date;
  calculationMethod: string;

  // ── 재현성 증거 ──
  formula: string;              // 수동 검증 가능한 계산식
  selectionReason: FactorSelectionReason;
  verifySnapshot: {
    input: CalculationInput;
    factor: {
      id: string;
      code: string;
      value: number;
      unit: string;
      sourceName: string;
      sourceVersion: string | null;
      validFrom: string;
      validTo: string | null;
      tenantId: string | null;
      approvalStatus: string;
    };
    engineVersion: string;
  };
}

export interface FactorSelectionReason {
  /** 선택 계층 */
  tier: 'TENANT_CUSTOM' | 'GLOBAL_OFFICIAL';
  /** 선택 이유 (감사 보고서에 그대로 사용 가능) */
  explanation: string;
  /** 승인 근거 별도 보관 필요 여부 */
  requiresSeparateApprovalDoc: boolean;
  /** 감사 노트 */
  auditNote: string;
}

// ─── 엔진 ─────────────────────────────────────────────────────────────────────

export class CalculationEngine {
  /**
   * 계산 로직 버전 — 계산 공식 변경 시 반드시 업데이트
   * EmissionsRecord에 저장되어 재현 가능성 보장
   */
  static readonly ENGINE_VERSION = '2.0.0';

  constructor(private readonly factorRepo: IEmissionFactorRepository) {}

  async calculate(input: CalculationInput): Promise<CalculationResult> {
    const calcAt = input.calculationTimestamp ?? new Date();

    // 1. 입력 검증
    this._validateInput(input);

    // 2. 배출계수 3-tier 조회
    const effectiveQuery: FindEffectiveQuery = {
      tenantId: input.tenantId,
      countryCode: input.countryCode,
      energyType: input.energyType,
      calculationType: input.calculationType,
      asOf: calcAt,
    };

    const factor = await this.factorRepo.findEffective(effectiveQuery);
    if (!factor) {
      throw new EmissionFactorNotFoundError({
        tenantId: input.tenantId,
        countryCode: input.countryCode,
        energyType: input.energyType,
        scope: ({ scope1: 1, scope2_location: 2, scope2_market: 2, scope3: 3 } as const)[input.scope],
        calculationType: input.calculationType,
        asOf: calcAt,
      });
    }

    // 3. 선택 이유 생성 (감사용)
    const selectionReason = this._buildSelectionReason(factor.tenantId, factor.sourceName, factor.factorSourceType);

    // 4. Strategy 선택 + 계산
    const calculator = this._getCalculatorForScope(input.scope, input.calculationType);
    const validation = calculator.validate({
      tenantId: input.tenantId,
      scope: input.scope,
      sourceType: input.energyType,
      activityData: input.activityData,
      activityUnit: input.activityUnit,
      period: input.period,
      dataSource: input.dataSource,
      calculatedBy: input.calculatedBy,
      renewableEnergy: input.renewableEnergy,
      scope3CategoryNo: input.scope3CategoryNo,
      spendAmount: input.spendAmount,
    });

    if (!validation.valid) {
      throw new CalculationValidationError(validation.errors);
    }

    const calcOutput = calculator.calculate(
      {
        tenantId: input.tenantId,
        scope: input.scope,
        sourceType: input.energyType,
        activityData: input.activityData,
        activityUnit: input.activityUnit,
        period: input.period,
        dataSource: input.dataSource,
        calculatedBy: input.calculatedBy,
        renewableEnergy: input.renewableEnergy,
        scope3CategoryNo: input.scope3CategoryNo,
        spendAmount: input.spendAmount,
      },
      factor.factorValue
    );

    // 5. 결과 조립 (감사 추적 필드 전부 포함)
    return {
      emissions: calcOutput.emissions,
      emissionsUnit: 'tCO2eq',

      emissionFactorId: factor.id,
      emissionFactorVersion: factor.version,
      emissionFactorCode: factor.factorCode,
      emissionFactorValue: factor.factorValue,
      calculationEngineVersion: CalculationEngine.ENGINE_VERSION,
      calculationTimestamp: calcAt,
      calculationMethod: calcOutput.calculationMethod,

      formula: calcOutput.formula,
      selectionReason,

      verifySnapshot: {
        input: { ...input, calculationTimestamp: calcAt },
        factor: {
          id: factor.id,
          code: factor.factorCode,
          value: factor.factorValue,
          unit: factor.unit,
          sourceName: factor.sourceName,
          sourceVersion: factor.sourceVersion,
          validFrom: factor.validFrom.toISOString(),
          validTo: factor.validTo?.toISOString() ?? null,
          tenantId: factor.tenantId,
          approvalStatus: factor.approvalStatus,
        },
        engineVersion: CalculationEngine.ENGINE_VERSION,
      },
    };
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private _validateInput(input: CalculationInput): void {
    const errors: string[] = [];
    if (input.activityData < 0) errors.push('activityData는 0 이상이어야 합니다');
    if (!input.tenantId) errors.push('tenantId는 필수입니다');
    if (!input.countryCode) errors.push('countryCode는 필수입니다');
    if (!input.energyType) errors.push('energyType는 필수입니다');
    if (!input.calculationType) errors.push('calculationType은 필수입니다');
    if (!['scope1', 'scope2_location', 'scope2_market', 'scope3'].includes(input.scope)) {
      errors.push(`scope는 scope1|scope2_location|scope2_market|scope3 중 하나여야 합니다: ${input.scope}`);
    }
    if (errors.length > 0) throw new CalculationValidationError(errors);
  }

  private _getCalculatorForScope(scope: EmissionScope, calculationType: string): IEmissionStrategy {
    // scope2는 calculationType으로 location/market 구분
    let resolvedScope = scope;
    if (scope === 'scope2_location' || (scope as string) === 'scope2' && calculationType === 'location') {
      resolvedScope = 'scope2_location';
    } else if (scope === 'scope2_market' || (scope as string) === 'scope2' && calculationType === 'market') {
      resolvedScope = 'scope2_market';
    }

    try {
      return getCalculator(resolvedScope) as unknown as IEmissionStrategy;
    } catch {
      throw new UnsupportedCalculationError(`${scope}_${calculationType}`);
    }
  }

  private _buildSelectionReason(
    tenantId: string | null,
    sourceName: string,
    factorSourceType: string
  ): FactorSelectionReason {
    if (tenantId !== null) {
      return {
        tier: 'TENANT_CUSTOM',
        explanation: `테넌트 커스텀 배출계수 적용 (출처: ${sourceName})`,
        requiresSeparateApprovalDoc: true,
        auditNote: '테넌트 커스텀 계수 사용: 계수 출처 근거 문서 및 내부 승인 이력 별도 보관 필요 (GHG Protocol Scope 2 Guidance §5.3)',
      };
    }
    return {
      tier: 'GLOBAL_OFFICIAL',
      explanation: `글로벌 공식 배출계수 적용 (${sourceName}, 유형: ${factorSourceType})`,
      requiresSeparateApprovalDoc: false,
      auditNote: '공식 기관 발표 계수 사용 — 별도 근거 문서 불필요',
    };
  }
}
