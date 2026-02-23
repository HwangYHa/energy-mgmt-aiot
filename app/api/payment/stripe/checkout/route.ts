/**
 * Stripe Checkout Session API
 *
 * POST /api/payment/stripe/checkout
 * - tier + billingCycle을 받아 Stripe Checkout Session 생성
 * - Stripe Price ID는 환경변수에서 조회 (클라이언트에 노출 불필요)
 *
 * 세금 전략:
 * - STRIPE_TAX_AUTO=true 시 Stripe Tax 자동 적용 (국가별 VAT/GST)
 * - 한국 사업자: 부가세(10%) 자동 계산 + 세금계산서 발행 가능
 * - 환경변수 STRIPE_TAX_RATE_ID 설정 시 수동 세율 적용
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/session';
import { createCheckoutSession } from '@/lib/services/stripe.service';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

// 환경변수 기반 Stripe Price ID 조회
// 실 서비스: Stripe Dashboard에서 Price 생성 후 env에 등록
const STRIPE_PRICE_MAP: Record<string, Record<string, string | undefined>> = {
  basic: {
    monthly: process.env.STRIPE_BASIC_MONTHLY_PRICE_ID,
    yearly:  process.env.STRIPE_BASIC_YEARLY_PRICE_ID,
  },
  pro: {
    monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
    yearly:  process.env.STRIPE_PRO_YEARLY_PRICE_ID,
  },
};

const checkoutSchema = z.object({
  tier: z.enum(['basic', 'pro']),
  billingCycle: z.enum(['monthly', 'yearly']).default('monthly'),
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
    const { tier, billingCycle } = checkoutSchema.parse(body);

    // 3. Stripe Price ID 조회 (환경변수)
    const priceId = STRIPE_PRICE_MAP[tier]?.[billingCycle];
    if (!priceId) {
      console.warn(`[Stripe Checkout] Price ID not configured for ${tier}/${billingCycle}`);
      return NextResponse.json(
        { error: `결제 설정이 완료되지 않았습니다 (${tier}/${billingCycle}). 관리자에게 문의해주세요.` },
        { status: 503 }
      );
    }

    // 4. DB 플랜 조회 (planId 확보)
    const plan = await prisma.plan.findFirst({
      where: { tier: tier as 'trial' | 'basic' | 'pro' | 'enterprise', isActive: true },
    });
    if (!plan) {
      return NextResponse.json({ error: '플랜을 찾을 수 없습니다' }, { status: 404 });
    }

    // 5. Stripe Checkout Session 생성
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const checkoutSession = await createCheckoutSession({
      priceId,
      userId: session.user.id,
      userEmail: session.user.email || '',
      successUrl: `${baseUrl}/settings/subscription?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl:  `${baseUrl}/settings/subscription?checkout=cancel`,
      metadata: {
        planId:      plan.id,
        tier,
        billingCycle,
        tenantId:    session.user.tenantId || '',
      },
    });

    // 6. 감사 로그
    await prisma.auditLog.create({
      data: {
        tenantId:     session.user.tenantId || null,
        userId:       session.user.id,
        action:       'PAYMENT_SESSION_CREATED',
        resourceType: 'payment',
        resourceId:   checkoutSession.id,
        changes: {
          provider:     'stripe',
          planId:       plan.id,
          tier,
          billingCycle,
          priceId,
          amount:       checkoutSession.amount_total,
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
