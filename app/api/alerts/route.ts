/**
 * GET /api/alerts
 *
 * 테넌트 전체 알림 로그 조회 (notification_log 기반)
 *
 * 쿼리 파라미터:
 *   summary=true  → 심각도별 카운트 + 최근 5건 (Header badge용)
 *   severity      → critical | warning | info (필터)
 *   days          → 최근 N일 (기본: 30)
 *   skip, take    → 페이지네이션 (기본: 0, 50)
 */

import { NextRequest } from 'next/server';
import { AlertSeverity } from '@prisma/client';
import { verifyAuth } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import {
  successResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      console.warn('[Alerts] 인증 실패 - 쿠키 또는 세션 없음');
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const summary  = searchParams.get('summary') === 'true';
    const severityRaw = searchParams.get('severity');
    const severity = Object.values(AlertSeverity).includes(severityRaw as AlertSeverity)
      ? (severityRaw as AlertSeverity)
      : undefined;
    const days     = Math.min(parseInt(searchParams.get('days') || '30', 10), 365);
    const skip     = Math.max(parseInt(searchParams.get('skip') || '0', 10), 0);
    const take     = Math.min(parseInt(searchParams.get('take') || '50', 10), 100);

    const since = new Date();
    since.setDate(since.getDate() - days);

    // summary 모드: 카운트 + 최근 5건 (Header 드롭다운용)
    if (summary) {
      const [criticalCount, warningCount, infoCount, recent] = await Promise.all([
        prisma.notificationLog.count({
          where: {
            createdAt: { gte: since },
            rule: { tenantId: auth.tenantId, severity: 'critical' },
          },
        }),
        prisma.notificationLog.count({
          where: {
            createdAt: { gte: since },
            rule: { tenantId: auth.tenantId, severity: 'warning' },
          },
        }),
        prisma.notificationLog.count({
          where: {
            createdAt: { gte: since },
            rule: { tenantId: auth.tenantId, severity: 'info' },
          },
        }),
        prisma.notificationLog.findMany({
          where: {
            createdAt: { gte: since },
            rule: { tenantId: auth.tenantId },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            subject: true,
            status: true,
            createdAt: true,
            rule: { select: { name: true, category: true, severity: true } },
          },
        }),
      ]);

      return successResponse({
        counts: {
          critical: criticalCount,
          warning:  warningCount,
          info:     infoCount,
          total:    criticalCount + warningCount + infoCount,
        },
        recent,
      });
    }

    // 목록 모드: 페이지네이션
    const where = {
      createdAt: { gte: since },
      rule: {
        tenantId: auth.tenantId,
        ...(severity ? { severity } : {}),
      },
    };

    const [logs, total] = await Promise.all([
      prisma.notificationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          channel: true,
          recipient: true,
          subject: true,
          body: true,
          status: true,
          errorMsg: true,
          sentAt: true,
          createdAt: true,
          rule: { select: { name: true, category: true, severity: true } },
        },
      }),
      prisma.notificationLog.count({ where }),
    ]);

    console.log(`[Alerts] tenantId=${auth.tenantId} → ${total}건 조회`);

    return successResponse(logs, {
      pagination: { skip, take, total, hasMore: skip + take < total },
    });
  } catch (error) {
    console.error('[Alerts] GET Error:', error);
    return serverErrorResponse();
  }
}
