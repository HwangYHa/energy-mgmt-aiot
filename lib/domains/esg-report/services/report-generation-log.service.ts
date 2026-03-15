/**
 * ReportGenerationLogService
 * 리포트 생성 시도 감사 로그 (Append-only)
 *
 * Big4 감사 대응:
 * - 생성 시도: pending → success | failed
 * - 실패 사유 보존 (errorMessage)
 * - 입력값 SHA-256 (inputHash) → 재현 가능성 증명
 */

import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';
import type { GenerateESGReportInput } from '../types/esg-report.types';

const db = prisma as any; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface StartLogInput {
  tenantId: string;
  standard: string;
  period: string;
  triggeredBy: string;
  input?: GenerateESGReportInput;
}

export class ReportGenerationLogService {
  /**
   * 생성 시작 기록 → logId 반환 (이후 completeLog/failLog에 전달)
   */
  static async startLog(input: StartLogInput): Promise<string> {
    const inputHash = input.input
      ? crypto.createHash('sha256')
          .update(JSON.stringify(input.input, Object.keys(input.input).sort()))
          .digest('hex')
      : null;

    const log = await db.reportGenerationLog.create({
      data: {
        tenantId: input.tenantId,
        standard: input.standard,
        period: input.period,
        status: 'pending',
        triggeredBy: input.triggeredBy,
        inputHash,
      },
      select: { id: true },
    });

    return log.id;
  }

  /**
   * 생성 성공 기록
   */
  static async completeLog(logId: string, reportId: string, durationMs: number): Promise<void> {
    await db.reportGenerationLog.update({
      where: { id: logId },
      data: { status: 'success', reportId, durationMs },
    });
  }

  /**
   * 생성 실패 기록
   */
  static async failLog(logId: string, error: unknown, durationMs: number): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await db.reportGenerationLog.update({
      where: { id: logId },
      data: { status: 'failed', errorMessage, durationMs },
    });
  }

  /**
   * 테넌트의 생성 로그 목록 (최신순)
   */
  static async list(tenantId: string, options: { limit?: number } = {}) {
    return db.reportGenerationLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: options.limit ?? 50,
    });
  }
}
