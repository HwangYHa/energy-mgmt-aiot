/**
 * /api/compliance/audit-trail - 감사 추적 API
 *
 * GET: 감사 로그 조회 (site_manager 이상)
 */

import { NextRequest } from 'next/server';
import { verifyAuth, requireRoleOrHigher } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import { UserRole } from '@/lib/constants/roles';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  serverErrorResponse,
} from '@/lib/api/response';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!requireRoleOrHigher(auth, 'site_manager' as UserRole)) {
      return forbiddenResponse();
    }

    const { tenantId } = auth;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const resourceType = searchParams.get('resourceType');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const skip = parseInt(searchParams.get('skip') || '0');
    const take = Math.min(parseInt(searchParams.get('take') || '50'), 100);

    const where: Record<string, unknown> = { tenantId };
    if (action) where.action = { contains: action };
    if (resourceType) where.resourceType = resourceType;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Record<string, unknown>).gte = new Date(startDate);
      if (endDate) (where.createdAt as Record<string, unknown>).lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.auditLog.count({ where }),
    ]);

    // 리소스 유형별 집계
    const resourceTypes = await prisma.auditLog.groupBy({
      by: ['resourceType'],
      where: { tenantId },
      _count: true,
      orderBy: { _count: { resourceType: 'desc' } },
    });

    // 오늘 로그 수
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayCount = await prisma.auditLog.count({
      where: { tenantId, createdAt: { gte: todayStart } },
    });

    return successResponse(logs, {
      pagination: { skip, take, total, hasMore: skip + take < total },
      meta: {
        resourceTypes: resourceTypes.map((r) => ({ type: r.resourceType, count: r._count })),
        todayCount,
      },
    });
  } catch (error) {
    console.error('[API] 감사 로그 조회 오류:', error);
    return serverErrorResponse();
  }
}
