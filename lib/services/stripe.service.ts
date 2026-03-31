/**
 * lib/services/stripe.service.ts
 *
 * Stripe 서버 사이드 서비스
 * - Checkout Session 생성
 * - 웹훅 서명 검증
 * - 구독 조회 / 취소
 *
 * 환경변수:
 *   STRIPE_SECRET_KEY       — sk_test_... 또는 sk_live_...
 *   STRIPE_WEBHOOK_SECRET   — whsec_...
 *   STRIPE_TAX_AUTO         — "true" 이면 자동 세금 계산 활성화
 */

import Stripe from 'stripe';

// Price ID → Plan tier 역매핑 (웹훅에서 tier 식별)
export const STRIPE_PRICE_TIER_MAP: Record<string, { tier: 'basic' | 'pro'; cycle: 'monthly' | 'yearly' }> = {};

function buildPriceTierMap() {
  const ids = {
    STRIPE_BASIC_MONTHLY_PRICE_ID: { tier: 'basic' as const,  cycle: 'monthly' as const },
    STRIPE_BASIC_YEARLY_PRICE_ID:  { tier: 'basic' as const,  cycle: 'yearly'  as const },
    STRIPE_PRO_MONTHLY_PRICE_ID:   { tier: 'pro'   as const,  cycle: 'monthly' as const },
    STRIPE_PRO_YEARLY_PRICE_ID:    { tier: 'pro'   as const,  cycle: 'yearly'  as const },
  };
  for (const [envKey, meta] of Object.entries(ids)) {
    const id = process.env[envKey];
    if (id) STRIPE_PRICE_TIER_MAP[id] = meta;
  }
}
buildPriceTierMap();

// 싱글톤 Stripe 클라이언트
let _stripe: Stripe | null = null;
export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY 환경변수가 설정되지 않았습니다.');
    _stripe = new Stripe(key, { apiVersion: '2026-02-25.clover' });
  }
  return _stripe;
}

// ── 가격 ID 헬퍼 ───────────────────────────────────────────────

export function getStripePriceId(tier: 'basic' | 'pro', cycle: 'monthly' | 'yearly'): string {
  const map: Record<string, string | undefined> = {
    'basic-monthly':  process.env.STRIPE_BASIC_MONTHLY_PRICE_ID,
    'basic-yearly':   process.env.STRIPE_BASIC_YEARLY_PRICE_ID,
    'pro-monthly':    process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
    'pro-yearly':     process.env.STRIPE_PRO_YEARLY_PRICE_ID,
  };
  const priceId = map[`${tier}-${cycle}`];
  if (!priceId) {
    throw new Error(`Stripe Price ID 미설정: ${tier}-${cycle}. 관리자에게 문의하세요.`);
  }
  return priceId;
}

// ── Checkout Session ───────────────────────────────────────────

export interface CreateCheckoutParams {
  tier: 'basic' | 'pro';
  billingCycle: 'monthly' | 'yearly';
  tenantId: string;
  userId: string;
  customerEmail: string;
  customerName?: string;
  successUrl: string;
  cancelUrl: string;
}

export async function createStripeCheckoutSession(params: CreateCheckoutParams): Promise<string> {
  const stripe = getStripe();
  const priceId = getStripePriceId(params.tier, params.billingCycle);

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: params.customerEmail,
    client_reference_id: params.tenantId,   // 웹훅에서 tenantId 식별용
    success_url: params.successUrl,
    cancel_url:  params.cancelUrl,
    metadata: {
      tenantId:    params.tenantId,
      userId:      params.userId,
      tier:        params.tier,
      billingCycle: params.billingCycle,
    },
    subscription_data: {
      metadata: {
        tenantId:    params.tenantId,
        tier:        params.tier,
        billingCycle: params.billingCycle,
      },
    },
  };

  // 자동 세금 계산 (STRIPE_TAX_AUTO=true 인 경우)
  if (process.env.STRIPE_TAX_AUTO === 'true') {
    sessionParams.automatic_tax = { enabled: true };
  }

  const session = await stripe.checkout.sessions.create(sessionParams);
  if (!session.url) throw new Error('Stripe Checkout Session URL 생성 실패');
  return session.url;
}

// ── Checkout Session 조회 ──────────────────────────────────────

export async function retrieveCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  return stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['subscription', 'customer'],
  });
}

// ── 구독 조회 ──────────────────────────────────────────────────

export async function retrieveStripeSubscription(stripeSubId: string): Promise<Stripe.Subscription> {
  return getStripe().subscriptions.retrieve(stripeSubId);
}

// ── 구독 취소 ──────────────────────────────────────────────────

export async function cancelStripeSubscription(
  stripeSubId: string,
  immediately = false
): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  if (immediately) {
    return stripe.subscriptions.cancel(stripeSubId);
  }
  // 즉시 취소가 아니면 현재 기간 종료 시 취소 예약
  return stripe.subscriptions.update(stripeSubId, { cancel_at_period_end: true });
}

// ── 웹훅 서명 검증 ─────────────────────────────────────────────

export function constructStripeEvent(payload: Buffer, signature: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET 환경변수가 설정되지 않았습니다.');
  return getStripe().webhooks.constructEvent(payload, signature, secret);
}

// ── 설정 여부 확인 ─────────────────────────────────────────────

export function isStripeConfigured(): boolean {
  return !!(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_WEBHOOK_SECRET &&
    (process.env.STRIPE_BASIC_MONTHLY_PRICE_ID || process.env.STRIPE_PRO_MONTHLY_PRICE_ID)
  );
}
