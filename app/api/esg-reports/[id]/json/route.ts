/**
 * GET /api/esg-reports/[id]/json
 *
 * ESG 보고서 JSON Export
 * - 감사관에게 제공하는 기계가독 형식 (Big4 대응)
 * - 배출량 요약 + 섹션 + 스냅샷 + 무결성 해시 포함
 * - Content-Disposition: attachment 로 직접 다운로드 지원
 */

import { type NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify';
import { errorResponse } from '@/lib/api/response';
import { getTemplate } from '@/lib/domains/esg-report/templates';
import { ESGJsonExporter } from '@/lib/domains/esg-report/exporters/json-exporter';
import type { TemplateContext } from '@/lib/domains/esg-report/templates/base.template';
import type {
  ESGStandard,
  ESGReportSummary,
  EmissionFactorSnapshot,
  BoundarySnapshot,
  CalculationMethodSnapshot,
  ActivityDataSnapshot,
} from '@/lib/domains/esg-report/types/esg-report.types';

const db = prisma as any; // eslint-disable-line @typescript-eslint/no-explicit-any

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await verifyAuth(req);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });

  const { id } = await params;

  // 1. 테넌트 격리 포함 보고서 조회 (스냅샷 JSON 필드 전체 포함)
  const report = await db.eSGReport.findFirst({
    where: { id, tenantId: auth.tenantId },
  });

  if (!report) {
    return errorResponse('RESOURCE_NOT_FOUND', { status: 404 });
  }

  // 2. 테넌트명 조회
  const tenant = await db.tenant.findUnique({
    where: { id: auth.tenantId },
    select: { name: true },
  });

  // 3. 저장된 스냅샷으로 TemplateContext 복원
  const summary: ESGReportSummary = {
    totalEmissions: Number(report.totalEmissions),
    scope1: Number(report.scope1),
    scope2Location: Number(report.scope2Location),
    scope2Market: report.scope2Market != null ? Number(report.scope2Market) : undefined,
    scope3: Number(report.scope3),
    emissionsUnit: 'tCO2eq',
  };

  const boundary = (report.boundarySnapshot as BoundarySnapshot) ?? {
    reportingYear: report.reportYear,
    baseYear: report.reportYear - 1,
    organizationalBoundary: 'operational_control',
    consolidationApproach: 'operational_control',
    facilitiesIncluded: [],
    facilitiesExcluded: [],
  };

  const calculationMethod = (report.calculationMethodSnapshot as CalculationMethodSnapshot) ?? {
    scope2Method: 'location',
    ghgProtocolVersion: '2015',
    uncertaintyAssessment: false,
  };

  const ctx: TemplateContext = {
    tenantId: auth.tenantId,
    tenantName: tenant?.name ?? auth.tenantId,
    period: report.period,
    reportYear: report.reportYear,
    summary,
    emissionFactors: (report.emissionFactorsSnapshot as EmissionFactorSnapshot[]) ?? [],
    boundary,
    calculationMethod,
    activityData: (report.activityDataSnapshot as ActivityDataSnapshot) ?? undefined,
    countryCode: report.countryCode,
  };

  // 4. 표준 템플릿으로 섹션 빌드
  let sections;
  try {
    const template = getTemplate(report.standard as ESGStandard);
    sections = template.buildSections(ctx);
  } catch {
    return errorResponse('SERVER_ERROR', {
      status: 500,
      details: { message: `지원하지 않는 표준: ${report.standard}` },
    });
  }

  // 5. JSON Export 생성
  const jsonExport = ESGJsonExporter.export(report, sections);

  // 6. 다운로드 응답 (attachment)
  const filename = `ESG_${report.reportNo}_${report.period}.json`
    .replace(/[^\w\-_.]/g, '_');

  return new Response(JSON.stringify(jsonExport, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
