// app/api/analytics/download/file/[id]/route.ts
/**
 * GET /api/analytics/download/file/[id]
 * 저장된 다운로드 파일 조회 (이력 ID 기반)
 *
 * NOTE: DownloadHistory 모델에 filepath 필드가 없으므로
 *       파일 재다운로드 기능은 현재 미지원입니다.
 *       클라이언트는 최초 다운로드 시 파일을 저장해야 합니다.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import { unauthorizedResponse } from '@/lib/api/response';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const { id } = await params;

    // 이력 존재 여부만 확인 (tenantId 검증)
    const history = await prisma.downloadHistory.findUnique({
      where: { id },
      select: { filename: true, tenantId: true },
    });

    if (!history) {
      return NextResponse.json({ error: '다운로드 이력을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (history.tenantId !== auth.tenantId) {
      return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    // 파일 재다운로드는 현재 미지원 (서버에 파일 경로가 저장되지 않음)
    return NextResponse.json(
      { error: '파일 재다운로드는 지원되지 않습니다. 최초 다운로드 시 파일을 저장하세요.' },
      { status: 501 }
    );
  } catch (error) {
    console.error('Download file error:', error);
    return NextResponse.json({ error: '파일 다운로드 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
