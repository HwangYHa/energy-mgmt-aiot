/**
 * GET /api/super-admin/erp/kpi
 * 플랫폼 전체 KPI — super_admin 전용
 */

import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { successResponse, errorResponse } from '@/lib/api/response';
import { isSuperAdmin } from '@/lib/auth/permissions';
import { ERPService } from '@/lib/services/erp.service';

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });
  if (!isSuperAdmin(auth.role)) return errorResponse('PERMISSION_DENIED', { status: 403 });

  try {
    const kpis = await ERPService.getPlatformKPIs();
    return successResponse(kpis);
  } catch (err) {
    console.error('[ERP KPI]', err);
    return errorResponse('SERVER_ERROR', { status: 500 });
  }
}
