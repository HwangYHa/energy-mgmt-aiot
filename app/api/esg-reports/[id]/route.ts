/**
 * GET    /api/esg-reports/[id]  - 보고서 상세 조회 (스냅샷 포함)
 * PATCH  /api/esg-reports/[id]  - 상태 전환 (submit_review, publish, withdraw)
 */

import { type NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { successResponse, errorResponse } from '@/lib/api/response';
import { ESGReportService } from '@/lib/domains/esg-report/services/esg-report.service';
import { logActivity } from '@/lib/services/activity-log.service';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await verifyAuth(req);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });

  const { id } = await params;

  try {
    const detail = await ESGReportService.getDetail(id, auth.tenantId);
    return successResponse(detail);
  } catch (e) {
    if (e instanceof Error && e.message.includes('찾을 수 없')) {
      return errorResponse('RESOURCE_NOT_FOUND', { status: 404 });
    }
    console.error('[ESG Report GET]', e);
    return errorResponse('SERVER_ERROR', { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await verifyAuth(req);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });

  const { id } = await params;

  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'submit_review':
        await ESGReportService.submitForReview(id, auth.tenantId, auth.userId);
        await logActivity({
          tenantId: auth.tenantId,
          userId: auth.userId,
          menuCode: 'ESG_REPORT',
          actionType: 'SUBMIT_REVIEW',
          actionLabel: 'ESG 보고서 검토 제출',
          resourceType: 'esg_report',
          resourceId: id,
        });
        return successResponse({ message: '검토 제출 완료' });

      case 'publish':
        await ESGReportService.publish(id, auth.tenantId);
        await logActivity({
          tenantId: auth.tenantId,
          userId: auth.userId,
          menuCode: 'ESG_REPORT',
          actionType: 'PUBLISH',
          actionLabel: 'ESG 보고서 발행',
          resourceType: 'esg_report',
          resourceId: id,
        });
        return successResponse({ message: '발행 완료' });

      case 'withdraw':
        await ESGReportService.withdraw(id, auth.tenantId);
        await logActivity({
          tenantId: auth.tenantId,
          userId: auth.userId,
          menuCode: 'ESG_REPORT',
          actionType: 'WITHDRAW',
          actionLabel: 'ESG 보고서 철회',
          resourceType: 'esg_report',
          resourceId: id,
        });
        return successResponse({ message: '철회 완료' });

      default:
        return errorResponse('VALIDATION_ERROR', {
          status: 400,
          details: { message: `지원하지 않는 action: ${action}. 허용: submit_review, publish, withdraw` },
        });
    }
  } catch (e) {
    console.error('[ESG Report PATCH]', e);
    const msg = e instanceof Error ? e.message : '요청 처리 중 오류가 발생했습니다.';
    return errorResponse('SERVER_ERROR', { status: 500, details: { message: msg } });
  }
}
