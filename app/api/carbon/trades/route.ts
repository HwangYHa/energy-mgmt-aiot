/**
 * GET  /api/carbon/trades — 원장 거래 내역 (페이지네이션 + 필터)
 * DELETE /api/carbon/trades/[id] — 매수 취소 (1시간 이내)
 *
 * Query:
 *   ?eventType=BUY|SELL|RETIRE|CANCEL
 *   ?page=1&limit=20
 */

import { type NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { requireFeature } from '@/lib/auth/subscription';
import { successResponse, errorResponse } from '@/lib/api/response';
import { CarbonTradingService } from '@/lib/domains/carbon-trading';

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });

  const [, subErr] = await requireFeature(auth.tenantId, 'analytics_carbon_trading');
  if (subErr) return subErr;

  const { searchParams } = new URL(req.url);
  const eventType = searchParams.get('eventType') ?? undefined;
  const page = Number(searchParams.get('page') ?? 1);
  const limit = Number(searchParams.get('limit') ?? 20);

  try {
    const result = await CarbonTradingService.listTrades(auth.tenantId, { eventType, page, limit });
    return successResponse(result);
  } catch (e) {
    console.error('[carbon/trades GET]', e);
    return errorResponse('SERVER_ERROR', { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });

  const [, subErr] = await requireFeature(auth.tenantId, 'analytics_carbon_trading');
  if (subErr) return subErr;

  const body = await req.json().catch(() => null);
  const ledgerEntryId = body?.ledgerEntryId as string | undefined;

  if (!ledgerEntryId) {
    return errorResponse('VALIDATION_ERROR', { status: 400, details: { message: 'ledgerEntryId가 필요합니다' } });
  }

  try {
    await CarbonTradingService.cancelBuy(ledgerEntryId, auth.tenantId);
    return successResponse({ message: '매수 취소 완료' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '거래 취소 중 오류가 발생했습니다';
    if (msg.includes('1시간') || msg.includes('결제 완료') || msg.includes('매수 거래만')) {
      return errorResponse('VALIDATION_ERROR', { status: 422, details: { message: msg } });
    }
    console.error('[carbon/trades DELETE]', e);
    return errorResponse('SERVER_ERROR', { status: 500, details: { message: msg } });
  }
}
