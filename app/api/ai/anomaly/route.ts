import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import { anomalyRequestSchema, formatValidationError } from '@/lib/validation/schemas';
import env from '@/lib/env';
import logger from '@/lib/logger';
import { z } from 'zod';

export async function POST(request: NextRequest) {
  let auth: Awaited<ReturnType<typeof verifyAuth>> | undefined;
  try {
    // ✅ 인증 및 테넌트 검증
    auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tenantId } = auth;

    // ✅ 입력 검증
    const body = await request.json();
    let validated;
    try {
      validated = anomalyRequestSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: formatValidationError(error),
          },
          { status: 400 }
        );
      }
      throw error;
    }

    const { siteId, sensitivity } = validated;

    // ✅ 과거 데이터 조회 (최근 30일)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const historicalData = await prisma.measurement.findMany({
      where: {
        tenantId,
        time: {
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
            device: {
              select: {
                id: true,
                name: true,
                deviceType: true,
              },
            },
          },
        },
      },
      orderBy: {
        time: 'asc',
      },
      take: 720, // 30일 * 24시간
    });

    if (historicalData.length < 48) {
      return NextResponse.json(
        {
          error: 'Insufficient data',
          message: '최소 48시간의 데이터가 필요합니다',
          required: 48,
          current: historicalData.length,
        },
        { status: 400 }
      );
    }

    const formattedData = historicalData.map((m) => ({
      timestamp: m.time.toISOString(),
      value: parseFloat(m.value.toString()),
    }));

    // ✅ AI Engine 호출
    logger.info('Anomaly detection request', { tenantId, siteId, sensitivity });

    const aiResponse = await fetch(`${env.AI_ENGINE_URL}/api/anomaly`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.AI_ENGINE_API_KEY}`,
        'X-Tenant-ID': tenantId,
      },
      body: JSON.stringify({
        tenantId,
        siteId: siteId || 'all',
        sensitivity,
        historicalData: formattedData,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      logger.error('AI Engine error', {
        tenantId,
        siteId,
        status: aiResponse.status,
        error: errorText,
      });
      throw new Error('AI Engine 호출 실패');
    }

    const result = await aiResponse.json();
    return NextResponse.json({
      success: true,
      ...result,
    });

  } catch (error) {
    logger.error('Anomaly detection failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      tenantId: auth?.tenantId,
    });

    return NextResponse.json(
      { error: 'Failed to detect anomalies' },
      { status: 500 }
    );
  }
}
