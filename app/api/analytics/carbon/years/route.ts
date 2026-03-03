// app/api/analytics/carbon/years/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/analytics/carbon/years
 * 데이터가 존재하는 연도 목록 반환 (동적 연도 드롭다운용)
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tenantId } = session.user;

    // EmissionsData의 period (YYYY-MM) 에서 연도 추출
    const rows = await prisma.emissionsData.findMany({
      where: { tenantId },
      select: { period: true },
      distinct: ['period'],
    });

    const yearSet = new Set<number>();
    for (const row of rows) {
      const y = parseInt(row.period.slice(0, 4), 10);
      if (!isNaN(y)) yearSet.add(y);
    }

    // 현재 연도는 항상 포함
    yearSet.add(new Date().getFullYear());

    const years = Array.from(yearSet).sort((a, b) => a - b);

    return NextResponse.json(years);
  } catch (error) {
    console.error('[Carbon/Years] Error:', error);
    return NextResponse.json([], { status: 200 }); // 에러 시 빈 배열 반환 (클라이언트 기본값 사용)
  }
}
