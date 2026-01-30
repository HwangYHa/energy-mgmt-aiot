// app/api/reports/download/[filename]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  const filePath = `/tmp/${params.filename}`;
  const fileBuffer = readFileSync(filePath);

  const contentType = params.filename.endsWith('.pdf')
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${params.filename}"`,
    },
  });
}