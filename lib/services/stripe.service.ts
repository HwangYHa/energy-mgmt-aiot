/**
 * Stripe 결제 서비스
 *
 * - Checkout Session 생성
 * - 구독 관리
 * - 웹훅 처리
 */

import Stripe from 'stripe';

// Stripe 인스턴스를 지연 초기화 (빌드 시 환경 변수가 없을 수 있음)
let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not defined');
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-01-28.clover',
      typescript: true,
    });
  }
  return stripeInstance;
}

/**
 * Checkout Session 생성
 */
export async function createCheckoutSession({
  priceId,
  userId,
  userEmail,
  successUrl,
  cancelUrl,
  metadata,
}: {
  priceId: string;
  userId: string;
  userEmail: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}) {
  const session = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    customer_email: userEmail,
    client_reference_id: userId,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId,
      ...metadata,
    },
    subscription_data: {
      metadata: {
        userId,
        ...metadata,
      },
    },
  });

  return session;
}

/**
 * 일회성 결제 세션 생성
 */
export async function createPaymentSession({
  amount,
  currency = 'krw',
  userId,
  userEmail,
  successUrl,
  cancelUrl,
  metadata,
}: {
  amount: number;
  currency?: string;
  userId: string;
  userEmail: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}) {
  const session = await getStripe().checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency,
          product_data: {
            name: 'EnergyAI 플랜',
          },
          unit_amount: amount,
        },
        quantity: 1,
      },
    ],
    customer_email: userEmail,
    client_reference_id: userId,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId,
      ...metadata,
    },
  });

  return session;
}

/**
 * 구독 조회
 */
export async function getSubscription(subscriptionId: string) {
  return await getStripe().subscriptions.retrieve(subscriptionId);
}

/**
 * 구독 취소
 */
export async function cancelSubscription(subscriptionId: string) {
  return await getStripe().subscriptions.cancel(subscriptionId);
}

/**
 * 구독 업데이트
 */
export async function updateSubscription(
  subscriptionId: string,
  params: Stripe.SubscriptionUpdateParams
) {
  return await getStripe().subscriptions.update(subscriptionId, params);
}

/**
 * 고객 생성
 */
export async function createCustomer({
  email,
  name,
  metadata,
}: {
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}) {
  return await getStripe().customers.create({
    email,
    name,
    metadata,
  });
}

/**
 * 웹훅 이벤트 검증
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
  webhookSecret: string
) {
  return getStripe().webhooks.constructEvent(payload, signature, webhookSecret);
}

/**
 * 가격 목록 조회
 */
export async function listPrices(productId?: string) {
  return await getStripe().prices.list({
    product: productId,
    active: true,
  });
}

/**
 * 제품 생성
 */
export async function createProduct({
  name,
  description,
  metadata,
}: {
  name: string;
  description?: string;
  metadata?: Record<string, string>;
}) {
  return await getStripe().products.create({
    name,
    description,
    metadata,
  });
}

/**
 * 가격 생성
 */
export async function createPrice({
  productId,
  unitAmount,
  currency = 'krw',
  recurring,
}: {
  productId: string;
  unitAmount: number;
  currency?: string;
  recurring?: {
    interval: 'day' | 'week' | 'month' | 'year';
    interval_count?: number;
  };
}) {
  return await getStripe().prices.create({
    product: productId,
    unit_amount: unitAmount,
    currency,
    recurring,
  });
}

export { getStripe as stripe };
