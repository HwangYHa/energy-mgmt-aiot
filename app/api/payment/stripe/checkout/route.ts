/**
 * POST /api/payment/stripe/checkout
 *
 * Stripe Checkout Session 생성 후 결제 URL 반환
 * 클라이언트 → 이 API → Stripe Checkout 페이지로 리다이렉트
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/session';
import { createStripeCheckoutSession, isStripeConfigured } from '@/lib/services/stripe.service';
import { z } from 'zod';

const bodySchema = z.object({
  tier:         z.enum(['basic', 'pro']),
  billingCycle: z.enum(['monthly', 'yearly']).default('monthly'),
});

export async function POST(request: NextRequest) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Stripe 결제가 아직 설정되지 않았습니다.' },
        { status: 503 }
      );
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ success: false, error: '테넌트 정보를 찾을 수 없습니다.' }, { status: 400 });
    }

    const body = await request.json();
    const { tier, billingCycle } = bodySchema.parse(body);

    const origin = request.headers.get('origin') || process.env.NEXTAUTH_URL || '';

    const checkoutUrl = await createStripeCheckoutSession({
      tier,
      billingCycle,
      tenantId,
      userId: session.user.id,
      customerEmail: session.user.email ?? '',
      customerName:  session.user.name ?? undefined,
      successUrl: `${origin}/payment/stripe/success?session_id={CHECKOUT_SESSION_ID}&tier=${tier}&billingCycle=${billingCycle}`,
      cancelUrl:  `${origin}/payment/stripe/cancel`,
    });

    return NextResponse.json({ success: true, url: checkoutUrl });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: '잘못된 요청입니다.', details: error.errors }, { status: 400 });
    }
    console.error('[Stripe Checkout]', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '결제 세션 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
