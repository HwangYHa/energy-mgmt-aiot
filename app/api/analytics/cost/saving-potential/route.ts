/**
 * GET /api/analytics/cost/saving-potential
 * 전력 비용 절감 잠재량 분석
 * query: month (ISO string)
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify';
import { successResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/api/response';
import { getSeason, getTimeType, FUND_RATE, VAT_RATE } from '@/lib/utils/kepco-pricing';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const { tenantId } = auth;
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month');
    const monthDate = monthParam ? new Date(monthParam) : new Date();

    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59);
    const season = getSeason(monthDate);

    // 에너지 메트릭 조회
    const energyMetrics = await prisma.metric.findMany({
      where: {
        tenantId,
        OR: [{ unit: 'kWh' }, { unit: 'kW' }, { key: { contains: 'energy' } }],
      },
      select: { id: true },
    });

    const metricIds = energyMetrics.map((m) => m.id);

    // 시간대별 총 kWh
    const timeTypeKwh = { offPeak: 0, midPeak: 0, onPeak: 0 };

    if (metricIds.length > 0) {
      const measurements = await prisma.measurement.findMany({
        where: {
          tenantId,
          metricId: { in: metricIds },
          time: { gte: monthStart, lte: monthEnd },
          quality: 'good',
        },
        select: { time: true, value: true },
      });

      for (const m of measurements) {
        const hour = new Date(m.time).getHours();
        const timeType = getTimeType(hour, season);
        timeTypeKwh[timeType] += Number(m.value);
      }
    }

    // 현재 전력량요금 계산
    const ENERGY_RATE = {
      summer: { offPeak: 68.5, midPeak: 116.8, onPeak: 234.4 },
      winter: { offPeak: 63.6, midPeak: 110.8, onPeak: 174.7 },
      spring_fall: { offPeak: 61.4, midPeak: 102.6, onPeak: 139.6 },
    };
    const rates = ENERGY_RATE[season];

    const currentEnergyCost =
      timeTypeKwh.offPeak * rates.offPeak +
      timeTypeKwh.midPeak * rates.midPeak +
      timeTypeKwh.onPeak * rates.onPeak;
    const currentCost = Math.round(currentEnergyCost * (1 + FUND_RATE + VAT_RATE));

    // 절감 시나리오: 최대부하 20%를 경부하로 이전
    const shiftableKwh = timeTypeKwh.onPeak * 0.2;
    const costSaved =
      shiftableKwh * (rates.onPeak - rates.offPeak) * (1 + FUND_RATE + VAT_RATE);
    const potentialSaving = Math.round(Math.max(0, costSaved));
    const savingPercentage =
      currentCost > 0 ? Math.round((potentialSaving / currentCost) * 1000) / 10 : 0;

    // 추천사항 생성
    const recommendations: string[] = [];
    const totalKwh = timeTypeKwh.offPeak + timeTypeKwh.midPeak + timeTypeKwh.onPeak;

    if (totalKwh === 0) {
      recommendations.push('이번 달 측정 데이터가 없습니다. 센서 연결 상태를 확인하세요.');
    } else {
      const onPeakRatio = timeTypeKwh.onPeak / totalKwh;
      const offPeakRatio = timeTypeKwh.offPeak / totalKwh;

      if (onPeakRatio > 0.4) {
        recommendations.push(
          `최대부하 시간대(하계 10-12시/13-17시) 사용량이 전체의 ${(onPeakRatio * 100).toFixed(0)}%입니다. ` +
          '주요 생산 공정을 오전 9시 이전 또는 오후 5시 이후로 이전하면 요금을 절감할 수 있습니다.'
        );
      }

      if (offPeakRatio < 0.3) {
        recommendations.push(
          '심야(23:00~09:00) 경부하 시간대 활용률이 낮습니다. ' +
          '냉난방·압축기 예열 등 연속 운전 설비를 심야에 집중 운전하면 요금이 절감됩니다.'
        );
      }

      if (timeTypeKwh.onPeak > 0) {
        recommendations.push(
          `최대부하 전력량 ${timeTypeKwh.onPeak.toFixed(0)} kWh의 20%를 경부하로 이전 시 ` +
          `약 ${potentialSaving.toLocaleString('ko-KR')}원 절감 가능합니다.`
        );
      }

      recommendations.push(
        '피크타임 제어(DR) 시스템을 도입하면 최대수요전력 초과 시 자동으로 부하를 차단하여 기본요금을 낮출 수 있습니다.'
      );

      if (recommendations.length < 3) {
        recommendations.push(
          '에너지 사용 패턴을 월별로 분석하여 계절별 계약전력을 최적화하면 기본요금을 절감할 수 있습니다.'
        );
      }
    }

    return successResponse({
      currentCost,
      potentialSaving,
      savingPercentage,
      recommendations,
    });
  } catch (error) {
    console.error('[API] 절감 잠재량 오류:', error);
    return serverErrorResponse();
  }
}
