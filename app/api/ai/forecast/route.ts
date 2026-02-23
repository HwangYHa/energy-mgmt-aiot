// app/api/ai/forecast/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import { forecastRequestSchema, formatValidationError } from '@/lib/validation/schemas';
import env from '@/lib/env';
import logger from '@/lib/logger';
import { z } from 'zod';

const MIN_DATA_POINTS = 48;
const HISTORICAL_DAYS = 30;

// ─── 예측 유틸리티 ────────────────────────────────────────────────────────

interface HistoricalPoint {
  timestamp: string;
  value: number;
  metricKey: string;
  unit: string;
  deviceId: string;
  deviceType: string;
}

interface PredictionPoint {
  timestamp: string;
  value: number;
  lower: number;
  upper: number;
  confidence: number;
}

/**
 * 시간대 × 요일 패턴 추출
 * 30일 과거 데이터에서 (hour, dayType) 조합별 평균값 계산
 * → 계절성(주중/주말 × 24시간)을 실제 데이터에서 도출
 */
function buildSeasonalPattern(
  data: HistoricalPoint[]
): { weekday: number[]; weekend: number[]; globalMean: number; globalStd: number } {
  const weekdayBuckets: number[][] = Array.from({ length: 24 }, () => []);
  const weekendBuckets: number[][] = Array.from({ length: 24 }, () => []);

  for (const d of data) {
    const dt = new Date(d.timestamp);
    const hour = dt.getHours();
    const dow = dt.getDay();
    const bucket = dow === 0 || dow === 6 ? weekendBuckets : weekdayBuckets;
    bucket[hour]!.push(d.value);
  }

  const avg = (arr: number[]) =>
    arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  const allValues = data.map((d) => d.value);
  const globalMean = allValues.reduce((a, b) => a + b, 0) / allValues.length;
  const globalVariance =
    allValues.reduce((a, b) => a + (b - globalMean) ** 2, 0) / allValues.length;
  const globalStd = Math.sqrt(globalVariance);

  // 데이터가 없는 버킷은 globalMean으로 대체
  const weekday = weekdayBuckets.map((b) => avg(b) ?? globalMean);
  const weekend = weekendBuckets.map((b) => avg(b) ?? globalMean);

  return { weekday, weekend, globalMean, globalStd };
}

/**
 * 실측 데이터 기반 계절성 예측
 * - 시간대 × 요일 패턴 적용
 * - 최근 7일 추세 반영 (선형)
 * - 신뢰 구간: ±1σ (68%), confidence: 데이터 커버리지에 따라 결정
 */
function generateSeasonalForecast(
  historicalData: HistoricalPoint[],
  horizon: string
): PredictionPoint[] {
  const hours = parseHorizonToHours(horizon);
  const pattern = buildSeasonalPattern(historicalData);

  // 최근 7일 추세 (단순 선형회귀)
  const recent = historicalData.slice(-168); // 최근 7일
  const trend =
    recent.length >= 2
      ? (recent[recent.length - 1]!.value - recent[0]!.value) / recent.length
      : 0;

  const now = new Date();
  const predictions: PredictionPoint[] = [];

  for (let i = 1; i <= hours; i++) {
    const futureTime = new Date(now.getTime() + i * 60 * 60 * 1000);
    const hour = futureTime.getHours();
    const dow = futureTime.getDay();
    const isWeekend = dow === 0 || dow === 6;

    const patternValue = isWeekend
      ? (pattern.weekend[hour] ?? pattern.globalMean)
      : (pattern.weekday[hour] ?? pattern.globalMean);

    // 추세는 멀수록 약하게 (감쇠)
    const trendDecay = Math.exp(-i / (hours * 0.5));
    const value = Math.max(0, patternValue + trend * i * trendDecay);

    const sigma = pattern.globalStd;
    const confidence = historicalData.length >= 336 ? 0.85 : 0.7; // 2주 이상이면 85%

    predictions.push({
      timestamp: futureTime.toISOString(),
      value: Math.round(value * 100) / 100,
      lower: Math.round(Math.max(0, value - sigma) * 100) / 100,
      upper: Math.round((value + sigma) * 100) / 100,
      confidence,
    });
  }

  return predictions;
}

/**
 * 데이터 부족 시: 산업 전력 표준 패턴 (결정론적, Math.random 없음)
 * 주중 피크: 09-17시, 주말 낮음
 */
function generateDeterministicPattern(horizon: string): PredictionPoint[] {
  const hours = parseHorizonToHours(horizon);
  const baseLoad = 150; // kW 기준

  // 시간대별 상대 부하 계수 (0-1)
  const weekdayPattern = [
    0.40, 0.35, 0.30, 0.30, 0.35, 0.50,   // 00-05
    0.70, 0.85, 0.95, 1.00, 0.98, 0.95,   // 06-11
    0.80, 0.90, 0.95, 1.00, 0.95, 0.85,   // 12-17
    0.70, 0.60, 0.55, 0.50, 0.45, 0.42,   // 18-23
  ];
  const weekendPattern = weekdayPattern.map((v) => v * 0.60);

  const now = new Date();
  return Array.from({ length: hours }, (_, i) => {
    const futureTime = new Date(now.getTime() + (i + 1) * 3600_000);
    const h = futureTime.getHours();
    const dow = futureTime.getDay();
    const isWeekend = dow === 0 || dow === 6;

    const factor = (isWeekend ? weekendPattern[h] : weekdayPattern[h]) ?? 0.5;
    const val = Math.round(baseLoad * factor * 100) / 100;

    return {
      timestamp: futureTime.toISOString(),
      value: val,
      lower: Math.round(val * 0.85 * 100) / 100,
      upper: Math.round(val * 1.15 * 100) / 100,
      confidence: 0.3,
    };
  });
}

