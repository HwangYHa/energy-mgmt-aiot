/**
 * POST /api/payment/toss/confirm
 *
 * 토스페이먼츠 결제 승인 및 구독 활성화
 * 1. 토스페이먼츠 /v1/payments/confirm 호출
 * 2. 기존 구독 비활성화
 * 3. 새 구독 ACTIVE 상태로 생성
 * 4. PaymentHistory 기록
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/session';
import { TossService } from '@/lib/services/toss.service';
import { prisma } from '@/lib/db/prisma';
import { invalidateTenantPermissionCache } from '@/lib/auth/permission-engine';
import { SubscriptionStatus, PaymentStatus, BillingCycle, AuditResult, PlanTier } from '@prisma/client';
import { z } from 'zod';

const confirmSchema = z.object({
  paymentKey:   z.string().min(1),
  orderId:      z.string().min(1),
  amount:       z.number().positive(),
  tier:         z.enum(['basic', 'pro']),
  billingCycle: z.enum(['monthly', 'yearly']).default('monthly'),
});

export async function POST(request: NextRequest) {
  try {
    // 1. 인증
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ success: false, error: '테넌트 정보를 찾을 수 없습니다.' }, { status: 400 });
    }

    // 2. 입력 검증
    const body = await request.json();
    const { paymentKey, orderId, amount, tier, billingCycle } = confirmSchema.parse(body);

    // 3. 중복 결제 방지 (같은 paymentKey 이미 처리됨)
    const existing = await prisma.subscription.findFirst({
      where: { tenantId, metadata: { path: '$.paymentKey', equals: paymentKey } },
    });
    if (existing) {
      return NextResponse.json({ success: true, subscription: existing, duplicate: true });
    }

    // 4. 토스페이먼츠 결제 승인
    const payment = await TossService.confirmPayment(paymentKey, orderId, amount);

    // 5. DB 플랜 조회
    const plan = await prisma.plan.findFirst({
      where: { tier: tier as PlanTier, isActive: true },
    });
    if (!plan) {
      return NextResponse.json({ success: false, error: '플랜을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 6. 기존 활성 구독 만료 처리
    await prisma.subscription.updateMany({
      where: { tenantId, status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAID, SubscriptionStatus.EXPIRE_SOON] } },
      data:  { status: SubscriptionStatus.EXPIRED },
    });

    // 7. 구독 생성
    const now       = new Date();
    const startDate = now;
    const endDate   = new Date(now);
    if (billingCycle === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    const subscription = await prisma.subscription.create({
      data: {
        tenantId,
        planId:        plan.id,
        status:        SubscriptionStatus.ACTIVE,
        startDate,
        endDate,
        paymentStatus: PaymentStatus.paid,
        paymentMethod: 'toss',
        billingCycle:  billingCycle as BillingCycle,
        autoRenew:     true,
        metadata: {
          paymentKey,
          orderId,
          amount,
          approvedAt:  payment.approvedAt,
          method:      payment.method,
          provider:    'toss',
          receiptUrl:  payment.receipt?.url ?? null,
        },
      },
    });

    // 8. 결제 내역 기록
    await prisma.paymentHistory.create({
      data: {
        tenantId,
        subscriptionId: subscription.id,
        amount,
        currency:      'KRW',
        status:        PaymentStatus.paid,
        method:        payment.method || 'toss',
        transactionId: paymentKey,
        receiptUrl:    payment.receipt?.url ?? null,
        paidAt:        new Date(payment.approvedAt),
      },
    });

    // 9. 감사 로그
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId:       session.user.id,
        action:       'PAYMENT_COMPLETED',
        resourceType: 'payment',
        resourceId:   subscription.id,
        result:       AuditResult.success,
        changes: {
          provider:    'toss',
          planId:      plan.id,
          tier,
          billingCycle,
          amount,
          paymentKey,
        },
      },
    });

    // 결제 완료 후 권한 캐시 즉시 무효화 (플랜 업그레이드 즉시 반영)
    invalidateTenantPermissionCache(tenantId).catch(err =>
      console.error('[TossConfirm] 캐시 무효화 실패:', err)
    );

    return NextResponse.json({ success: true, subscription });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: '잘못된 요청입니다.', details: error.errors },
        { status: 400 }
      );
    }
    console.error('[Toss Confirm] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '결제 확인 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
