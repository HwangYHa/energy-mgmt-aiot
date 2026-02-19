/**
 * /api/cron/cleanup-logs - 로그 보관 정책 자동 삭제
 *
 * 사용법:
 *   GET /api/cron/cleanup-logs?secret=CRON_SECRET
 *
 * 호출 방식:
 *   - Vercel Cron Jobs (vercel.json crons 설정)
 *   - 외부 스케줄러 (cron-job.org, GitHub Actions 등)
 *
 * 환경변수: CRON_SECRET (필수)
 * 기본 보관 기간: 90일 (AuditLog)
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { successResponse, serverErrorResponse } from '@/lib/api/response';
import logger from '@/lib/logger';

const DEFAULT_RETENTION_DAYS = 90;

export async function GET(request: NextRequest) {
  try {
    const secret = request.nextUrl.searchParams.get('secret');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || secret !== cronSecret) {
      logger.warn('Unauthorized cron attempt', {
        ip: request.headers.get('x-forwarded-for') || 'unknown',
      });
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const retentionDays = Number(process.env.LOG_RETENTION_DAYS) || DEFAULT_RETENTION_DAYS;
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    logger.info('Starting log cleanup', { retentionDays, cutoff: cutoff.toISOString() });

    // AuditLog 삭제
    const auditResult = await prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    // NotificationLog 삭제 (알림 로그는 30일 보관)
    const notifCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const notifResult = await prisma.notificationLog.deleteMany({
      where: { createdAt: { lt: notifCutoff } },
    });

    const result = {
      deletedAt: new Date().toISOString(),
      retentionDays,
      deleted: {
        auditLogs: auditResult.count,
        notificationLogs: notifResult.count,
      },
    };

    logger.info('Log cleanup completed', result.deleted);

    return successResponse(result);
  } catch (error) {
    logger.error('Log cleanup error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return serverErrorResponse();
  }
}
