/**
 * POST /api/payment/stripe/webhook
 *
 * Stripe 이벤트 수신 및 구독 상태 머신 업데이트
 *
 * 처리 이벤트:
 *   checkout.session.completed      → 최초 결제 완료 → Subscription ACTIVE 생성/업그레이드
 *   invoice.payment_succeeded       → 갱신 결제 성공 → endDate 연장 + PaymentHistory
 *   invoice.payment_failed          → 결제 실패 → EXPIRE_SOON (7일 유예)
 *   customer.subscription.updated   → 업그레이드/다운그레이드/취소 예약
 *   customer.subscription.deleted   → 구독 완전 해지 → TERMINATED
 *
 * 상태 머신:
 *   PRE_PAYMENT
 *     → (checkout 완료) → ACTIVE
 *       → (갱신 실패 7일) → EXPIRE_SOON → EXPIRED
 *       → (Stripe 해지) → TERMINATED
 *
 * 보안:
 *   stripe-signature 헤더 HMAC-SHA256 검증
 *   STRIPE_WEBHOOK_SECRET 환경변수 필수
 */

import { NextRequest, NextResponse } from 'next/server';
import { constructWebhookEvent } from '@/lib/services/stripe.service';
import { prisma } from '@/lib/db/prisma';
import { invalidateCacheByPrefix } from '@/lib/cache/redis';
import type Stripe from 'stripe';

export const dynamic = 'force-dynamic';

// ──────────────────────────────────────────────────────────────
// 헬퍼
// ──────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function billingPeriodDays(cycle: string | null | undefined): number {
  return cycle === 'yearly' ? 365 : 30;
}

function invalidateSubCache(tenantId: string) {
  // invalidateCacheByPrefix returns void (fire-and-forget)
  invalidateCacheByPrefix(`sub:${tenantId}`);
}

/**
 * Invoice에서 Stripe 구독 ID 추출 (Stripe v20 API 대응)
 * v20: invoice.parent.subscription_details.subscription
 */
function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const parent = invoice.parent;
  if (!parent || parent.type !== 'subscription_details') return null;
  const sub = parent.subscription_details?.subscription;
  if (!sub) return null;
  return typeof sub === 'string' ? sub : sub.id;
}

// ──────────────────────────────────────────────────────────────
// checkout.session.completed
// 최초 결제 완료 → 신규 구독 생성 또는 기존 구독 업그레이드
// ──────────────────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const { tenantId, planId, billingCycle, userId } = session.metadata ?? {};

  if (!tenantId || !planId) {
    console.error('[Webhook] checkout.session.completed: metadata 누락', { tenantId, planId });
    return;
  }

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) {
    console.error('[Webhook] 플랜 없음:', planId);
    return;
  }

  const stripeSubId = typeof session.subscription === 'string'
    ? session.subscription
    : (session.subscription as Stripe.Subscription | null)?.id;
  const stripeCustomerId = typeof session.customer === 'string'
    ? session.customer
    : (session.customer as Stripe.Customer | null)?.id;

  const cycle = (billingCycle === 'yearly' ? 'yearly' : 'monthly') as 'monthly' | 'yearly';
  const now = new Date();
  const endDate = addDays(now, billingPeriodDays(cycle));

  await prisma.$transaction(async (tx) => {
    // 기존 활성 구독 종료
    await tx.subscription.updateMany({
      where: {
        tenantId,
        status: { in: ['ACTIVE', 'EXPIRE_SOON', 'PRE_PAYMENT', 'PAID'] },
      },
      data: { status: 'TERMINATED', autoRenew: false },
    });

    // 신규 구독 생성
    const sub = await tx.subscription.create({
      data: {
        tenantId,
        planId,
        status: 'ACTIVE',
        paymentStatus: 'paid',
        billingCycle: cycle,
        autoRenew: true,
        startDate: now,
        endDate,
        metadata: {
          stripeSubscriptionId: stripeSubId,
          stripeCustomerId,
          checkoutSessionId: session.id,
        },
      },
    });

    // PaymentHistory 기록
    if (session.amount_total) {
      await tx.paymentHistory.create({
        data: {
          tenantId,
          subscriptionId: sub.id,
          amount: session.amount_total / 100, // Stripe: 최소 단위 (원화 × 100)
          currency: (session.currency ?? 'KRW').toUpperCase(),
          status: 'paid',
          method: 'card',
          transactionId: typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.id,
          paidAt: now,
        },
      });
    }

    // AuditLog
    await tx.auditLog.create({
      data: {
        tenantId,
        userId: userId ?? null,
        action: 'PAYMENT_COMPLETED',
        resourceType: 'subscription',
        resourceId: sub.id,
        changes: {
          provider: 'stripe',
          sessionId: session.id,
          planId,
          billingCycle: cycle,
          amount: session.amount_total,
          stripeSubscriptionId: stripeSubId,
        },
      },
    });
  });

  invalidateSubCache(tenantId);
  console.log('[Webhook] checkout 완료 — 구독 활성화:', tenantId, planId);
}

