/**
 * CalculateEmissions UseCase
 * 배출량 계산의 단일 진입점 (Application Layer)
 *
 * 외부(API Route, Job 등)에서 배출량 계산이 필요할 때 이 UseCase를 통해서만 접근.
 * CalculationEngine을 래핑하여 Repository 주입 및 에러 변환 담당.
 *
 * Big4 감사 필수:
 * - 계산에 사용된 배출계수 ID/Version 추적
 * - 계산 공식(formula) 문자열 반환
 * - 동일 입력 → 동일 출력 (deterministic)
 */

import { CalculationEngine, type CalculationInput, type CalculationResult } from '../calculation-engine/CalculationEngine';
import { PrismaEmissionFactorRepository } from '../../infrastructure/repositories/PrismaEmissionFactorRepository';
import { EmissionFactorNotFoundError, CalculationValidationError } from '../../domain/errors';

export type { CalculationInput, CalculationResult };

export interface CalculateEmissionsOutput {
  success: true;
  result: CalculationResult;
}

export interface CalculateEmissionsError {
  success: false;
  errorCode: 'FACTOR_NOT_FOUND' | 'VALIDATION_ERROR' | 'UNSUPPORTED_SCOPE' | 'SERVER_ERROR';
  message: string;
  details?: string[];
}

export type CalculateEmissionsResponse = CalculateEmissionsOutput | CalculateEmissionsError;

export class CalculateEmissionsUseCase {
  private readonly engine: CalculationEngine;

  constructor() {
    // 기본: PrismaEmissionFactorRepository 사용
    // 테스트 시: 생성자에서 주입 가능
    this.engine = new CalculationEngine(new PrismaEmissionFactorRepository());
  }

  /** 의존성 주입용 (테스트에서 Mock Repository 사용) */
  static withRepository(repo: ConstructorParameters<typeof CalculationEngine>[0]): CalculateEmissionsUseCase {
    const instance = new CalculateEmissionsUseCase();
    // @ts-expect-error: engine은 readonly이지만 테스트 전용 주입
    instance.engine = new CalculationEngine(repo);
    return instance;
  }

  async execute(input: CalculationInput): Promise<CalculateEmissionsResponse> {
    try {
      const result = await this.engine.calculate(input);
      return { success: true, result };
    } catch (e) {
      if (e instanceof EmissionFactorNotFoundError) {
        return {
          success: false,
          errorCode: 'FACTOR_NOT_FOUND',
          message: e.message,
        };
      }
      if (e instanceof CalculationValidationError) {
        return {
          success: false,
          errorCode: 'VALIDATION_ERROR',
          message: e.message,
          details: e.errors,
        };
      }
      return {
        success: false,
        errorCode: 'SERVER_ERROR',
        message: e instanceof Error ? e.message : '배출량 계산 중 오류가 발생했습니다',
      };
    }
  }
}
