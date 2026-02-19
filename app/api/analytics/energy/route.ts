/**
 * /api/analytics/energy - 에너지 분석 API
 *
 * GET: 에너지 사용량 추이, 피크 분석, 전월 대비 데이터 반환
 * query: period (hourly|daily|weekly|monthly), startDate, endDate
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify';
import {
  successResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from '@/lib/api/response';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const { tenantId } = auth;
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'daily';

    // 기간 설정
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case 'hourly':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case 'daily':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case 'weekly':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case 'monthly':
        startDate.setMonth(startDate.getMonth() - 12);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    // 에너지 관련 메트릭 조회
    const energyMetrics = await prisma.metric.findMany({
      where: {
        tenantId,
        OR: [
          { key: { contains: 'energy' } },
          { key: { contains: 'power' } },
          { unit: 'kWh' },
          { unit: 'kW' },
        ],
      },
      select: { id: true, key: true, unit: true },
    });

    const metricIds = energyMetrics.map((m) => m.id);

    let energyData: Array<{ timestamp: string; value: number }> = [];
    let peakAnalysis = null;
    let comparison = null;

    if (metricIds.length > 0) {
      // 실제 Measurement 데이터 조회
      const measurements = await prisma.measurement.findMany({
        where: {
          tenantId,
          metricId: { in: metricIds },
          time: { gte: startDate, lte: endDate },
          quality: 'good',
        },
        orderBy: { time: 'asc' },
        select: { time: true, value: true },
      });

      if (measurements.length > 0) {
        // 기간별 집계
        const grouped = groupByPeriod(measurements, period);
        energyData = grouped;

        // 피크 분석
        const values = measurements.map((m) => Number(m.value));
        const maxIdx = values.indexOf(Math.max(...values));
        const minIdx = values.indexOf(Math.min(...values));
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const peak = values[maxIdx] ?? 0;
        const peakM = measurements[maxIdx];
        const valleyM = measurements[minIdx];

        peakAnalysis = {
          peak: { value: peak, timestamp: peakM ? peakM.time.toISOString() : '' },
          valley: { value: values[minIdx] ?? 0, timestamp: valleyM ? valleyM.time.toISOString() : '' },
          average: Math.round(avg * 10) / 10,
          loadFactor: peak > 0 ? Math.round((avg / peak) * 1000) / 10 : 0,
        };

        // 전월 대비
        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

        const [currentSum, previousSum] = await Promise.all([
          prisma.measurement.aggregate({
            where: {
              tenantId,
              metricId: { in: metricIds },
              time: { gte: thisMonthStart, lte: now },
              quality: 'good',
            },
            _sum: { value: true },
          }),
          prisma.measurement.aggregate({
            where: {
              tenantId,
              metricId: { in: metricIds },
              time: { gte: lastMonthStart, lte: lastMonthEnd },
              quality: 'good',
            },
            _sum: { value: true },
          }),
        ]);

        const current = Number(currentSum._sum.value || 0);
        const previous = Number(previousSum._sum.value || 0);
        const difference = current - previous;

        comparison = {
          current: Math.round(current * 10) / 10,
          previous: Math.round(previous * 10) / 10,
          difference: Math.round(difference * 10) / 10,
          percentageChange: previous > 0 ? Math.round((difference / previous) * 1000) / 10 : 0,
        };
      }
    }

    return successResponse({
      energyData,
      peakAnalysis,
      comparison,
      period,
      range: { start: startDate.toISOString(), end: endDate.toISOString() },
      hasData: energyData.length > 0,
    });
  } catch (error) {
    console.error('[API] 에너지 분석 오류:', error);
    return serverErrorResponse();
  }
}

function groupByPeriod(
  measurements: Array<{ time: Date; value: unknown }>,
  period: string
): Array<{ timestamp: string; value: number }> {
  const groups = new Map<string, number[]>();

  for (const m of measurements) {
    const d = new Date(m.time);
    let key: string;

    switch (period) {
      case 'hourly':
        key = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:00`;
        break;
      case 'daily':
        key = `${d.getMonth() + 1}/${d.getDate()}`;
        break;
      case 'weekly': {
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        key = `${weekStart.getMonth() + 1}/${weekStart.getDate()}주`;
        break;
      }
      case 'monthly':
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        break;
      default:
        key = `${d.getMonth() + 1}/${d.getDate()}`;
    }

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(Number(m.value));
  }

  return Array.from(groups.entries()).map(([timestamp, values]) => ({
    timestamp,
    value: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10,
  }));
}

