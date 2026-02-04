import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, requireRoleOrHigher } from '@/lib/auth/verify';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

const subscriptionCreateSchema = z.object({
  planId: z.string().uuid(),
  billingCycle: z.enum(['monthly', 'yearly', 'lifetime']),
  autoRenew: z.boolean().default(true),
});

// 현재 테넌트 구독 조회
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscription = await prisma.subscription.findFirst({
      where: {
        tenantId: auth.tenantId,
        status: { in: ['ACTIVE', 'EXPIRE_SOON'] },
      },
      include: {
        plan: true,
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { success: false, message: 'No active subscription' },
        { status: 404 }
      );
    }

    // 사용량 계산
    const [sitesCount, devicesCount, usersCount] = await Promise.all([
      prisma.site.count({ where: { tenantId: auth.tenantId, deletedAt: null } }),
      prisma.device.count({
        where: { tenantId: auth.tenantId, deletedAt: null },
      }),
      prisma.user.count({ where: { tenantId: auth.tenantId, isActive: true } }),
    ]);

    const usage = {
      sites: { current: sitesCount, limit: subscription.plan.maxSites },
      devices: { current: devicesCount, limit: subscription.plan.maxDevices },
      users: { current: usersCount, limit: subscription.plan.maxUsers },
    };

    return NextResponse.json({
      success: true,
      data: { ...subscription, usage },
    });
  } catch (error) {
    console.error('[API] Subscription fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 구독 생성
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // tenant_admin 이상 권한 필요
    if (!requireRoleOrHigher(auth, 'tenant_admin' as UserRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validated = subscriptionCreateSchema.parse(body);

    // 플랜 존재 확인
    const plan = await prisma.plan.findUnique({
      where: { id: validated.planId },
    });

    if (!plan || !plan.isActive) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // 기존 활성 구독 확인
    const existingSubscription = await prisma.subscription.findFirst({
      where: {
        tenantId: auth.tenantId,
        status: { in: ['ACTIVE', 'PRE_PAYMENT', 'PAID'] },
      },
    });

    if (existingSubscription) {
      return NextResponse.json(
        { error: 'Active subscription already exists' },
        { status: 400 }
      );
    }

    // 구독 생성
    const subscription = await prisma.$transaction(async (tx) => {
      const newSub = await tx.subscription.create({
        data: {
          tenantId: auth.tenantId,
          planId: validated.planId,
          status: 'PRE_PAYMENT',
          billingCycle: validated.billingCycle,
          autoRenew: validated.autoRenew,
          startDate: new Date(),
          endDate: new Date(
            Date.now() +
              (validated.billingCycle === 'yearly' ? 365 : 30) *
                24 *
                60 *
                60 *
                1000
          ),
        },
        include: { plan: true },
      });

      await tx.auditLog.create({
        data: {
          tenantId: auth.tenantId,
          userId: auth.userId,
          action: 'SUBSCRIPTION_CREATED',
          resourceType: 'subscription',
          resourceId: newSub.id,
        },
      });

      return newSub;
    });

    return NextResponse.json(
      { success: true, data: subscription },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[API] Subscription create error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
