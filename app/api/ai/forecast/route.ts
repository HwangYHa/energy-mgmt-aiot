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
    const { siteId, horizon = '24h' } = body;

    // 1. 과거 데이터 조회 (최근 30일)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    // ⚠️ 주의: 실제 DB 스키마에 맞게 쿼리 수정 필요
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
      include: {
        metric: {
          select: {
            key: true,
            unit: true,
          },
        },
      },
      orderBy: {
        time: 'asc',
      },
      take: 720, // 최근 30일 (1시간 단위)
    });

    if (historicalData.length < 48) {
      return NextResponse.json(
        { error: '최소 48시간의 데이터가 필요합니다' },
        { status: 400 }
      );
    }

    // 2. 데이터 변환 (AI Engine 형식)
    const formattedData = historicalData.map((m) => ({
      timestamp: m.time.toISOString(),
      value: parseFloat(m.value.toString()),
    }));

    // 3. FastAPI 호출
    const aiEngineUrl = process.env.AI_ENGINE_URL || 'http://localhost:8001';
    const aiResponse = await fetch(`${aiEngineUrl}/api/forecast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: session.user.tenantId,
        siteId: siteId || 'all',
        horizon,
        historicalData: formattedData,
      }),
    });

    if (!aiResponse.ok) {
      const error = await aiResponse.text();
      console.error('AI Engine error:', error);
      throw new Error('AI Engine 호출 실패');
    }

    const predictions = await aiResponse.json();

    // 4. DB 저장
    await prisma.forecastResult.create({
      data: {
        tenantId: session.user.tenantId,
        siteId: siteId || null,
        horizon,
        predictions: predictions.predictions,
        accuracy: predictions.accuracy,
        model: predictions.model,
      },
    });

    return NextResponse.json({
      success: true,
      ...predictions,
    });

  } catch (error) {
    console.error('Forecast error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate forecast',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
