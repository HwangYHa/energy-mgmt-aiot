// app/api/analytics/carbon/register-fuel/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/session';
import { EmissionsService } from '@/lib/services/emissions.service';

/**
 * POST /api/analytics/carbon/register-fuel
 * 연료 사용량 등록
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { deviceId, sourceType, amount, unit, period } = body;

    const emissionData = await EmissionsService.registerFuelUsage({
      tenantId: session.user.tenantId,
      deviceId,
      sourceType,
      amount,
      unit,
      period,
    });

    return NextResponse.json(emissionData, { status: 201 });
  } catch (error) {
    console.error('Register fuel error:', error);
    return NextResponse.json(
      { error: 'Failed to register fuel usage' },
      { status: 500 }
    );
  }
}