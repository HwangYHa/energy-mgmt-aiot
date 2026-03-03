/**
 * GET /api/esg-reports/templates
 * 지원하는 ESG 표준 목록 및 템플릿 구조 반환
 *
 * ?standard=GHG_PROTOCOL  → 해당 표준의 빈 템플릿 구조(필드 정의) 반환
 * (파라미터 없음)         → 지원 표준 목록만 반환
 */

import { type NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { successResponse, errorResponse } from '@/lib/api/response';
import { getSupportedStandards } from '@/lib/domains/esg-report/templates';
import { ESGReportService } from '@/lib/domains/esg-report/services/esg-report.service';
import type { ESGStandard } from '@/lib/domains/esg-report/types/esg-report.types';

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const standard = searchParams.get('standard') as ESGStandard | null;

    if (standard) {
      // 특정 표준의 템플릿 구조 반환
      try {
        const template = ESGReportService.getTemplateStructure(standard);
        return successResponse(template);
      } catch {
        return errorResponse('RESOURCE_NOT_FOUND', {
          status: 404,
          details: { message: `지원하지 않는 ESG 표준입니다: ${standard}` },
        });
      }
    }

    // 모든 지원 표준 목록 반환
    const standards = getSupportedStandards();
    return successResponse({
      standards,
      total: standards.length,
    });
  } catch (e) {
    console.error('[ESG Templates GET]', e);
    return errorResponse('SERVER_ERROR', { status: 500 });
  }
}
