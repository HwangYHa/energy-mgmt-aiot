/**
 * Stripe Checkout Session API
 *
 * POST /api/payment/stripe/checkout
 * - Checkout Session 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/session';
import { createCheckoutSession } from '@/lib/services/stripe.service';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

const checkoutSchema = z.object({
  planId: z.string().uuid(),
  priceId: z.string(), // Stripe Price ID
});

export async function POST(request: NextRequest) {
  try {
    // 1. 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. 입력 검증
    const body = await request.json();
    const { planId, priceId } = checkoutSchema.parse(body);

    // 3. 플랜 존재 확인
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan || !plan.isActive) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // 4. Stripe Checkout Session 생성
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const checkoutSession = await createCheckoutSession({
      priceId,
      userId: session.user.id,
      userEmail: session.user.email || '',
      successUrl: `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/payment/cancel`,
      metadata: {
        planId,
        tenantId: session.user.tenantId || '',
      },
    });

    // 5. 결제 세션 정보 DB에 임시 저장 (선택사항)
    await prisma.auditLog.create({
      data: {
        tenantId: session.user.tenantId || null,
        userId: session.user.id,
        action: 'PAYMENT_SESSION_CREATED',
        resourceType: 'payment',
        resourceId: checkoutSession.id,
        changes: {
          provider: 'stripe',
          planId,
          priceId,
          amount: checkoutSession.amount_total,
        },
      },
    });

    return NextResponse.json({
      success: true,
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[Stripe Checkout] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
