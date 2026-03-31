/**
 * POST /api/payment/stripe/portal
 *
 * Stripe Customer Portal 세션 생성
 * 구독 취소 / 결제 수단 변경 / 청구 내역 등을 Stripe 호스팅 페이지에서 처리
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/session';
import { getStripe, isStripeConfigured } from '@/lib/services/stripe.service';
import { prisma } from '@/lib/db/prisma';

export async function POST(request: NextRequest) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json({ success: false, error: 'Stripe가 설정되지 않았습니다.' }, { status: 503 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { tenantId } = session.user;

    // 현재 Stripe 구독에서 customerId 추출
    const sub = await prisma.subscription.findFirst({
      where: {
        tenantId,
        paymentMethod: 'stripe',
        status: { notIn: ['TERMINATED', 'EXPIRED'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    const stripeCustomerId = (sub?.metadata as any)?.stripeCustomerId as string | undefined;
    if (!stripeCustomerId) {
      return NextResponse.json(
        { success: false, error: 'Stripe 구독 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const origin = request.headers.get('origin') || process.env.NEXTAUTH_URL || '';
    const stripe = getStripe();

    const portalSession = await stripe.billingPortal.sessions.create({
      customer:   stripeCustomerId,
      return_url: `${origin}/settings/subscription`,
    });

    return NextResponse.json({ success: true, url: portalSession.url });
  } catch (error) {
    console.error('[Stripe Portal]', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '포털 세션 생성 실패' },
      { status: 500 }
    );
  }
}
