/**
 * POST /api/carbon/trading/buy
 *
 * 탄소 크레딧 매수
 *
 * 멱등성: X-Idempotency-Key 헤더 필수
 * - 동일 키 재전송 → 기존 결과 반환 (중복 거래 방지)
 *
 * Body:
 * {
 *   registry, projectId, serialNumberStart, serialNumberEnd,
 *   vintageYear, creditType, certificationBody, issuanceDate,
 *   quantity, unitPrice, counterparty?, paymentMethod, memo?
 * }
 */

import { type NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { requireFeature } from '@/lib/auth/subscription';
import { successResponse, errorResponse } from '@/lib/api/response';
import { CarbonTradingService } from '@/lib/domains/carbon-trading';
import type { BuyInput, CarbonRegistry, CreditType } from '@/lib/domains/carbon-trading';

const VALID_REGISTRIES = ['K-ETS', 'Verra', 'GoldStandard', 'CDM', 'J-Credit', 'OTHER'];
const VALID_CREDIT_TYPES = ['KAU', 'KCU', 'OFFSET', 'VER', 'GS-VER', 'CER'];
const VALID_PAYMENT_METHODS = ['bank_transfer', 'pg', 'escrow'];

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });

  const [, subErr] = await requireFeature(auth.tenantId, 'analytics_carbon_trading');
  if (subErr) return subErr;

  // 멱등성 키 (X-Idempotency-Key 헤더 또는 body.idempotencyKey)
  const idempotencyKey =
    req.headers.get('X-Idempotency-Key') ??
    req.headers.get('x-idempotency-key') ??
    null;

  const body = await req.json().catch(() => null);
  if (!body) return errorResponse('VALIDATION_ERROR', { status: 400, details: { message: '요청 본문이 올바르지 않습니다' } });

  const {
    registry,
    projectId,
    serialNumberStart,
    serialNumberEnd,
    vintageYear,
    creditType,
    certificationBody,
    issuanceDate,
    quantity,
    unitPrice,
    counterparty,
    paymentMethod = 'bank_transfer',
    memo,
  } = body;

  // ── 유효성 검증 ──
  const missing = ['registry', 'projectId', 'serialNumberStart', 'serialNumberEnd',
    'vintageYear', 'creditType', 'certificationBody', 'issuanceDate',
    'quantity', 'unitPrice'].filter((k) => !body[k]);
  if (missing.length > 0) {
    return errorResponse('VALIDATION_ERROR', { status: 400, details: { message: `필수 항목 누락: ${missing.join(', ')}` } });
  }

  if (!VALID_REGISTRIES.includes(registry)) {
    return errorResponse('VALIDATION_ERROR', { status: 400, details: { message: `유효하지 않은 레지스트리: ${registry}` } });
  }
  if (!VALID_CREDIT_TYPES.includes(creditType)) {
    return errorResponse('VALIDATION_ERROR', { status: 400, details: { message: `유효하지 않은 크레딧 타입: ${creditType}` } });
  }
  if (!VALID_PAYMENT_METHODS.includes(paymentMethod)) {
    return errorResponse('VALIDATION_ERROR', { status: 400, details: { message: `유효하지 않은 결제 방법: ${paymentMethod}` } });
  }
  if (quantity <= 0 || unitPrice <= 0) {
    return errorResponse('VALIDATION_ERROR', { status: 400, details: { message: '수량과 단가는 0보다 커야 합니다' } });
  }
  if (!idempotencyKey) {
    return errorResponse('VALIDATION_ERROR', { status: 400, details: { message: 'X-Idempotency-Key 헤더가 필요합니다' } });
  }

  const input: BuyInput = {
    tenantId: auth.tenantId,
    performedBy: auth.userId,
    idempotencyKey,
    registry: registry as CarbonRegistry,
    projectId,
    serialNumberStart,
    serialNumberEnd,
    vintageYear: Number(vintageYear),
    creditType: creditType as CreditType,
    certificationBody,
    issuanceDate,
    quantity: Number(quantity),
    unitPrice: Number(unitPrice),
    counterparty,
    paymentMethod,
    memo,
  };

  try {
    const result = await CarbonTradingService.buy(input);
    return successResponse(result, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '매수 처리 중 오류가 발생했습니다';
    if (msg.includes('충돌')) return errorResponse('RESOURCE_CONFLICT', { status: 409, details: { message: msg } });
    console.error('[carbon/trading/buy]', e);
    return errorResponse('SERVER_ERROR', { status: 500, details: { message: msg } });
  }
}
