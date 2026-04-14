/**
 * GET /api/analytics/cost/monthly
 * 월별 전기요금 계산 (KEPCO 산업용 고압A 기준)
 * query: contractPower (kW), month (ISO string)
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify';
import { successResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/api/response';
import {
  getSeason,
  getTimeType,
  calcMonthlyCost,
  type TimeType,
} from '@/lib/utils/kepco-pricing';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const { tenantId } = auth;
    const { searchParams } = new URL(request.url);
    const contractPower = Math.max(1, Number(searchParams.get('contractPower') || 1000));
    const monthParam = searchParams.get('month');
    const monthDate = monthParam ? new Date(monthParam) : new Date();

    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59);

    // 에너지 메트릭 조회
    const energyMetrics = await prisma.metric.findMany({
      where: {
        tenantId,
        OR: [{ unit: 'kWh' }, { unit: 'kW' }, { key: { contains: 'energy' } }],
      },
      select: { id: true },
    });

    const metricIds = energyMetrics.map((m) => m.id);

    const energyByTimeType: Record<TimeType, number> = {
      offPeak: 0,
      midPeak: 0,
      onPeak: 0,
    };

    if (metricIds.length > 0) {
      // 해당 월 측정 데이터 조회 (hourly 집계)
      const measurements = await prisma.measurement.findMany({
        where: {
          tenantId,
          metricId: { in: metricIds },
          time: { gte: monthStart, lte: monthEnd },
          quality: 'good',
        },
        select: { time: true, value: true },
        orderBy: { time: 'asc' },
      });

      const season = getSeason(monthDate);
      for (const m of measurements) {
        const hour = new Date(m.time).getHours();
        const timeType = getTimeType(hour, season);
        energyByTimeType[timeType] += Number(m.value);
      }
    }

    const breakdown = calcMonthlyCost(contractPower, energyByTimeType, monthDate);
    return successResponse(breakdown);
  } catch (error) {
    console.error('[API] 월별 비용 오류:', error);
    return serverErrorResponse();
  }
}
