/**
 * lib/services/roi-calculator.service.ts
 *
 * 테넌트 ROI 자동 계산 엔진
 *
 * ─ 계산 방식 ──────────────────────────────────────────────────
 * 1. 에너지 절감액 = (베이스라인 kWh - 실제 kWh) × 전기요금단가(원/kWh)
 * 2. 탄소 절감 수익 = 절감 CO₂(kg) × 탄소크레딧단가(원/kg)
 * 3. DR 수익 = dr_event.revenue 합산
 * 4. 총 절감 = 1 + 2 + 3
 * 5. 투자비용 = 구독료 (subscription monthlyPrice × 가입 개월)
 * 6. ROI(%) = (총절감 - 투자비용) / 투자비용 × 100
 * 7. 페이백(월) = 투자비용 / (총절감 / 개월 수)
 * ─────────────────────────────────────────────────────────────
 */

import { prisma } from '@/lib/db/prisma';

// 전기 요금 단가 (원/kWh) - 한전 기준 평균, 환경변수로 override 가능
const ELECTRICITY_PRICE_KRW = Number(process.env.ELECTRICITY_PRICE_KRW ?? 130);
// 탄소 크레딧 단가 (원/kg CO₂)
const CARBON_CREDIT_KRW = Number(process.env.CARBON_CREDIT_KRW ?? 30);

export interface ROIReport {
  tenantId:         string;
  tenantName:       string;
  period:           string; // YYYY-MM
  periodMonths:     number; // 분석 기간(월)

  // 에너지
  totalKwh:         number;
  baselineKwh:      number;
  savedKwh:         number;
  savedEnergyCost:  number; // 원

  // 탄소
  totalCo2Kg:       number;
  savedCo2Kg:       number;
  carbonCreditKrw:  number; // 원

  // DR 수익
  drRevenueKrw:     number;

  // 종합
  totalSavedKrw:    number;
  investmentKrw:    number;  // 구독료 합계
  netBenefitKrw:    number;  // 순이익
  roiPercent:       number;
  paybackMonths:    number | null;

  // 월별 트렌드
  monthlyTrend: Array<{
    period:    string;
    savedKwh:  number;
    savedCost: number;
    roi:       number;
  }>;
}

