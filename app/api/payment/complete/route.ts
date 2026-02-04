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

    console.log('[Payment Complete] Validating payment:', {
      imp_uid,
      merchant_uid,
      userId: auth.userId,
    });

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

    // 4. Subscription 조회
    const subscription = await prisma.subscription.findFirst({
      where: {
        tenantId: auth.tenantId,
        status: { in: ['PAID', 'ACTIVE'] },
      },
      include: {
        plan: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!subscription) {
      console.error(
        '[Payment Complete] Subscription not found for tenant:',
        auth.tenantId
      );
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    // 5. 사용자 역할 확인 (tenant_admin으로 업그레이드 되었는지)
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
          id: subscription.id,
          planName: subscription.plan.name,
          status: subscription.status,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
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

    console.error('[Payment Complete] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
