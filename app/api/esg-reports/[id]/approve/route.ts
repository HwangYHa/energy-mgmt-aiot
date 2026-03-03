/**
 * POST /api/esg-reports/[id]/approve
 * 보고서 승인 → isImmutable = true (이후 수정 불가)
 * 권한: tenant_admin 이상
 */

import { type NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { successResponse, errorResponse } from '@/lib/api/response';
import { ESGReportService } from '@/lib/domains/esg-report/services/esg-report.service';
import { logActivity } from '@/lib/services/activity-log.service';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await verifyAuth(req);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });

  // tenant_admin 이상만 승인 가능
  if (auth.role !== 'tenant_admin' && auth.role !== 'super_admin') {
    return errorResponse('PERMISSION_DENIED', {
      status: 403,
      details: { message: 'ESG 보고서 승인은 관리자 권한이 필요합니다.' },
    });
  }

  const { id } = await params;

  try {
    await ESGReportService.approve(id, auth.tenantId, auth.userId);

    await logActivity({
      tenantId: auth.tenantId,
      userId: auth.userId,
      menuCode: 'ESG_REPORT',
      actionType: 'APPROVE',
      actionLabel: 'ESG 보고서 승인 (불변 처리)',
      resourceType: 'esg_report',
      resourceId: id,
      metadata: { approvedBy: auth.userId, isImmutable: true },
    });

    return successResponse({
      message: '보고서가 승인되었습니다. 이제 불변 상태로 보호됩니다.',
      isImmutable: true,
    });
  } catch (e) {
    console.error('[ESG Report Approve]', e);
    const msg = e instanceof Error ? e.message : '승인 처리 중 오류가 발생했습니다.';
    return errorResponse('SERVER_ERROR', { status: 500, details: { message: msg } });
  }
}
