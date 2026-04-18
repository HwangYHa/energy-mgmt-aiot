// app/api/analytics/download/history/route.ts
import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import {
  successResponse,
  unauthorizedResponse,
  serverErrorResponse,
  validationErrorResponse,
} from '@/lib/api/response';
import { logActivity, MENU_CODES, ACTION_TYPES } from '@/lib/services/activity-log.service';

/**
 * GET /api/analytics/download/history
 * 다운로드 이력 목록 조회 (최근 100건)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    const rows = await prisma.downloadHistory.findMany({
      where: { tenantId: auth.tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return successResponse(
      rows.map((r) => ({
        id: r.id,
        category: r.category,
        format: r.format,
        filename: r.filename,
        startDate: r.startDate,
        endDate: r.endDate,
        rowCount: Number(r.rowCount),
        sizeBytes: Number(r.sizeBytes),
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error('Download history GET error:', error);
    return serverErrorResponse({ message: '다운로드 이력을 불러오는 중 오류가 발생했습니다.' });
  }
}

/**
 * POST /api/analytics/download/history
 * 다운로드 이력 저장
 * 응답: { success: true, data: { id: string } }
 *
 * NOTE: DownloadHistory 모델에 filepath 필드가 없으므로 파일 경로는 저장되지 않습니다.
 *       fileContent 파라미터는 하위호환을 위해 수신하지만 무시됩니다.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const body = await request.json() as {
      category: string;
      format: string;
      filename: string;
      startDate: string;
      endDate: string;
      rowCount: number;
      sizeBytes: number;
      status: 'completed' | 'failed';
      fileContent?: string; // 무시됨 (서버 파일 저장 미지원)
    };

    const { category, format, filename, startDate, endDate, rowCount, sizeBytes, status } = body;

    if (!category || !format || !filename || !startDate || !endDate) {
      return validationErrorResponse({ message: '필수 항목이 누락되었습니다.' });
    }

    const created = await prisma.downloadHistory.create({
      data: {
        id: crypto.randomUUID(),
        tenantId: auth.tenantId,
        userId: auth.userId ?? null,
        category,
        format,
        filename,
        startDate,
        endDate,
        rowCount: rowCount ?? 0,
        sizeBytes: sizeBytes ?? 0,
        status: status ?? 'completed',
      },
    });

    // 활동 이력 기록 (fire-and-forget)
    logActivity({
      tenantId: auth.tenantId,
      menuCode: MENU_CODES.DATA_DOWNLOAD,
      actionType: ACTION_TYPES.DOWNLOAD,
      actionLabel: '데이터 다운로드',
      resourceType: 'download_history',
      resourceId: created.id,
      resourceName: filename,
      afterData: { category, format, startDate, endDate },
      metadata: { rowCount, sizeBytes, status },
      userId: auth.userId,
      userEmail: auth.email,
      userRole: auth.role,
      request,
    });

    return successResponse({ id: created.id }, { status: 201 });
  } catch (error) {
    console.error('Download history POST error:', error);
    return serverErrorResponse({ message: '이력 저장 중 오류가 발생했습니다.' });
  }
}

/**
 * DELETE /api/analytics/download/history?id=xxx
 * 특정 이력 삭제 (또는 ?all=1 로 테넌트 전체 삭제)
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const all = searchParams.get('all') === '1';

    if (all) {
      const { count } = await prisma.downloadHistory.deleteMany({
        where: { tenantId: auth.tenantId },
      });
      return successResponse({ deleted: count });
    }

    if (!id) {
      return validationErrorResponse({ message: 'id 파라미터가 필요합니다.' });
    }

    // tenantId 확인 (다른 테넌트 삭제 방지)
    const record = await prisma.downloadHistory.findUnique({
      where: { id },
      select: { tenantId: true },
    });

    if (!record || record.tenantId !== auth.tenantId) {
      return validationErrorResponse({ message: '이력을 찾을 수 없습니다.' });
    }

    await prisma.downloadHistory.delete({ where: { id } });

    return successResponse({ id });
  } catch (error) {
    console.error('Download history DELETE error:', error);
    return serverErrorResponse({ message: '이력 삭제 중 오류가 발생했습니다.' });
  }
}
