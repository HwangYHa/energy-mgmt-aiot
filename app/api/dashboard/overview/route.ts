/**
 * GET /api/dashboard/overview
 * HMI 대시보드 전체 데이터 조회
 *
 * 성능 최적화 (Phase 6):
 *  - 테넌트 settings + hasPowerCategory 상위에서 1회만 조회 후 하위 함수에 전달
 *  - getSitesData(): N+1 → 배치 쿼리 (사이트 수 무관 쿼리 3개로 고정)
 *  - Cache-Control: private, max-age=15 (개인 캐시 15초)
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { verifyAuth } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import type {
  DashboardOverview,
  EnergyData,
  EquipmentData,
  CarbonData,
  Alert,
  SiteStatus,
  OptimizationRecommendation,
  AbnormalDevice,
} from '@/lib/types/hmi';
import {
  calculateEnergyStatus,
  calculateEquipmentStatus,
  calculateCarbonStatus,
} from '@/lib/types/hmi';

type TenantSettings = Record<string, Record<string, number>>;

export async function GET(request: NextRequest) {
  try {
    const context = await verifyAuth(request);
    if (!context) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { tenantId } = context;

    // ── 공통 사전 데이터: 테넌트 설정 + power_active 카테고리 여부를 1회만 조회 ──
    const [tenant, powerMetricRow] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { settings: true },
      }),
      prisma.$queryRaw<{ cnt: bigint }[]>`
        SELECT COUNT(*) as cnt FROM metric
        WHERE tenant_id = ${tenantId} AND category = 'power_active'
      `,
    ]);

    if (!tenant) {
      return NextResponse.json({ error: '테넌트를 찾을 수 없습니다' }, { status: 404 });
    }

    const settings = (tenant.settings as TenantSettings) || {};
    const hasPowerCategory = Number(powerMetricRow[0]?.cnt ?? 0) > 0;

    // ── 나머지 데이터 병렬 조회 ──
    const [energyData, equipmentData, carbonData, alertsData, sitesData, recommendationsData] =
      await Promise.all([
        getEnergyData(tenantId, settings, hasPowerCategory),
        getEquipmentData(tenantId),
        getCarbonData(tenantId, settings, hasPowerCategory),
        getAlertsData(tenantId),
        getSitesData(tenantId, settings),
        getRecommendationsData(tenantId),
      ]);

    const overview: DashboardOverview = {
      energy: energyData,
      equipment: equipmentData,
      carbon: carbonData,
      alerts: alertsData,
      sites: sitesData,
      recommendations: recommendationsData,
      timestamp: new Date(),
    };

    return NextResponse.json(overview, {
      headers: {
        // 개인(테넌트별) 캐시 15초 — 브라우저 재폴링 부하 감소
        'Cache-Control': 'private, max-age=15',
      },
    });
  } catch (error) {
    console.error('[Dashboard API] Error:', error);
    return NextResponse.json({ error: '대시보드 데이터 조회 실패' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 에너지 데이터 조회
// ─────────────────────────────────────────────────────────────────────────────

async function getEnergyData(
  tenantId: string,
  settings: TenantSettings,
  hasPowerCategory: boolean
): Promise<EnergyData> {
  const targetUsage = settings?.energy?.target || 1000;
  const peakLimit = settings?.energy?.peakLimit || 500;
  const electricityRate = settings?.energy?.electricityRate || 120;

  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

  // 최근 5분 평균 전력 — power_active 필터 (없으면 전체 폴백)
  type RecentRow = { avg_val: number | null; max_time: Date | null };
  const recentRows = hasPowerCategory
    ? await prisma.$queryRaw<RecentRow[]>`
        SELECT AVG(m.value) as avg_val, MAX(m.time) as max_time
        FROM measurement m
        JOIN metric mt ON m.metric_id = mt.id
        WHERE m.tenant_id = ${tenantId}
          AND m.time >= ${fiveMinAgo}
          AND mt.category = 'power_active'
      `
    : await prisma.$queryRaw<RecentRow[]>`
        SELECT AVG(m.value) as avg_val, MAX(m.time) as max_time
        FROM measurement m
        WHERE m.tenant_id = ${tenantId}
          AND m.time >= ${fiveMinAgo}
      `;

  const currentUsage = recentRows[0]?.avg_val ? Number(recentRows[0].avg_val) : 0;
  const lastUpdate = recentRows[0]?.max_time || new Date();

  const savings = Math.max(0, targetUsage - currentUsage);
  const savingsCost = Math.round(savings * electricityRate);
  const usageRate = targetUsage > 0 ? (currentUsage / targetUsage) * 100 : 0;
  const peakRate = peakLimit > 0 ? (currentUsage / peakLimit) * 100 : 0;
  const status = calculateEnergyStatus(currentUsage, targetUsage, peakLimit);

  // 24시간 트렌드 (시간당 평균 — power_active 필터)
  type TrendRow = { hour: number; avg_usage: number };
  const trendResult = hasPowerCategory
    ? await prisma.$queryRaw<TrendRow[]>`
        SELECT HOUR(m.time) as hour, AVG(m.value) as avg_usage
        FROM measurement m
        JOIN metric mt ON m.metric_id = mt.id
        WHERE m.tenant_id = ${tenantId}
          AND m.time > DATE_SUB(NOW(), INTERVAL 24 HOUR)
          AND mt.category = 'power_active'
        GROUP BY HOUR(m.time)
        ORDER BY HOUR(m.time)
      `
    : await prisma.$queryRaw<TrendRow[]>`
        SELECT HOUR(time) as hour, AVG(value) as avg_usage
        FROM measurement
        WHERE tenant_id = ${tenantId}
          AND time > DATE_SUB(NOW(), INTERVAL 24 HOUR)
        GROUP BY HOUR(time)
        ORDER BY HOUR(time)
      `;

  const trend = trendResult.map((row) => Number(row.avg_usage || 0));

  return {
    currentUsage, targetUsage, peakLimit, savings, savingsCost,
    usageRate, peakRate, trend, status, lastUpdate,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 설비 상태 데이터 조회
// ─────────────────────────────────────────────────────────────────────────────

async function getEquipmentData(tenantId: string): Promise<EquipmentData> {
  const statusAggregation = await prisma.device.groupBy({
    by: ['status'],
    where: { tenantId },
    _count: { id: true },
  });

  let normalCount = 0;
  let warningCount = 0;
  let dangerCount = 0;

  statusAggregation.forEach((item) => {
    const count = item._count.id;
    if (item.status === 'online') normalCount = count;
    else if (item.status === 'offline' || item.status === 'maintenance') warningCount += count;
    else if (item.status === 'error') dangerCount = count;
  });

  const totalCount = normalCount + warningCount + dangerCount;

  const abnormalDevicesRaw = await prisma.device.findMany({
    where: { tenantId, status: { not: 'online' } },
    select: {
      id: true, name: true, deviceType: true, status: true, updatedAt: true,
      site: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 5,
  });

  const abnormalDevices: AbnormalDevice[] = abnormalDevicesRaw.map((device) => ({
    id: device.id,
    deviceName: device.name,
    deviceType: device.deviceType,
    status: device.status === 'error' ? 'danger' : 'warning',
    message: device.status === 'error' ? '긴급 점검 필요' : '점검 권장',
    timestamp: device.updatedAt,
    siteId: device.site?.id || '',
    siteName: device.site?.name || '알 수 없음',
  }));

  const status = calculateEquipmentStatus(dangerCount, warningCount);

  return {
    normalCount, warningCount, dangerCount, totalCount,
    abnormalDevices, status, lastUpdate: new Date(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 탄소 배출 데이터 조회
// ─────────────────────────────────────────────────────────────────────────────

async function getCarbonData(
  tenantId: string,
  settings: TenantSettings,
  hasPowerCategory: boolean
): Promise<CarbonData> {
  const carbonFactor = settings?.energy?.carbonFactor || 0.4567;
  const targetReductionRate = settings?.energy?.targetReduction || 10;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // 오늘 전력 합계 → 탄소 배출량 (power_active 필터)
  type SumRow = { total: number | null; max_time: Date | null };
  const todayRows = hasPowerCategory
    ? await prisma.$queryRaw<SumRow[]>`
        SELECT SUM(m.value) as total, MAX(m.time) as max_time
        FROM measurement m
        JOIN metric mt ON m.metric_id = mt.id
        WHERE m.tenant_id = ${tenantId}
          AND m.time >= ${todayStart}
          AND mt.category = 'power_active'
      `
    : await prisma.$queryRaw<SumRow[]>`
        SELECT SUM(value) as total, MAX(time) as max_time
        FROM measurement
        WHERE tenant_id = ${tenantId} AND time >= ${todayStart}
      `;

  const todayUsageTotal = todayRows[0]?.total ? Number(todayRows[0].total) : 0;
  const currentEmissions = todayUsageTotal * carbonFactor;

  // 기준선: 지난 30일 일평균 전력 (power_active 필터)
  type AvgRow = { avg_val: number | null };
  const baselineRows = hasPowerCategory
    ? await prisma.$queryRaw<AvgRow[]>`
        SELECT AVG(m.value) as avg_val
        FROM measurement m
        JOIN metric mt ON m.metric_id = mt.id
        WHERE m.tenant_id = ${tenantId}
          AND m.time >= ${thirtyDaysAgo}
          AND m.time <= ${yesterday}
          AND mt.category = 'power_active'
      `
    : await prisma.$queryRaw<AvgRow[]>`
        SELECT AVG(value) as avg_val
        FROM measurement
        WHERE tenant_id = ${tenantId}
          AND time >= ${thirtyDaysAgo}
          AND time <= ${yesterday}
      `;

  const avgPower = baselineRows[0]?.avg_val ? Number(baselineRows[0].avg_val) : 0;
  const baselineEmissions = avgPower > 0 ? avgPower * 24 * carbonFactor : currentEmissions * 1.1;

  const actualReductionRate =
    baselineEmissions > 0
      ? ((baselineEmissions - currentEmissions) / baselineEmissions) * 100
      : 0;
  const savingsEmissions = Math.max(0, baselineEmissions - currentEmissions);
  const status = calculateCarbonStatus(actualReductionRate, targetReductionRate);

  // 24시간 트렌드 (power_active 필터)
  type CarbonTrendRow = { hour: number; hourly_usage: number };
  const carbonTrendResult = hasPowerCategory
    ? await prisma.$queryRaw<CarbonTrendRow[]>`
        SELECT HOUR(m.time) as hour, SUM(m.value) as hourly_usage
        FROM measurement m
        JOIN metric mt ON m.metric_id = mt.id
        WHERE m.tenant_id = ${tenantId}
          AND m.time > DATE_SUB(NOW(), INTERVAL 24 HOUR)
          AND mt.category = 'power_active'
        GROUP BY HOUR(m.time)
        ORDER BY HOUR(m.time)
      `
    : await prisma.$queryRaw<CarbonTrendRow[]>`
        SELECT HOUR(time) as hour, SUM(value) as hourly_usage
        FROM measurement
        WHERE tenant_id = ${tenantId}
          AND time > DATE_SUB(NOW(), INTERVAL 24 HOUR)
        GROUP BY HOUR(time)
        ORDER BY HOUR(time)
      `;

  const trend = carbonTrendResult.map((row) => Number(row.hourly_usage || 0) * carbonFactor);

  return {
    currentEmissions, baselineEmissions, targetReductionRate,
    actualReductionRate, savingsEmissions, trend, status,
    lastUpdate: todayRows[0]?.max_time || new Date(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 알람 데이터 조회
// ─────────────────────────────────────────────────────────────────────────────

async function getAlertsData(_tenantId: string): Promise<Alert[]> {
  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// 사이트별 상태 조회 — N+1 해소 (배치 쿼리)
//
// Before: 1(sites) + N×(1 usage + 1 tenant_settings + 1 device_groupby) = 1 + 3N
// After:  1(sites) + 1(usage_batch) + 1(device_counts_batch)            = 3 고정
// ─────────────────────────────────────────────────────────────────────────────

async function getSitesData(
  tenantId: string,
  settings: TenantSettings
): Promise<SiteStatus[]> {
  const sites = await prisma.site.findMany({
    where: { tenantId },
    select: { id: true, name: true },
  });

  if (sites.length === 0) return [];

  const peakLimit = settings?.energy?.peakLimit || 1000;
  const siteIds = sites.map((s) => s.id);
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

  // 배치 쿼리 1: 사이트별 최근 5분 평균 전력 (metric→device 직접 조인)
  type UsageRow = { site_id: string; current_usage: number | null };
  const usageRows = await prisma.$queryRaw<UsageRow[]>`
    SELECT d.site_id, AVG(m.value) as current_usage
    FROM measurement m
    JOIN metric mt ON m.metric_id = mt.id
    JOIN device d ON mt.device_id = d.id
    WHERE d.site_id IN (${Prisma.join(siteIds)})
      AND m.time > ${fiveMinAgo}
    GROUP BY d.site_id
  `;

  // 배치 쿼리 2: 사이트별 비정상 설비 상태 카운트
  type DeviceCountRow = { site_id: string; status: string; cnt: bigint };
  const deviceCountRows = await prisma.$queryRaw<DeviceCountRow[]>`
    SELECT site_id, status, COUNT(*) as cnt
    FROM device
    WHERE site_id IN (${Prisma.join(siteIds)})
      AND status != 'online'
      AND deleted_at IS NULL
    GROUP BY site_id, status
  `;

  // 맵 변환
  const usageMap = new Map(usageRows.map((r) => [r.site_id, Number(r.current_usage || 0)]));

  const warningMap = new Map<string, number>();
  const dangerMap = new Map<string, number>();
  for (const row of deviceCountRows) {
    const cnt = Number(row.cnt);
    if (row.status === 'error') {
      dangerMap.set(row.site_id, (dangerMap.get(row.site_id) ?? 0) + cnt);
    } else {
      warningMap.set(row.site_id, (warningMap.get(row.site_id) ?? 0) + cnt);
    }
  }

  return sites.map((site) => {
    const currentUsage = usageMap.get(site.id) ?? 0;
    const peakRate = peakLimit > 0 ? (currentUsage / peakLimit) * 100 : 0;
    const warningCount = warningMap.get(site.id) ?? 0;
    const dangerCount = dangerMap.get(site.id) ?? 0;

    let status: 'normal' | 'warning' | 'danger' = 'normal';
    let message: string | undefined;

    if (dangerCount > 0 || peakRate >= 95) {
      status = 'danger';
      message = dangerCount > 0 ? `${dangerCount}개 설비 위험` : '피크 전력 초과';
    } else if (warningCount > 0 || peakRate >= 80) {
      status = 'warning';
      message = warningCount > 0 ? `${warningCount}개 설비 경고` : '피크 전력 주의';
    }

    return {
      siteId: site.id, siteName: site.name, status,
      currentUsage, peakRate, warningCount, dangerCount,
      message, lastUpdate: new Date(),
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// AI 최적화 추천
// ─────────────────────────────────────────────────────────────────────────────

async function getRecommendationsData(
  _tenantId: string
): Promise<OptimizationRecommendation[]> {
  return [];
}
