/**
 * GET /api/esg-reports/[id]/pdf
 * ESG 보고서 PDF 다운로드 생성
 * PDFKit 기반 전문 Big4 감사 대응 보고서
 */

import { type NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { errorResponse } from '@/lib/api/response';
import { ESGReportService } from '@/lib/domains/esg-report/services/esg-report.service';
import { ESGPDFRenderer } from '@/lib/domains/esg-report/renderers/pdf-renderer';
import { logActivity } from '@/lib/services/activity-log.service';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await verifyAuth(req);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });

  const { id } = await params;

  try {
    // 보고서 상세 조회
    const detail = await ESGReportService.getDetail(id, auth.tenantId);

    // PDF 생성
    const renderer = new ESGPDFRenderer(detail);
    const pdfBuffer = await renderer.render();

    // 파일명 생성
    const filename = `ESG_${detail.metadata.standard}_${detail.metadata.period}_${detail.metadata.reportNo}.pdf`;
    const encodedFilename = encodeURIComponent(filename);

    // 활동 로그
    await logActivity({
      tenantId: auth.tenantId,
      userId: auth.userId,
      menuCode: 'ESG_REPORT',
      actionType: 'DOWNLOAD',
      actionLabel: 'ESG 보고서 PDF 다운로드',
      resourceType: 'esg_report',
      resourceId: id,
      resourceName: filename,
    });

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename}`,
        'Content-Length': String(pdfBuffer.length),
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (e) {
    console.error('[ESG Report PDF]', e);
    const msg = e instanceof Error ? e.message : 'PDF 생성 중 오류가 발생했습니다.';
    return errorResponse('SERVER_ERROR', { status: 500, details: { message: msg } });
  }
}
