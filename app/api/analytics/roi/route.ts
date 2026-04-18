/**
 * GET /api/analytics/roi
 * ROI (투자 회수) 분석 — 에너지 절감액 vs 구독료
 *
 * 반환:
 *   monthlySavings       : number  — 최근 3개월 평균 절감액 (원)
 *   annualSavings        : number  — 연간 예상 절감액
 *   subscriptionCost     : number  — 월 구독료 (원)
 *   roiMultiple          : number  — 절감액 / 구독료 배수
 *   roiPercent           : number  — (절감액 - 구독료) / 구독료 × 100
 *   paybackMonths        : number  — 누적 절감액이 구독료 회수하는 개월 수
 *   trend                : Array<{ month, savings, cost }>  — 6개월 추이
 *   savingBreakdown      : { peakShift, efficiency, demand }  — 절감 원인 분류
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify';
import { successResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/api/response';
import { getSeason, getTimeType, FUND_RATE, VAT_RATE } from '@/lib/utils/kepco-pricing';

export const dynamic = 'force-dynamic';

// 시간대별 단가 (원/kWh, KEPCO 산업용 고압A)
const ENERGY_RATE = {
  summer:     { offPeak: 68.5, midPeak: 116.8, onPeak: 234.4 },
  winter:     { offPeak: 63.6, midPeak: 110.8, onPeak: 174.7 },
  spring_fall:{ offPeak: 61.4, midPeak: 102.6, onPeak: 139.6 },
};

// 플랜 월정액 (원) — DB 없을 때 폴백
const PLAN_MONTHLY: Record<string, number> = {
  trial:      0,
  basic:      99_000,
  pro:        299_000,
  enterprise: 790_000,
};

async function getMonthlyKwh(
  tenantId: string,
  metricIds: string[],
  year: number,
  month: number        // 0-indexed
): Promise<{ offPeak: number; midPeak: number; onPeak: number; total: number }> {
  const start = new Date(year, month, 1);
  const end   = new Date(year, month + 1, 0, 23, 59, 59);
  const season = getSeason(start);
  const result = { offPeak: 0, midPeak: 0, onPeak: 0, total: 0 };

  if (metricIds.length === 0) return result;

  const rows = await prisma.measurement.findMany({
    where: { tenantId, metricId: { in: metricIds }, time: { gte: start, lte: end }, quality: 'good' },
    select: { time: true, value: true },
  });

  for (const r of rows) {
    const hour = new Date(r.time).getHours();
    const tt = getTimeType(hour, season);
    result[tt] += Number(r.value);
    result.total += Number(r.value);
  }
  return result;
}

function calcCost(kwh: { offPeak: number; midPeak: number; onPeak: number }, season: 'summer' | 'winter' | 'spring_fall'): number {
  const r = ENERGY_RATE[season];
  return Math.round((kwh.offPeak * r.offPeak + kwh.midPeak * r.midPeak + kwh.onPeak * r.onPeak) * (1 + FUND_RATE + VAT_RATE));
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const { tenantId } = auth;

    // ── 에너지 메트릭 IDs ─────────────────────────────────────────────
    const metrics = await prisma.metric.findMany({
      where: { tenantId, OR: [{ unit: 'kWh' }, { unit: 'kW' }, { key: { contains: 'energy' } }] },
      select: { id: true },
    });
    const metricIds = metrics.map(m => m.id);

    // ── 구독 플랜 조회 ────────────────────────────────────────────────
    const sub = await prisma.subscription.findFirst({
      where: { tenantId, status: { in: ['ACTIVE', 'EXPIRE_SOON'] } },
      orderBy: { startDate: 'desc' },
      select: { plan: { select: { tier: true, monthlyPrice: true } } },
    });
    const planTier = (sub?.plan?.tier ?? 'trial').toLowerCase();
    const subscriptionCost = sub?.plan?.monthlyPrice
      ? Number(sub.plan.monthlyPrice)
      : (PLAN_MONTHLY[planTier] ?? 0);

    // ── 최근 6개월 데이터 수집 ────────────────────────────────────────
    const now = new Date();
    const trend: Array<{ month: string; savings: number; cost: number; kwh: number }> = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const mo   = d.getMonth();
      const label = `${year}-${String(mo + 1).padStart(2, '0')}`;
      const season = getSeason(d);

      const kwh = await getMonthlyKwh(tenantId, metricIds, year, mo);
      const totalCost = calcCost(kwh, season);

      // 절감 가능액: 최대부하 20%를 경부하로 이전 시
      const r = ENERGY_RATE[season];
      const shiftableKwh = kwh.onPeak * 0.2;
      const peakShiftSaving = Math.round(shiftableKwh * (r.onPeak - r.offPeak) * (1 + FUND_RATE + VAT_RATE));

      // 효율 개선 절감 (EMS 도입 평균 8% 효율 개선 가정)
      const efficiencySaving = Math.round(totalCost * 0.08);

      const totalSaving = peakShiftSaving + efficiencySaving;

      trend.push({ month: label, savings: totalSaving, cost: totalCost, kwh: Math.round(kwh.total) });
    }

    // ── 집계 ─────────────────────────────────────────────────────────
    const recentMonths = trend.slice(-3).filter(t => t.kwh > 0);
    const avgSavings = recentMonths.length > 0
      ? Math.round(recentMonths.reduce((s, t) => s + t.savings, 0) / recentMonths.length)
      : 0;
    const avgCost = recentMonths.length > 0
      ? Math.round(recentMonths.reduce((s, t) => s + t.cost, 0) / recentMonths.length)
      : 0;

    const monthlySavings  = avgSavings;
    const annualSavings   = monthlySavings * 12;
    const roiMultiple     = subscriptionCost > 0 ? Math.round((monthlySavings / subscriptionCost) * 10) / 10 : 0;
    const roiPercent      = subscriptionCost > 0
      ? Math.round(((monthlySavings - subscriptionCost) / subscriptionCost) * 1000) / 10
      : 0;
    const paybackMonths   = monthlySavings > subscriptionCost
      ? 1  // 첫 달에 회수
      : subscriptionCost > 0 && monthlySavings > 0
      ? Math.ceil(subscriptionCost / monthlySavings)
      : 99;

    // 절감 분류 (최근 달 기준)
    const lastMonth  = trend[trend.length - 1] ?? { savings: 0, cost: 0, kwh: 0, month: '' };
    const lastD      = new Date(now.getFullYear(), now.getMonth() - 0, 1);
    const lastSeason = getSeason(lastD);
    const lastKwh    = await getMonthlyKwh(tenantId, metricIds, lastD.getFullYear(), lastD.getMonth());
    const lr         = ENERGY_RATE[lastSeason];
    const peakShift  = Math.round(lastKwh.onPeak * 0.2 * (lr.onPeak - lr.offPeak) * (1 + FUND_RATE + VAT_RATE));
    const efficiencyS  = Math.round(lastMonth.cost * 0.08);
    const demandCtrl   = Math.round(lastMonth.cost * 0.03);  // 최대수요전력 절감

    return successResponse({
      monthlySavings,
      annualSavings,
      subscriptionCost,
      roiMultiple,
      roiPercent,
      paybackMonths,
      planTier,
      avgMonthlyCost: avgCost,
      dataMonths: recentMonths.length,
      trend: trend.map(t => ({ month: t.month, savings: t.savings, cost: t.cost, kwh: t.kwh })),
      savingBreakdown: {
        peakShift,
        efficiency: efficiencyS,
        demandControl: demandCtrl,
        total: peakShift + efficiencyS + demandCtrl,
      },
    });
  } catch (error) {
    console.error('[API] ROI 분석 오류:', error);
    return serverErrorResponse();
  }
}