// ──────────────────────────────────────────────────────────────
// invoice.payment_succeeded — 갱신 결제 성공
// ──────────────────────────────────────────────────────────────

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const stripeSubId = getInvoiceSubscriptionId(invoice);
  if (!stripeSubId) return;

  const dbSub = await prisma.subscription.findFirst({
    where: { metadata: { path: '$.stripeSubscriptionId', equals: stripeSubId } },
  });
  if (!dbSub) {
    console.warn('[Webhook] invoice.payment_succeeded: DB 구독 없음', stripeSubId);
    return;
  }

  const newEnd = addDays(new Date(), billingPeriodDays(dbSub.billingCycle));

  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { id: dbSub.id },
      data: { status: 'ACTIVE', paymentStatus: 'paid', endDate: newEnd },
    });

    if (invoice.amount_paid) {
      // invoice.id를 transactionId로 사용 (Stripe v20: payment_intent 분리)
      await tx.paymentHistory.create({
        data: {
          tenantId: dbSub.tenantId,
          subscriptionId: dbSub.id,
          amount: invoice.amount_paid / 100,
          currency: (invoice.currency ?? 'KRW').toUpperCase(),
          status: 'paid',
          method: 'card',
          transactionId: invoice.id,
          receiptUrl: invoice.hosted_invoice_url ?? undefined,
          paidAt: new Date(),
        },
      });
    }
  });

  invalidateSubCache(dbSub.tenantId);
  console.log('[Webhook] 갱신 결제 성공 → endDate 연장:', dbSub.id, newEnd.toISOString().slice(0, 10));
}

// ──────────────────────────────────────────────────────────────
// invoice.payment_failed — 결제 실패 → 7일 유예 EXPIRE_SOON
// ──────────────────────────────────────────────────────────────

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const stripeSubId = getInvoiceSubscriptionId(invoice);
  if (!stripeSubId) return;

  const dbSub = await prisma.subscription.findFirst({
    where: { metadata: { path: '$.stripeSubscriptionId', equals: stripeSubId } },
  });
  if (!dbSub) return;

  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { id: dbSub.id },
      data: {
        status: 'EXPIRE_SOON',
        paymentStatus: 'failed',
        endDate: addDays(new Date(), 7), // 7일 유예
      },
    });

    if (invoice.amount_due) {
      await tx.paymentHistory.create({
        data: {
          tenantId: dbSub.tenantId,
          subscriptionId: dbSub.id,
          amount: invoice.amount_due / 100,
          currency: (invoice.currency ?? 'KRW').toUpperCase(),
          status: 'failed',
          method: 'card',
          transactionId: invoice.id,
          failReason: '정기 결제 실패 — 7일 유예 기간 시작',
          paidAt: null,
        },
      });
    }
  });

  invalidateSubCache(dbSub.tenantId);
  console.warn('[Webhook] 결제 실패 → EXPIRE_SOON (7일 유예):', dbSub.id);
}

// ──────────────────────────────────────────────────────────────
// customer.subscription.updated — 플랜 변경 / 취소 예약
// ──────────────────────────────────────────────────────────────

const STRIPE_STATUS_MAP: Record<string, string> = {
  active:             'ACTIVE',
  past_due:           'EXPIRE_SOON',
  canceled:           'TERMINATED',
  unpaid:             'SUSPENDED',
  trialing:           'ACTIVE',
  incomplete:         'PRE_PAYMENT',
  incomplete_expired: 'EXPIRED',
  paused:             'SUSPENDED',
};

async function handleSubscriptionUpdated(stripeSub: Stripe.Subscription) {
  const dbSub = await prisma.subscription.findFirst({
    where: { metadata: { path: '$.stripeSubscriptionId', equals: stripeSub.id } },
  });
  if (!dbSub) return;

  const newStatus = STRIPE_STATUS_MAP[stripeSub.status] ?? 'ACTIVE';

  // Stripe v20: current_period_end는 SubscriptionItem 레벨로 이동.
  // 가장 첫 번째 아이템의 period 또는 billing_cycle_anchor 기반으로 계산.
  const firstItem = stripeSub.items.data[0];
  const periodEnd = firstItem?.current_period_end;
  const newEnd = periodEnd
    ? new Date(periodEnd * 1000)
    : addDays(new Date(), billingPeriodDays(dbSub.billingCycle));

  await prisma.subscription.update({
    where: { id: dbSub.id },
    data: {
      status: newStatus as 'ACTIVE' | 'EXPIRE_SOON' | 'TERMINATED' | 'SUSPENDED' | 'PRE_PAYMENT' | 'EXPIRED',
      endDate: newEnd,
      autoRenew: !stripeSub.cancel_at_period_end,
    },
  });

  invalidateSubCache(dbSub.tenantId);
  console.log('[Webhook] 구독 업데이트:', dbSub.id, stripeSub.status, '→', newStatus);
}

// ──────────────────────────────────────────────────────────────
// customer.subscription.deleted — 완전 해지
// ──────────────────────────────────────────────────────────────

async function handleSubscriptionDeleted(stripeSub: Stripe.Subscription) {
  const dbSub = await prisma.subscription.findFirst({
    where: { metadata: { path: '$.stripeSubscriptionId', equals: stripeSub.id } },
  });
  if (!dbSub) return;

  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { id: dbSub.id },
      data: { status: 'TERMINATED', autoRenew: false, endDate: new Date() },
    });

    await tx.auditLog.create({
      data: {
        tenantId: dbSub.tenantId,
        action: 'SUBSCRIPTION_TERMINATED',
        resourceType: 'subscription',
        resourceId: dbSub.id,
        changes: { stripeSubscriptionId: stripeSub.id, reason: 'stripe_deletion' },
      },
    });
  });

  invalidateSubCache(dbSub.tenantId);
  console.log('[Webhook] 구독 해지 → TERMINATED:', dbSub.id);
}

// ──────────────────────────────────────────────────────────────
// 메인 핸들러
// ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const rawBody   = await request.text();
  const signature = request.headers.get('stripe-signature');

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[Webhook] STRIPE_WEBHOOK_SECRET 미설정');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('[Webhook] 서명 검증 실패:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log('[Webhook] 이벤트 수신:', event.type, event.id);

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
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      default:
        console.log('[Webhook] 미처리 이벤트 (정상):', event.type);
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Webhook] 처리 오류:', event.type, error);
    return NextResponse.json({ error: '이벤트 처리 오류' }, { status: 500 });
  }
}
