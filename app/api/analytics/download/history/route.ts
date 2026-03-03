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
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

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
        filepath: r.filepath, // filepath 포함
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
      fileContent?: string; // Base64 인코딩된 파일 콘텐츠
    };

    const { category, format, filename, startDate, endDate, rowCount, sizeBytes, status, fileContent } = body;

    if (!category || !format || !filename || !startDate || !endDate) {
      return validationErrorResponse({ message: '필수 항목이 누락되었습니다.' });
    }

    // 파일 저장 (fileContent가 제공된 경우)
    let filepath: string | null = null;
    if (fileContent && status === 'completed') {
      try {
        const downloadDir = join(tmpdir(), 'energy-mgmt-downloads');
        mkdirSync(downloadDir, { recursive: true });
        filepath = join(downloadDir, filename);

        // Base64를 Buffer로 디코딩하여 파일 저장
        const buffer = Buffer.from(fileContent, 'base64');
        writeFileSync(filepath, buffer);
      } catch (err) {
        console.error('File save error:', err);
        // 파일 저장 실패해도 이력은 저장 (filepath는 null)
      }
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
        filepath: filepath ?? null, // filepath 필드 (존재하지 않으면 null)
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

    // 표준 응답: data 필드 안에 id 포함
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
      // 모든 이력의 파일 삭제
      const rows = await prisma.downloadHistory.findMany({
        where: { tenantId: auth.tenantId },
        select: { filepath: true },
      });
      rows.forEach((row) => {
        if (row.filepath) {
          try {
            const { unlinkSync } = require('fs');
            unlinkSync(row.filepath);
          } catch { /* ignore */ }
        }
      });

      const { count } = await prisma.downloadHistory.deleteMany({
        where: { tenantId: auth.tenantId },
      });
      return successResponse({ deleted: count });
    }

    if (!id) {
      return validationErrorResponse({ message: 'id 파라미터가 필요합니다.' });
    }

    // 파일 삭제 후 이력 삭제
    const record = await prisma.downloadHistory.findUnique({
      where: { id },
      select: { filepath: true, tenantId: true },
    });

    // tenantId 확인 (다른 테넌트 삭제 방지)
    if (record && record.tenantId === auth.tenantId && record.filepath) {
      try {
        const { unlinkSync } = require('fs');
        unlinkSync(record.filepath);
      } catch { /* ignore */ }
    }

    await prisma.downloadHistory.deleteMany({
      where: { id, tenantId: auth.tenantId },
    });

    return successResponse({ id });
  } catch (error) {
    console.error('Download history DELETE error:', error);
    return serverErrorResponse({ message: '이력 삭제 중 오류가 발생했습니다.' });
  }
}