export async function calculateROI(
  tenantId: string,
  monthCount = 6,
): Promise<ROIReport | null> {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!tenant) return null;

  // 분석 기간 산출
  const endDate   = new Date();
  const startDate = new Date(endDate);
  startDate.setMonth(startDate.getMonth() - monthCount);

  const periodStart = startDate.toISOString().slice(0, 7); // YYYY-MM
  const periodEnd   = endDate.toISOString().slice(0, 7);

  // ── KPI 스냅샷 조회 ─────────────────────────────────────────
  const kpiModel = (prisma as any).kpiSnapshot;
  const snapshots: Array<{
    period: string;
    totalKwh: string;
    baselineKwh: string | null;
    savedKwh: string | null;
    totalCo2Kg: string;
    savedCo2Kg: string | null;
    energyCostKrw: string | null;
    savedCostKrw: string | null;
    investmentKrw: string | null;
  }> = kpiModel
    ? await kpiModel.findMany({
        where: {
          tenantId,
          period: { gte: periodStart, lte: periodEnd },
        },
        orderBy: { period: 'asc' },
      }).catch(() => [])
    : [];

  // ── 측정 데이터에서 실시간 집계 ─────────────────────────────
  let realTimeKwh    = 0;
  let realTimeCo2Kg  = 0;
  if (snapshots.length === 0) {
    const measurements = await prisma.measurement.aggregate({
      where: {
        tenantId,
        time: { gte: startDate, lte: endDate },
      },
      _sum: { value: true },
    }).catch(() => ({ _sum: { value: null } }));
    realTimeKwh = Number(measurements._sum.value ?? 0) / 1000; // Wh → kWh 환산 (가정)
    realTimeCo2Kg = realTimeKwh * 0.4781; // 한국 전력 배출계수
  }

  // ── DR 수익 ─────────────────────────────────────────────────
  const drEvents = await prisma.drEvent.findMany({
    where: {
      tenantId,
      status: 'completed',
      startTime: { gte: startDate },
    },
    select: { revenue: true },
  }).catch(() => []);
  const drRevenueKrw = drEvents.reduce((sum, e) => sum + Number(e.revenue ?? 0), 0);

  // ── 구독료(투자비용) ─────────────────────────────────────────
  const subscriptions = await prisma.subscription.findMany({
    where: { tenantId },
    select: { plan: { select: { monthlyPrice: true } }, startDate: true, endDate: true },
  }).catch(() => []);

  let investmentKrw = 0;
  for (const sub of subscriptions) {
    const monthlyPrice = Number(sub.plan.monthlyPrice);
    const from = new Date(Math.max(sub.startDate.getTime(), startDate.getTime()));
    const to   = new Date(Math.min((sub.endDate ?? endDate).getTime(), endDate.getTime()));
    const months = Math.max(0,
      (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1,
    );
    investmentKrw += monthlyPrice * months;
  }
  if (investmentKrw === 0) investmentKrw = 0; // trial 등 무료 플랜

  // ── KPI 집계 ────────────────────────────────────────────────
  let totalKwh     = snapshots.reduce((s, k) => s + Number(k.totalKwh   ?? 0), 0) || realTimeKwh;
  let baselineKwh  = snapshots.reduce((s, k) => s + Number(k.baselineKwh ?? 0), 0);
  let savedKwh     = snapshots.reduce((s, k) => s + Number(k.savedKwh    ?? 0), 0);
  let totalCo2Kg   = snapshots.reduce((s, k) => s + Number(k.totalCo2Kg  ?? 0), 0) || realTimeCo2Kg;
  let savedCo2Kg   = snapshots.reduce((s, k) => s + Number(k.savedCo2Kg  ?? 0), 0);

  // 베이스라인 미입력 시 추정 (실제 × 1.15)
  if (baselineKwh === 0 && totalKwh > 0) baselineKwh = totalKwh * 1.15;
  if (savedKwh    === 0) savedKwh = Math.max(0, baselineKwh - totalKwh);
  if (savedCo2Kg  === 0) savedCo2Kg = savedKwh * 0.4781;

  const savedEnergyCost  = savedKwh  * ELECTRICITY_PRICE_KRW;
  const carbonCreditKrw  = savedCo2Kg * CARBON_CREDIT_KRW;
  const totalSavedKrw    = savedEnergyCost + carbonCreditKrw + drRevenueKrw;
  const netBenefitKrw    = totalSavedKrw - investmentKrw;
  const roiPercent       = investmentKrw > 0
    ? ((totalSavedKrw - investmentKrw) / investmentKrw) * 100
    : totalSavedKrw > 0 ? 999 : 0;
  const monthlyBenefit   = totalSavedKrw / (monthCount || 1);
  const paybackMonths    = investmentKrw > 0 && monthlyBenefit > 0
    ? investmentKrw / monthlyBenefit
    : null;

  // ── 월별 트렌드 ─────────────────────────────────────────────
  const monthlyTrend = snapshots.map((k) => {
    const mSavedKwh    = Number(k.savedKwh   ?? 0);
    const mInvestment  = Number(k.investmentKrw ?? 0) || investmentKrw / (monthCount || 1);
    const mSavedCost   = mSavedKwh * ELECTRICITY_PRICE_KRW;
    const mRoi         = mInvestment > 0 ? ((mSavedCost - mInvestment) / mInvestment) * 100 : 0;
    return { period: k.period, savedKwh: mSavedKwh, savedCost: mSavedCost, roi: mRoi };
  });

  return {
    tenantId:      tenant.id,
    tenantName:    tenant.name,
    period:        periodEnd,
    periodMonths:  monthCount,
    totalKwh,
    baselineKwh,
    savedKwh,
    savedEnergyCost,
    totalCo2Kg,
    savedCo2Kg,
    carbonCreditKrw,
    drRevenueKrw,
    totalSavedKrw,
    investmentKrw,
    netBenefitKrw,
    roiPercent,
    paybackMonths,
    monthlyTrend,
  };
}

// ── KPI 스냅샷 갱신 (월말 크론에서 호출) ─────────────────────

export async function upsertKpiSnapshot(tenantId: string, period: string): Promise<void> {
  const roi = await calculateROI(tenantId, 1);
  if (!roi) return;

  const kpiModel = (prisma as any).kpiSnapshot;
  if (!kpiModel) return;

  await kpiModel.upsert({
    where: { kpi_snapshot_tenant_id_period_key: { tenantId, period } },
    create: {
      tenantId,
      period,
      totalKwh:     roi.totalKwh,
      peakKw:       0,
      baselineKwh:  roi.baselineKwh,
      savedKwh:     roi.savedKwh,
      totalCo2Kg:   roi.totalCo2Kg,
      savedCo2Kg:   roi.savedCo2Kg,
      energyCostKrw: roi.totalKwh * ELECTRICITY_PRICE_KRW,
      savedCostKrw:  roi.savedEnergyCost,
      investmentKrw: roi.investmentKrw,
      roiPercent:    roi.roiPercent,
      paybackMonths: roi.paybackMonths ?? null,
    },
    update: {
      totalKwh:     roi.totalKwh,
      baselineKwh:  roi.baselineKwh,
      savedKwh:     roi.savedKwh,
      totalCo2Kg:   roi.totalCo2Kg,
      savedCo2Kg:   roi.savedCo2Kg,
      savedCostKrw: roi.savedEnergyCost,
      investmentKrw: roi.investmentKrw,
      roiPercent:   roi.roiPercent,
      paybackMonths: roi.paybackMonths ?? null,
    },
  }).catch((e: Error) => console.warn('[ROI] KPI upsert 실패:', e.message));
}
