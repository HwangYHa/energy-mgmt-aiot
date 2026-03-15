/**
 * GET /api/esg-reports/[id]/audit-log
 *
 * ESG 보고서 감사 로그 조회 (Append-only)
 * - 보고서 상태 전환 이력 전체 조회
 * - generate → submit_review → approve → publish 등 모든 액션 포함
 * - Big4 감사 대응: 누가, 언제, 어떤 상태 전환을 수행했는지 추적
 */

import { type NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify';
import { successResponse, errorResponse } from '@/lib/api/response';
import { ReportAuditService } from '@/lib/domains/esg-report/services/report-audit.service';

const db = prisma as any; // eslint-disable-line @typescript-eslint/no-explicit-any

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await verifyAuth(req);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });

  const { id } = await params;

  // 테넌트 소유 확인 (스냅샷 불필요 — id + tenantId만 검증)
  const exists = await db.eSGReport.findFirst({
    where: { id, tenantId: auth.tenantId },
    select: { id: true, reportNo: true, standard: true, status: true },
  });

  if (!exists) {
    return errorResponse('RESOURCE_NOT_FOUND', { status: 404 });
  }

  try {
    const logs = await ReportAuditService.getHistory(id);

    return successResponse({
      reportId: id,
      reportNo: exists.reportNo,
      standard: exists.standard,
      currentStatus: exists.status,
      totalEntries: logs.length,
      entries: logs.map((entry) => ({
        id: entry.id,
        action: entry.action,
        fromStatus: entry.fromStatus,
        toStatus: entry.toStatus,
        performedBy: entry.performedBy,
        note: entry.note,
        metadata: entry.metadata,
        timestamp: entry.createdAt,
      })),
    });
  } catch (e) {
    console.error('[ESG AuditLog GET]', e);
    return errorResponse('SERVER_ERROR', { status: 500 });
  }
}
