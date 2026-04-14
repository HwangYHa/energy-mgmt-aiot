/**
 * GET /api/analytics/cost/hourly
 * 당일 시간대별 전기요금 조회
 * query: date (ISO string)
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify';
import { successResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/api/response';
import { getSeason, getTimeType, calcEnergyCost } from '@/lib/utils/kepco-pricing';

interface HourlyCost {
  hour: number;
  energy: number;
  cost: number;
  timeType: 'offPeak' | 'midPeak' | 'onPeak';
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const { tenantId } = auth;
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const targetDate = dateParam ? new Date(dateParam) : new Date();

    const dayStart = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
      0, 0, 0
    );
    const dayEnd = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
      23, 59, 59
    );
    const season = getSeason(targetDate);

    // 에너지 메트릭 조회
    const energyMetrics = await prisma.metric.findMany({
      where: {
        tenantId,
        OR: [{ unit: 'kWh' }, { unit: 'kW' }, { key: { contains: 'energy' } }],
      },
      select: { id: true },
    });

    const metricIds = energyMetrics.map((m) => m.id);

    // 시간별 집계 맵
    const hourlyMap = new Map<number, number>();

    if (metricIds.length > 0) {
      const measurements = await prisma.measurement.findMany({
        where: {
          tenantId,
          metricId: { in: metricIds },
          time: { gte: dayStart, lte: dayEnd },
          quality: 'good',
        },
        select: { time: true, value: true },
      });

      for (const m of measurements) {
        const hour = new Date(m.time).getHours();
        hourlyMap.set(hour, (hourlyMap.get(hour) ?? 0) + Number(m.value));
      }
    }

    const currentHour = new Date().getHours();
    const hourlyCost: HourlyCost[] = [];

    for (let h = 0; h <= Math.min(23, currentHour); h++) {
      const energy = Math.round((hourlyMap.get(h) ?? 0) * 10) / 10;
      const timeType = getTimeType(h, season);
      const cost = Math.round(calcEnergyCost(energy, timeType, season));
      hourlyCost.push({ hour: h, energy, cost, timeType });
    }

    return successResponse(hourlyCost);
  } catch (error) {
    console.error('[API] 시간대별 비용 오류:', error);
    return serverErrorResponse();
  }
}
