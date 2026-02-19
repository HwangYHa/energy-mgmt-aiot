/**
 * 결제 완료 검증 API
 *
 * 클라이언트에서 결제 완료 후 호출
 * - 결제 검증
 * - Subscription 상태 확인
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { validatePayment } from '@/lib/services/iamport.service';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

const completeSchema = z.object({
  imp_uid: z.string(),
  merchant_uid: z.string(),
  paid_amount: z.number(),
});

export async function POST(request: NextRequest) {
  try {
    // 1. 인증 검증
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. 입력 검증
    const body = await request.json();
    const { imp_uid, merchant_uid, paid_amount } = completeSchema.parse(body);

    // 3. Iamport에서 결제 검증
    const { valid, payment } = await validatePayment(
      imp_uid,
      paid_amount,
      merchant_uid
    );

    if (!valid || !payment) {
      console.error('[Payment Complete] Payment validation failed');
      return NextResponse.json(
        { error: 'Payment validation failed' },
        { status: 400 }
      );
    }

    // 4. 중복 결제 방지 - imp_uid 기준 멱등성 체크
    const existingPayment = await prisma.paymentHistory.findFirst({
      where: { transactionId: imp_uid },
    });

    if (existingPayment) {
      console.warn('[Payment Complete] Duplicate imp_uid detected:', imp_uid);
      return NextResponse.json(
        { error: 'Payment already processed' },
        { status: 409 }
      );
    }

    // 5. 트랜잭션: Subscription 조회 + 상태 업데이트 + PaymentHistory 생성
    const result = await prisma.$transaction(async (tx) => {
      // 구독 조회 (PRE_PAYMENT 또는 PAID 상태)
      const subscription = await tx.subscription.findFirst({
        where: {
          tenantId: auth.tenantId,
          status: { in: ['PRE_PAYMENT', 'PAID', 'ACTIVE'] },
        },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      });

      if (!subscription) {
        throw new Error('SUBSCRIPTION_NOT_FOUND');
      }

      // 구독 상태를 ACTIVE로 업데이트 (PRE_PAYMENT → ACTIVE)
      const updatedSubscription = await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'ACTIVE',
          updatedAt: new Date(),
        },
        include: { plan: true },
      });

      // PaymentHistory 레코드 생성
      await tx.paymentHistory.create({
        data: {
          tenantId: auth.tenantId,
          subscriptionId: subscription.id,
          amount: payment.paid_amount,
          currency: 'KRW',
          status: 'paid',
          method: payment.pay_method ?? null,
          transactionId: imp_uid,
          receiptUrl: payment.receipt_url ?? null,
          paidAt: payment.paid_at ? new Date(payment.paid_at * 1000) : new Date(),
        },
      });

      return updatedSubscription;
    });

    // 6. 사용자 정보 조회
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        subscription: {
          id: result.id,
          planName: result.plan.name,
          status: result.status,
          startDate: result.startDate,
          endDate: result.endDate,
        },
        user: {
          role: user.role,
          isEmailVerified: user.isEmailVerified,
        },
        payment: {
          imp_uid: payment.imp_uid,
          paid_amount: payment.paid_amount,
          paid_at: payment.paid_at,
          receipt_url: payment.receipt_url,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === 'SUBSCRIPTION_NOT_FOUND') {
      console.error('[Payment Complete] Subscription not found');
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    console.error('[Payment Complete] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
