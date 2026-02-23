/**
 * GET /api/analytics/carbon/export — 탄소 배출 데이터 내보내기
 *
 * Query params:
 *   format  'csv' | 'json'  (기본: csv)
 *   year    숫자 연도        (기본: 현재 연도)
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify';
import { generateDownloadFilename, contentDispositionHeader } from '@/lib/utils/filename';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') ?? 'csv';
    const year = Number(searchParams.get('year') ?? new Date().getFullYear());

    if (!['csv', 'json'].includes(format)) {
      return NextResponse.json({ error: 'format은 csv 또는 json 이어야 합니다' }, { status: 400 });
    }

    // YYYY-MM 형식으로 해당 연도 데이터 조회
    const startPeriod = `${year}-01`;
    const endPeriod = `${year}-12`;

    const emissions = await prisma.emissionsData.findMany({
      where: {
        tenantId: auth.tenantId,
        period: { gte: startPeriod, lte: endPeriod },
      },
      orderBy: [{ period: 'asc' }, { emissionType: 'asc' }],
    });

    if (format === 'json') {
      return NextResponse.json({
        year,
        count: emissions.length,
        data: emissions,
      });
    }

    // CSV 생성 (BOM 포함 — Excel 한글 호환)
    const headers = [
      '기간',
      '배출범위',
      '배출원유형',
      '사용량',
      '단위',
      '배출계수',
      '산정배출량(tCO₂eq)',
      '계산방식',
      '데이터출처',
    ].join(',');

    const lines = emissions.map((e) =>
      [
        e.period,
        e.emissionType,
        e.sourceType,
        e.amount.toString(),
        e.unit,
        e.emissionFactor.toString(),
        e.calculatedEmission.toString(),
        e.calculationMethod,
        e.dataSource,
      ].join(',')
    );

    const csv = '\uFEFF' + [headers, ...lines].join('\n');
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': contentDispositionHeader(generateDownloadFilename('탄소배출데이터', '', 'csv')),
      },
    });
  } catch (error) {
    console.error('[carbon/export GET]', error);
    return NextResponse.json({ error: '내보내기 중 오류가 발생했습니다' }, { status: 500 });
  }
}
