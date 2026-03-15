/**
 * POST /api/carbon/retirement  — 소각 실행
 * GET  /api/carbon/retirement  — 소각 인증서 목록
 *
 * POST Body:
 * {
 *   registryId, quantity,
 *   retirementReason, beneficiaryCompany,
 *   offsetScope?, compliancePeriod?, registryReference?, memo?
 * }
 */

import { type NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { requireFeature } from '@/lib/auth/subscription';
import { successResponse, errorResponse } from '@/lib/api/response';
import { CarbonRetirementService } from '@/lib/domains/carbon-trading';
import type { RetireInput } from '@/lib/domains/carbon-trading';

const VALID_OFFSET_SCOPES = ['scope1', 'scope2', 'scope3'];

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });

  const [, subErr] = await requireFeature(auth.tenantId, 'analytics_carbon_trading');
  if (subErr) return subErr;

  // 멱등성 키 필수: 중복 소각 방지
  const idempotencyKey =
    req.headers.get('X-Idempotency-Key') ??
    req.headers.get('x-idempotency-key') ??
    null;
  if (!idempotencyKey) {
    return errorResponse('VALIDATION_ERROR', { status: 400, details: { message: 'X-Idempotency-Key 헤더가 필요합니다 (중복 소각 방지)' } });
  }

  const body = await req.json().catch(() => null);
  if (!body) return errorResponse('VALIDATION_ERROR', { status: 400, details: { message: '요청 본문이 올바르지 않습니다' } });

  const {
    registryId,
    quantity,
    retirementReason,
    beneficiaryCompany,
    offsetScope,
    compliancePeriod,
    registryReference,
    memo,
  } = body;

  const missing = ['registryId', 'quantity', 'retirementReason', 'beneficiaryCompany']
    .filter((k) => !body[k]);
  if (missing.length > 0) {
    return errorResponse('VALIDATION_ERROR', { status: 400, details: { message: `필수 항목 누락: ${missing.join(', ')}` } });
  }

  if (Number(quantity) <= 0) {
    return errorResponse('VALIDATION_ERROR', { status: 400, details: { message: '소각 수량은 0보다 커야 합니다' } });
  }

  if (offsetScope && !VALID_OFFSET_SCOPES.includes(offsetScope)) {
    return errorResponse('VALIDATION_ERROR', { status: 400, details: { message: `유효하지 않은 offsetScope: ${offsetScope}` } });
  }

  const input: RetireInput = {
    tenantId: auth.tenantId,
    registryId,
    performedBy: auth.userId,
    idempotencyKey,
    quantity: Number(quantity),
    retirementReason,
    beneficiaryCompany,
    offsetScope,
    compliancePeriod,
    registryReference,
    memo,
  };

  try {
    const result = await CarbonRetirementService.retire(input);
    return successResponse(result, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '소각 처리 중 오류가 발생했습니다';
    if (msg.includes('부족') || msg.includes('비활성')) {
      return errorResponse('VALIDATION_ERROR', { status: 422, details: { message: msg } });
    }
    if (msg.includes('충돌')) return errorResponse('RESOURCE_CONFLICT', { status: 409, details: { message: msg } });
    console.error('[carbon/retirement POST]', e);
    return errorResponse('SERVER_ERROR', { status: 500, details: { message: msg } });
  }
}

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });

  const [, subErr] = await requireFeature(auth.tenantId, 'analytics_carbon_trading');
  if (subErr) return subErr;

  const { searchParams } = new URL(req.url);
  const compliancePeriod = searchParams.get('compliancePeriod') ?? undefined;
  const page  = Number(searchParams.get('page')  ?? 1);
  const limit = Number(searchParams.get('limit') ?? 20);

  try {
    const result = await CarbonRetirementService.listCertificates(auth.tenantId, { compliancePeriod, page, limit });
    return successResponse(result);
  } catch (e) {
    console.error('[carbon/retirement GET]', e);
    return errorResponse('SERVER_ERROR', { status: 500 });
  }
}
