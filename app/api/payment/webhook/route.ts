/**
 * Iamport 결제 웹훅 API
 *
 * 결제 완료 시 Iamport가 호출하는 웹훅
 * - 결제 검증
 * - Tenant 생성/활성화
 * - tenant_admin 권한 부여
 * - Subscription 생성/갱신
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyPayment } from '@/lib/services/iamport.service';
import { z } from 'zod';

const webhookSchema = z.object({
  imp_uid: z.string(),
  merchant_uid: z.string(),
  status: z.enum(['paid', 'ready', 'failed', 'cancelled']),
});

export async function POST(request: NextRequest) {
  try {
    // 1. 웹훅 데이터 검증
    const body = await request.json();
    const { imp_uid, merchant_uid, status } = webhookSchema.parse(body);

    console.log('[Webhook] Received payment webhook:', {
      imp_uid,
      merchant_uid,
      status,
    });

    // 2. 결제 완료가 아니면 무시
    if (status !== 'paid') {
      console.log('[Webhook] Payment status is not paid, skipping');
      return NextResponse.json({ success: true, message: 'Skipped' });
    }

    // 3. Iamport에서 결제 정보 검증
    const payment = await verifyPayment(imp_uid);

    if (payment.status !== 'paid') {
      console.error('[Webhook] Payment verification failed: status not paid');
      return NextResponse.json(
        { error: 'Payment not completed' },
        { status: 400 }
      );
    }

    // 4. merchant_uid에서 userId와 planId 추출
    // 형식: `${userId}_${planId}_${timestamp}`
    const [userId, planId] = merchant_uid.split('_');

    if (!userId || !planId) {
      console.error('[Webhook] Invalid merchant_uid format:', merchant_uid);
      return NextResponse.json(
        { error: 'Invalid merchant_uid' },
        { status: 400 }
      );
    }

    // 5. 사용자 조회
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });

    if (!user) {
      console.error('[Webhook] User not found:', userId);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 6. 플랜 조회
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan || !plan.isActive) {
      console.error('[Webhook] Plan not found or inactive:', planId);
      return NextResponse.json(
        { error: 'Invalid plan' },
        { status: 400 }
      );
    }

    // 7. 결제 금액 검증
    const expectedAmount =
      Number(plan.monthlyPrice) ||
      Number(plan.yearlyPrice) ||
      0;

    if (payment.paid_amount !== expectedAmount) {
      console.error('[Webhook] Payment amount mismatch:', {
        expected: expectedAmount,
        actual: payment.paid_amount,
      });
      return NextResponse.json(
        { error: 'Payment amount mismatch' },
        { status: 400 }
      );
    }

    // 8. 트랜잭션으로 Tenant 생성/활성화 + Subscription 생성 + 권한 부여
    const result = await prisma.$transaction(async (tx) => {
      let tenant = user.tenant;

      // Tenant가 없으면 생성
      if (!tenant) {
        tenant = await tx.tenant.create({
          data: {
            name: user.name || user.email,
          },
        });

        // 사용자에게 tenantId 할당
        await tx.user.update({
          where: { id: userId },
          data: { tenantId: tenant.id },
        });
      }

      // 사용자 권한을 tenant_admin으로 업그레이드
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          role: 'tenant_admin',
          isActive: true,
          isEmailVerified: true,
        },
      });

      // 기존 활성 구독 종료
      await tx.subscription.updateMany({
        where: {
          tenantId: tenant.id,
          status: { in: ['ACTIVE', 'PRE_PAYMENT', 'PAID'] },
        },
        data: {
          status: 'TERMINATED',
          autoRenew: false,
        },
      });

      // 새 구독 생성
      const subscription = await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          planId: plan.id,
          status: 'PAID',
          billingCycle: plan.yearlyPrice ? 'yearly' : 'monthly',
          autoRenew: true,
          startDate: new Date(),
          endDate: new Date(
            Date.now() +
              (plan.yearlyPrice ? 365 : 30) * 24 * 60 * 60 * 1000
          ),
        },
      });

      // 결제 기록 생성 (Payment 모델이 schema에 정의되면 활성화)
      // await tx.payment.create({
      //   data: {
      //     tenantId: tenant.id,
      //     subscriptionId: subscription.id,
      //     amount: payment.paid_amount,
      //     status: 'SUCCESS',
      //     method: payment.pay_method,
      //     provider: 'IAMPORT',
      //     providerPaymentId: payment.imp_uid,
      //     receiptUrl: payment.receipt_url,
      //     metadata: {
      //       merchant_uid: payment.merchant_uid,
      //       buyer_name: payment.buyer_name,
      //       buyer_email: payment.buyer_email,
      //     },
      //   },
      // });

      // 감사 로그 기록
      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          action: 'PAYMENT_COMPLETED',
          resourceType: 'subscription',
          resourceId: subscription.id,
          changes: {
            plan: plan.name,
            amount: payment.paid_amount,
            imp_uid: payment.imp_uid,
            role_upgraded: 'tenant_admin',
          },
        },
      });

      return {
        tenant,
        user: updatedUser,
        subscription,
      };
    });

    console.log('[Webhook] Payment processed successfully:', {
      tenantId: result.tenant.id,
      userId: result.user.id,
      subscriptionId: result.subscription.id,
    });

    return NextResponse.json({
      success: true,
      data: {
        tenantId: result.tenant.id,
        subscriptionId: result.subscription.id,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid webhook data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[Webhook] Payment webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
