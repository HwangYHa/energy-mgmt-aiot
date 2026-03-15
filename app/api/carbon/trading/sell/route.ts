/**
 * POST /api/carbon/trading/sell
 *
 * 탄소 크레딧 매도
 *
 * 멱등성: X-Idempotency-Key 헤더 필수
 * 레이스 컨디션 방지: 낙관적 잠금 (version 컬럼)
 *
 * Body: { registryId, quantity, unitPrice, counterparty?, paymentMethod, memo? }
 */

import { type NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { requireFeature } from '@/lib/auth/subscription';
import { successResponse, errorResponse } from '@/lib/api/response';
import { CarbonTradingService } from '@/lib/domains/carbon-trading';
import type { SellInput } from '@/lib/domains/carbon-trading';

const VALID_PAYMENT_METHODS = ['bank_transfer', 'pg', 'escrow'];

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });

  const [, subErr] = await requireFeature(auth.tenantId, 'analytics_carbon_trading');
  if (subErr) return subErr;

  const idempotencyKey = req.headers.get('X-Idempotency-Key') ?? req.headers.get('x-idempotency-key');
  if (!idempotencyKey) {
    return errorResponse('VALIDATION_ERROR', { status: 400, details: { message: 'X-Idempotency-Key 헤더가 필요합니다' } });
  }

  const body = await req.json().catch(() => null);
  if (!body) return errorResponse('VALIDATION_ERROR', { status: 400, details: { message: '요청 본문이 올바르지 않습니다' } });

  const { registryId, quantity, unitPrice, counterparty, paymentMethod = 'bank_transfer', memo } = body;

  if (!registryId || !quantity || !unitPrice) {
    return errorResponse('VALIDATION_ERROR', { status: 400, details: { message: 'registryId, quantity, unitPrice는 필수입니다' } });
  }
  if (Number(quantity) <= 0 || Number(unitPrice) <= 0) {
    return errorResponse('VALIDATION_ERROR', { status: 400, details: { message: '수량과 단가는 0보다 커야 합니다' } });
  }
  if (!VALID_PAYMENT_METHODS.includes(paymentMethod)) {
    return errorResponse('VALIDATION_ERROR', { status: 400, details: { message: `유효하지 않은 결제 방법: ${paymentMethod}` } });
  }

  const input: SellInput = {
    tenantId: auth.tenantId,
    registryId,
    performedBy: auth.userId,
    idempotencyKey,
    quantity: Number(quantity),
    unitPrice: Number(unitPrice),
    counterparty,
    paymentMethod,
    memo,
  };

  try {
    const result = await CarbonTradingService.sell(input);
    return successResponse(result, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '매도 처리 중 오류가 발생했습니다';
    if (msg.includes('부족')) return errorResponse('VALIDATION_ERROR', { status: 422, details: { message: msg } });
    if (msg.includes('충돌')) return errorResponse('RESOURCE_CONFLICT', { status: 409, details: { message: msg } });
    console.error('[carbon/trading/sell]', e);
    return errorResponse('SERVER_ERROR', { status: 500, details: { message: msg } });
  }
}
