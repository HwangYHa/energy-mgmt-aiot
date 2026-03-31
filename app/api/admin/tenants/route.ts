/**
 * /api/admin/tenants - Super Admin 테넌트 관리 API
 *
 * GET: 전체 테넌트 목록 + 집계 통계 (super_admin 전용)
 *   ?q=검색어        이름/도메인 서버 검색
 *   ?status=active   상태 필터
 *   ?skip=0&take=20  페이지네이션
 */

import { NextRequest } from 'next/server';
import { verifyAuth, isSuperAdmin } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
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
    if (!isSuperAdmin(auth)) return forbiddenResponse();

    const { searchParams } = new URL(request.url);
    const q      = searchParams.get('q')?.trim() || '';
    const status = searchParams.get('status');
    const skip   = Math.max(0, parseInt(searchParams.get('skip') || '0'));
    const take   = Math.min(parseInt(searchParams.get('take') || '20'), 100);

    const where: Record<string, unknown> = { deletedAt: null };
    if (status) where.status = status;
    if (q) {
      where.OR = [
        { name:   { contains: q } },
        { domain: { contains: q } },
      ];
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [tenants, total, globalStats] = await Promise.all([
      prisma.tenant.findMany({
        where,
        select: {
          id:             true,
          name:           true,
          businessNumber: true,
          domain:         true,
          industryType:   true,
          status:         true,
          createdAt:      true,
          _count: {
            select: {
              users:   true,
              sites:   true,
              devices: true,
              sensors: true,
            },
          },
          subscriptions: {
            where: { status: 'ACTIVE' },
            take: 1,
            select: {
              id:      true,
              status:  true,
              endDate: true,
              plan: { select: { id: true, name: true, tier: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.tenant.count({ where }),
      // 전체 통계 (검색/필터 무관한 전체 집계)
      Promise.all([
        prisma.tenant.count({ where: { deletedAt: null } }),
        prisma.tenant.count({ where: { deletedAt: null, status: 'active' } }),
        prisma.tenant.count({ where: { deletedAt: null, status: 'suspended' } }),
        prisma.user.count(),
        prisma.measurement.count({ where: { time: { gte: todayStart } } }).catch(() => 0),
      ]),
    ]);

    const [totalTenants, activeTenants, suspendedTenants, totalUsers, measurementsToday] = globalStats;

    // 현재 페이지 테넌트의 오늘 측정 데이터 수 (groupBy 단일 쿼리)
    const measurementCounts = await prisma.measurement.groupBy({
      by: ['tenantId'],
      where: {
        tenantId: { in: tenants.map((t) => t.id) },
        time: { gte: todayStart },
      },
      _count: { _all: true },
    }).catch(() => []);

    const countMap = new Map(measurementCounts.map((mc) => [mc.tenantId, mc._count._all]));

    const enriched = tenants.map((t) => ({
      ...t,
      subscription:  t.subscriptions[0] || null,
      subscriptions: undefined,
      measurementsToday: countMap.get(t.id) ?? 0,
    }));

    return successResponse(enriched, {
      pagination: { skip, take, total, hasMore: skip + take < total },
      meta: {
        stats: {
          totalTenants,
          activeTenants,
          suspendedTenants,
          totalUsers,
          measurementsToday,
        },
      },
    });
  } catch (error) {
    console.error('[API] 테넌트 목록 조회 오류:', error);
    return serverErrorResponse();
  }
}
