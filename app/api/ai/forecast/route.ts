// app/api/ai/forecast/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import { forecastRequestSchema, formatValidationError } from '@/lib/validation/schemas';
import env from '@/lib/env';
import logger from '@/lib/logger';
import { z } from 'zod';

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

const AI_ENGINE_URL = env.AI_ENGINE_URL; // ✅ 검증된 환경 변수 사용
const MIN_DATA_POINTS = 48; // 최소 48시간 데이터
const HISTORICAL_DAYS = 30;  // 과거 30일 데이터 사용

export async function POST(request: NextRequest) {
  let auth: Awaited<ReturnType<typeof verifyAuth>> | undefined;
  try {
    // ✅ 1. 인증 및 테넌트 검증 (3중 검증)
    auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized', message: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    const { tenantId } = auth; // ✅ DB에서 검증된 tenantId

    // ✅ 2. 요청 파라미터 검증
    const body = await request.json();
    let validated;
    try {
      validated = forecastRequestSchema.parse(body);
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

    const {
      siteId,
      horizon,
      features,
    } = validated;

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

    // 4. 데이터 검증 - 부족 시 시뮬레이션 폴백
    if (historicalData.length < MIN_DATA_POINTS) {
      logger.info('Insufficient data, generating simulated forecast', {
        tenantId, siteId, current: historicalData.length, required: MIN_DATA_POINTS,
      });

      const simulatedPredictions = generateSimulatedPredictions(horizon);

      return NextResponse.json({
        success: true,
        predictions: simulatedPredictions,
        confidence: 0.3,
        accuracy: null,
        model: 'SIMULATED',
        metadata: {
          simulated: true,
          reason: `측정 데이터 부족 (${historicalData.length}/${MIN_DATA_POINTS})`,
          dataPoints: historicalData.length,
          horizon,
          siteId: siteId || 'all',
        },
      });
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
    logger.info('AI Forecast request', { tenantId, siteId, horizon });
    
    const aiResponse = await fetch(`${AI_ENGINE_URL}/api/forecast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.AI_ENGINE_API_KEY}`, // ✅ API 키 추가
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
      logger.error('AI Engine error', { 
        tenantId, 
        siteId, 
        status: aiResponse.status,
        error: errorText 
      });
      
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

    // ✅ 8. 예측 결과 DB 저장 (트랜잭션으로 원자성 보장)
    const forecastResult = await prisma.$transaction(async (tx) => {
      const result = await tx.forecastResult.create({
        data: {
          tenantId,
          siteId: siteId || null,
          horizon,
          predictions: predictions, // Prisma가 자동으로 JSON 변환
          accuracy: confidence,
          model,
          createdAt: new Date(),
        },
      });

      // ✅ 감사 로그 기록
      await tx.auditLog.create({
        data: {
          tenantId,
          userId: auth!.userId,
          action: 'AI_FORECAST_GENERATED',
          resourceType: 'FORECAST',
          resourceId: result.id,
          result: 'success',
          metadata: {
            siteId: siteId || 'all',
            horizon,
            model,
            confidence,
          },
        },
      }).catch((err) => {
        logger.error('Failed to create audit log', { error: err });
        // 감사 로그 실패해도 계속 진행 (선택적)
      });

      return result;
    });

    logger.info('Forecast result saved', { 
      forecastId: forecastResult.id, 
      tenantId,
      confidence 
    });

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
    // ✅ 서버 로그에 상세 정보 기록
    logger.error('Forecast generation failed', {
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      stack: error instanceof Error ? error.stack : undefined,
      tenantId: auth?.tenantId,
      userId: auth?.userId,
    });
    
    // ✅ 클라이언트에는 일반적인 메시지만 전달 (보안)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate forecast',
      },
      { status: 500 }
    );
  }
}

/**
 * GET: 예측 이력 조회
 */
export async function GET(request: NextRequest) {
  let auth: Awaited<ReturnType<typeof verifyAuth>> | undefined;
  try {
    // ✅ 인증 및 테넌트 검증
    auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');
    const limit = Math.min(Number(searchParams.get('limit') || '10'), 100); // ✅ 최대 100개 제한

    // ✅ 입력 검증
    if (siteId && !z.string().uuid().safeParse(siteId).success) {
      return NextResponse.json(
        { error: 'Invalid siteId format' },
        { status: 400 }
      );
    }

    const forecasts = await prisma.forecastResult.findMany({
      where: {
        tenantId: auth.tenantId, // ✅ 검증된 tenantId만 사용
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
      data: forecasts,
      count: forecasts.length,
    });

  } catch (error) {
    logger.error('Failed to fetch forecast history', {
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      tenantId: auth?.tenantId,
    });
    
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
): Array<{ timestamp: string; value: number; lower: number; upper: number; confidence: number }> {
  const hours = parseHorizonToHours(horizon);
  const recentData = historicalData.slice(-24);

  const averageValue = recentData.reduce(
    (sum, m) => sum + parseFloat(m.value.toString()),
    0
  ) / recentData.length;

  const now = new Date();
  const predictions = [];

  for (let i = 1; i <= hours; i++) {
    const futureTime = new Date(now.getTime() + i * 60 * 60 * 1000);
    const roundedValue = Math.round(averageValue * 100) / 100;
    predictions.push({
      timestamp: futureTime.toISOString(),
      value: roundedValue,
      lower: Math.round(roundedValue * 0.8 * 100) / 100,
      upper: Math.round(roundedValue * 1.2 * 100) / 100,
      confidence: 0.5,
    });
  }

  return predictions;
}

/**
 * 시뮬레이션 예측 생성 (데이터 부족 시)
 * 일반적인 산업 전력 패턴 기반
 */
function generateSimulatedPredictions(
  horizon: string
): Array<{ timestamp: string; value: number; lower: number; upper: number; confidence: number }> {
  const hours = parseHorizonToHours(horizon);
  const now = new Date();
  const predictions = [];

  // 시간대별 전력 사용 패턴 (상대값, kW 기준)
  const hourlyPattern = [
    0.4, 0.35, 0.3, 0.3, 0.35, 0.5,   // 00-05시
    0.7, 0.85, 0.95, 1.0, 0.98, 0.95,  // 06-11시
    0.8, 0.9, 0.95, 1.0, 0.95, 0.85,   // 12-17시
    0.7, 0.6, 0.55, 0.5, 0.45, 0.42,   // 18-23시
  ];

  const baseLoad = 150; // 기본 부하 kW

  for (let i = 1; i <= hours; i++) {
    const futureTime = new Date(now.getTime() + i * 60 * 60 * 1000);
    const hour = futureTime.getHours();
    const dayOfWeek = futureTime.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    let value = baseLoad * (hourlyPattern[hour] ?? 0.5);
    if (isWeekend) value *= 0.6; // 주말 감소
    // 약간의 랜덤 변동 (+/- 5%)
    value *= (0.95 + Math.random() * 0.1);

    const roundedValue = Math.round(value * 100) / 100;
    predictions.push({
      timestamp: futureTime.toISOString(),
      value: roundedValue,
      lower: Math.round(roundedValue * 0.85 * 100) / 100,
      upper: Math.round(roundedValue * 1.15 * 100) / 100,
      confidence: 0.3,
    });
  }

  return predictions;
}

/**
 * horizon 문자열을 시간으로 변환
 */
function parseHorizonToHours(horizon: string): number {
  if (horizon.endsWith('d')) {
    return parseInt(horizon.replace('d', '')) * 24;
  }
  return parseInt(horizon.replace('h', ''));
}