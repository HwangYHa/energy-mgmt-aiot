/**
 * ApproveEmissionFactor UseCase
 * 배출계수 승인 (DRAFT/PENDING_REVIEW → APPROVED)
 *
 * 비즈니스 규칙:
 * 1. 이미 승인된 계수 재승인 불가
 * 2. REJECTED 계수는 재승인 불가 (새 버전 생성 필요)
 * 3. 승인 즉시 isActive=true (계산에 사용 가능)
 * 4. 감사 로그: APPROVED (이전 CREATED 로그와 체인)
 * 5. 승인자 정보 완전 기록 (이름, 시각, 사유)
 */

import type { IEmissionFactorRepository } from '../../domain/repositories/IEmissionFactorRepository';
import { EmissionFactorAuditService } from '../../services/emission-factor-audit.service';
import {
  EmissionFactorNotFoundError,
  EmissionFactorAlreadyApprovedError,
  CarbonDomainError,
} from '../../domain/errors';

export interface ApproveEmissionFactorInput {
  factorId: string;
  approvedBy: string;     // User ID
  approvalReason?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ApproveEmissionFactorOutput {
  factorId: string;
  version: string;
  approvedAt: Date;
  message: string;
}

export class ApproveEmissionFactorUseCase {
  constructor(private readonly repo: IEmissionFactorRepository) {}

  async execute(input: ApproveEmissionFactorInput): Promise<ApproveEmissionFactorOutput> {
    // 1. 레코드 조회
    const factor = await this.repo.findById(input.factorId);
    if (!factor) {
      throw new EmissionFactorNotFoundError({
        tenantId: 'unknown',
        code: `id:${input.factorId}`,
      });
    }

    // 2. 상태 검증
    if (factor.approvalStatus === 'APPROVED') {
      throw new EmissionFactorAlreadyApprovedError(input.factorId);
    }
    if (factor.approvalStatus === 'REJECTED') {
      throw new CarbonDomainError(
        `거부된 배출계수는 재승인 불가합니다. 새 버전을 생성하십시오. factorId=${input.factorId}`,
        'CANNOT_APPROVE_REJECTED'
      );
    }

    const approvedAt = new Date();

    // 3. 승인 상태 업데이트
    await this.repo.updateApprovalStatus({
      id: input.factorId,
      approvalStatus: 'APPROVED',
      isActive: true,
      approvedBy: input.approvedBy,
      approvedAt,
    });

    // 4. 감사 로그 (Hash-chain)
    await EmissionFactorAuditService.recordChange({
      emissionFactorId: input.factorId,
      changeType: 'APPROVED',
      newValue: factor.factorValue,
      changeReason: input.approvalReason,
      requestedBy: input.approvedBy,
      approvedBy: input.approvedBy,
      requestedAt: approvedAt,
    });

    return {
      factorId: input.factorId,
      version: factor.version,
      approvedAt,
      message: `배출계수 v${factor.version} 승인 완료. 즉시 계산에 사용 가능합니다.`,
    };
  }
}
