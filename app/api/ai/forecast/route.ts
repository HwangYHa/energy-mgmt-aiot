// app/api/ai/forecast/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

/**
 * 🤖 AI 부하 예측 API
 * 
 * 기능:
 * - LSTM 기반 24시간 전력 부하 예측
 * - 최소 48시간 이상의 과거 데이터 필요
 * - FastAPI AI Engine 연동
 * - 예측 결과 DB 저장 및 히스토리 관리
 * 
 * Request Body:
 * {
 *   siteId?: string;      // 특정 사이트 (선택)
 *   horizon?: string;     // 예측 범위 (기본: 24h)
 *   features?: string[];  // 추가 피처 (온도, 요일 등)
 * }
 * 
 * Response:
 * {
 *   success: boolean;
 *   predictions: Array<{ timestamp: string; value: number; }>;
 *   confidence: number;   // 0~1
 *   accuracy: number;     // MAPE (%)
 *   model: string;        // 모델 버전
 *   metadata: object;     // 추가 정보
 * }
 */

// AI Engine 설정
const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8001';
const MIN_DATA_POINTS = 48; // 최소 48시간 데이터
const HISTORICAL_DAYS = 30;  // 과거 30일 데이터 사용

export async function POST(request: NextRequest) {
  try {
    // 1. 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Invalid session', message: '테넌트 정보가 없습니다' },
        { status: 400 }
      );
    }

    // 2. 요청 파라미터 파싱
    const body = await request.json();
    const {
      siteId,
      horizon = '24h',
      features = ['hour', 'weekday', 'temperature'],
    } = body;

    // 3. 과거 데이터 조회 (최근 30일)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - HISTORICAL_DAYS);

    const historicalData = await prisma.measurement.findMany({
      where: {
        tenantId,
        time: {
          gte: startDate,
        },
        // 특정 사이트 필터
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
      take: 720, // 30일 * 24시간 (시간당 데이터)
    });

    // 4. 데이터 검증
    if (historicalData.length < MIN_DATA_POINTS) {
      return NextResponse.json(
        {
          error: 'Insufficient data',
          message: `최소 ${MIN_DATA_POINTS}시간의 데이터가 필요합니다 (현재: ${historicalData.length}시간)`,
          required: MIN_DATA_POINTS,
          current: historicalData.length,
        },
        { status: 400 }
      );
    }

    // 5. 데이터 변환 (AI Engine 형식)
    const formattedData = historicalData.map((measurement) => ({
      timestamp: measurement.time.toISOString(),
      value: parseFloat(measurement.value.toString()),
      metricKey: measurement.metric.key,
      unit: measurement.metric.unit,
      deviceId: measurement.metric.device.id,
      deviceType: measurement.metric.device.deviceType,
    }));

    // 6. AI Engine 호출
    console.log(`[AI Forecast] Calling AI Engine: ${AI_ENGINE_URL}`);
    
    const aiResponse = await fetch(`${AI_ENGINE_URL}/api/forecast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantId,
      },
      body: JSON.stringify({
        tenantId,
        siteId: siteId || 'all',
        horizon,
        features,
        historicalData: formattedData,
        options: {
          model: 'LSTM-v1.0',
          confidenceThreshold: 0.7,
          includeMetadata: true,
        },
      }),
    });

    // 7. AI Engine 응답 처리
    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[AI Forecast] AI Engine error:', errorText);
      
      // AI Engine 오류 시 폴백 (단순 평균 예측)
      const fallbackPredictions = generateFallbackPredictions(
        historicalData,
        horizon
      );
      
      return NextResponse.json({
        success: true,
        predictions: fallbackPredictions,
        confidence: 0.5,
        accuracy: null,
        model: 'FALLBACK-AVERAGE',
        metadata: {
          fallback: true,
          reason: 'AI Engine unavailable',
          error: errorText,
        },
      });
    }

    const aiResult = await aiResponse.json();
    const {
      predictions,
      confidence,
      accuracy,
      model = 'LSTM-v1.0',
      metadata = {},
    } = aiResult;

    // 8. 예측 결과 DB 저장
    const forecastResult = await prisma.forecastResult.create({
      data: {
        tenantId,
        siteId: siteId || null,
        horizon,
        predictions: JSON.stringify(predictions), // JSON 배열로 저장
        accuracy: confidence, // confidence를 accuracy 필드에 저장
        model,
        createdAt: new Date(),
      },
    });

    console.log(
      `[AI Forecast] Result saved: ID=${forecastResult.id}, Confidence=${confidence}`
    );

    // 9. 성공 응답
    return NextResponse.json({
      success: true,
      forecastId: forecastResult.id,
      predictions,
      confidence,
      accuracy,
      model,
      metadata: {
        ...metadata,
        dataPoints: historicalData.length,
        horizon,
        siteId: siteId || 'all',
        features,
        createdAt: forecastResult.createdAt.toISOString(),
      },
    });

  } catch (error) {
    console.error('[AI Forecast] Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate forecast',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? error : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * GET: 예측 이력 조회
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');
    const limit = parseInt(searchParams.get('limit') || '10');

    const forecasts = await prisma.forecastResult.findMany({
      where: {
        tenantId: session.user.tenantId,
        ...(siteId && { siteId }),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      select: {
        id: true,
        siteId: true,
        horizon: true,
        accuracy: true,
        model: true,
        createdAt: true,
        // predictions는 크므로 기본적으로 제외
      },
    });

    return NextResponse.json({
      success: true,
      forecasts,
      count: forecasts.length,
    });

  } catch (error) {
    console.error('[AI Forecast] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch forecast history' },
      { status: 500 }
    );
  }
}

/**
 * 폴백 예측 생성 (AI Engine 실패 시)
 * 단순 이동 평균 기반
 */
function generateFallbackPredictions(
  historicalData: any[],
  horizon: string
): Array<{ timestamp: string; value: number }> {
  const hours = parseInt(horizon.replace('h', ''));
  const recentData = historicalData.slice(-24); // 최근 24시간
  
  const averageValue = recentData.reduce(
    (sum, m) => sum + parseFloat(m.value.toString()),
    0
  ) / recentData.length;

  const now = new Date();
  const predictions = [];

  for (let i = 1; i <= hours; i++) {
    const futureTime = new Date(now.getTime() + i * 60 * 60 * 1000);
    predictions.push({
      timestamp: futureTime.toISOString(),
      value: Math.round(averageValue * 100) / 100,
      confidence: 0.5,
    });
  }

  return predictions;
}