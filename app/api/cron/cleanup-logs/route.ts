/**
 * /api/cron/cleanup-logs - 로그 보관 정책 자동 삭제
 *
 * 테넌트별 logPolicy 설정(auditLogRetentionDays, accessLogRetentionDays,
 * autoDeleteEnabled)을 읽어 보관 기간 초과 레코드를 삭제합니다.
 *
 * 사용법:
 *   GET /api/cron/cleanup-logs?secret=CRON_SECRET
 *
 * 환경변수: CRON_SECRET (필수)
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getSystemSettings } from '@/lib/services/system-settings.service';
import { successResponse, serverErrorResponse } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const provided = request.nextUrl.searchParams.get('secret')
    ?? request.headers.get('authorization')?.replace('Bearer ', '');

  if (!secret) {
    const host = request.headers.get('host') ?? '';
    return host.startsWith('localhost') || host.startsWith('127.0.0.1');
  }
  return provided === secret;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  const summary: Record<string, { auditDeleted: number; notifDeleted: number; measurementDeleted: number }> = {};
  let errorCount = 0;

  try {
    // 전체 테넌트 목록 조회
    const tenants = await prisma.tenant.findMany({
      select: { id: true },
    });

    for (const { id: tenantId } of tenants) {
      try {
        const settings = await getSystemSettings(tenantId);
        const policy = settings.logPolicy;

        // autoDeleteEnabled = false → 해당 테넌트 삭제 건너뜀
        if (!policy.autoDeleteEnabled) continue;

        const auditCutoff = new Date(
          Date.now() - policy.auditLogRetentionDays * 24 * 60 * 60 * 1000,
        );
        const accessCutoff = new Date(
          Date.now() - policy.accessLogRetentionDays * 24 * 60 * 60 * 1000,
        );
        // 측정 데이터 보존 기간 (dataCollection.retentionDays)
        const measurementCutoff = new Date(
          Date.now() - settings.dataCollection.retentionDays * 24 * 60 * 60 * 1000,
        );

        // 1. 감사 로그 삭제
        const auditResult = await prisma.auditLog.deleteMany({
          where: {
            createdAt: { lt: auditCutoff },
            // AuditLog에 tenantId가 있으면 필터, 없으면 전체 (여기서는 tenantId 없음)
          },
        });

        // 2. 알림 로그 삭제 (accessLogRetentionDays 기준)
        const notifResult = await prisma.notificationLog.deleteMany({
          where: {
            createdAt: { lt: accessCutoff },
            rule: { tenantId },
          },
        });

        // 3. 측정 데이터 삭제 (retentionDays 기준)
        let measurementDeleted = 0;
        try {
          const measResult = await (prisma as any).measurement.deleteMany({
            where: {
              tenantId,
              time: { lt: measurementCutoff },
            },
          });
          measurementDeleted = measResult.count ?? 0;
        } catch {
          // measurement 테이블 스키마에 tenantId 없을 수 있음
        }

        summary[tenantId.slice(0, 8)] = {
          auditDeleted:       auditResult.count,
          notifDeleted:       notifResult.count,
          measurementDeleted,
        };
      } catch (err) {
        console.error(`[CleanupLogs] 테넌트 ${tenantId} 정리 오류:`, err);
        errorCount++;
      }
    }

    const totalAudit       = Object.values(summary).reduce((a, b) => a + b.auditDeleted, 0);
    const totalNotif        = Object.values(summary).reduce((a, b) => a + b.notifDeleted, 0);
    const totalMeasurement  = Object.values(summary).reduce((a, b) => a + b.measurementDeleted, 0);

    console.info(
      `[CleanupLogs] 완료: 감사로그 ${totalAudit}건, 알림로그 ${totalNotif}건, ` +
      `측정데이터 ${totalMeasurement}건 삭제, 오류 ${errorCount}건, ` +
      `${Date.now() - startedAt}ms`,
    );

    return successResponse({
      deletedAt: new Date().toISOString(),
      summary,
      totals: { auditDeleted: totalAudit, notifDeleted: totalNotif, measurementDeleted: totalMeasurement },
      errorCount,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error('[CleanupLogs] 크론 실행 오류:', error);
    return serverErrorResponse();
  }
}
