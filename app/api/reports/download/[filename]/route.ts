// app/api/reports/download/[filename]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { contentDispositionHeader } from '@/lib/utils/filename';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  // 경로 traversal 방지: 파일명에 경로 구분자 포함 시 거부
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    return NextResponse.json({ error: '잘못된 파일명입니다.' }, { status: 400 });
  }

  const filePath = join(tmpdir(), filename);

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: '파일을 찾을 수 없습니다.' }, { status: 404 });
  }

  let fileBuffer: Buffer;
  try {
    fileBuffer = readFileSync(filePath);
  } catch {
    return NextResponse.json({ error: '파일을 읽을 수 없습니다.' }, { status: 500 });
  }

  const contentType = filename.endsWith('.pdf')
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  // RFC 5987 인코딩으로 한글 파일명 지원 (ByteString 오류 방지)
  return new NextResponse(new Uint8Array(fileBuffer), {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': contentDispositionHeader(filename),
    },
  });
}
