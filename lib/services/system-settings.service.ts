/**
 * lib/services/system-settings.service.ts
 *
 * 시스템 설정 캐시 서비스
 *
 * - tenant.settings JSON 필드를 Redis에 60초 캐싱 (DB 반복 조회 방지)
 * - PUT /api/system-settings 저장 시 invalidateSettingsCache() 호출 필수
 * - 전체 시스템에서 이 서비스를 통해 설정을 읽어야 즉시 반영 보장
 *
 * 사용:
 *   const s = await getSystemSettings(tenantId);
 *   const factor = s.energy.carbonFactor;  // 테넌트별 탄소 계수
 */

import { prisma } from '@/lib/db/prisma';
import { getCached, invalidateCache } from '@/lib/cache/redis';

// ─── 타입 ─────────────────────────────────────────────────────────

export interface TenantSystemSettings {
  organization: {
    name: string;
    industryType: string;
    timezone: string;
    website: string;
  };
  general: {
    language: 'ko' | 'en';
    dateFormat: 'YYYY-MM-DD' | 'MM/DD/YYYY' | 'DD.MM.YYYY';
    numberFormat: '1,000.00' | '1.000,00';
  };
  energy: {
    electricityRate: number;
    peakRate: number;
    offPeakRate: number;
    carbonFactor: number;
    targetReduction: number;
    currency: string;
  };
  alerts: {
    powerThresholdWarning: number;
    powerThresholdCritical: number;
    emailNotifications: boolean;
    kakaoNotifications: boolean;
    refreshInterval: number;
  };
  dashboard: {
    defaultView: 'overview' | 'realtime' | 'analytics';
    chartType: 'area' | 'bar' | 'line';
    showCarbonWidget: boolean;
    showCostWidget: boolean;
    showDeviceStatus: boolean;
  };
  dataCollection: {
    defaultInterval: number;
    retentionDays: number;
    aggregationEnabled: boolean;
    aggregationInterval: '1m' | '5m' | '15m' | '1h';
  };
  logPolicy: {
    auditLogRetentionDays: number;
    accessLogRetentionDays: number;
    compressionEnabled: boolean;
    compressionAfterDays: number;
    autoDeleteEnabled: boolean;
    archiveEnabled: boolean;
    archiveStoragePath?: string;
  };
  backup: {
    enabled: boolean;
    schedule: 'daily' | 'weekly' | 'monthly' | 'manual';
    retentionCount: number;
    includeAttachments: boolean;
    notifyEmail: string;
    storageType: 'local' | 's3' | 'gcs';
    storagePath?: string;
  };
}

// ─── 기본값 ──────────────────────────────────────────────────────

const DEFAULTS: TenantSystemSettings = {
  organization: {
    name: '',
    industryType: 'other',
    timezone: 'Asia/Seoul',
    website: '',
  },
  general: {
    language: 'ko',
    dateFormat: 'YYYY-MM-DD',
    numberFormat: '1,000.00',
  },
  energy: {
    electricityRate: 120,
    peakRate: 180,
    offPeakRate: 80,
    carbonFactor: 0.4567,
    targetReduction: 10,
    currency: 'KRW',
  },
  alerts: {
    powerThresholdWarning: 80,
    powerThresholdCritical: 95,
    emailNotifications: true,
    kakaoNotifications: false,
    refreshInterval: 30,
  },
  dashboard: {
    defaultView: 'overview',
    chartType: 'area',
    showCarbonWidget: true,
    showCostWidget: true,
    showDeviceStatus: true,
  },
  dataCollection: {
    defaultInterval: 60,
    retentionDays: 365,
    aggregationEnabled: true,
    aggregationInterval: '15m',
  },
  logPolicy: {
    auditLogRetentionDays: 365,
    accessLogRetentionDays: 90,
    compressionEnabled: true,
    compressionAfterDays: 30,
    autoDeleteEnabled: true,
    archiveEnabled: false,
  },
  backup: {
    enabled: false,
    schedule: 'weekly',
    retentionCount: 7,
    includeAttachments: false,
    notifyEmail: '',
    storageType: 'local',
  },
};

// ─── 캐시 설정 ────────────────────────────────────────────────────

const SETTINGS_TTL = 60; // 60초

function cacheKey(tenantId: string) {
  return `sys:settings:${tenantId}`;
}

// ─── 깊은 병합 ────────────────────────────────────────────────────

function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Record<string, unknown>,
): T {
  const result = { ...target } as Record<string, unknown>;
  for (const key in source) {
    const sv = source[key];
    const tv = target[key];
    if (
      sv !== null &&
      typeof sv === 'object' &&
      !Array.isArray(sv) &&
      tv !== null &&
      typeof tv === 'object' &&
      !Array.isArray(tv)
    ) {
      result[key] = deepMerge(
        tv as Record<string, unknown>,
        sv as Record<string, unknown>,
      );
    } else if (sv !== undefined) {
      result[key] = sv;
    }
  }
  return result as T;
}

// ─── 공개 API ────────────────────────────────────────────────────

/**
 * 테넌트 시스템 설정 조회 (Redis 캐시 60초).
 *
 * 이 함수를 통해 설정을 읽으면 PUT /api/system-settings 저장 후
 * invalidateSettingsCache() 호출 시 즉시 반영됩니다.
 */
export async function getSystemSettings(
  tenantId: string,
): Promise<TenantSystemSettings> {
  return getCached(
    cacheKey(tenantId),
    SETTINGS_TTL,
    async () => {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true, industryType: true, settings: true },
      });

      if (!tenant) return { ...DEFAULTS };

      const stored = (tenant.settings as Record<string, unknown>) || {};
      const merged = deepMerge(DEFAULTS as unknown as Record<string, unknown>, stored);

      // organization.name / industryType는 DB 컬럼에서 병합
      (merged.organization as Record<string, unknown>).name = tenant.name ?? DEFAULTS.organization.name;
      (merged.organization as Record<string, unknown>).industryType = tenant.industryType ?? DEFAULTS.organization.industryType;

      return merged as unknown as TenantSystemSettings;
    },
  );
}

/**
 * 시스템 설정 캐시 무효화.
 * PUT /api/system-settings 저장 성공 직후 반드시 호출.
 */
export async function invalidateSettingsCache(tenantId: string): Promise<void> {
  await invalidateCache(cacheKey(tenantId));
}

/**
 * 에너지 설정만 빠르게 조회 (대시보드, 탄소 계산용).
 */
export async function getEnergySettings(tenantId: string) {
  const s = await getSystemSettings(tenantId);
  return s.energy;
}

/**
 * 알림 임계값 조회 (알림 체크 크론용).
 */
export async function getAlertThresholds(tenantId: string) {
  const s = await getSystemSettings(tenantId);
  return s.alerts;
}

/**
 * 로그 보관 정책 조회 (cleanup-logs 크론용).
 */
export async function getLogPolicy(tenantId: string) {
  const s = await getSystemSettings(tenantId);
  return s.logPolicy;
}

/**
 * 데이터 수집 설정 조회 (신규 센서 등록 기본값용).
 */
export async function getDataCollectionSettings(tenantId: string) {
  const s = await getSystemSettings(tenantId);
  return s.dataCollection;
}
