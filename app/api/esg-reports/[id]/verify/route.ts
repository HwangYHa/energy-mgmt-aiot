/**
 * GET /api/esg-reports/[id]/verify
 * 보고서 무결성 검증 (SHA-256 Hash 비교)
 * 저장된 해시 vs 현재 내용 → 변조 여부 탐지
 */

import { type NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { successResponse, errorResponse } from '@/lib/api/response';
import { ESGReportService } from '@/lib/domains/esg-report/services/esg-report.service';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await verifyAuth(req);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });

  const { id } = await params;

  try {
    const result = await ESGReportService.verifyIntegrity(id, auth.tenantId);

    // HTTP 상태: 무결성 이상 시 409 반환
    const status = result.isValid ? 200 : 409;
    return successResponse(result, { status });
  } catch (e) {
    console.error('[ESG Report Verify]', e);
    const msg = e instanceof Error ? e.message : '무결성 검증 중 오류가 발생했습니다.';
    return errorResponse('SERVER_ERROR', { status: 500, details: { message: msg } });
  }
}
