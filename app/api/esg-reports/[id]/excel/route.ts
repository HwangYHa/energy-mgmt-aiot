/**
 * GET /api/esg-reports/[id]/excel
 * ESG 보고서 Excel 다운로드 생성
 * ExcelJS 기반 구조화된 다중 시트 워크북
 * 시트: 요약 / 섹션상세 / 배출계수스냅샷 / 활동데이터 / 방법론 / 감사무결성
 */

import { type NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { errorResponse } from '@/lib/api/response';
import { ESGReportService } from '@/lib/domains/esg-report/services/esg-report.service';
import { ESGExcelRenderer } from '@/lib/domains/esg-report/renderers/excel-renderer';
import { logActivity } from '@/lib/services/activity-log.service';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await verifyAuth(req);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });

  const { id } = await params;

  try {
    // 보고서 상세 조회
    const detail = await ESGReportService.getDetail(id, auth.tenantId);

    // Excel 생성
    const renderer = new ESGExcelRenderer(detail);
    const excelBuffer = await renderer.render();

    // 파일명 생성
    const filename = `ESG_${detail.metadata.standard}_${detail.metadata.period}_${detail.metadata.reportNo}.xlsx`;
    const encodedFilename = encodeURIComponent(filename);

    // 활동 로그
    await logActivity({
      tenantId: auth.tenantId,
      userId: auth.userId,
      menuCode: 'ESG_REPORT',
      actionType: 'DOWNLOAD',
      actionLabel: 'ESG 보고서 Excel 다운로드',
      resourceType: 'esg_report',
      resourceId: id,
      resourceName: filename,
    });

    return new NextResponse(excelBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename}`,
        'Content-Length': String(excelBuffer.length),
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (e) {
    console.error('[ESG Report Excel]', e);
    const msg = e instanceof Error ? e.message : 'Excel 생성 중 오류가 발생했습니다.';
    return errorResponse('SERVER_ERROR', { status: 500, details: { message: msg } });
  }
}
