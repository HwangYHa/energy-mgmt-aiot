import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { requireFeature } from '@/lib/auth/subscription';
import { prisma } from '@/lib/db/prisma';
import { optimizeRequestSchema, formatValidationError } from '@/lib/validation/schemas';
import env from '@/lib/env';
import logger from '@/lib/logger';
import { z } from 'zod';

// ─── 타입 정의 ────────────────────────────────────────────────────────────────

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
  estimatedSavings: number; // kWh/월
  estimatedCostSaving: number; // 원/월
  confidence: number; // 0~1
  actions?: string[]; // 구체적 조치사항
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

// ─── 상수 ─────────────────────────────────────────────────────────────────────

const KRW_PER_KWH = 150;      // 한국 전기요금 기준 (원/kWh)
const KRW_DEMAND  = 8_000;    // 수요 전력 요금 (원/kW·월) 고압 기준
const CO2_FACTOR  = 0.4654;   // 전력 탄소 배출 계수 (kg CO2/kWh, 2023 한국)
const MIN_DATA_POINTS = 24;   // 최소 유효 데이터: 24시간

// ─── 산업별 기준 부하 패턴 (데이터 부족 시 활용) ──────────────────────────────

function getIndustryBaselinePattern(): number[] {
  // 24시간 부하 지수 (제조업 평균, 정규화됨)
  return [
    0.45, 0.40, 0.38, 0.37, 0.38, 0.42,  // 00-05시
    0.55, 0.72, 0.88, 0.95, 0.98, 1.00,  // 06-11시
    0.97, 0.99, 1.00, 0.98, 0.96, 0.90,  // 12-17시
    0.82, 0.75, 0.70, 0.62, 0.55, 0.48,  // 18-23시
  ];
}

/**
 * 데이터 부족 시 산업 패턴 기반 합성 데이터 생성 (결정론적)
 */
function generateSyntheticData(baseValue: number, hours: number = 168): DataPoint[] {
  const pattern = getIndustryBaselinePattern();
  const now = new Date();
  const result: DataPoint[] = [];
  for (let i = hours - 1; i >= 0; i--) {
    const dt = new Date(now.getTime() - i * 60 * 60 * 1000);
    const h = dt.getHours();
    const factor = pattern[h] ?? 0.7;
    // 결정론적 노이즈: 시간 인덱스 기반
    const noise = ((i * 17 + h * 31) % 20 - 10) / 100; // ±10%
    result.push({
      timestamp: dt.toISOString(),
      value: Math.max(0, baseValue * (factor + noise)),
    });
  }
  return result;
}

// ─── 핵심 분석 엔진 ────────────────────────────────────────────────────────────

/**
 * 실측 데이터 패턴 분석 기반 최적화 추천 (확장판 v2)
 *
 * 분석 항목:
 * 1. 피크 부하 이동/감소
 * 2. 야간 대기전력 감소
 * 3. 주중/주말 스케줄 최적화
 * 4. 고변동성 → 설비 진단
 * 5. 목표 달성 격차 분석
 * 6. 역률(Power Factor) 개선
 * 7. 수요 전력 요금 절감 (Demand Charge)
 * 8. 탄소 배출 감소 기회
 * 9. 시간대별 요금제 최적화 (TOU)
 * 10. 설비 노후화 / 효율 저하 감지
 */
