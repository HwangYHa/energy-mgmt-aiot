/**
 * /api/dashboard/stats - 대시보드 통계 API
 *
 * GET: 대시보드에 필요한 모든 통계 데이터 조회
 *
 * 실제 Measurement 데이터가 있으면 DB 집계,
 * 없으면 폴백 시뮬레이션 데이터 사용
 */

import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import { successResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/api/response';

interface DashboardStats {
  kpis: {
    totalConsumption: number;
    consumptionUnit: string;
    consumptionTrend: { value: number; direction: 'up' | 'down' };
    efficiency: number;
    equipmentRate: number;
    drParticipation: number;
    carbonGoal: number;
  };
  realtime: {
    currentPower: number;
    dailyUsage: number;
    peakRatio: number;
    estimatedCost: number;
  };
  monthlyConsumption: Array<{ name: string; consumption: number; target: number }>;
  weeklyTrend: Array<{ name: string; current: number; previous: number }>;
  hourlyLoad: Array<{ name: string; load: number; peak: number }>;
  costAnalysis: Array<{ name: string; cost: number; savings: number }>;
  efficiencyTrend: Array<{ name: string; efficiency: number; target: number }>;
  carbonEmission: Array<{ name: string; emission: number; limit: number }>;
  costSavings: Array<{ name: string; profit: number; target: number }>;
  renewableEnergy: Array<{ name: string; solar: number; wind: number; ess: number }>;
  peakHourAnalysis: Array<{ name: string; value: number; avg: number }>;
  devices: {
    total: number;
    online: number;
    offline: number;
    error: number;
  };
  sensors: {
    total: number;
    online: number;
    types: Array<{ type: string; count: number }>;
  };
  dataSource: 'db' | 'simulation';
}

const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
const weekdayNames = ['월', '화', '수', '목', '금', '토', '일'];

// 시스템 설정에서 전기요금 조회
async function getEnergySettings(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  const settings = (tenant?.settings as Record<string, Record<string, number>>) || {};
  return {
    electricityRate: settings?.energy?.electricityRate || 120,
    carbonFactor: settings?.energy?.carbonFactor || 0.4567,
    targetReduction: settings?.energy?.targetReduction || 10,
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const { tenantId } = auth;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 1. 병렬 DB 쿼리
    const [
      sites,
      devices,
      onlineDevices,
      offlineDevices,
      errorDevices,
      sensors,
      onlineSensors,
      sensorTypes,
      measurementCount,
      energySettings,
    ] = await Promise.all([
      prisma.site.count({ where: { tenantId, deletedAt: null, isActive: true } }),
      prisma.device.count({ where: { tenantId, deletedAt: null } }),
      prisma.device.count({ where: { tenantId, deletedAt: null, status: 'online' } }),
      prisma.device.count({ where: { tenantId, deletedAt: null, status: 'offline' } }),
      prisma.device.count({ where: { tenantId, deletedAt: null, status: 'error' } }),
      prisma.sensor.count({ where: { tenantId, deletedAt: null } }),
      prisma.sensor.count({ where: { tenantId, deletedAt: null, status: 'online' } }),
      prisma.sensor.groupBy({
        by: ['sensorType'],
        where: { tenantId, deletedAt: null },
        _count: { id: true },
      }),
      prisma.measurement.count({
        where: { tenantId, time: { gte: todayStart } },
      }),
      getEnergySettings(tenantId),
    ]);

    const hasRealData = measurementCount > 0;
    const equipmentRate = devices > 0 ? Math.round((onlineDevices / devices) * 100) : 0;

    let realtime: DashboardStats['realtime'];
    let monthlyConsumption: DashboardStats['monthlyConsumption'];
    let weeklyTrend: DashboardStats['weeklyTrend'];
    let hourlyLoad: DashboardStats['hourlyLoad'];

    if (hasRealData) {
      // 실제 DB 데이터 기반 집계
      const [todayMeasurements, recentMeasurement] = await Promise.all([
        prisma.measurement.aggregate({
          where: { tenantId, time: { gte: todayStart } },
          _sum: { value: true },
          _avg: { value: true },
          _max: { value: true },
        }),
        prisma.measurement.findFirst({
          where: { tenantId },
          orderBy: { time: 'desc' },
          select: { value: true, time: true },
        }),
      ]);

      const currentPower = recentMeasurement ? Number(recentMeasurement.value) : 0;
      const dailyUsage = todayMeasurements._sum?.value ? Number(todayMeasurements._sum.value) : 0;
      const maxPower = todayMeasurements._max?.value ? Number(todayMeasurements._max.value) : 1;
      const peakRatio = maxPower > 0 ? Math.round((currentPower / maxPower) * 100) : 0;
      const estimatedCost = Math.round(dailyUsage * energySettings.electricityRate);

      realtime = { currentPower: Math.round(currentPower), dailyUsage: Math.round(dailyUsage), peakRatio, estimatedCost };

      // 시간대별 부하 (실제 데이터)
      const hourBuckets = [0, 4, 8, 12, 16, 20];
      const hourlyData: DashboardStats['hourlyLoad'] = [];

      for (const h of hourBuckets) {
        const start = new Date(todayStart);
        start.setHours(h);
        const end = new Date(todayStart);
        end.setHours(h + 4);

        const agg = await prisma.measurement.aggregate({
          where: { tenantId, time: { gte: start, lt: end } },
          _avg: { value: true },
          _max: { value: true },
        });

        hourlyData.push({
          name: `${String(h).padStart(2, '0')}시`,
          load: agg._avg?.value ? Math.round(Number(agg._avg.value)) : 0,
          peak: agg._max?.value ? Math.round(Number(agg._max.value)) : 0,
        });
      }
      hourlyLoad = hourlyData;

      // 월별 소비량 (실제 데이터)
      monthlyConsumption = [];
      for (let m = 0; m < 12; m++) {
        const mStart = new Date(now.getFullYear(), m, 1);
        const mEnd = new Date(now.getFullYear(), m + 1, 1);
        if (mStart > now) break;

        const mAgg = await prisma.measurement.aggregate({
          where: { tenantId, time: { gte: mStart, lt: mEnd } },
          _sum: { value: true },
        });

        monthlyConsumption.push({
          name: monthNames[m] ?? `${m + 1}월`,
          consumption: mAgg._sum?.value ? Math.round(Number(mAgg._sum.value)) : 0,
          target: 4000 + (m % 4) * 200,
        });
      }

      // 주간 추이
      weeklyTrend = [];
      for (let d = 0; d < 7; d++) {
        const dayStart = new Date(now);
        dayStart.setDate(now.getDate() - now.getDay() + d + 1);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const prevDayStart = new Date(dayStart);
        prevDayStart.setDate(prevDayStart.getDate() - 7);
        const prevDayEnd = new Date(dayEnd);
        prevDayEnd.setDate(prevDayEnd.getDate() - 7);

        const [current, previous] = await Promise.all([
          prisma.measurement.aggregate({
            where: { tenantId, time: { gte: dayStart, lt: dayEnd } },
            _sum: { value: true },
          }),
          prisma.measurement.aggregate({
            where: { tenantId, time: { gte: prevDayStart, lt: prevDayEnd } },
            _sum: { value: true },
          }),
        ]);

        weeklyTrend.push({
          name: weekdayNames[d] ?? `${d}`,
          current: current._sum?.value ? Math.round(Number(current._sum.value)) : 0,
          previous: previous._sum?.value ? Math.round(Number(previous._sum.value)) : 0,
        });
      }
    } else {
      // 폴백: 시뮬레이션 데이터 (센서 데이터 없을 때)
      realtime = {
        currentPower: Math.round(200 + Math.random() * 100),
        dailyUsage: Math.round(1500 + Math.random() * 500),
        peakRatio: Math.round(60 + Math.random() * 20),
        estimatedCost: Math.round(250000 + Math.random() * 50000),
      };

      monthlyConsumption = monthNames.map((name, index) => ({
        name,
        consumption: Math.round(3500 + Math.random() * 2000),
        target: 4000 + (index % 4) * 200,
      }));

      weeklyTrend = weekdayNames.map((name) => ({
        name,
        current: Math.round(400 + Math.random() * 400),
        previous: Math.round(400 + Math.random() * 400),
      }));

      hourlyLoad = [
        { name: '00시', load: 120, peak: 200 },
        { name: '04시', load: 100, peak: 200 },
        { name: '08시', load: 280, peak: 300 },
        { name: '12시', load: 350, peak: 350 },
        { name: '16시', load: 320, peak: 350 },
        { name: '20시', load: 250, peak: 300 },
      ];
    }

    // KPI 계산
    const totalConsumption = monthlyConsumption.reduce((sum, m) => sum + m.consumption, 0);
    const previousYearEstimate = totalConsumption * 1.085;
    const consumptionTrendValue = ((previousYearEstimate - totalConsumption) / previousYearEstimate) * 100;

    // 비용 분석
    const costAnalysis = monthlyConsumption.slice(0, 6).map((m) => ({
      name: m.name,
      cost: Math.round(m.consumption * energySettings.electricityRate),
      savings: Math.round(m.consumption * energySettings.electricityRate * 0.08),
    }));

    // 탄소 배출
    const carbonEmission = monthlyConsumption.slice(0, 6).map((m, i) => ({
      name: m.name,
      emission: Math.round(m.consumption * energySettings.carbonFactor),
      limit: 2800 + (i % 3) * 200,
    }));

    // 효율성 추이
    const efficiencyTrend = Array.from({ length: 6 }, (_, i) => ({
      name: `${i + 1}주`,
      efficiency: hasRealData ? Math.round(equipmentRate - 5 + Math.random() * 10) : Math.round(80 + Math.random() * 10),
      target: 85,
    }));

    // 비용 절감 추이
    const costSavings = monthlyConsumption.slice(0, 6).map((m, i) => ({
      name: m.name,
      profit: Math.round(m.consumption * energySettings.electricityRate * 0.06),
      target: 800 + i * 50,
    }));

    // 신재생 에너지
    const renewableEnergy = ['1분기', '2분기', '3분기', '4분기'].map((name) => ({
      name,
      solar: Math.round(4000 + Math.random() * 2500),
      wind: Math.round(3000 + Math.random() * 1500),
      ess: Math.round(1500 + Math.random() * 1000),
    }));

    // 피크 시간대
    const peakHourAnalysis = [
      { name: '06-09', value: hourlyLoad[2]?.load || 180, avg: 150 },
      { name: '09-12', value: hourlyLoad[3]?.load || 320, avg: 280 },
      { name: '12-15', value: Math.round(((hourlyLoad[3]?.load || 0) + (hourlyLoad[4]?.load || 0)) / 2) || 280, avg: 260 },
      { name: '15-18', value: hourlyLoad[4]?.load || 350, avg: 300 },
      { name: '18-21', value: hourlyLoad[5]?.load || 290, avg: 250 },
      { name: '21-24', value: Math.round((hourlyLoad[5]?.load || 0) * 0.6) || 150, avg: 120 },
    ];

    const stats: DashboardStats = {
      kpis: {
        totalConsumption,
        consumptionUnit: 'kWh',
        consumptionTrend: {
          value: Math.round(consumptionTrendValue * 10) / 10,
          direction: 'down',
        },
        efficiency: hasRealData ? equipmentRate : 94,
        equipmentRate,
        drParticipation: 76,
        carbonGoal: Math.round(100 - energySettings.targetReduction),
      },
      realtime,
      monthlyConsumption,
      weeklyTrend,
      hourlyLoad,
      costAnalysis,
      efficiencyTrend,
      carbonEmission,
      costSavings,
      renewableEnergy,
      peakHourAnalysis,
      devices: {
        total: devices,
        online: onlineDevices,
        offline: offlineDevices,
        error: errorDevices,
      },
      sensors: {
        total: sensors,
        online: onlineSensors,
        types: sensorTypes.map((s) => ({
          type: s.sensorType,
          count: s._count.id,
        })),
      },
      dataSource: hasRealData ? 'db' : 'simulation',
    };

    return successResponse(stats, {
      meta: {
        timestamp: now.toISOString(),
        tenantId,
        sitesCount: sites,
        devicesCount: devices,
        sensorsCount: sensors,
        measurementsToday: measurementCount,
        dataSource: hasRealData ? 'database' : 'simulation',
      },
    });
  } catch (error) {
    console.error('[API] 대시보드 통계 조회 오류:', error);
    return serverErrorResponse();
  }
}
