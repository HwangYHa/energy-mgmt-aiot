/**
 * DeprecateEmissionFactor UseCase
 * 배출계수 폐지 (APPROVED → 비활성)
 *
 * 비즈니스 규칙:
 * 1. 폐지 사유 필수 (Big4 감사에서 "왜 더 이상 안 쓰나?" 질문 대응)
 * 2. 폐지 후에도 레코드 보존 (Append-only — 물리적 삭제 금지)
 * 3. 폐지된 계수로 계산했던 EmissionsRecord는 그대로 보존
 * 4. 감사 로그: DEPRECATED 기록
 */

import type { IEmissionFactorRepository } from '../../domain/repositories/IEmissionFactorRepository';
import { EmissionFactorAuditService } from '../../services/emission-factor-audit.service';
import { EmissionFactorNotFoundError, CalculationValidationError } from '../../domain/errors';

export interface DeprecateEmissionFactorInput {
  factorId: string;
  reason: string;             // 필수: 폐지 사유
  requestedBy: string;
  ipAddress?: string;
}

export interface DeprecateEmissionFactorOutput {
  factorId: string;
  version: string;
  deprecatedAt: Date;
  message: string;
}

export class DeprecateEmissionFactorUseCase {
  constructor(private readonly repo: IEmissionFactorRepository) {}

  async execute(input: DeprecateEmissionFactorInput): Promise<DeprecateEmissionFactorOutput> {
    // 1. 사유 필수 검증
    if (!input.reason || input.reason.trim().length < 5) {
      throw new CalculationValidationError(['폐지 사유는 최소 5자 이상이어야 합니다 (감사 기록 요건)']);
    }

    // 2. 레코드 조회
    const factor = await this.repo.findById(input.factorId);
    if (!factor) {
      throw new EmissionFactorNotFoundError({ tenantId: 'unknown', code: `id:${input.factorId}` });
    }

    const deprecatedAt = new Date();

    // 3. 비활성화 (approvalStatus는 APPROVED 유지 — "폐지"는 isActive=false)
    await this.repo.updateApprovalStatus({
      id: input.factorId,
      approvalStatus: factor.approvalStatus, // 기존 상태 유지
      isActive: false,
    });

    // 4. 감사 로그
    await EmissionFactorAuditService.recordChange({
      emissionFactorId: input.factorId,
      changeType: 'DEPRECATED',
      oldValue: factor.factorValue,
      changeReason: input.reason,
      requestedBy: input.requestedBy,
      requestedAt: deprecatedAt,
    });

    return {
      factorId: input.factorId,
      version: factor.version,
      deprecatedAt,
      message: `배출계수 v${factor.version} 폐지 완료. 기존 계산 기록은 보존됩니다.`,
    };
  }
}
