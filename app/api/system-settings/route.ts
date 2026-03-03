/**
 * /api/system-settings - 시스템 설정 API
 *
 * GET: 시스템 설정 조회 (viewer 이상)
 * PUT: 시스템 설정 변경 (tenant_admin 이상)
 *
 * 설정 저장 구조:
 * - organization.*  → tenant.name, tenant.industryType (DB 컬럼 직접 저장)
 * - 나머지 섹션     → tenant.settings JSON 필드에 저장
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { verifyAuth, requireRoleOrHigher } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import { UserRole } from '@/lib/constants/roles';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  validationErrorResponse,
  serverErrorResponse,
  formatZodErrors,
} from '@/lib/api/response';

// ─── 스키마 ──────────────────────────────────────────────────────

const systemSettingsSchema = z.object({
  // 조직 정보 (tenant 컬럼 직접 저장)
  organization: z.object({
    name:         z.string().min(1).max(200),
    industryType: z.enum(['manufacturing', 'building', 'industrial_complex', 'datacenter', 'other']),
    timezone:     z.string().max(50).default('Asia/Seoul'),
    website:      z.string().url().max(255).optional().or(z.literal('')),
  }).optional(),

  // 일반 설정
  general: z.object({
    language:     z.enum(['ko', 'en']).default('ko'),
    dateFormat:   z.enum(['YYYY-MM-DD', 'MM/DD/YYYY', 'DD.MM.YYYY']).default('YYYY-MM-DD'),
    numberFormat: z.enum(['1,000.00', '1.000,00']).default('1,000.00'),
  }).optional(),

  // 에너지 설정 (dashboard, carbon 계산에 실시간 반영)
  energy: z.object({
    electricityRate:  z.number().min(0).default(120),
    peakRate:         z.number().min(0).default(180),
    offPeakRate:      z.number().min(0).default(80),
    carbonFactor:     z.number().min(0).default(0.4567),
    targetReduction:  z.number().min(0).max(100).default(10),
    currency:         z.string().default('KRW'),
  }).optional(),

  // 알림 임계값 설정
  alerts: z.object({
    powerThresholdWarning:  z.number().min(0).max(100).default(80),
    powerThresholdCritical: z.number().min(0).max(100).default(95),
    emailNotifications:     z.boolean().default(true),
    kakaoNotifications:     z.boolean().default(false),
    refreshInterval:        z.number().min(5).max(300).default(30),
  }).optional(),

  // 대시보드 설정
  dashboard: z.object({
    defaultView:      z.enum(['overview', 'realtime', 'analytics']).default('overview'),
    chartType:        z.enum(['area', 'bar', 'line']).default('area'),
    showCarbonWidget: z.boolean().default(true),
    showCostWidget:   z.boolean().default(true),
    showDeviceStatus: z.boolean().default(true),
  }).optional(),

  // 데이터 수집 설정
  dataCollection: z.object({
    defaultInterval:      z.number().min(1).max(3600).default(60),
    retentionDays:        z.number().min(30).max(3650).default(365),
    aggregationEnabled:   z.boolean().default(true),
    aggregationInterval:  z.enum(['1m', '5m', '15m', '1h']).default('15m'),
  }).optional(),

  // 로그 보관 정책
  logPolicy: z.object({
    auditLogRetentionDays:  z.number().int().min(30).max(3650).default(365),
    accessLogRetentionDays: z.number().int().min(7).max(365).default(90),
    compressionEnabled:     z.boolean().default(true),
    compressionAfterDays:   z.number().int().min(7).max(365).default(30),
    autoDeleteEnabled:      z.boolean().default(true),
    archiveEnabled:         z.boolean().default(false),
    archiveStoragePath:     z.string().max(255).optional(),
  }).optional(),

  // 백업 설정
  backup: z.object({
    enabled:            z.boolean().default(false),
    schedule:           z.enum(['daily', 'weekly', 'monthly', 'manual']).default('weekly'),
    retentionCount:     z.number().int().min(1).max(30).default(7),
    includeAttachments: z.boolean().default(false),
    notifyEmail:        z.string().email().optional().or(z.literal('')),
    storageType:        z.enum(['local', 's3', 'gcs']).default('local'),
    storagePath:        z.string().max(255).optional(),
  }).optional(),
});

type SystemSettings = z.infer<typeof systemSettingsSchema>;

// ─── 기본값 ──────────────────────────────────────────────────────

const DEFAULT_SETTINGS: Omit<SystemSettings, 'organization'> = {
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

const INDUSTRY_LABELS: Record<string, string> = {
  manufacturing:     '제조업',
  building:          '빌딩/건물',
  industrial_complex:'산업단지',
  datacenter:        '데이터센터',
  other:             '기타',
};

// ─── GET ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const tenant = await prisma.tenant.findUnique({
      where:  { id: auth.tenantId },
      select: { name: true, industryType: true, settings: true },
    });

    const stored  = (tenant?.settings as Record<string, unknown>) || {};
    const merged  = deepMerge(DEFAULT_SETTINGS as Record<string, unknown>, stored);
    const isAdmin = requireRoleOrHigher(auth, 'tenant_admin' as UserRole);

    // 조직 정보를 settings 구조에 포함해서 반환
    const organization = {
      name:         tenant?.name ?? '',
      industryType: tenant?.industryType ?? 'other',
      industryLabel: INDUSTRY_LABELS[tenant?.industryType ?? 'other'] ?? '기타',
      timezone:     (stored as Record<string, Record<string, string>>).organization?.timezone ?? 'Asia/Seoul',
      website:      (stored as Record<string, Record<string, string>>).organization?.website ?? '',
    };

    return successResponse({ settings: { ...merged, organization }, isAdmin });
  } catch (error) {
    console.error('[API] 시스템 설정 조회 오류:', error);
    return serverErrorResponse();
  }
}

// ─── PUT ─────────────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!requireRoleOrHigher(auth, 'tenant_admin' as UserRole)) {
      return forbiddenResponse();
    }

    const body   = await request.json();
    const parsed = systemSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse({ fields: formatZodErrors(parsed.error) });
    }

    const { organization, ...settingsData } = parsed.data;

    // 기존 설정 가져와 병합
    const tenant = await prisma.tenant.findUnique({
      where:  { id: auth.tenantId },
      select: { name: true, settings: true },
    });
    const currentSettings = (tenant?.settings as Record<string, unknown>) || {};
    const merged = deepMerge(currentSettings, settingsData as Record<string, unknown>);

    // 조직 정보 → tenant 컬럼 + settings.organization 병합 저장
    if (organization) {
      const orgForSettings = {
        timezone: organization.timezone,
        website:  organization.website ?? '',
      };
      const mergedWithOrg = deepMerge(merged, { organization: orgForSettings } as Record<string, unknown>);

      await prisma.tenant.update({
        where: { id: auth.tenantId },
        data: {
          name:         organization.name,
          industryType: organization.industryType as never,
          settings:     mergedWithOrg as unknown as Prisma.InputJsonValue,
        },
      });

      return successResponse({ settings: mergedWithOrg, updated: true });
    }

    // 조직 정보 제외 — settings만 저장
    await prisma.tenant.update({
      where: { id: auth.tenantId },
      data:  { settings: merged as unknown as Prisma.InputJsonValue },
    });

    return successResponse({ settings: merged, updated: true });
  } catch (error) {
    console.error('[API] 시스템 설정 변경 오류:', error);
    return serverErrorResponse();
  }
}

// ─── 유틸 ────────────────────────────────────────────────────────

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...target };
  for (const key in source) {
    if (
      source[key] !== null &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] !== null &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(
        target[key] as Record<string, unknown>,
        source[key] as Record<string, unknown>,
      );
    } else if (source[key] !== undefined) {
      result[key] = source[key];
    }
  }
  return result;
}
