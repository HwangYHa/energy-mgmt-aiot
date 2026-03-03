// app/api/analytics/download/file/[id]/route.ts
/**
 * GET /api/analytics/download/file/[id]
 * 저장된 다운로드 파일 조회 (이력 ID 기반)
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import { unauthorizedResponse, serverErrorResponse } from '@/lib/api/response';
import { readFileSync, existsSync } from 'fs';
import { contentDispositionHeader } from '@/lib/utils/filename';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const { id } = await params;

    // 이력 조회 (tenantId 확인)
    const history = await prisma.downloadHistory.findUnique({
      where: { id },
      select: { filepath: true, filename: true, tenantId: true },
    });

    if (!history) {
      return NextResponse.json({ error: '다운로드 이력을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 테넌트 확인
    if (history.tenantId !== auth.tenantId) {
      return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    // 파일 경로 확인
    if (!history.filepath) {
      return NextResponse.json(
        { error: '저장된 파일이 없습니다. 이력을 다시 생성해 주세요.' },
        { status: 404 }
      );
    }

    // 경로 순회 공격 방지: filepath가 이미 서버에서 저장한 경로이므로 안전
    if (!existsSync(history.filepath)) {
      return NextResponse.json({ error: '파일이 삭제되었습니다.' }, { status: 404 });
    }

    let fileBuffer: Buffer;
    try {
      fileBuffer = readFileSync(history.filepath);
    } catch {
      return NextResponse.json(
        { error: '파일을 읽을 수 없습니다.' },
        { status: 500 }
      );
    }

    const contentType = history.filename.endsWith('.json')
      ? 'application/json'
      : 'text/csv;charset=utf-8;';

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': contentDispositionHeader(history.filename),
      },
    });
  } catch (error) {
    console.error('Download file error:', error);
    return serverErrorResponse({ message: '파일 다운로드 중 오류가 발생했습니다.' });
  }
}
