import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { requireFeature } from '@/lib/auth/subscription';
import { prisma } from '@/lib/db/prisma';
import { anomalyRequestSchema, formatValidationError } from '@/lib/validation/schemas';
import env from '@/lib/env';
import logger from '@/lib/logger';
import { z } from 'zod';
import { notifyAnomalyDetected } from '@/lib/services/notification.service';

// ─── 로컬 이상 탐지 ────────────────────────────────────────────────────────
interface DataPoint {
  timestamp: string;
  value: number;
}

interface AnomalyResult {
  index: number;
  timestamp: string;
  value: number;
  score: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  reason: string;
}

/**
 * Z-score + IQR 기반 로컬 이상 탐지
 *
 * sensitivity 0.0 → 3.5σ (엄격, 이상 적게 탐지)
 * sensitivity 0.5 → 2.75σ (기본)
 * sensitivity 1.0 → 2.0σ (완화, 이상 많이 탐지)
 *
 * IQR 아웃라이어가 Z-score 기준을 통과해도 low severity로 포함
 */
function runLocalAnomalyDetection(
  data: DataPoint[],
  sensitivity: number
): { anomalies: AnomalyResult[]; anomaly_rate: number; model: string } {
  const values = data.map((d) => d.value);
  const n = values.length;

  // 통계량 계산
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);

  // Z-score 임계값: sensitivity [0,1] → threshold [3.5, 2.0]σ
  const threshold = 3.5 - sensitivity * 1.5;

  // IQR 계산 (보조 기준)
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(n * 0.25)] ?? mean;
  const q3 = sorted[Math.floor(n * 0.75)] ?? mean;
  const iqr = q3 - q1;
  const iqrLow = q1 - 1.5 * iqr;
  const iqrHigh = q3 + 1.5 * iqr;

  const anomalies: AnomalyResult[] = [];

  for (let i = 0; i < n; i++) {
    const val = values[i]!;
    const zscore = std > 0 ? (val - mean) / std : 0;
    const absZ = Math.abs(zscore);
    const isIqrOutlier = val < iqrLow || val > iqrHigh;

    // Z-score 기준 미달 + IQR 정상 → 정상
    if (absZ < threshold && !isIqrOutlier) continue;

    let severity: AnomalyResult['severity'];
    if (absZ >= 5) severity = 'critical';
    else if (absZ >= 4) severity = 'high';
    else if (absZ >= threshold) severity = 'medium';
    else severity = 'low'; // IQR 아웃라이어지만 Z-score 경미

    const direction = zscore > 0 ? '급증' : '급감';
    const deviation = std > 0 ? `${absZ.toFixed(1)}σ` : '이상값';
    const reason =
      `전력 사용량 ${direction} ` +
      `(평균 대비 ${deviation}: ${val.toFixed(1)} kW vs 평균 ${mean.toFixed(1)} kW)`;

    anomalies.push({
      index: i,
      timestamp: data[i]!.timestamp,
      value: val,
      score: zscore,
      severity,
      reason,
    });
  }

  return {
    anomalies,
    anomaly_rate: anomalies.length / n,
    model: 'Z-SCORE-IQR-LOCAL',
  };
}

// ─── API 핸들러 ────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  let auth: Awaited<ReturnType<typeof verifyAuth>> | undefined;
  try {
    auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tenantId } = auth;

    // 구독 기반 기능 제한: PROFESSIONAL 이상 플랜 필요
    const [, subErr] = await requireFeature(tenantId, 'ai_anomaly');
    if (subErr) return subErr;

    const body = await request.json();
    let validated;
    try {
      validated = anomalyRequestSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation failed', details: formatValidationError(error) },
          { status: 400 }
        );
      }
      throw error;
    }

    const { siteId, sensitivity } = validated;

    // 최근 30일 측정 데이터 조회
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

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

    if (historicalData.length === 0) {
      return NextResponse.json({
        success: true,
        anomalies: [],
        anomaly_rate: 0,
        model: 'NO_DATA',
        timestamp: new Date().toISOString(),
        metadata: {
          dataPoints: 0,
          message: '분석할 측정 데이터가 없습니다. 센서가 올바르게 연결되어 데이터가 수집 중인지 확인하세요.',
        },
      });
    }

    if (historicalData.length < 10) {
      return NextResponse.json(
        {
          error: 'INSUFFICIENT_DATA',
          message: `이상 탐지를 위한 데이터가 부족합니다. 현재 ${historicalData.length}개의 데이터가 수집되어 있으며, 정확한 분석을 위해 최소 10개 이상이 필요합니다.`,
          required: 10,
          current: historicalData.length,
        },
        { status: 400 }
      );
    }

    const formattedData = historicalData.map((m) => ({
      timestamp: m.time.toISOString(),
      value: parseFloat(m.value.toString()),
    }));

    // AI 엔진 호출 시도 (설정된 경우)
    if (env.AI_ENGINE_URL) {
      try {
        logger.info('Anomaly detection request (AI Engine)', { tenantId, siteId, sensitivity });

        const aiResponse = await fetch(`${env.AI_ENGINE_URL}/api/anomaly`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.AI_ENGINE_API_KEY}`,
            'X-Tenant-ID': tenantId,
          },
          body: JSON.stringify({
            tenantId,
            siteId: siteId || 'all',
            sensitivity,
            historicalData: formattedData,
          }),
          signal: AbortSignal.timeout(10000), // 10초 타임아웃
        });

        if (aiResponse.ok) {
          const result = await aiResponse.json();
          return NextResponse.json({ success: true, ...result });
        }

        logger.warn('AI Engine unhealthy, falling back to local detection', {
          tenantId,
          status: aiResponse.status,
        });
      } catch (aiErr) {
        logger.warn('AI Engine unreachable, falling back to local detection', {
          tenantId,
          error: aiErr instanceof Error ? aiErr.message : String(aiErr),
        });
      }
    }

    // 로컬 Z-score + IQR 이상 탐지 (폴백 or 기본)
    logger.info('Running local anomaly detection', { tenantId, siteId, dataPoints: formattedData.length });
    const localResult = runLocalAnomalyDetection(formattedData, sensitivity);

    // critical/high 이상 탐지 시 역할별 알림 발송 (비동기)
    const criticalCount = localResult.anomalies.filter((a) => a.severity === 'critical').length;
    const highCount = localResult.anomalies.filter((a) => a.severity === 'high').length;
    if ((criticalCount > 0 || highCount > 0) && localResult.anomalies[0]) {
      notifyAnomalyDetected({
        tenantId,
        siteId: siteId ?? null,
        anomalyCount: localResult.anomalies.length,
        criticalCount,
        highCount,
        topAnomaly: localResult.anomalies[0],
      }).catch(() => null);
    }

    return NextResponse.json({
      success: true,
      anomalies: localResult.anomalies,
      anomaly_rate: localResult.anomaly_rate,
      model: localResult.model,
      timestamp: new Date().toISOString(),
      metadata: {
        dataPoints: formattedData.length,
        sensitivity,
        siteId: siteId || 'all',
        thresholdSigma: parseFloat((3.5 - sensitivity * 1.5).toFixed(2)),
      },
    });
  } catch (error) {
    logger.error('Anomaly detection failed', {
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      stack: error instanceof Error ? error.stack : undefined,
      tenantId: auth?.tenantId,
    });

    return NextResponse.json(
      {
        error: 'DETECTION_ERROR',
        message: '이상 탐지 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      },
      { status: 500 }
    );
  }
}
