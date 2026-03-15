/**
 * GET /api/carbon/portfolio
 *
 * 원장 기반 탄소 크레딧 포트폴리오 조회
 * - WAC (가중 평균 단가) 계산
 * - Mark-to-market 평가 손익
 * - 보유 포지션 + 요약
 */

import { type NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { requireFeature } from '@/lib/auth/subscription';
import { successResponse, errorResponse } from '@/lib/api/response';
import { CarbonPortfolioService } from '@/lib/domains/carbon-trading';

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });

  const [, subErr] = await requireFeature(auth.tenantId, 'analytics_carbon_trading');
  if (subErr) return subErr;

  try {
    const portfolio = await CarbonPortfolioService.calculate(auth.tenantId);
    return successResponse(portfolio);
  } catch (e) {
    console.error('[carbon/portfolio GET]', e);
    return errorResponse('SERVER_ERROR', { status: 500 });
  }
}
