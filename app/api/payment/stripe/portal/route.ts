/**
 * POST /api/payment/stripe/portal
 *
 * Stripe Customer Portal 세션 생성
 * - 구독 취소 / 업그레이드 / 다운그레이드
 * - 결제 수단 변경
 * - 인보이스 내역 조회
 * - 세금계산서 발행 정보 수정
 *
 * 사용:
 *   const { url } = await apiPost('/api/payment/stripe/portal', {});
 *   window.location.href = url;  // Stripe Hosted Portal로 이동
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import { stripe } from '@/lib/services/stripe.service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  try {
    const tenantId = auth.tenantId;

    // 활성 구독에서 Stripe Customer ID 조회
    const activeSub = await prisma.subscription.findFirst({
      where: {
        tenantId,
        status: { in: ['ACTIVE', 'EXPIRE_SOON'] },
      },
      orderBy: { startDate: 'desc' },
    });

    if (!activeSub) {
      return NextResponse.json(
        { error: '활성 구독이 없습니다. 먼저 플랜을 구독하세요.' },
        { status: 404 }
      );
    }

    const meta = activeSub.metadata as Record<string, string> | null;
    const stripeCustomerId = meta?.stripeCustomerId;

    if (!stripeCustomerId) {
      return NextResponse.json(
        {
          error: 'Stripe 고객 정보가 없습니다.',
          hint: '결제 시스템을 통해 구독을 시작해야 Customer Portal을 이용할 수 있습니다.',
        },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    // Stripe Customer Portal 세션 생성
    const portalSession = await stripe().billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${baseUrl}/settings/subscription`,
    });

    // AuditLog
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: auth.userId ?? null,
        action: 'BILLING_PORTAL_ACCESSED',
        resourceType: 'subscription',
        resourceId: activeSub.id,
        changes: { stripeCustomerId, portalSessionId: portalSession.id },
      },
    }).catch(() => null);

    return NextResponse.json({
      success: true,
      url: portalSession.url,
    });
  } catch (error) {
    console.error('[Stripe Portal] 오류:', error);
    return NextResponse.json(
      { error: 'Billing Portal 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
