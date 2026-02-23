import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import { optimizeRequestSchema, formatValidationError } from '@/lib/validation/schemas';
import env from '@/lib/env';
import logger from '@/lib/logger';
import { z } from 'zod';

// ─── 로컬 최적화 추천 ────────────────────────────────────────────────────

interface DataPoint {
  timestamp: string;
  value: number;
}

interface Recommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  estimatedSavings: number; // kWh
  estimatedCostSaving: number; // 원
  confidence: number;
}

interface OptimizationResult {
  recommendations: Recommendation[];
  summary: {
    totalEstimatedSavings: number;
    totalCostSaving: number;
    overallEfficiency: number;
    peakReductionOpportunity: number;
  };
  model: string;
  timestamp: string;
}

const KRW_PER_KWH = 150; // 한국 전기요금 기준 (원/kWh)

/**
 * 실측 데이터 패턴 분석 기반 최적화 추천
 *
 * 분석 항목:
 * 1. 피크 부하 시간대 식별 → 피크 이동/감소 추천
 * 2. 야간 상시 부하 (낭비 전력) → 대기전력 감소 추천
 * 3. 주중/주말 패턴 차이 → 스케줄링 최적화
 * 4. 급격한 부하 변동 → 설비 진단 추천
 * 5. 목표 대비 사용량 분석
 */
