/**
 * GET /api/analytics/cost/compare
 * 당월 vs 전월 전기요금 비교
 * query: contractPower (kW), currentMonth (ISO string)
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify';
import { successResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/api/response';
import { getSeason, getTimeType, calcMonthlyCost, type TimeType } from '@/lib/utils/kepco-pricing';

async function calcMonthCostForTenant(
  tenantId: string,
  metricIds: string[],
  monthStart: Date,
  monthEnd: Date,
  contractPower: number
): Promise<number> {
  if (metricIds.length === 0) return 0;

  const measurements = await prisma.measurement.findMany({
    where: {
      tenantId,
      metricId: { in: metricIds },
      time: { gte: monthStart, lte: monthEnd },
      quality: 'good',
    },
    select: { time: true, value: true },
  });

  const season = getSeason(monthStart);
  const energyByTimeType: Record<TimeType, number> = { offPeak: 0, midPeak: 0, onPeak: 0 };

  for (const m of measurements) {
    const hour = new Date(m.time).getHours();
    const timeType = getTimeType(hour, season);
    energyByTimeType[timeType] += Number(m.value);
  }

  const breakdown = calcMonthlyCost(contractPower, energyByTimeType, monthStart);
  return breakdown.total;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const { tenantId } = auth;
    const { searchParams } = new URL(request.url);
    const contractPower = Math.max(1, Number(searchParams.get('contractPower') || 1000));
    const currentMonthParam = searchParams.get('currentMonth');
    const currentMonthDate = currentMonthParam ? new Date(currentMonthParam) : new Date();

    const currentMonthStart = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), 1);
    const currentMonthEnd = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 0, 23, 59, 59);
    const previousMonthStart = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1);
    const previousMonthEnd = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), 0, 23, 59, 59);

    // 에너지 메트릭 조회
    const energyMetrics = await prisma.metric.findMany({
      where: {
        tenantId,
        OR: [{ unit: 'kWh' }, { unit: 'kW' }, { key: { contains: 'energy' } }],
      },
      select: { id: true },
    });
    const metricIds = energyMetrics.map((m) => m.id);

    const [currentMonth, previousMonth] = await Promise.all([
      calcMonthCostForTenant(tenantId, metricIds, currentMonthStart, currentMonthEnd, contractPower),
      calcMonthCostForTenant(tenantId, metricIds, previousMonthStart, previousMonthEnd, contractPower),
    ]);

    const difference = currentMonth - previousMonth;
    const percentageChange =
      previousMonth > 0 ? Math.round((difference / previousMonth) * 1000) / 10 : 0;

    return successResponse({ currentMonth, previousMonth, difference, percentageChange });
  } catch (error) {
    console.error('[API] 비용 비교 오류:', error);
    return serverErrorResponse();
  }
}
