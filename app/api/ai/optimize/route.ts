import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { siteId, targetReduction = 50 } = body;

    // 1. 과거 데이터 조회
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const historicalData = await prisma.measurement.findMany({
      where: {
        tenantId: session.user.tenantId,
        receivedAt: {
          gte: startDate,
        },
        ...(siteId && {
          metric: {
            device: {
              siteId: siteId,
            },
          },
        }),
      },
      orderBy: {
        time: 'asc',
      },
    });

    const formattedData = historicalData.map((m) => ({
      timestamp: m.time.toISOString(),
      value: parseFloat(m.value.toString()),
    }));

    // 2. FastAPI 호출
    const aiEngineUrl = process.env.AI_ENGINE_URL || 'http://localhost:8001';
    const aiResponse = await fetch(`${aiEngineUrl}/api/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: session.user.tenantId,
        siteId: siteId || 'all',
        targetReduction,
        historicalData: formattedData,
      }),
    });

    if (!aiResponse.ok) {
      throw new Error('AI Engine 호출 실패');
    }

    const result = await aiResponse.json();

    return NextResponse.json({
      success: true,
      ...result,
    });

  } catch (error) {
    console.error('Optimization error:', error);
    return NextResponse.json(
      { error: 'Failed to generate optimization recommendations' },
      { status: 500 }
    );
  }
}
