import { prisma } from '@/lib/db/prisma';

export async function createSubscription(
  tenantId: string,
  planId: string,
  userId: string
) {
  // 플랜 검증
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan || !plan.isActive) {
    throw new Error('Invalid plan');
  }

  // 구독 생성
  return prisma.$transaction(async (tx) => {
    const subscription = await tx.subscription.create({
      data: {
        tenantId,
        planId,
        status: 'PRE_PAYMENT',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30일
        autoRenew: true,
      },
    });

    await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'SUBSCRIPTION_CREATED',
        resourceType: 'subscription',
        resourceId: subscription.id,
      },
    });

    return subscription;
  });
}

export async function cancelSubscription(subscriptionId: string, userId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    throw new Error('Subscription not found');
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'TERMINATED', autoRenew: false },
    });

    await tx.auditLog.create({
      data: {
        tenantId: subscription.tenantId,
        userId,
        action: 'SUBSCRIPTION_CANCELLED',
        resourceType: 'subscription',
        resourceId: subscriptionId,
      },
    });

    return updated;
  });
}
