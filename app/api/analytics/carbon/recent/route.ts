// app/api/analytics/carbon/recent/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/session';
import { EmissionsService } from '@/lib/services/emissions.service';

/**
 * GET /api/analytics/carbon/recent
 * 최근에 입력된 배출 데이터 (최대 5건 기본)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '5', 10);

    const records = await EmissionsService.getRecentEmissions(
      session.user.tenantId,
      limit
    );

    return NextResponse.json({ success: true, data: records });
  } catch (error) {
    console.error('Recent emissions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recent emissions' },
      { status: 500 }
    );
  }
}
