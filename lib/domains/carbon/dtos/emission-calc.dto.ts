/**
 * 배출량 계산 DTO
 * 계산 입력 및 출력 정의
 *
 * Role: 배출량 계산 엔진의 입출력 명세서
 * 목적: 계산 재현성, 감사 추적, 검증 가능성 보장
 */

import { EmissionScope, DataSource, DataQuality, CalculationMethod } from '../types/carbon.types';
import { EmissionFactorDTO } from './emission-factor.dto';

/**
 * 배출량 계산 입력
 * 활동 데이터를 받아 배출량 계산하기 위한 모든 정보 포함
 */
export interface CalculateEmissionsInput {
  /** 테넌트 ID */
  tenantId: string;

  /** 배출 스코프 (scope1 | scope2_location | scope2_market | scope3) */
  scope: EmissionScope;

  /** 배출원 타입 (예: 'grid-korea', 'diesel', 'air-domestic') */
  sourceType: string;

  /** 활동 데이터 (수치, 양수만 허용) */
  activityData: number;

  /** 활동 단위 (kWh, L, km, kg 등) */
  activityUnit: string;

  /** 보고 기간 (YYYY-MM 형식) */
  period: string;

  /** 데이터 출처 ('sensor' | 'manual' | 'invoice') */
  dataSource: DataSource;

  /** 데이터 품질 ('good' | 'uncertain', 기본값: 'good') */
  dataQuality?: DataQuality;

  /** 계산 수행자 (자동: 'system', 수동: userId) */
  calculatedBy: string;

  /** 사이트 ID (선택) */
  siteId?: string | null;

  // ── Scope 2 Market-based 선택 파라미터 ──

  /** Scope 2 Market-based: 재생에너지 전력량 (kWh, 선택) */
  renewableEnergy?: number;

  // ── 메타데이터 ──

  /** 원본 활동 데이터 스냅샷 (JSON, 추적용) */
  snapshot?: Record<string, any>;
}

/**
 * 배출량 계산 결과 출력
 * 계산 결과 + 감사 추적 정보 + 재현성 검증 데이터
 */
export interface CalculateEmissionsOutput {
  /** EmissionsRecord ID */
  recordId: string;

  // ── 계산 결과 ──

  /** 계산된 배출량 (tCO2eq) */
  emissions: number;

  /** 배출 단위 (항상 'tCO2eq') */
  unit: string;

  // ── 계산 기준 (감사 추적) ──

  /** 사용된 배출계수 버전 (예: '1.0.0') */
  factorVersion: string;

  /** 사용된 배출계수 값 */
  factorValue: number;

  /** 사용된 계산 엔진 버전 (예: '1.0.0') */
  engineVersion: string;

  /** 계산 방식 ('location-based' | 'market-based') */
  calculationMethod: CalculationMethod;

  // ── 메타 ──

  /** 계산 시각 */
  calculatedAt: Date;

  // ── 재현성 검증 (Big4 감사용) ──

  /** 검증 스냅샷: 재계산 시에도 동일한 결과가 나오도록 하는 모든 정보 */
  verifySnapshot: {
    /** 입력 파라미터 */
    input: CalculateEmissionsInput;

    /** 사용된 배출계수 전체 정보 */
    factor: EmissionFactorDTO;

    /** 계산 공식 (사람이 읽을 수 있는 형식) */
    calculationFormula: string;

    /** 최종 계산 결과 검증 */
    result: number;
  };
}

/**
 * 계산 엔진 팩토리 입력
 * 스코프별 계산기 선택에 필요한 정보
 */
export interface CalculatorFactoryInput {
  /** 배출 스코프 */
  scope: EmissionScope;

  /** Scope 2인 경우 계산 방식 선택 */
  calculationMethod?: 'location-based' | 'market-based';
}

/**
 * 배출량 통계 (기간별 집계)
 * 보고서 생성 시 사용
 */
export interface EmissionsAggregate {
  /** 집계 기간 (YYYY-MM) */
  period: string;

  /** Scope별 배출량 */
  scope1: number; // tCO2eq
  scope2Location: number; // tCO2eq
  scope2Market?: number; // tCO2eq (선택)
  scope3: number; // tCO2eq

  /** 총 배출량 */
  totalEmissions: number; // = scope1 + scope2Location + scope3

  /** 데이터 완전성 (0-100%) */
  completeness: number;

  /** 기록 수 */
  recordCount: number;

  /** 마지막 업데이트 */
  updatedAt: Date;
}

/**
 * 계산 결과 검증 함수
 * 배출량 계산 출력이 잘못되었는지 확인 (Big4 감사용)
 *
 * @param input 입력값
 * @param factor 배출계수
 * @param output 계산 출력값
 * @returns 검증 결과
 */
export function validateCalculationResult(
  input: CalculateEmissionsInput,
  factor: EmissionFactorDTO,
  output: CalculateEmissionsOutput
): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // 기본 검증
  if (input.activityData <= 0) {
    errors.push('활동 데이터는 양수여야 합니다.');
  }

  if (factor.factor <= 0) {
    errors.push('배출계수는 양수여야 합니다.');
  }

  // 결과 검증
  if (output.emissions < 0) {
    errors.push('배출량은 음수가 될 수 없습니다.');
  }

  // Scope별 특수 검증
  if (input.scope === 'scope2_market' && (input.renewableEnergy ?? 0) > input.activityData) {
    errors.push('재생에너지 전력량이 총 전력량을 초과할 수 없습니다.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Scope별 계산 공식 생성
 * 사람이 읽을 수 있는 형식의 계산식
 */
export function generateCalculationFormula(
  input: CalculateEmissionsInput,
  factorValue: number,
  result: number
): string {
  const actData = input.activityData.toFixed(2);
  const factor = factorValue.toFixed(6);
  const res = result.toFixed(6);

  switch (input.scope) {
    case 'scope1':
      return `배출량 = 연료량(${actData} ${input.activityUnit}) × 배출계수(${factor} tCO2/${input.activityUnit}) = ${res} tCO2eq`;

    case 'scope2_location':
      return `배출량 = 전력(${actData} ${input.activityUnit}) × 지역계수(${factor} tCO2/${input.activityUnit}) = ${res} tCO2eq`;

    case 'scope2_market': {
      const renewable = input.renewableEnergy ?? 0;
      const gridPortion = input.activityData - renewable;
      return `배출량 = [그리드(${gridPortion.toFixed(2)} kWh) × ${factor} + 재생(${renewable.toFixed(2)} kWh) × 0] = ${res} tCO2eq`;
    }

    case 'scope3':
      return `배출량 = 활동량(${actData} ${input.activityUnit}) × 배출계수(${factor} tCO2/${input.activityUnit}) = ${res} tCO2eq`;

    default:
      return `배출량 = ${actData} × ${factor} = ${res} tCO2eq`;
  }
}