function parseHorizonToHours(horizon: string): number {
  if (horizon.endsWith('d')) return parseInt(horizon) * 24;
  return parseInt(horizon);
}

// ─── API 핸들러 ────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  let auth: Awaited<ReturnType<typeof verifyAuth>> | undefined;
  try {
    auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized', message: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    const { tenantId } = auth;

    const body = await request.json();
    let validated;
    try {
      validated = forecastRequestSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation failed', details: formatValidationError(error) },
          { status: 400 }
        );
      }
      throw error;
    }

    const { siteId, horizon, features } = validated;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - HISTORICAL_DAYS);

    const historicalData = await prisma.measurement.findMany({
      where: {
        tenantId,
        time: { gte: startDate },
        ...(siteId && { metric: { device: { siteId } } }),
      },
      include: {
        metric: {
          select: {
            key: true,
            unit: true,
            device: { select: { id: true, name: true, deviceType: true } },
          },
        },
      },
      orderBy: { time: 'asc' },
      take: 720,
    });

    // 데이터 부족 → 결정론적 표준 패턴 (Math.random 없음)
    if (historicalData.length < MIN_DATA_POINTS) {
      logger.info('Insufficient data, using deterministic industry pattern', {
        tenantId,
        siteId,
        current: historicalData.length,
        required: MIN_DATA_POINTS,
      });

      const predictions = generateDeterministicPattern(horizon);
      return NextResponse.json({
        success: true,
        predictions,
        confidence: 0.3,
        accuracy: null,
        model: 'INDUSTRY-PATTERN',
        metadata: {
          simulated: true,
          reason: `측정 데이터 부족 (${historicalData.length}/${MIN_DATA_POINTS})`,
          dataPoints: historicalData.length,
          horizon,
          siteId: siteId || 'all',
        },
      });
    }

    const formattedData: HistoricalPoint[] = historicalData.map((m) => ({
      timestamp: m.time.toISOString(),
      value: parseFloat(m.value.toString()),
      metricKey: m.metric.key,
      unit: m.metric.unit ?? '',
      deviceId: m.metric.device.id,
      deviceType: m.metric.device.deviceType,
    }));

    // AI 엔진 시도
    if (env.AI_ENGINE_URL) {
      try {
        logger.info('AI Forecast request (AI Engine)', { tenantId, siteId, horizon });

        const aiResponse = await fetch(`${env.AI_ENGINE_URL}/api/forecast`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.AI_ENGINE_API_KEY}`,
            'X-Tenant-ID': tenantId,
          },
          body: JSON.stringify({
            tenantId,
            siteId: siteId || 'all',
            horizon,
            features,
            historicalData: formattedData,
            options: { model: 'LSTM-v1.0', confidenceThreshold: 0.7, includeMetadata: true },
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (aiResponse.ok) {
          const aiResult = await aiResponse.json();
          const { predictions, confidence, accuracy, model = 'LSTM-v1.0', metadata = {} } = aiResult;

          const forecastResult = await prisma.$transaction(async (tx) => {
            const saved = await tx.forecastResult.create({
              data: { tenantId, siteId: siteId || null, horizon, predictions, accuracy: confidence, model },
            });
            await tx.auditLog.create({
              data: {
                tenantId,
                userId: auth!.userId,
                action: 'AI_FORECAST_GENERATED',
                resourceType: 'FORECAST',
                resourceId: saved.id,
                result: 'success',
                metadata: { siteId: siteId || 'all', horizon, model, confidence },
              },
            }).catch(() => {});
            return saved;
          });

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
        }

        logger.warn('AI Engine unhealthy, falling back to local seasonal forecast', {
          tenantId,
          status: aiResponse.status,
        });
      } catch (aiErr) {
        logger.warn('AI Engine unreachable, falling back to local seasonal forecast', {
          tenantId,
          error: aiErr instanceof Error ? aiErr.message : String(aiErr),
        });
      }
    }

    // 로컬 계절성 예측 (실 데이터 기반, Math.random 없음)
    logger.info('Running local seasonal forecast', {
      tenantId,
      siteId,
      dataPoints: formattedData.length,
      horizon,
    });

    const predictions = generateSeasonalForecast(formattedData, horizon);
    const confidence = historicalData.length >= 336 ? 0.75 : 0.60;

    return NextResponse.json({
      success: true,
      predictions,
      confidence,
      accuracy: null,
      model: 'SEASONAL-LOCAL',
      metadata: {
        fallback: true,
        dataPoints: historicalData.length,
        horizon,
        siteId: siteId || 'all',
        features,
        patternSource: 'historical',
      },
    });
  } catch (error) {
    logger.error('Forecast generation failed', {
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      stack: error instanceof Error ? error.stack : undefined,
      tenantId: auth?.tenantId,
    });

    return NextResponse.json(
      { success: false, error: 'Failed to generate forecast' },
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
    auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');
    const limit = Math.min(Number(searchParams.get('limit') || '10'), 100);

    if (siteId && !z.string().uuid().safeParse(siteId).success) {
      return NextResponse.json({ error: 'Invalid siteId format' }, { status: 400 });
    }

    const forecasts = await prisma.forecastResult.findMany({
      where: {
        tenantId: auth.tenantId,
        ...(siteId && { siteId }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        siteId: true,
        horizon: true,
        accuracy: true,
        model: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, data: forecasts, count: forecasts.length });
  } catch (error) {
    logger.error('Failed to fetch forecast history', {
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      tenantId: auth?.tenantId,
    });

    return NextResponse.json({ error: 'Failed to fetch forecast history' }, { status: 500 });
  }
}
