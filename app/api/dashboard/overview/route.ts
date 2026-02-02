/**
 * GET /api/dashboard/overview
 * HMI 대시보드 전체 데이터 조회
 * 5초마다 갱신되는 실시간 데이터
 */

import { NextRequest, NextResponse } from 'next/server';
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

export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const context = await verifyAuth(request);
    if (!context) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { tenantId } = context;

    // 병렬로 모든 데이터 조회 (성능 최적화)
    const [energyData, equipmentData, carbonData, alertsData, sitesData, recommendationsData] =
      await Promise.all([
        getEnergyData(tenantId),
        getEquipmentData(tenantId),
        getCarbonData(tenantId),
        getAlertsData(tenantId),
        getSitesData(tenantId),
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

    return NextResponse.json(overview);
  } catch (error) {
    console.error('[Dashboard API] Error:', error);
    return NextResponse.json(
      { error: '대시보드 데이터 조회 실패' },
      { status: 500 }
    );
  }
}

/**
 * 에너지 데이터 조회
 */
async function getEnergyData(tenantId: string): Promise<EnergyData> {
  // 테넌트 확인
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) {
    throw new Error('테넌트를 찾을 수 없습니다');
  }

  // Mock values for energy targets
  const energyTarget = 1000;
  const peakDemandLimit = 500;

  // 현재 전력 사용량 (최근 5분 평균)
  const currentUsageResult = await prisma.$queryRaw<
    { current_usage: number | null; last_update: Date | null }[]
  >`
    SELECT
      AVG(active_power) as current_usage,
      MAX(timestamp) as last_update
    FROM measurements
    WHERE tenant_id = ${tenantId}
      AND timestamp > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
  `;

  const currentUsage = Number(currentUsageResult[0]?.current_usage || 0);
  const targetUsage = Number(energyTarget);
  const peakLimit = Number(peakDemandLimit);

  // 목표 대비 절감량 계산
  const savings = Math.max(0, targetUsage - currentUsage);
  const savingsCost = savings * 150; // kWh당 150원 가정

  // 사용률 계산
  const usageRate = (currentUsage / targetUsage) * 100;
  const peakRate = (currentUsage / peakLimit) * 100;

  // 상태 계산
  const status = calculateEnergyStatus(currentUsage, targetUsage, peakLimit);

  // 24시간 트렌드 데이터 (시간당 평균)
  const trendResult = await prisma.$queryRaw<{ hour: number; avg_usage: number }[]>`
    SELECT
      HOUR(timestamp) as hour,
      AVG(active_power) as avg_usage
    FROM measurements
    WHERE tenant_id = ${tenantId}
      AND timestamp > DATE_SUB(NOW(), INTERVAL 24 HOUR)
    GROUP BY HOUR(timestamp)
    ORDER BY HOUR(timestamp)
  `;

  const trend = trendResult.map((row) => Number(row.avg_usage || 0));

  return {
    currentUsage,
    targetUsage,
    peakLimit,
    savings,
    savingsCost,
    usageRate,
    peakRate,
    trend,
    status,
    lastUpdate: currentUsageResult[0]?.last_update || new Date(),
  };
}

/**
 * 설비 상태 데이터 조회
 */
