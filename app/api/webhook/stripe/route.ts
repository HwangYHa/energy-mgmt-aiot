/**
 * POST /api/webhook/stripe
 *
 * Stripe 웹훅 핸들러
 *
 * 처리 이벤트:
 *   checkout.session.completed     → 구독 활성화 (최초 결제)
 *   invoice.payment_succeeded      → 구독 갱신 기록
 *   invoice.payment_failed         → 구독 정지 (SUSPENDED)
 *   customer.subscription.deleted  → 구독 종료 (TERMINATED)
 *   customer.subscription.updated  → 구독 변경 반영
 *
 * 주의: Next.js는 request body를 Stream으로 읽어야 Stripe 서명 검증 가능
 *       → export const runtime = 'nodejs' + request.arrayBuffer() 패턴
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { constructStripeEvent } from '@/lib/services/stripe.service';
import { prisma } from '@/lib/db/prisma';
import { invalidateTenantPermissionCache } from '@/lib/auth/permission-engine';
import { SubscriptionStatus, PaymentStatus, BillingCycle, AuditResult, PlanTier } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const runtime  = 'nodejs';   // Stripe 서명 검증은 Node.js 런타임 필요

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'stripe-signature 헤더 누락' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const payload = Buffer.from(await request.arrayBuffer());
    event = constructStripeEvent(payload, signature);
  } catch (err) {
    console.error('[Stripe Webhook] 서명 검증 실패:', err);
    return NextResponse.json({ error: '웹훅 서명 검증 실패' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      default:
        // 처리하지 않는 이벤트 — 무시 (200 반환 필수)
        break;
    }
  } catch (err) {
    console.error(`[Stripe Webhook] 이벤트 처리 실패 (${event.type}):`, err);
    // 500 반환 시 Stripe가 재전송 → 멱등성 처리 중요
    return NextResponse.json({ error: '이벤트 처리 중 오류 발생' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// ── checkout.session.completed ─────────────────────────────────
// 최초 결제 완료: 구독 활성화
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const { tenantId, userId, tier, billingCycle } = session.metadata ?? {};
  if (!tenantId || !tier || !billingCycle) {
    console.warn('[Stripe Webhook] checkout.session.completed — metadata 누락', session.id);
    return;
  }

  const stripeSubId      = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription?.id;
  const stripeCustomerId = typeof session.customer === 'string'
    ? session.customer
    : session.customer?.id;
  const amountTotal      = (session.amount_total ?? 0) / 100; // cent → 원 (USD 기준)

  // 중복 처리 방지 (이미 이 session_id로 구독이 있으면 skip)
  const dup = await prisma.subscription.findFirst({
    where: { tenantId, metadata: { path: '$.stripeSessionId', equals: session.id } },
  });
  if (dup) return;

  // 플랜 조회
  const plan = await prisma.plan.findFirst({
    where: { tier: tier as PlanTier, isActive: true },
  });
  if (!plan) {
    console.error('[Stripe Webhook] 플랜 없음:', tier);
    return;
  }

  // 기존 활성 구독 만료
  await prisma.subscription.updateMany({
    where: {
      tenantId,
      status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAID, SubscriptionStatus.EXPIRE_SOON] },
    },
    data: { status: SubscriptionStatus.EXPIRED },
  });

  // 날짜 계산
  const now      = new Date();
  const endDate  = new Date(now);
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
      startDate:     now,
      endDate,
      paymentStatus: PaymentStatus.paid,
      paymentMethod: 'stripe',
      billingCycle:  billingCycle as BillingCycle,
      autoRenew:     true,
      metadata: {
        stripeSessionId:   session.id,
        stripeSubId:       stripeSubId ?? null,
        stripeCustomerId:  stripeCustomerId ?? null,
        provider:          'stripe',
        tier,
        billingCycle,
        amountTotal,
      },
    },
  });

  // 결제 내역 기록
  await prisma.paymentHistory.create({
    data: {
      tenantId,
      subscriptionId: subscription.id,
      amount:         amountTotal,
      currency:       session.currency?.toUpperCase() ?? 'USD',
      status:         PaymentStatus.paid,
      method:         'stripe',
      transactionId:  session.id,
      paidAt:         now,
    },
  });

  // 감사 로그
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId:       userId ?? 'stripe-webhook',
      action:       'PAYMENT_COMPLETED',
      resourceType: 'payment',
      resourceId:   subscription.id,
      result:       AuditResult.success,
      changes: {
        provider: 'stripe',
        planId:   plan.id,
        tier,
        billingCycle,
        amount:   amountTotal,
        sessionId: session.id,
      },
    },
  });

  // 권한 캐시 무효화
  invalidateTenantPermissionCache(tenantId).catch(console.error);
}

// ── invoice.payment_succeeded ──────────────────────────────────
// 구독 갱신 결제 성공: PaymentHistory 기록 + 구독 endDate 연장
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  // Stripe v20: invoice.parent.subscription_details.subscription
  const subDetail = invoice.parent?.subscription_details;
  const stripeSubId = subDetail?.subscription
    ? typeof subDetail.subscription === 'string'
      ? subDetail.subscription
      : subDetail.subscription.id
    : null;
  if (!stripeSubId) return;

  const tenantId = subDetail?.metadata?.tenantId as string | undefined;

  if (!tenantId) {
    // metadata에서 tenantId를 못 찾으면 subscription metadata에서 찾기
    const sub = await prisma.subscription.findFirst({
      where: { metadata: { path: '$.stripeSubId', equals: stripeSubId } },
    });
    if (!sub) return;

    const amountPaid = (invoice.amount_paid ?? 0) / 100;
    await prisma.paymentHistory.create({
      data: {
        tenantId:       sub.tenantId,
        subscriptionId: sub.id,
        amount:         amountPaid,
        currency:       invoice.currency.toUpperCase(),
        status:         PaymentStatus.paid,
        method:         'stripe',
        transactionId:  invoice.id,
        paidAt:         new Date(),
      },
    });

    // endDate 연장 (billingCycle 기반)
    const billingCycle = (sub.metadata as any)?.billingCycle as string | undefined;
    const newEnd = new Date(sub.endDate);
    if (billingCycle === 'yearly') {
      newEnd.setFullYear(newEnd.getFullYear() + 1);
    } else {
      newEnd.setMonth(newEnd.getMonth() + 1);
    }

    await prisma.subscription.update({
      where: { id: sub.id },
      data:  { endDate: newEnd, status: SubscriptionStatus.ACTIVE, paymentStatus: PaymentStatus.paid },
    });
    return;
  }

  // tenantId를 직접 얻은 경우
  const sub = await prisma.subscription.findFirst({
    where: { tenantId, metadata: { path: '$.stripeSubId', equals: stripeSubId } },
    orderBy: { createdAt: 'desc' },
  });
  if (!sub) return;

  const amountPaid = (invoice.amount_paid ?? 0) / 100;
  await prisma.paymentHistory.create({
    data: {
      tenantId,
      subscriptionId: sub.id,
      amount:         amountPaid,
      currency:       invoice.currency.toUpperCase(),
      status:         PaymentStatus.paid,
      method:         'stripe',
      transactionId:  invoice.id,
      paidAt:         new Date(),
    },
  });
}

// ── invoice.payment_failed ─────────────────────────────────────
// 구독 갱신 결제 실패: 구독 SUSPENDED
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subDetail = invoice.parent?.subscription_details;
  const stripeSubId = subDetail?.subscription
    ? typeof subDetail.subscription === 'string'
      ? subDetail.subscription
      : subDetail.subscription.id
    : null;
  if (!stripeSubId) return;

  const sub = await prisma.subscription.findFirst({
    where: { metadata: { path: '$.stripeSubId', equals: stripeSubId } },
  });
  if (!sub) return;

  await prisma.subscription.update({
    where: { id: sub.id },
    data:  { status: SubscriptionStatus.SUSPENDED, paymentStatus: PaymentStatus.failed },
  });

  await prisma.paymentHistory.create({
    data: {
      tenantId:       sub.tenantId,
      subscriptionId: sub.id,
      amount:         (invoice.amount_due ?? 0) / 100,
      currency:       invoice.currency.toUpperCase(),
      status:         PaymentStatus.failed,
      method:         'stripe',
      transactionId:  invoice.id,
      failReason:     '자동 갱신 결제 실패',
    },
  });
}

// ── customer.subscription.deleted ─────────────────────────────
// 구독 취소 완료: TERMINATED
async function handleSubscriptionDeleted(stripeSub: Stripe.Subscription) {
  const sub = await prisma.subscription.findFirst({
    where: { metadata: { path: '$.stripeSubId', equals: stripeSub.id } },
  });
  if (!sub) return;

  await prisma.subscription.update({
    where: { id: sub.id },
    data:  { status: SubscriptionStatus.TERMINATED, autoRenew: false },
  });

  invalidateTenantPermissionCache(sub.tenantId).catch(console.error);
}

// ── customer.subscription.updated ─────────────────────────────
// 구독 상태 변경 (cancel_at_period_end 등)
async function handleSubscriptionUpdated(stripeSub: Stripe.Subscription) {
  const sub = await prisma.subscription.findFirst({
    where: { metadata: { path: '$.stripeSubId', equals: stripeSub.id } },
  });
  if (!sub) return;

  // cancel_at_period_end=true → autoRenew=false로 표시
  if (stripeSub.cancel_at_period_end) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data:  { autoRenew: false },
    });
  }
}
