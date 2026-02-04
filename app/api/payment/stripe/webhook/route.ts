/**
 * Stripe 웹훅 API
 *
 * POST /api/payment/stripe/webhook
 * - 결제 완료 이벤트 처리
 * - 구독 생성/갱신/취소 처리
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { constructWebhookEvent } from '@/lib/services/stripe.service';
import { prisma } from '@/lib/db/prisma';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  try {
    // 1. 웹훅 서명 검증
    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'No signature provided' },
        { status: 400 }
      );
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('[Stripe Webhook] STRIPE_WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    let event: Stripe.Event;
    try {
      event = constructWebhookEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('[Stripe Webhook] Signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // 2. 이벤트 타입별 처리
    console.log('[Stripe Webhook] Received event:', event.type);

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Stripe Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

/**
 * Checkout Session 완료 처리
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const planId = session.metadata?.planId;
  const tenantId = session.metadata?.tenantId;

  if (!userId || !planId) {
    console.error('[Stripe Webhook] Missing metadata in checkout session');
    return;
  }

  // 사용자 조회
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { tenant: true },
  });

  if (!user) {
    console.error('[Stripe Webhook] User not found:', userId);
    return;
  }

  // 플랜 조회
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    console.error('[Stripe Webhook] Plan not found:', planId);
    return;
  }

  // 트랜잭션으로 처리
  await prisma.$transaction(async (tx) => {
    // Tenant 생성 (없는 경우)
    let tenant = user.tenant;
    if (!tenant && tenantId) {
      tenant = await tx.tenant.create({
        data: {
          name: user.name || user.email,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { tenantId: tenant.id },
      });
    }

    if (!tenant) {
      throw new Error('Tenant is required for subscription');
    }

    // 사용자 권한 업그레이드 (Viewer → Tenant Admin)
    if (user.role === 'viewer') {
      await tx.user.update({
        where: { id: userId },
        data: {
          role: 'tenant_admin',
          isActive: true,
          isEmailVerified: true,
        },
      });
    }

    // 기존 활성 구독 종료
    await tx.subscription.updateMany({
      where: {
        tenantId: tenant.id,
        status: { in: ['ACTIVE', 'PAID', 'PRE_PAYMENT'] },
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
        status: 'ACTIVE',
        billingCycle: session.mode === 'subscription' ? 'monthly' : 'lifetime',
        autoRenew: session.mode === 'subscription',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30일 후
      },
    });

    // 감사 로그
    await tx.auditLog.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        action: 'PAYMENT_COMPLETED',
        resourceType: 'subscription',
        resourceId: subscription.id,
        changes: {
          provider: 'stripe',
          sessionId: session.id,
          planId: plan.id,
          amount: session.amount_total,
          role_upgraded: user.role === 'viewer' ? 'tenant_admin' : user.role,
        },
      },
    });
  });

  console.log('[Stripe Webhook] Checkout session completed:', session.id);
}

/**
 * 구독 생성 처리
 */
async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log('[Stripe Webhook] Subscription created:', subscription.id);
  // 추가 로직 필요 시 구현
}

/**
 * 구독 업데이트 처리
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('[Stripe Webhook] Subscription updated:', subscription.id);
  // 플랜 변경, 갱신 등 처리
}

/**
 * 구독 삭제 처리
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('[Stripe Webhook] Subscription deleted:', subscription.id);

  const userId = subscription.metadata?.userId;
  if (!userId) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || !user.tenantId) return;

  // 구독 상태 업데이트
  await prisma.subscription.updateMany({
    where: {
      tenantId: user.tenantId,
      status: 'ACTIVE',
    },
    data: {
      status: 'TERMINATED',
      autoRenew: false,
    },
  });
}

/**
 * 인보이스 결제 성공 처리
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('[Stripe Webhook] Invoice payment succeeded:', invoice.id);
  // 갱신 결제 성공 처리
}

/**
 * 인보이스 결제 실패 처리
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  console.log('[Stripe Webhook] Invoice payment failed:', invoice.id);
  // 결제 실패 알림 등
}