function generateLocalRecommendations(
  data: DataPoint[],
  targetReduction: number,
  dataQuality: 'real' | 'synthetic' | 'partial'
): OptimizationResult {
  const n = data.length;
  const values = data.map((d) => d.value);

  // ── 기초 통계 ────────────────────────────────────────
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const max  = Math.max(...values);
  const min  = Math.min(...values);
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const stdDev   = Math.sqrt(variance);
  const cv       = mean > 0 ? stdDev / mean : 0; // 변동계수

  // 신뢰도 보정 (합성 데이터는 낮춤)
  const qualityMultiplier = dataQuality === 'real' ? 1.0
    : dataQuality === 'partial' ? 0.85
    : 0.65;

  // ── 시간대별 분석 ────────────────────────────────────
  const hourlySum    = Array(24).fill(0) as number[];
  const hourlyCount  = Array(24).fill(0) as number[];
  const weekdayHourly = Array(24).fill(0) as number[];
  const weekdayCount  = Array(24).fill(0) as number[];
  const weekendHourly = Array(24).fill(0) as number[];
  const weekendCount  = Array(24).fill(0) as number[];
  const daily: Record<string, number[]> = {};

  for (const d of data) {
    const dt  = new Date(d.timestamp);
    const h   = dt.getHours();
    const dow = dt.getDay();
    const dateKey = dt.toISOString().slice(0, 10);

    hourlySum[h]   = (hourlySum[h]   ?? 0) + d.value;
    hourlyCount[h] = (hourlyCount[h] ?? 0) + 1;

    if (dow === 0 || dow === 6) {
      weekendHourly[h] = (weekendHourly[h] ?? 0) + d.value;
      weekendCount[h]  = (weekendCount[h]  ?? 0) + 1;
    } else {
      weekdayHourly[h] = (weekdayHourly[h] ?? 0) + d.value;
      weekdayCount[h]  = (weekdayCount[h]  ?? 0) + 1;
    }

    if (!daily[dateKey]) daily[dateKey] = [];
    daily[dateKey]!.push(d.value);
  }

  const hourlyAvg = hourlySum.map((s, i) =>
    (hourlyCount[i] ?? 0) > 0 ? s / hourlyCount[i]! : mean
  );
  const weekdayAvg = weekdayHourly.map((s, i) =>
    (weekdayCount[i] ?? 0) > 0 ? s / weekdayCount[i]! : mean
  );
  const weekendAvg = weekendHourly.map((s, i) =>
    (weekendCount[i] ?? 0) > 0 ? s / weekendCount[i]! : mean
  );

  // 피크 시간대 (상위 4시간)
  const peakHours = [...hourlyAvg.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([h]) => h)
    .sort((a, b) => a - b);

  // 야간 부하 (22-06시)
  const nightHours = [22, 23, 0, 1, 2, 3, 4, 5, 6];
  const nightAvg = nightHours.reduce((s, h) => s + (hourlyAvg[h] ?? mean), 0) / nightHours.length;

  // 주중/주말 평균
  const weekdayMean  = weekdayAvg.reduce((a, b) => a + b, 0) / 24;
  const weekendMean  = weekendAvg.reduce((a, b) => a + b, 0) / 24;
  const weekendRatio = weekdayMean > 0 ? weekendMean / weekdayMean : 1;

  // 한국 계시별 요금제 (산업용 고압): 최대부하 09-11, 13-17시 / 중간부하 나머지
  const onPeakHours = [9, 10, 13, 14, 15, 16]; // 최대부하
  const onPeakAvg   = onPeakHours.reduce((s, h) => s + (hourlyAvg[h] ?? mean), 0) / onPeakHours.length;
  const offPeakAvg = nightHours.reduce((s, h) => s + (hourlyAvg[h] ?? mean), 0) / nightHours.length;

  // 일별 피크 추출 (수요 전력 분석)
  const dailyPeaks = Object.values(daily).map((vals) => Math.max(...vals));
  const monthlyDemand = dailyPeaks.length > 0 ? Math.max(...dailyPeaks) : max;

  const recommendations: Recommendation[] = [];

  // ── 1. 피크 부하 이동 ────────────────────────────────
  const peakExcess = max - mean * 1.3;
  if (peakExcess > 0) {
    const savingsKwh = peakExcess * 0.35 * 22;
    recommendations.push({
      id: 'opt-peak-shift',
      priority: 'high',
      category: '피크 관리',
      title: `피크 부하 이동 (${peakHours.map((h) => `${h}시`).join(', ')} 집중)`,
      description:
        `최대 부하(${max.toFixed(1)} kW)가 평균(${mean.toFixed(1)} kW)의 ` +
        `${((max / mean) * 100).toFixed(0)}%에 달합니다. ` +
        `피크 시간대 고소비 설비(HVAC, 압축기, 냉각탑)의 운전 스케줄을 경부하 시간(22-07시)으로 분산하면 ` +
        `수요 전력 감소 및 요금 절감이 가능합니다.`,
      estimatedSavings: Math.round(savingsKwh),
      estimatedCostSaving: Math.round(savingsKwh * KRW_PER_KWH),
      confidence: Math.min(0.90, 0.70 * qualityMultiplier + 0.15),
      actions: [
        '주요 부하 설비(HVAC, 압축기) 타이머 재설정',
        '배치 작업을 심야(00-06시)로 이동',
        '인터록 시스템으로 동시 기동 방지',
      ],
    });
  }

  // ── 2. 야간 대기전력 감소 ────────────────────────────
  const standbyThreshold = mean * 0.25;
  if (nightAvg > standbyThreshold) {
    const standbyWaste = (nightAvg - standbyThreshold) * 9 * 30;
    recommendations.push({
      id: 'opt-standby',
      priority: nightAvg > mean * 0.5 ? 'high' : 'medium',
      category: '대기전력 절감',
      title: '야간 대기전력 자동 차단',
      description:
        `야간(22-06시) 평균 부하 ${nightAvg.toFixed(1)} kW는 ` +
        `전체 평균의 ${((nightAvg / mean) * 100).toFixed(0)}%입니다. ` +
        `비가동 설비 자동 전원 차단, 대기전력 차단 멀티탭 도입, BAS(빌딩자동화시스템) 야간 절전 모드 구성을 권장합니다.`,
      estimatedSavings: Math.round(standbyWaste),
      estimatedCostSaving: Math.round(standbyWaste * KRW_PER_KWH),
      confidence: Math.min(0.92, 0.78 * qualityMultiplier + 0.10),
      actions: [
        '조명 타이머·점유 센서 설치',
        'HVAC 야간 자동 절전 설정',
        '비생산 설비 전원 타임스위치 적용',
      ],
    });
  }

  // ── 3. 주말 절감 스케줄링 ────────────────────────────
  if (weekendRatio > 0.65 && weekdayMean > 0) {
    const weekendExcess = (weekendMean - weekdayMean * 0.35) * 16 * 8;
    if (weekendExcess > 0) {
      recommendations.push({
        id: 'opt-weekend',
        priority: weekendRatio > 0.85 ? 'high' : 'medium',
        category: '스케줄 최적화',
        title: '주말 설비 가동 스케줄 최적화',
        description:
          `주말 평균 부하(${weekendMean.toFixed(1)} kW)가 주중(${weekdayMean.toFixed(1)} kW)의 ` +
          `${(weekendRatio * 100).toFixed(0)}%입니다. ` +
          `주말 비필수 공조·조명·보조 설비를 자동 절전 모드로 전환하면 월 ${Math.round(weekendExcess)} kWh 절감이 가능합니다.`,
        estimatedSavings: Math.round(weekendExcess),
        estimatedCostSaving: Math.round(weekendExcess * KRW_PER_KWH),
        confidence: Math.min(0.85, 0.70 * qualityMultiplier),
        actions: [
          '주말 HVAC 설정온도 완화 (+2°C)',
          '비생산 구역 조명 자동 소등',
          '보조 압축기 주말 대기 모드 설정',
        ],
      });
    }
  }

  // ── 4. 고변동성 → 설비 이상 진단 ─────────────────────
  if (cv > 0.35) {
    const diagSavings = Math.round(mean * cv * 0.20 * 720);
    recommendations.push({
      id: 'opt-variance',
      priority: cv > 0.55 ? 'high' : 'medium',
      category: '설비 진단',
      title: '전력 소비 이상 변동 원인 점검',
      description:
        `전력 소비 변동계수(CV) ${(cv * 100).toFixed(0)}% — ` +
        `최솟값 ${min.toFixed(1)} kW ↔ 최댓값 ${max.toFixed(1)} kW. ` +
        `인버터 불량, 압축기 과부하, 전압 불균형, 누전을 점검하고 ` +
        `에너지 집중 설비(모터·압축기·냉동기)의 열화 여부를 측정하세요.`,
      estimatedSavings: diagSavings,
      estimatedCostSaving: Math.round(diagSavings * KRW_PER_KWH),
      confidence: Math.min(0.78, 0.60 * qualityMultiplier),
      actions: [
        '전력 품질 분석기로 고조파·전압 불균형 측정',
        '인버터 냉각핀 점검 및 청소',
        '누전 차단기 동작 이력 확인',
      ],
    });
  }

  // ── 5. 수요 전력 요금 절감 (Demand Charge) ────────────
  const demandChargeSaving = monthlyDemand * 0.10 * KRW_DEMAND;
  if (demandChargeSaving > 10000) {
    recommendations.push({
      id: 'opt-demand',
      priority: monthlyDemand > mean * 1.5 ? 'high' : 'medium',
      category: '수요 전력 관리',
      title: `수요 전력 최고치 절감 (현재 ${monthlyDemand.toFixed(0)} kW)`,
      description:
        `현재 최대 수요 전력 ${monthlyDemand.toFixed(0)} kW 기준으로 ` +
        `10% 절감 시 월 ₩${demandChargeSaving.toLocaleString()} 절감 가능합니다. ` +
        `수요 반응(DR) 프로그램 참여, 피크 인터록 시스템, ESS(에너지 저장장치) 도입을 검토하세요.`,
      estimatedSavings: Math.round(monthlyDemand * 0.10 * 30 * 0.5),
      estimatedCostSaving: Math.round(demandChargeSaving),
      confidence: Math.min(0.88, 0.75 * qualityMultiplier),
      actions: [
        '수요 피크 인터록 자동화 구성',
        'DR(수요반응) 프로그램 참여 신청',
        'ESS 도입 경제성 분석 의뢰',
      ],
    });
  }

  // ── 6. 계시별 요금 최적화 (TOU) ──────────────────────
  const touOpportunity = (onPeakAvg - offPeakAvg) / (onPeakAvg || 1);
  if (touOpportunity > 0.3 && dataQuality !== 'synthetic') {
    const movableLoad = (onPeakAvg - offPeakAvg) * 0.25;
    const touSavings  = movableLoad * 4 * 22; // 4시간 × 22일
    recommendations.push({
      id: 'opt-tou',
      priority: 'medium',
      category: '요금제 최적화',
      title: '계시별 요금(TOU) 최적 스케줄 구성',
      description:
        `최대부하 시간대 평균 ${onPeakAvg.toFixed(1)} kW, ` +
        `경부하 시간대 ${offPeakAvg.toFixed(1)} kW로 ` +
        `${(touOpportunity * 100).toFixed(0)}%의 부하 이동 여지가 있습니다. ` +
        `최대부하 요금이 경부하 요금의 2.5배인 산업용 고압 요금제에서 부하 이동 효과가 큽니다.`,
      estimatedSavings: Math.round(touSavings),
      estimatedCostSaving: Math.round(touSavings * KRW_PER_KWH * 1.5), // 최대부하 단가 1.5배
      confidence: Math.min(0.82, 0.72 * qualityMultiplier),
      actions: [
        '최대부하 시간(09-11, 13-17시) 설비 자동 절감',
        'AMI(스마트미터) 데이터 기반 실시간 요금 모니터링',
        '가변속 드라이브(VFD) 적용으로 탄력적 부하 조정',
      ],
    });
  }

  // ── 7. 탄소 배출 감소 ────────────────────────────────
  const targetSavingsKwh = mean * (targetReduction / 100) * 720;
  const co2Reduction     = targetSavingsKwh * CO2_FACTOR;
  if (co2Reduction > 100) {
    recommendations.push({
      id: 'opt-carbon',
      priority: 'low',
      category: '탄소 중립',
      title: `${targetReduction}% 절감 시 탄소 배출 ${co2Reduction.toFixed(0)} kg/월 감소`,
      description:
        `목표 감축(${targetReduction}%)이 달성될 경우 월 ${targetSavingsKwh.toFixed(0)} kWh 절감, ` +
        `CO₂ ${co2Reduction.toFixed(0)} kg 감소 (배출 계수 ${CO2_FACTOR} kg/kWh 적용). ` +
        `온실가스 명세서(K-MRV) 및 K-ETS 배출권 거래 활용을 검토하세요.`,
      estimatedSavings: Math.round(targetSavingsKwh * 0.3),
      estimatedCostSaving: Math.round(targetSavingsKwh * 0.3 * KRW_PER_KWH),
      confidence: Math.min(0.70, 0.55 * qualityMultiplier),
      actions: [
        `K-ETS 배출권 구매 비용 대비 절감 경제성 분석`,
        '재생에너지 인증서(REC) 도입 검토',
        'ESG 보고서 연계 탄소 절감 목표 설정',
      ],
    });
  }

  // ── 8. 목표 달성 격차 분석 ───────────────────────────
  const achievableWithCurrent = recommendations.reduce((s, r) => s + r.estimatedSavings, 0);
  if (achievableWithCurrent < targetSavingsKwh * 0.6) {
    recommendations.push({
      id: 'opt-goal-gap',
      priority: 'low',
      category: '목표 관리',
      title: `${targetReduction}% 절감 목표 달성을 위한 추가 조치 필요`,
      description:
        `현재 파악된 절감 기회(${achievableWithCurrent.toFixed(0)} kWh/월)로는 ` +
        `목표(${targetSavingsKwh.toFixed(0)} kWh/월)의 ` +
        `${((achievableWithCurrent / (targetSavingsKwh || 1)) * 100).toFixed(0)}%만 달성 가능합니다. ` +
        `ISO 50001 에너지 감사 또는 설비별 서브미터링 도입을 통해 추가 절감 기회를 발굴하세요.`,
      estimatedSavings: 0,
      estimatedCostSaving: 0,
      confidence: 0.50,
      actions: [
        'ISO 50001 에너지 경영 시스템 인증 검토',
        '설비별 서브미터링으로 고소비 설비 특정',
        '공정 최적화 전문 컨설팅 의뢰',
      ],
    });
  }

  const totalSavings = recommendations.reduce((s, r) => s + r.estimatedSavings, 0);
  const totalCost    = recommendations.reduce((s, r) => s + r.estimatedCostSaving, 0);
  const peakReductionOpportunity =
    mean > 0 ? Math.min(100, ((max - mean) / mean) * 45) : 0;
  const overallEfficiency = Math.round(Math.max(0, Math.min(100, 100 - cv * 80)));

  return {
    recommendations,
    summary: {
      totalEstimatedSavings: Math.round(totalSavings),
      totalCostSaving: Math.round(totalCost),
      overallEfficiency,
      peakReductionOpportunity: Math.round(peakReductionOpportunity),
    },
    model: dataQuality === 'real'
      ? 'PATTERN-RULE-v2 (실측 데이터)'
      : dataQuality === 'partial'
      ? 'PATTERN-RULE-v2 (부분 실측)'
      : 'PATTERN-RULE-v2 (산업 기준)',
    timestamp: new Date().toISOString(),
  };
}