function generateLocalRecommendations(
  data: DataPoint[],
  targetReduction: number
): OptimizationResult {
  const n = data.length;
  const values = data.map((d) => d.value);

  // 기초 통계
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const max = Math.max(...values);
  const min = Math.min(...values);

  // 시간대별 평균 (0-23시)
  const hourlySum = Array(24).fill(0) as number[];
  const hourlyCount = Array(24).fill(0) as number[];
  const weekdayHourly = Array(24).fill(0) as number[];
  const weekdayCount = Array(24).fill(0) as number[];
  const weekendHourly = Array(24).fill(0) as number[];
  const weekendCount = Array(24).fill(0) as number[];

  for (const d of data) {
    const dt = new Date(d.timestamp);
    const h = dt.getHours();
    const dow = dt.getDay();
    hourlySum[h] = (hourlySum[h] ?? 0) + d.value;
    hourlyCount[h] = (hourlyCount[h] ?? 0) + 1;
    if (dow === 0 || dow === 6) {
      weekendHourly[h] = (weekendHourly[h] ?? 0) + d.value;
      weekendCount[h] = (weekendCount[h] ?? 0) + 1;
    } else {
      weekdayHourly[h] = (weekdayHourly[h] ?? 0) + d.value;
      weekdayCount[h] = (weekdayCount[h] ?? 0) + 1;
    }
  }

  const hourlyAvg = hourlySum.map((s, i) =>
    hourlyCount[i]! > 0 ? s / hourlyCount[i]! : mean
  );
  const weekdayAvg = weekdayHourly.map((s, i) =>
    weekdayCount[i]! > 0 ? s / weekdayCount[i]! : mean
  );
  const weekendAvg = weekendHourly.map((s, i) =>
    weekendCount[i]! > 0 ? s / weekendCount[i]! : mean
  );

  // 피크 시간대 (상위 4시간)
  const peakHours = [...hourlyAvg.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([h]) => h)
    .sort((a, b) => a - b);

  // 야간 부하 (23-06시) 평균
  const nightHours = [23, 0, 1, 2, 3, 4, 5, 6];
  const nightAvg =
    nightHours.reduce((s, h) => s + (hourlyAvg[h] ?? mean), 0) / nightHours.length;

  // 주중/주말 차이
  const weekdayMean = weekdayAvg.reduce((a, b) => a + b, 0) / 24;
  const weekendMean = weekendAvg.reduce((a, b) => a + b, 0) / 24;
  const weekendRatio = weekdayMean > 0 ? weekendMean / weekdayMean : 1;

  // 변동성 (CV: 표준편차/평균)
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;

  const recommendations: Recommendation[] = [];

  // 1. 피크 부하 감소
  const peakExcess = max - mean * 1.3;
  if (peakExcess > 0) {
    const savingsKwh = peakExcess * 0.3 * 22; // 하루 0.3h × 22일
    recommendations.push({
      id: 'opt-peak-shift',
      priority: 'high',
      category: '피크 관리',
      title: `피크 부하 이동 (${peakHours.map((h) => `${h}시`).join(', ')} 집중)`,
      description:
        `최대 부하(${max.toFixed(1)} kW)가 평균(${mean.toFixed(1)} kW)의 ` +
        `${((max / mean) * 100).toFixed(0)}%에 달합니다. ` +
        `피크 시간대 고소비 설비의 운전 스케줄을 경부하 시간(23-09시)으로 이동하면 ` +
        `수요 전력 감소 및 요금 절감이 가능합니다.`,
      estimatedSavings: Math.round(savingsKwh),
      estimatedCostSaving: Math.round(savingsKwh * KRW_PER_KWH),
      confidence: 0.75,
    });
  }

  // 2. 야간 대기전력 감소
  const standbyThreshold = mean * 0.3;
  if (nightAvg > standbyThreshold) {
    const standbyWaste = (nightAvg - standbyThreshold) * 8 * 30; // 8시간/일 × 30일
    recommendations.push({
      id: 'opt-standby',
      priority: nightAvg > mean * 0.5 ? 'high' : 'medium',
      category: '대기전력',
      title: '야간 대기전력 감소',
      description:
        `야간(23-06시) 평균 부하가 ${nightAvg.toFixed(1)} kW로 ` +
        `전체 평균의 ${((nightAvg / mean) * 100).toFixed(0)}%입니다. ` +
        `비가동 설비의 전원 차단 자동화 및 대기전력 차단 멀티탭 적용을 권장합니다.`,
      estimatedSavings: Math.round(standbyWaste),
      estimatedCostSaving: Math.round(standbyWaste * KRW_PER_KWH),
      confidence: 0.80,
    });
  }

  // 3. 주말 절감 스케줄링
  if (weekendRatio > 0.7 && weekdayMean > 0) {
    const weekendExcess = (weekendMean - weekdayMean * 0.4) * 16 * 8; // 16h × 8일/월
    if (weekendExcess > 0) {
      recommendations.push({
        id: 'opt-weekend',
        priority: 'medium',
        category: '스케줄 최적화',
        title: '주말 설비 가동 스케줄 최적화',
        description:
          `주말 평균 부하(${weekendMean.toFixed(1)} kW)가 주중(${weekdayMean.toFixed(1)} kW)의 ` +
          `${(weekendRatio * 100).toFixed(0)}%입니다. ` +
          `비필수 공조·조명 설비를 주말 자동 절전 모드로 전환하면 추가 절감이 가능합니다.`,
        estimatedSavings: Math.round(weekendExcess),
        estimatedCostSaving: Math.round(weekendExcess * KRW_PER_KWH),
        confidence: 0.70,
      });
    }
  }

  // 4. 고변동성 → 설비 진단
  if (cv > 0.4) {
    recommendations.push({
      id: 'opt-variance',
      priority: 'medium',
      category: '설비 진단',
      title: '전력 소비 변동성 원인 점검',
      description:
        `전력 소비의 변동계수(CV)가 ${(cv * 100).toFixed(0)}%로 높습니다 ` +
        `(최솟값 ${min.toFixed(1)} kW ↔ 최댓값 ${max.toFixed(1)} kW). ` +
        `인버터 불량, 압축기 과부하, 전압 불균형 등을 점검하고 ` +
        `에너지 집중 설비의 효율을 측정하세요.`,
      estimatedSavings: Math.round(mean * cv * 0.15 * 720), // 월간 추정
      estimatedCostSaving: Math.round(mean * cv * 0.15 * 720 * KRW_PER_KWH),
      confidence: 0.60,
    });
  }

  // 5. 목표 감소율 달성 가능성 평가
  const targetSavingsKwh = mean * (targetReduction / 100) * 720; // 월간
  const achievableWithCurrent = recommendations.reduce(
    (s, r) => s + r.estimatedSavings,
    0
  );
  if (achievableWithCurrent < targetSavingsKwh * 0.5) {
    recommendations.push({
      id: 'opt-goal-gap',
      priority: 'low',
      category: '목표 관리',
      title: `${targetReduction}% 절감 목표 달성을 위한 추가 조치 필요`,
      description:
        `현재 파악된 절감 기회(${achievableWithCurrent.toFixed(0)} kWh/월)로는 ` +
        `목표(${targetSavingsKwh.toFixed(0)} kWh/월)의 ` +
        `${((achievableWithCurrent / targetSavingsKwh) * 100).toFixed(0)}%만 달성 가능합니다. ` +
        `에너지 감사(Energy Audit)를 통해 추가 절감 기회를 발굴하세요.`,
      estimatedSavings: 0,
      estimatedCostSaving: 0,
      confidence: 0.50,
    });
  }

  const totalSavings = recommendations.reduce((s, r) => s + r.estimatedSavings, 0);
  const totalCost = recommendations.reduce((s, r) => s + r.estimatedCostSaving, 0);
  const peakReductionOpportunity =
    mean > 0 ? Math.min(100, ((max - mean) / mean) * 50) : 0;

  return {
    recommendations,
    summary: {
      totalEstimatedSavings: Math.round(totalSavings),
      totalCostSaving: Math.round(totalCost),
      overallEfficiency: Math.round(Math.max(0, 100 - cv * 100)),
      peakReductionOpportunity: Math.round(peakReductionOpportunity),
    },
    model: 'PATTERN-RULE-LOCAL',
    timestamp: new Date().toISOString(),
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

    const body = await request.json();
    let validated;
    try {
      validated = optimizeRequestSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation failed', details: formatValidationError(error) },
          { status: 400 }
        );
      }
      throw error;
    }

    const { siteId, targetReduction } = validated;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const historicalData = await prisma.measurement.findMany({
      where: {
        tenantId,
        time: { gte: startDate },
        ...(siteId && { metric: { device: { siteId } } }),
      },
      orderBy: { time: 'asc' },
      take: 720,
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

    const formattedData: DataPoint[] = historicalData.map((m) => ({
      timestamp: m.time.toISOString(),
      value: parseFloat(m.value.toString()),
    }));

    // AI 엔진 시도
    if (env.AI_ENGINE_URL) {
      try {
        logger.info('Optimization request (AI Engine)', { tenantId, siteId, targetReduction });

        const aiResponse = await fetch(`${env.AI_ENGINE_URL}/api/optimize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.AI_ENGINE_API_KEY}`,
            'X-Tenant-ID': tenantId,
          },
          body: JSON.stringify({
            tenantId,
            siteId: siteId || 'all',
            targetReduction,
            historicalData: formattedData,
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (aiResponse.ok) {
          const result = await aiResponse.json();
          return NextResponse.json({ success: true, ...result });
        }

        logger.warn('AI Engine unhealthy, falling back to local optimization', {
          tenantId,
          status: aiResponse.status,
        });
      } catch (aiErr) {
        logger.warn('AI Engine unreachable, falling back to local optimization', {
          tenantId,
          error: aiErr instanceof Error ? aiErr.message : String(aiErr),
        });
      }
    }

    // 로컬 패턴 기반 추천
    logger.info('Running local optimization analysis', {
      tenantId,
      siteId,
      dataPoints: formattedData.length,
      targetReduction,
    });

    const result = generateLocalRecommendations(formattedData, targetReduction);

    return NextResponse.json({
      success: true,
      ...result,
      metadata: {
        dataPoints: formattedData.length,
        siteId: siteId || 'all',
        targetReduction,
      },
    });
  } catch (error) {
    logger.error('Optimization failed', {
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      stack: error instanceof Error ? error.stack : undefined,
      tenantId: auth?.tenantId,
    });

    return NextResponse.json(
      { error: 'Failed to generate optimization recommendations' },
      { status: 500 }
    );
  }
}
