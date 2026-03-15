/**
 * VerifyAuditChain UseCase
 * 배출계수 감사 체인 무결성 검증
 *
 * Big4 감사 대응:
 * 1. 전체 Hash Chain 재계산
 * 2. 변조된 항목 목록 반환 (ID, 예상 해시 vs 실제 해시)
 * 3. 검증 결과를 audit report에 첨부 가능
 */

import { EmissionFactorAuditService } from '../../services/emission-factor-audit.service';

export interface VerifyAuditChainInput {
  factorId: string;
}

export interface IntegrityReport {
  factorId: string;
  isIntact: boolean;
  totalLogs: number;
  tamperedEntries?: Array<{
    id: string;
    expectedHash: string;
    actualHash: string;
  }>;
  verifiedAt: Date;
  /** 감사 보고서용 요약 */
  summary: string;
}

export class VerifyAuditChainUseCase {
  async execute(input: VerifyAuditChainInput): Promise<IntegrityReport> {
    const result = await EmissionFactorAuditService.verifyIntegrity(input.factorId);

    const verifiedAt = new Date();

    const summary = result.isValid
      ? `감사 체인 무결성 확인 완료. 총 ${result.totalLogs}개 로그, 변조 없음. (검증 시각: ${verifiedAt.toISOString()})`
      : `⚠️ 감사 체인 무결성 위반 감지! 총 ${result.totalLogs}개 로그 중 ${result.tamperedLogs?.length ?? 0}개 변조됨. 즉시 조사 필요.`;

    return {
      factorId: input.factorId,
      isIntact: result.isValid,
      totalLogs: result.totalLogs,
      tamperedEntries: result.tamperedLogs,
      verifiedAt,
      summary,
    };
  }
}
