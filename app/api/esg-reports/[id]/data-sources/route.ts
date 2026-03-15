/**
 * GET /api/esg-reports/[id]/data-sources
 *
 * ESG 보고서 데이터 계보(Lineage) 조회
 * - 이 보고서에 사용된 원본 EmissionsRecord 목록
 * - 스코프별 집계 (count, emissions, sensorRatio)
 * - Big4 감사 대응: 어떤 측정값이 보고서에 반영됐는지 추적
 *
 * Query params:
 *   ?scope=scope1|scope2_location|scope2_market|scope3   (필터, 선택)
 *   ?quality=sensor|manual|estimated                      (필터, 선택)
 */

import { type NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify';
import { successResponse, errorResponse } from '@/lib/api/response';
import { ReportDataSourceService } from '@/lib/domains/esg-report/services/report-data-source.service';

const db = prisma as any; // eslint-disable-line @typescript-eslint/no-explicit-any

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await verifyAuth(req);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });

  const { id } = await params;

  // 테넌트 소유 확인
  const exists = await db.eSGReport.findFirst({
    where: { id, tenantId: auth.tenantId },
    select: { id: true, reportNo: true, standard: true, period: true },
  });

  if (!exists) {
    return errorResponse('RESOURCE_NOT_FOUND', { status: 404 });
  }

  // 쿼리 파라미터 파싱
  const { searchParams } = new URL(req.url);
  const scopeFilter = searchParams.get('scope') ?? null;
  const qualityFilter = searchParams.get('quality') ?? null;

  try {
    const [allSources, scopeSummary] = await Promise.all([
      ReportDataSourceService.getSources(id),
      ReportDataSourceService.getSummaryByScope(id),
    ]);

    // 클라이언트 필터 적용
    const filtered = allSources.filter((s) => {
      if (scopeFilter && s.scope !== scopeFilter) return false;
      if (qualityFilter && s.dataQuality !== qualityFilter) return false;
      return true;
    });

    // 데이터 품질 분포 계산
    const qualityDistribution = filtered.reduce<Record<string, number>>((acc, s) => {
      acc[s.dataQuality] = (acc[s.dataQuality] ?? 0) + 1;
      return acc;
    }, {});

    const totalEmissions = filtered.reduce((sum, s) => sum + s.emissions, 0);

    return successResponse({
      reportId: id,
      reportNo: exists.reportNo,
      standard: exists.standard,
      period: exists.period,
      summary: {
        totalRecords: filtered.length,
        totalEmissions: Math.round(totalEmissions * 1000) / 1000,
        byScope: scopeSummary,
        byQuality: qualityDistribution,
        sensorRatio: filtered.length > 0
          ? Math.round(((qualityDistribution['sensor'] ?? 0) / filtered.length) * 100)
          : 0,
      },
      sources: filtered.map((s) => ({
        id: s.id,
        sourceType: s.sourceType,
        sourceId: s.sourceId,
        scope: s.scope,
        period: s.period,
        activityData: s.activityData,
        activityUnit: s.activityUnit,
        emissions: s.emissions,
        dataQuality: s.dataQuality,
        metadata: s.metadata,
        recordedAt: s.createdAt,
      })),
    });
  } catch (e) {
    console.error('[ESG DataSources GET]', e);
    return errorResponse('SERVER_ERROR', { status: 500 });
  }
}
