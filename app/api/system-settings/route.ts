/**
 * /api/system-settings - 시스템 설정 API
 *
 * GET: 시스템 설정 조회 (viewer 이상)
 * PUT: 시스템 설정 변경 (tenant_admin 이상)
 *
 * 설정은 tenant.settings JSON 필드에 저장
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

// 시스템 설정 스키마
const systemSettingsSchema = z.object({
  // 일반 설정
  general: z.object({
    language: z.enum(['ko', 'en']).default('ko'),
    dateFormat: z.enum(['YYYY-MM-DD', 'MM/DD/YYYY', 'DD.MM.YYYY']).default('YYYY-MM-DD'),
    numberFormat: z.enum(['1,000.00', '1.000,00']).default('1,000.00'),
  }).optional(),

  // 에너지 설정
  energy: z.object({
    electricityRate: z.number().min(0).default(120),
    peakRate: z.number().min(0).default(180),
    offPeakRate: z.number().min(0).default(80),
    carbonFactor: z.number().min(0).default(0.4567),
    targetReduction: z.number().min(0).max(100).default(10),
    currency: z.string().default('KRW'),
  }).optional(),

  // 알림 설정
  alerts: z.object({
    powerThresholdWarning: z.number().min(0).default(80),
    powerThresholdCritical: z.number().min(0).default(95),
    emailNotifications: z.boolean().default(true),
    smsNotifications: z.boolean().default(false),
    refreshInterval: z.number().min(5).max(300).default(30),
  }).optional(),

  // 대시보드 설정
  dashboard: z.object({
    defaultView: z.enum(['overview', 'realtime', 'analytics']).default('overview'),
    chartType: z.enum(['area', 'bar', 'line']).default('area'),
    showCarbonWidget: z.boolean().default(true),
    showCostWidget: z.boolean().default(true),
    showDeviceStatus: z.boolean().default(true),
  }).optional(),

  // 데이터 수집 설정
  dataCollection: z.object({
    defaultInterval: z.number().min(1).max(3600).default(60),
    retentionDays: z.number().min(30).max(3650).default(365),
    aggregationEnabled: z.boolean().default(true),
    aggregationInterval: z.enum(['1m', '5m', '15m', '1h']).default('15m'),
  }).optional(),
});

type SystemSettings = z.infer<typeof systemSettingsSchema>;

// 기본 시스템 설정
const DEFAULT_SETTINGS: SystemSettings = {
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
    smsNotifications: false,
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
};

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const tenant = await prisma.tenant.findUnique({
      where: { id: auth.tenantId },
      select: { settings: true },
    });

    const currentSettings = (tenant?.settings as Record<string, unknown>) || {};
    const merged = deepMerge(DEFAULT_SETTINGS, currentSettings);

    return successResponse({
      settings: merged,
      isAdmin: requireRoleOrHigher(auth, 'tenant_admin' as UserRole),
    });
  } catch (error) {
    console.error('[API] 시스템 설정 조회 오류:', error);
    return serverErrorResponse();
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!requireRoleOrHigher(auth, 'tenant_admin' as UserRole)) {
      return forbiddenResponse();
    }

    const body = await request.json();
    const parsed = systemSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse({ fields: formatZodErrors(parsed.error) });
    }

    // 기존 설정 가져오기
    const tenant = await prisma.tenant.findUnique({
      where: { id: auth.tenantId },
      select: { settings: true },
    });

    const currentSettings = (tenant?.settings as Record<string, unknown>) || {};
    const merged = deepMerge(currentSettings, parsed.data);

    await prisma.tenant.update({
      where: { id: auth.tenantId },
      data: { settings: merged as unknown as Prisma.InputJsonValue },
    });

    return successResponse({ settings: merged, updated: true });
  } catch (error) {
    console.error('[API] 시스템 설정 변경 오류:', error);
    return serverErrorResponse();
  }
}

// 깊은 병합 유틸리티
function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key in source) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(
        target[key] as Record<string, unknown>,
        source[key] as Record<string, unknown>
      );
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