async function getEquipmentData(tenantId: string): Promise<EquipmentData> {
  // 설비별 상태 집계
  const statusAggregation = await prisma.device.groupBy({
    by: ['status'],
    where: {
      tenantId,
    },
    _count: {
      id: true,
    },
  });

  let normalCount = 0;
  let warningCount = 0;
  let dangerCount = 0;

  statusAggregation.forEach((item) => {
    const count = item._count.id;
    if (item.status === 'online') {
      normalCount = count;
    } else if (item.status === 'offline' || item.status === 'maintenance') {
      warningCount += count;
    } else if (item.status === 'error') {
      dangerCount = count;
    }
  });

  const totalCount = normalCount + warningCount + dangerCount;

  // 이상 설비 목록 (최근 5개)
  const abnormalDevicesRaw = await prisma.device.findMany({
    where: {
      tenantId,
      status: {
        not: 'online',
      },
    },
    select: {
      id: true,
      name: true,
      status: true,
      updatedAt: true,
      site: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
    take: 5,
  });

  const abnormalDevices: AbnormalDevice[] = abnormalDevicesRaw.map((device) => {
    // Map DeviceStatus to display status
    const displayStatus: 'normal' | 'warning' | 'danger' =
      device.status === 'error' ? 'danger' : 'warning';

    return {
      id: device.id,
      deviceName: device.name,
      deviceType: '설비', // Mock value - type field doesn't exist in Device model
      status: displayStatus,
      message: device.status === 'error' ? '긴급 점검 필요' : '점검 권장',
      timestamp: device.updatedAt,
      siteId: device.site?.id || '',
      siteName: device.site?.name || '알 수 없음',
    };
  });

  const status = calculateEquipmentStatus(dangerCount, warningCount);

  return {
    normalCount,
    warningCount,
    dangerCount,
    totalCount,
    abnormalDevices,
    status,
    lastUpdate: new Date(),
  };
}

/**
 * 탄소 배출 데이터 조회
 */
async function getCarbonData(tenantId: string): Promise<CarbonData> {
  // 테넌트 확인
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) {
    throw new Error('테넌트를 찾을 수 없습니다');
  }

  // Mock value for carbon reduction target
  const targetReductionRate = 10;

  // 당일 누적 배출량
  const todayEmissionsResult = await prisma.$queryRaw<
    { total_emissions: number | null; last_update: Date | null }[]
  >`
    SELECT
      SUM(co2_emissions) as total_emissions,
      MAX(timestamp) as last_update
    FROM emissions_data
    WHERE tenant_id = ${tenantId}
      AND DATE(timestamp) = CURDATE()
  `;

  const currentEmissions = Number(todayEmissionsResult[0]?.total_emissions || 0);

  // 기준선 배출량 (전월 같은 요일 평균)
  const baselineEmissionsResult = await prisma.$queryRaw<{ baseline: number | null }[]>`
    SELECT
      AVG(daily_emissions) as baseline
    FROM (
      SELECT
        DATE(timestamp) as date,
        SUM(co2_emissions) as daily_emissions
      FROM emissions_data
      WHERE tenant_id = ${tenantId}
        AND timestamp BETWEEN DATE_SUB(NOW(), INTERVAL 30 DAY) AND DATE_SUB(NOW(), INTERVAL 1 DAY)
        AND DAYOFWEEK(timestamp) = DAYOFWEEK(NOW())
      GROUP BY DATE(timestamp)
    ) as daily_data
  `;

  const baselineEmissions = Number(baselineEmissionsResult[0]?.baseline || 10000);

  // 실제 감축률 계산
  const actualReductionRate =
    ((baselineEmissions - currentEmissions) / baselineEmissions) * 100;

  const savingsEmissions = baselineEmissions - currentEmissions;

  // 상태 계산
  const status = calculateCarbonStatus(actualReductionRate, targetReductionRate);

  // 24시간 트렌드 데이터
  const trendResult = await prisma.$queryRaw<{ hour: number; hourly_emissions: number }[]>`
    SELECT
      HOUR(timestamp) as hour,
      SUM(co2_emissions) as hourly_emissions
    FROM emissions_data
    WHERE tenant_id = ${tenantId}
      AND timestamp > DATE_SUB(NOW(), INTERVAL 24 HOUR)
    GROUP BY HOUR(timestamp)
    ORDER BY HOUR(timestamp)
  `;

  const trend = trendResult.map((row) => Number(row.hourly_emissions || 0));

  return {
    currentEmissions,
    baselineEmissions,
    targetReductionRate,
    actualReductionRate,
    savingsEmissions,
    trend,
    status,
    lastUpdate: todayEmissionsResult[0]?.last_update || new Date(),
  };
}

/**
 * 알람 데이터 조회
 */
async function getAlertsData(_tenantId: string): Promise<Alert[]> {
  // Note: Alert model doesn't exist in Prisma schema
  // Return empty array for now - alerts functionality needs to be implemented
  return [];
}

/**
 * 사이트별 상태 조회
 */
async function getSitesData(tenantId: string): Promise<SiteStatus[]> {
  const sites = await prisma.site.findMany({
    where: {
      tenantId,
    },
    select: {
      id: true,
      name: true,
    },
  });

  const sitesData: SiteStatus[] = await Promise.all(
    sites.map(async (site) => {
      // 현재 사용량
      const usageResult = await prisma.$queryRaw<{ current_usage: number | null }[]>`
        SELECT AVG(active_power) as current_usage
        FROM measurements
        WHERE site_id = ${site.id}
          AND timestamp > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
      `;

      const currentUsage = Number(usageResult[0]?.current_usage || 0);
      const peakLimit = 1000; // Mock value - peakDemandLimit field doesn't exist
      const peakRate = (currentUsage / peakLimit) * 100;

      // 경고/위험 설비 개수
      const deviceCounts = await prisma.device.groupBy({
        by: ['status'],
        where: {
          siteId: site.id,
          status: {
            not: 'online',
          },
        },
        _count: {
          id: true,
        },
      });

      let warningCount = 0;
      let dangerCount = 0;

      deviceCounts.forEach((item) => {
        if (item.status === 'offline' || item.status === 'maintenance') {
          warningCount += item._count.id;
        } else if (item.status === 'error') {
          dangerCount += item._count.id;
        }
      });

      // 상태 계산
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
        siteId: site.id,
        siteName: site.name,
        status,
        currentUsage,
        peakRate,
        warningCount,
        dangerCount,
        message,
        lastUpdate: new Date(),
      };
    })
  );

  return sitesData;
}

/**
 * AI 최적화 추천 조회
 */
async function getRecommendationsData(
  _tenantId: string
): Promise<OptimizationRecommendation[]> {
  // Note: ForecastResult model has predictions as JSON field
  // Would need to parse the JSON structure to extract recommendations
  // Return empty array for now - recommendations functionality needs proper implementation
  return [];
}
