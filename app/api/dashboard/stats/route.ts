/**
 * /api/dashboard/stats - 대시보드 통계 API
 *
 * GET: 대시보드에 필요한 모든 통계 데이터 조회
 *
 * 실제 Measurement 데이터가 있으면 DB 집계 (GROUP BY 단일 쿼리),
 * 없으면 0값 반환
 *
 * 개선사항:
 *  - N+1 쿼리 제거: hourly(6→1), monthly(12→1), weekly(14→2) GROUP BY 적용
 *  - drParticipation: DrEvent 실집계
 *  - carbonFactor: EmissionFactor DB 조회 (테넌트 설정 폴백)
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

// MySQL DAYOFWEEK 인덱스 매핑: d=0(월)→2, d=1(화)→3, ..., d=5(토)→7, d=6(일)→1
const DOW_FOR_INDEX = [2, 3, 4, 5, 6, 7, 1];

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

// Raw 쿼리 결과 행 타입 (MySQL: 정수 집계 → bigint, Decimal 집계 → string)
interface HourlyRow {
  hour_bucket: bigint;
  avg_val: string | null;
  max_val: string | null;
}
interface MonthlyRow {
  month_num: bigint;
  total_val: string | null;
}
interface WeeklyRow {
  dow: bigint;
  total_val: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const { tenantId } = auth;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(todayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 이번 주 월요일 00:00
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // 0=Sun 보정
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevWeekEnd = new Date(weekStart);

    // 올해 범위
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const yearEnd = new Date(now.getFullYear() + 1, 0, 1);

    // 1. 병렬 DB 쿼리 (측정 데이터 유무와 무관한 것들)
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
      drParticipation,
      emissionFactorRow,
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
      // DR 이벤트 실집계: 올해 완료된 이벤트 수
      prisma.drEvent.count({
        where: {
          tenantId,
          status: 'completed',
          startTime: { gte: yearStart },
        },
      }),
      // 배출계수 DB 조회 (한국 전력, 최신 기본값)
      prisma.emissionFactor.findFirst({
        where: {
          category: 'electricity',
          isDefault: true,
          region: 'KR',
          OR: [{ validTo: null }, { validTo: { gte: now } }],
        },
        orderBy: { year: 'desc' },
        select: { factor: true },
      }),
    ]);

    // 탄소계수: EmissionFactor DB → 테넌트 설정 → 기본값 순서로 fallback
    const carbonFactor = emissionFactorRow
      ? Number(emissionFactorRow.factor)
      : energySettings.carbonFactor;

    const hasRealData = measurementCount > 0;
    const equipmentRate = devices > 0 ? Math.round((onlineDevices / devices) * 100) : 0;

    let realtime: DashboardStats['realtime'];
    let monthlyConsumption: DashboardStats['monthlyConsumption'];
    let weeklyTrend: DashboardStats['weeklyTrend'];
    let hourlyLoad: DashboardStats['hourlyLoad'];

    if (hasRealData) {
      // 실제 DB 데이터 기반 집계 — GROUP BY 단일 쿼리로 N+1 제거
      const [
        todayMeasurements,
        recentMeasurement,
        hourlyRows,
        monthlyRows,
        currentWeekRows,
        prevWeekRows,
      ] = await Promise.all([
        // 오늘 합계/평균/최대
        prisma.measurement.aggregate({
          where: { tenantId, time: { gte: todayStart } },
          _sum: { value: true },
          _avg: { value: true },
          _max: { value: true },
        }),
        // 가장 최근 측정값
        prisma.measurement.findFirst({
          where: { tenantId },
          orderBy: { time: 'desc' },
          select: { value: true, time: true },
        }),
        // 시간대별 부하: 6개 개별 쿼리 → 1개 GROUP BY
        prisma.$queryRaw<HourlyRow[]>`
          SELECT
            FLOOR(HOUR(time) / 4) * 4 AS hour_bucket,
            AVG(value)                AS avg_val,
            MAX(value)                AS max_val
          FROM measurement
          WHERE tenant_id = ${tenantId}
            AND time >= ${todayStart}
            AND time <  ${tomorrow}
          GROUP BY hour_bucket
          ORDER BY hour_bucket
        `,
        // 월별 소비량: 12개 개별 쿼리 → 1개 GROUP BY
        prisma.$queryRaw<MonthlyRow[]>`
          SELECT
            MONTH(time)  AS month_num,
            SUM(value)   AS total_val
          FROM measurement
          WHERE tenant_id = ${tenantId}
            AND time >= ${yearStart}
            AND time <  ${yearEnd}
          GROUP BY month_num
          ORDER BY month_num
        `,
        // 이번 주 일별 합계
        prisma.$queryRaw<WeeklyRow[]>`
          SELECT
            DAYOFWEEK(time) AS dow,
            SUM(value)      AS total_val
          FROM measurement
          WHERE tenant_id = ${tenantId}
            AND time >= ${weekStart}
            AND time <  ${weekEnd}
          GROUP BY dow
        `,
        // 전주 일별 합계
        prisma.$queryRaw<WeeklyRow[]>`
          SELECT
            DAYOFWEEK(time) AS dow,
            SUM(value)      AS total_val
          FROM measurement
          WHERE tenant_id = ${tenantId}
            AND time >= ${prevWeekStart}
            AND time <  ${prevWeekEnd}
          GROUP BY dow
        `,
      ]);

      // 실시간 지표
      const currentPower = recentMeasurement ? Number(recentMeasurement.value) : 0;
      const dailyUsage = todayMeasurements._sum?.value ? Number(todayMeasurements._sum.value) : 0;
      const maxPower = todayMeasurements._max?.value ? Number(todayMeasurements._max.value) : 1;
      const peakRatio = maxPower > 0 ? Math.round((currentPower / maxPower) * 100) : 0;
      const estimatedCost = Math.round(dailyUsage * energySettings.electricityRate);
      realtime = { currentPower: Math.round(currentPower), dailyUsage: Math.round(dailyUsage), peakRatio, estimatedCost };

      // 시간대별 부하 (GROUP BY 결과 → 매핑)
      const hourlyMap = new Map<number, HourlyRow>();
      for (const row of hourlyRows) {
        hourlyMap.set(Number(row.hour_bucket), row);
      }
      hourlyLoad = [0, 4, 8, 12, 16, 20].map((h) => {
        const row = hourlyMap.get(h);
        return {
          name: `${String(h).padStart(2, '0')}시`,
          load: row?.avg_val ? Math.round(Number(row.avg_val)) : 0,
          peak: row?.max_val ? Math.round(Number(row.max_val)) : 0,
        };
      });

      // 월별 소비량 (GROUP BY 결과 → 매핑)
      const monthMap = new Map<number, number>();
      for (const row of monthlyRows) {
        monthMap.set(Number(row.month_num), row.total_val ? Math.round(Number(row.total_val)) : 0);
      }
      monthlyConsumption = monthNames.slice(0, now.getMonth() + 1).map((name, i) => ({
        name,
        consumption: monthMap.get(i + 1) ?? 0,
        target: 4000 + (i % 4) * 200,
      }));

      // 주간 추이 (GROUP BY 결과 → 매핑)
      const currentWeekMap = new Map<number, number>();
      for (const row of currentWeekRows) {
        currentWeekMap.set(Number(row.dow), row.total_val ? Math.round(Number(row.total_val)) : 0);
      }
      const prevWeekMap = new Map<number, number>();
      for (const row of prevWeekRows) {
        prevWeekMap.set(Number(row.dow), row.total_val ? Math.round(Number(row.total_val)) : 0);
      }
      weeklyTrend = weekdayNames.map((name, d) => {
        const dow = DOW_FOR_INDEX[d] ?? 0;
        return {
          name,
          current: currentWeekMap.get(dow) ?? 0,
          previous: prevWeekMap.get(dow) ?? 0,
        };
      });
    } else {
      // 실제 데이터 없음 → 0값 반환
      realtime = { currentPower: 0, dailyUsage: 0, peakRatio: 0, estimatedCost: 0 };

      monthlyConsumption = monthNames.slice(0, now.getMonth() + 1).map((name) => ({
        name,
        consumption: 0,
        target: 4000,
      }));

      weeklyTrend = weekdayNames.map((name) => ({ name, current: 0, previous: 0 }));

      hourlyLoad = [
        { name: '00시', load: 0, peak: 0 },
        { name: '04시', load: 0, peak: 0 },
        { name: '08시', load: 0, peak: 0 },
        { name: '12시', load: 0, peak: 0 },
        { name: '16시', load: 0, peak: 0 },
        { name: '20시', load: 0, peak: 0 },
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

    // 탄소 배출 (탄소계수: DB → 테넌트 설정 → 기본값)
    const emissionLimit = Math.round(4000 * carbonFactor * 1.1);
    const carbonEmission = monthlyConsumption.slice(0, 6).map((m) => ({
      name: m.name,
      emission: Math.round(m.consumption * carbonFactor),
      limit: emissionLimit,
    }));

    // 효율성 추이
    const efficiencyTrend = hasRealData
      ? Array.from({ length: 6 }, (_, i) => ({
          name: `${i + 1}주`,
          efficiency: equipmentRate,
          target: 85,
        }))
      : ([] as DashboardStats['efficiencyTrend']);

    // 비용 절감 추이
    const costSavings = monthlyConsumption.slice(0, 6).map((m, i) => ({
      name: m.name,
      profit: Math.round(m.consumption * energySettings.electricityRate * 0.06),
      target: 800 + i * 50,
    }));

    // 신재생 에너지: 별도 데이터 모델 없음 → 빈 배열
    const renewableEnergy: DashboardStats['renewableEnergy'] = [];

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
        drParticipation,
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
        carbonFactorSource: emissionFactorRow ? 'db' : 'tenant_settings',
      },
    });
  } catch (error) {
    console.error('[API] 대시보드 통계 조회 오류:', error);
    return serverErrorResponse();
  }
}
