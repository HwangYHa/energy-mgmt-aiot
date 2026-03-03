/**
 * GET  /api/esg-reports  - 보고서 목록 조회
 * POST /api/esg-reports  - 보고서 생성 (Deterministic Engine)
 */

import { type NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { successResponse, errorResponse } from '@/lib/api/response';
import { ESGReportService } from '@/lib/domains/esg-report/services/esg-report.service';
import { logActivity } from '@/lib/services/activity-log.service';
import type { CreateESGReportDTO } from '@/lib/domains/esg-report/dtos/esg-report.dto';
import type { ESGStandard, ESGReportType, PeriodType, Scope2Method } from '@/lib/domains/esg-report/types/esg-report.types';

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });

  try {
    const { searchParams } = new URL(req.url);

    const result = await ESGReportService.list(auth.tenantId, {
      reportYear: searchParams.get('year') ? Number(searchParams.get('year')) : undefined,
      standard: (searchParams.get('standard') as ESGStandard) ?? undefined,
      status: searchParams.get('status') as 'draft' | 'in_review' | 'approved' | 'published' | 'withdrawn' ?? undefined,
      reportType: (searchParams.get('reportType') as ESGReportType) ?? undefined,
      page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
      pageSize: searchParams.get('pageSize') ? Number(searchParams.get('pageSize')) : 20,
    });

    return successResponse(result);
  } catch (e) {
    console.error('[ESG Reports GET]', e);
    return errorResponse('SERVER_ERROR', { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });

  try {
    const body: CreateESGReportDTO = await req.json();

    // 입력 검증
    if (!body.reportType || !body.standard || !body.period || !body.periodType) {
      return errorResponse('VALIDATION_ERROR', {
        status: 400,
        details: { message: 'reportType, standard, period, periodType는 필수입니다.' },
      });
    }

    const result = await ESGReportService.generate({
      tenantId: auth.tenantId,
      reportType: body.reportType as ESGReportType,
      standard: body.standard as ESGStandard,
      period: body.period,
      periodType: body.periodType as PeriodType,
      scope2Method: (body.scope2Method ?? 'location-based') as Scope2Method,
      scope3Categories: body.scope3Categories,
      countryCode: body.countryCode ?? 'KR',
      methodologyNotes: body.methodologyNotes,
      generatedBy: auth.userId,
    });

    // 활동 로그
    await logActivity({
      tenantId: auth.tenantId,
      userId: auth.userId,
      menuCode: 'ESG_REPORT',
      actionType: 'GENERATE',
      actionLabel: 'ESG 보고서 생성',
      resourceType: 'esg_report',
      resourceId: result.reportId,
      resourceName: result.reportNo,
      metadata: {
        standard: body.standard,
        period: body.period,
        totalEmissions: result.summary.totalEmissions,
        completenessScore: result.completenessScore,
        warnings: result.warnings,
      },
    });

    return successResponse(result, { status: 201 });
  } catch (e) {
    console.error('[ESG Reports POST]', e);
    const msg = e instanceof Error ? e.message : '보고서 생성 중 오류가 발생했습니다.';
    return errorResponse('SERVER_ERROR', { status: 500, details: { message: msg } });
  }
}
