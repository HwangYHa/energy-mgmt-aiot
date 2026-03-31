/**
 * GET /api/super-admin/roi?tenantId=xxx&months=6
 *
 * 테넌트 ROI 리포트 조회
 */

import { NextRequest } from 'next/server';
import { verifyAuth, isSuperAdmin } from '@/lib/auth/verify';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  serverErrorResponse,
} from '@/lib/api/response';
import { calculateROI } from '@/lib/services/roi-calculator.service';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!isSuperAdmin(auth)) return forbiddenResponse();

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const months   = Math.min(24, Math.max(1, parseInt(searchParams.get('months') ?? '6')));

    if (!tenantId) {
      return successResponse({ error: 'tenantId 필수' }, { meta: { status: 400 } });
    }

    const roi = await calculateROI(tenantId, months);
    if (!roi) return notFoundResponse('테넌트');

    return successResponse(roi);
  } catch (error) {
    console.error('[SuperAdmin/ROI]', error);
    return serverErrorResponse();
  }
}
