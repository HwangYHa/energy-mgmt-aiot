import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { siteId, sensitivity = 0.1 } = body;

    // TODO: 과거 데이터 조회 로직
    const historicalData = [
      // { timestamp: '...', value: 150 },
      // ...
    ];

    // FastAPI 호출
    const aiEngineUrl = process.env.AI_ENGINE_URL || 'http://localhost:8001';
    const aiResponse = await fetch(`${aiEngineUrl}/api/anomaly`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: session.user.tenantId,
        siteId: siteId || 'all',
        sensitivity,
        historicalData,
      }),
    });

    if (!aiResponse.ok) {
      throw new Error('AI Engine 호출 실패');
    }

    const result = await aiResponse.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('Anomaly detection error:', error);
    return NextResponse.json(
      { error: 'Failed to detect anomalies' },
      { status: 500 }
    );
  }
}
