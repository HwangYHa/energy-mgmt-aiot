/**
 * /api/cron/cleanup-logs - 로그 보관 정책 자동 삭제
 *
 * 테넌트별 logPolicy 설정(auditLogRetentionDays, accessLogRetentionDays,
 * autoDeleteEnabled)을 읽어 보관 기간 초과 레코드를 삭제합니다.
 *
 * 크론 주기 (docker-compose cron 서비스):
 *   매일 새벽 03:00 KST
 *
 * 사용법:
 *   GET /api/cron/cleanup-logs
 *   Authorization: Bearer ${CRON_SECRET}
 *
 * 환경변수: CRON_SECRET (필수)
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getSystemSettings } from '@/lib/services/system-settings.service';
import { successResponse, serverErrorResponse } from '@/lib/api/response';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;

  const auth = request.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;

  // 로컬 개발 환경 허용
  const host = request.headers.get('host') ?? '';
  return host.startsWith('localhost') || host.startsWith('127.0.0.1');
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  const summary: Record<string, {
    auditDeleted: number;
    notifDeleted: number;
    activityDeleted: number;
    measurementDeleted: number;
  }> = {};
  let errorCount = 0;

  try {
    const tenants = await prisma.tenant.findMany({
      select: { id: true },
    });

    for (const { id: tenantId } of tenants) {
      try {
        const settings = await getSystemSettings(tenantId);
        const policy   = settings.logPolicy;

        // autoDeleteEnabled = false → 해당 테넌트 건너뜀
        if (!policy.autoDeleteEnabled) continue;

        const auditCutoff = new Date(
          Date.now() - policy.auditLogRetentionDays * 24 * 60 * 60 * 1000,
        );
        const accessCutoff = new Date(
          Date.now() - policy.accessLogRetentionDays * 24 * 60 * 60 * 1000,
        );
        const measurementCutoff = new Date(
          Date.now() - settings.dataCollection.retentionDays * 24 * 60 * 60 * 1000,
        );

        // 1. 감사 로그 삭제 — tenantId 필터 필수 (타 테넌트 로그 절대 삭제 금지)
        const auditResult = await prisma.auditLog.deleteMany({
          where: {
            tenantId,
            createdAt: { lt: auditCutoff },
          },
        });

        // 2. 알림 로그 삭제
        const notifResult = await prisma.notificationLog.deleteMany({
          where: {
            createdAt: { lt: accessCutoff },
            rule: { tenantId },
          },
        });

        // 3. 활동 로그 삭제 (accessLogRetentionDays 기준)
        let activityDeleted = 0;
        try {
          const actResult = await (prisma as any).activityLog?.deleteMany({
            where: {
              tenantId,
              createdAt: { lt: accessCutoff },
            },
          });
          activityDeleted = actResult?.count ?? 0;
        } catch { /* activityLog 테이블 없을 수 있음 */ }

        // 4. 측정 데이터 삭제 (dataCollection.retentionDays 기준)
        let measurementDeleted = 0;
        try {
          const measResult = await (prisma as any).measurement.deleteMany({
            where: {
              tenantId,
              time: { lt: measurementCutoff },
            },
          });
          measurementDeleted = measResult.count ?? 0;
        } catch { /* measurement 없을 수 있음 */ }

        summary[tenantId.slice(0, 8)] = {
          auditDeleted:       auditResult.count,
          notifDeleted:       notifResult.count,
          activityDeleted,
          measurementDeleted,
        };

      } catch (err) {
        console.error(`[CleanupLogs] 테넌트 ${tenantId} 정리 오류:`, err);
        errorCount++;
      }
    }

    const totals = Object.values(summary).reduce(
      (acc, t) => ({
        auditDeleted:       acc.auditDeleted       + t.auditDeleted,
        notifDeleted:       acc.notifDeleted       + t.notifDeleted,
        activityDeleted:    acc.activityDeleted    + t.activityDeleted,
        measurementDeleted: acc.measurementDeleted + t.measurementDeleted,
      }),
      { auditDeleted: 0, notifDeleted: 0, activityDeleted: 0, measurementDeleted: 0 },
    );

    console.info(
      `[CleanupLogs] 완료 — 감사로그 ${totals.auditDeleted}건, ` +
      `알림로그 ${totals.notifDeleted}건, 활동로그 ${totals.activityDeleted}건, ` +
      `측정데이터 ${totals.measurementDeleted}건 삭제, 오류 ${errorCount}건, ` +
      `${Date.now() - startedAt}ms`,
    );

    return successResponse({
      deletedAt:  new Date().toISOString(),
      summary,
      totals,
      errorCount,
      durationMs: Date.now() - startedAt,
    });

  } catch (error) {
    console.error('[CleanupLogs] 크론 실행 오류:', error);
    return serverErrorResponse();
  }
}
