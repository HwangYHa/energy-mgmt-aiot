import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, requireRoleOrHigher } from '@/lib/auth/verify';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // tenant_admin 이상만 조회 가능
    if (!requireRoleOrHigher(auth, 'tenant_admin' as UserRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // 현재 활성 구독
    const subscription = await prisma.subscription.findFirst({
      where: {
        tenantId: auth.tenantId,
        status: { in: ['ACTIVE', 'EXPIRE_SOON'] },
      },
      include: { plan: true },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: 'No active subscription' },
        { status: 404 }
      );
    }

    // 사용량 집계
    const [sitesCount, devicesCount, usersCount] = await Promise.all([
      prisma.site.count({ where: { tenantId: auth.tenantId, deletedAt: null } }),
      prisma.device.count({
        where: { tenantId: auth.tenantId, deletedAt: null },
      }),
      prisma.user.count({ where: { tenantId: auth.tenantId, isActive: true } }),
    ]);

    const usage = {
      sites: {
        current: sitesCount,
        limit: subscription.plan.maxSites,
        percentage: subscription.plan.maxSites
          ? (sitesCount / subscription.plan.maxSites) * 100
          : 0,
      },
      devices: {
        current: devicesCount,
        limit: subscription.plan.maxDevices,
        percentage: subscription.plan.maxDevices
          ? (devicesCount / subscription.plan.maxDevices) * 100
          : 0,
      },
      users: {
        current: usersCount,
        limit: subscription.plan.maxUsers,
        percentage: subscription.plan.maxUsers
          ? (usersCount / subscription.plan.maxUsers) * 100
          : 0,
      },
      dataRetentionDays: subscription.plan.dataRetentionDays,
      apiRateLimit: subscription.plan.apiRateLimit,
    };

    return NextResponse.json({ success: true, data: usage });
  } catch (error) {
    console.error('[API] Usage fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
