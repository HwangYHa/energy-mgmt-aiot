/**
 * ReportAuditService
 * 리포트 상태 변경 감사 로그 (Append-only)
 *
 * Big4 감사 대응:
 * - 모든 상태 전환 기록 (generate → submit_review → approve → publish)
 * - 수행자 ID + 노트 + 메타데이터
 * - INSERT만 허용, UPDATE/DELETE 금지
 */

import { prisma } from '@/lib/db/prisma';
import type { ESGReportStatus } from '../types/esg-report.types';

const db = prisma as any; // eslint-disable-line @typescript-eslint/no-explicit-any

export type ReportAction =
  | 'generate'
  | 'submit_review'
  | 'approve'
  | 'publish'
  | 'withdraw'
  | 'reissue'
  | 'verify_integrity';

export interface ReportAuditEntry {
  reportId: string;
  tenantId: string;
  action: ReportAction;
  fromStatus?: ESGReportStatus | null;
  toStatus?: ESGReportStatus | null;
  performedBy: string;
  note?: string;
  metadata?: Record<string, unknown>;
}

export interface ReportAuditLog {
  id: string;
  reportId: string;
  tenantId: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  performedBy: string;
  note: string | null;
  metadata: unknown;
  createdAt: Date;
}

export class ReportAuditService {
  /**
   * 감사 로그 기록 (Append-only — 수정/삭제 불가)
   */
  static async log(entry: ReportAuditEntry): Promise<void> {
    await db.reportAuditLog.create({
      data: {
        reportId: entry.reportId,
        tenantId: entry.tenantId,
        action: entry.action,
        fromStatus: entry.fromStatus ?? null,
        toStatus: entry.toStatus ?? null,
        performedBy: entry.performedBy,
        note: entry.note ?? null,
        metadata: entry.metadata ? (entry.metadata as object) : null,
      },
    });
  }

  /**
   * 보고서 감사 로그 전체 조회 (시간순)
   */
  static async getHistory(reportId: string): Promise<ReportAuditLog[]> {
    return db.reportAuditLog.findMany({
      where: { reportId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * 테넌트 전체 감사 로그 (최신순, 필터 가능)
   */
  static async listByTenant(
    tenantId: string,
    options: { action?: ReportAction; limit?: number; page?: number } = {}
  ): Promise<{ items: ReportAuditLog[]; total: number }> {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, options.limit ?? 20);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };
    if (options.action) where.action = options.action;

    const [items, total] = await Promise.all([
      db.reportAuditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      db.reportAuditLog.count({ where }),
    ]);

    return { items, total };
  }
}
