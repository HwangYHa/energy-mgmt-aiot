// app/api/analytics/carbon/register-transport/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/session';
import { EmissionsService } from '@/lib/services/emissions.service';

/**
 * POST /api/analytics/carbon/register-transport
 * 운송 거리 등록
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { sourceType, distance, period } = body;

    const emissionData = await EmissionsService.registerTransport({
      tenantId: session.user.tenantId,
      sourceType,
      distance,
      period,
    });

    return NextResponse.json(emissionData, { status: 201 });
  } catch (error) {
    console.error('Register transport error:', error);
    return NextResponse.json(
      { error: 'Failed to register transport' },
      { status: 500 }
    );
  }
}