// ─── API 핸들러 ────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let auth: Awaited<ReturnType<typeof verifyAuth>> | undefined;
  try {
    auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tenantId } = auth;

    // 구독 기반 기능 제한: PROFESSIONAL 이상
    const [, subErr] = await requireFeature(tenantId, 'ai_optimize');
    if (subErr) return subErr;

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

    // 30일치 데이터 조회
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

    let formattedData: DataPoint[];
    let dataQuality: 'real' | 'synthetic' | 'partial';

    if (historicalData.length >= MIN_DATA_POINTS) {
      // 실측 데이터 충분
      formattedData = historicalData.map((m) => ({
        timestamp: m.time.toISOString(),
        value: parseFloat(m.value.toString()),
      }));
      dataQuality = historicalData.length >= 168 ? 'real' : 'partial';
    } else if (historicalData.length > 0) {
      // 실측 데이터 일부 있음 → 실측 기반으로 합성 보완
      const realValues = historicalData.map((m) => parseFloat(m.value.toString()));
      const baseMean   = realValues.reduce((a, b) => a + b, 0) / realValues.length;
      const synthetic  = generateSyntheticData(baseMean, 168);
      // 실측 데이터로 합성 데이터 일부 교체
      formattedData = [
        ...synthetic.slice(0, synthetic.length - historicalData.length),
        ...historicalData.map((m) => ({
          timestamp: m.time.toISOString(),
          value: parseFloat(m.value.toString()),
        })),
      ];
      dataQuality = 'partial';

      logger.info('AI optimize: 데이터 부족 → 실측+합성 혼합', {
        tenantId, siteId, realCount: historicalData.length,
      });
    } else {
      // 실측 데이터 없음 → 산업 기준 합성 데이터로 기준선 분석
      const defaultBase = 500; // kW 기본값 (제조업 중소기업 기준)
      formattedData = generateSyntheticData(defaultBase, 168);
      dataQuality = 'synthetic';

      logger.info('AI optimize: 실측 데이터 없음 → 산업 기준 합성 데이터 사용', {
        tenantId, siteId,
      });
    }

    // 외부 AI 엔진 시도
    if (env.AI_ENGINE_URL) {
      try {
        logger.info('Optimization request → AI Engine', { tenantId, siteId, targetReduction });

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
          return NextResponse.json({
            success: true,
            ...result,
            metadata: { dataPoints: formattedData.length, siteId: siteId || 'all', targetReduction, dataQuality },
          });
        }

        logger.warn('AI Engine 오류, 로컬 폴백', { tenantId, status: aiResponse.status });
      } catch (aiErr) {
        logger.warn('AI Engine 연결 불가, 로컬 폴백', {
          tenantId,
          error: aiErr instanceof Error ? aiErr.message : String(aiErr),
        });
      }
    }

    // 로컬 패턴 기반 추천 (v2)
    logger.info('Running local optimization v2', {
      tenantId, siteId, dataPoints: formattedData.length, targetReduction, dataQuality,
    });

    const result = generateLocalRecommendations(formattedData, targetReduction, dataQuality);

    return NextResponse.json({
      success: true,
      ...result,
      metadata: {
        dataPoints: formattedData.length,
        realDataPoints: historicalData.length,
        siteId: siteId || 'all',
        targetReduction,
        dataQuality,
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
