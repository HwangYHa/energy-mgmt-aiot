/**
 * /api/admin/tenants - Super Admin 테넌트 관리 API
 *
 * GET: 전체 테넌트 목록 (super_admin 전용)
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
    const status = searchParams.get('status');
    const skip = parseInt(searchParams.get('skip') || '0');
    const take = Math.min(parseInt(searchParams.get('take') || '20'), 50);

    const where: Record<string, unknown> = { deletedAt: null };
    if (status) where.status = status;

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        select: {
          id: true,
          name: true,
          businessNumber: true,
          domain: true,
          industryType: true,
          status: true,
          createdAt: true,
          _count: {
            select: {
              users: true,
              sites: true,
              devices: true,
              sensors: true,
            },
          },
          subscriptions: {
            where: { status: 'ACTIVE' },
            take: 1,
            select: {
              id: true,
              status: true,
              endDate: true,
              plan: {
                select: { id: true, name: true, tier: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.tenant.count({ where }),
    ]);

    // 각 테넌트의 측정 데이터 수 (오늘)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const enriched = await Promise.all(
      tenants.map(async (t) => {
        const measurementsToday = await prisma.measurement.count({
          where: { tenantId: t.id, time: { gte: todayStart } },
        });
        return {
          ...t,
          subscription: t.subscriptions[0] || null,
          subscriptions: undefined,
          measurementsToday,
        };
      })
    );

    return successResponse(enriched, {
      pagination: { skip, take, total, hasMore: skip + take < total },
    });
  } catch (error) {
    console.error('[API] 테넌트 목록 조회 오류:', error);
    return serverErrorResponse();
  }
}
