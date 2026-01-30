// app/api/analytics/carbon/emissions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/session';
import { EmissionsService } from '@/lib/services/emissions.service';

/**
 * GET /api/analytics/carbon/emissions
 * 월간 배출량 조회
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const siteId = searchParams.get('siteId') || undefined;

    const emissions = await EmissionsService.getMonthlyEmissions(
      session.user.tenantId,
      year,
      siteId
    );

    return NextResponse.json(emissions);
  } catch (error) {
    console.error('Carbon emissions error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate emissions' },
      { status: 500 }
    );
  }
}