// app/api/reports/download/[filename]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  const filePath = `/tmp/${filename}`;
  const fileBuffer = readFileSync(filePath);

  const contentType = filename.endsWith('.pdf')
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
