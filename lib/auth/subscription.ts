/**
 * lib/auth/subscription.ts — 구독/라이센스 기반 기능 접근 제어
 *
 * 모든 기능은 업체(테넌트) 단위로 구독/라이센스 적용.
 * 체험(demo) 기간 또는 FREE 플랜은 기본 기능만 허용.
 *
 * 사용 예:
 *   const sub = await getActiveSub(auth.tenantId);
 *   if (!sub) return featureLockedResponse('SUBSCRIPTION_REQUIRED');
 *   if (!hasFeature(sub, 'ai_forecast')) return featureLockedResponse('FEATURE_NOT_IN_PLAN');
 */

import { prisma } from '@/lib/db/prisma';
import { NextResponse } from 'next/server';
import { getCached } from '@/lib/cache/redis';

// ──────────────────────────────────────────────────────────────
// 플랜 기능 정의
// ──────────────────────────────────────────────────────────────

/** 구독 플랜 계층 (코드레벨 표현) */
export const PLAN_TIERS = ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

/**
 * DB PlanTier enum(trial/basic/pro/enterprise) → 코드레벨 PlanTier 매핑.
 * Prisma 스키마와 feature 매핑을 분리하여 DB 컬럼명 변경 없이 운용 가능.
 */
const TIER_MAP: Record<string, PlanTier> = {
  trial: 'FREE',
  basic: 'STARTER',
  pro: 'PROFESSIONAL',
  enterprise: 'ENTERPRISE',
  FREE: 'FREE',
  STARTER: 'STARTER',
  PROFESSIONAL: 'PROFESSIONAL',
  ENTERPRISE: 'ENTERPRISE',
};

/**
 * 플랜별 정량 한도 (수량 제한).
 * null = 무제한
 */
export interface PlanLimits {
  maxSites: number | null;          // 최대 사업장(Site) 수
  maxSensors: number | null;        // 최대 센서 수
  maxGateways: number | null;       // 최대 게이트웨이 수
  maxApiKeysPerTenant: number;      // 최대 API 키 수
  complianceReport: boolean;        // K-MRV 규제 리포트 PDF
  aiFeatures: boolean;              // AI 예측/이상탐지/최적화
  digitalTwin: boolean;             // 디지털 트윈
  carbonTrading: boolean;           // 배출권 거래소
  dataRetentionDays: number;        // 원시 데이터 보관 기간 (일)
  alertRules: number | null;        // 최대 알림 규칙 수
}

/**
 * 플랜별 정량 한도 상수 (기본값/폴백).
 * 수량 한도(maxSites, maxSensors)는 DB plan 테이블이 단일 진실원이므로
 * getActiveSub()에서 DB 값으로 덮어씀.
 * 이 상수는 DB 조회 실패 폴백, 기능 플래그, maxGateways 등 DB에 없는 필드에 사용.
 */
export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  FREE: {
    maxSites:            1,     // DB trial.max_sites = 1
    maxSensors:          10,    // DB trial.max_devices = 10
    maxGateways:         1,
    maxApiKeysPerTenant: 2,
    complianceReport:    false,
    aiFeatures:          false,
    digitalTwin:         false,
    carbonTrading:       false,
    dataRetentionDays:   30,
    alertRules:          3,
  },
  STARTER: {
    maxSites:            3,     // DB basic.max_sites = 3 (기존 5 → 수정)
    maxSensors:          50,    // DB basic.max_devices = 50
    maxGateways:         5,
    maxApiKeysPerTenant: 5,
    complianceReport:    false,
    aiFeatures:          false,
    digitalTwin:         false,
    carbonTrading:       false,
    dataRetentionDays:   90,
    alertRules:          20,
  },
  PROFESSIONAL: {
    maxSites:            10,    // DB pro.max_sites = 10 (기존 20 → 수정)
    maxSensors:          200,   // DB pro.max_devices = 200
    maxGateways:         20,
    maxApiKeysPerTenant: 20,
    complianceReport:    true,
    aiFeatures:          true,
    digitalTwin:         true,
    carbonTrading:       true,
    dataRetentionDays:   365,
    alertRules:          100,
  },
  ENTERPRISE: {
    maxSites:            null,
    maxSensors:          null,
    maxGateways:         null,
    maxApiKeysPerTenant: 100,
    complianceReport:    true,
    aiFeatures:          true,
    digitalTwin:         true,
    carbonTrading:       true,
    dataRetentionDays:   1095, // 3년
    alertRules:          null,
  },
};

/**
 * 플랜별 허용 기능 매핑.
 * 기능 추가 시 여기에만 선언하면 됨.
 */
export const PLAN_FEATURES: Record<PlanTier, string[]> = {
  FREE: [
    'dashboard',
    'monitoring_basic',
    'realtime_chart',
  ],
  STARTER: [
    'dashboard',
    'monitoring_basic',
    'monitoring_advanced',
    'realtime_chart',
    'analytics_basic',
    'analytics_cost',
    'reports_basic',
    'alerts',
    'gateways',
    'devices',
    // Basic tier gets AI load forecasting and cost optimization but not anomaly detection
    'ai_forecast',
    'ai_optimize',
  ],
  PROFESSIONAL: [
    'dashboard',
    'monitoring_basic',
    'monitoring_advanced',
    'realtime_chart',
    'analytics_basic',
    'analytics_advanced',
    'analytics_cost',
    'analytics_carbon',
    'analytics_carbon_trading',
    'analytics_simulator',
    'reports_basic',
    'reports_advanced',
    'alerts',
    'ai_anomaly',
    'ai_forecast',
    'ai_optimize',
    'digital_twin',
    'gateways',
    'devices',
    'api_keys',
  ],
  ENTERPRISE: [
    // 모든 기능 허용
    '*',
  ],
};

// ──────────────────────────────────────────────────────────────
// 타입
// ──────────────────────────────────────────────────────────────

export interface ActiveSubscription {
  id: string;
  status: string;
  planId: string;
  planName: string;
  planTier: string;
  apiRateLimit: number;
  expiresAt: Date | null;
  features: Record<string, unknown>;
  isDemo: boolean;
  isTrial: boolean;
  // 정량 한도 (PLAN_LIMITS에서 파생)
  limits: PlanLimits;
}

// ──────────────────────────────────────────────────────────────
// 구독 조회 (캐시 30초)
// ──────────────────────────────────────────────────────────────

export async function getActiveSub(tenantId: string): Promise<ActiveSubscription | null> {
  return getCached(
    `sub:${tenantId}`,
    30, // 30초 캐시 (빠른 갱신)
    async () => {
      const sub = await prisma.subscription.findFirst({
        where: {
          tenantId,
          status: { in: ['ACTIVE', 'EXPIRE_SOON'] },
        },
        orderBy: { startDate: 'desc' },
        select: {
          id: true,
          status: true,
          planId: true,
          endDate: true,
          plan: {
            select: {
              name: true,
              tier: true,
              apiRateLimit: true,
              features: true,
              maxSites: true,          // DB 직접 조회 (단일 진실원)
              maxDevices: true,        // DB 직접 조회 (센서/디바이스 합산 한도)
              dataRetentionDays: true, // DB 직접 조회
            },
          },
        },
      });

      if (!sub) return null;

      // DB 티어(trial/basic/pro/enterprise) → 코드레벨 PlanTier 변환
      const rawTier = (sub.plan.tier as string).toLowerCase();
      const tierStr = TIER_MAP[rawTier] ?? TIER_MAP[(sub.plan.tier as string).toUpperCase()] ?? 'FREE';

      const tier = tierStr as PlanTier;

      // feature flags / maxGateways 등 DB에 없는 필드는 코드 상수 사용
      const baseLimits = PLAN_LIMITS[tier] ?? PLAN_LIMITS.FREE;

      // DB 수량 한도가 있으면 DB 우선 (DB가 단일 진실원)
      const limits: PlanLimits = {
        ...baseLimits,
        maxSites:          sub.plan.maxSites   ?? baseLimits.maxSites,
        maxSensors:        sub.plan.maxDevices ?? baseLimits.maxSensors,
        dataRetentionDays: sub.plan.dataRetentionDays,
      };

      return {
        id: sub.id,
        status: sub.status,
        planId: sub.planId,
        planName: sub.plan.name,
        planTier: tierStr,
        apiRateLimit: sub.plan.apiRateLimit,
        expiresAt: sub.endDate ?? null,
        features: (sub.plan.features as Record<string, unknown>) ?? {},
        isDemo: tierStr === 'FREE',
        isTrial: sub.status === 'EXPIRE_SOON',
        limits,
      };
    }
  );
}

// ──────────────────────────────────────────────────────────────
// 기능 접근 확인
// ──────────────────────────────────────────────────────────────

/**
 * 구독 플랜에서 특정 기능이 허용되는지 확인.
 * ENTERPRISE는 모든 기능 허용.
 */
export function hasFeature(sub: ActiveSubscription, feature: string): boolean {
  const tier = sub.planTier.toUpperCase() as PlanTier;
  const allowed = PLAN_FEATURES[tier] ?? PLAN_FEATURES.FREE;
  if (allowed.includes('*')) return true;
  return allowed.includes(feature);
}

/**
 * 테넌트의 Rate Limit (requests/day) 조회.
 * 구독 없으면 기본 100.
 */
export async function getTenantRateLimit(tenantId: string): Promise<number> {
  const sub = await getActiveSub(tenantId);
  return sub?.apiRateLimit ?? 100;
}

// ──────────────────────────────────────────────────────────────
// API 응답 헬퍼
// ──────────────────────────────────────────────────────────────

/**
 * 구독 없음 / 기능 미포함 시 반환 응답.
 */
export function featureLockedResponse(reason: 'SUBSCRIPTION_REQUIRED' | 'FEATURE_NOT_IN_PLAN' | 'SUBSCRIPTION_EXPIRED') {
  const messages: Record<string, string> = {
    SUBSCRIPTION_REQUIRED:
      '이 기능은 구독 후 이용하실 수 있습니다. /settings/subscription 에서 플랜을 선택하세요.',
    FEATURE_NOT_IN_PLAN:
      '현재 플랜에서 지원하지 않는 기능입니다. 상위 플랜으로 업그레이드하면 사용하실 수 있습니다.',
    SUBSCRIPTION_EXPIRED:
      '구독이 만료되었습니다. /settings/subscription 에서 갱신해주세요.',
  };

  // 로그: 어떤 이유로 차단되었는지 기록
  console.warn(`[Subscription] feature locked: ${reason}`);
  return NextResponse.json(
    {
      success: false,
      code: reason,
      error: messages[reason],
      upgradeUrl: '/settings/subscription',
    },
    { status: 402 } // Payment Required
  );
}

// ──────────────────────────────────────────────────────────────
// 통합 가드 함수 (API 라우트에서 사용)
// ──────────────────────────────────────────────────────────────

/**
 * 활성 구독 필요. 없으면 402 응답 반환.
 * ```ts
 * const [sub, err] = await requireSub(auth.tenantId);
 * if (err) return err;
 * ```
 */
export async function requireSub(
  tenantId: string
): Promise<[ActiveSubscription, null] | [null, NextResponse]> {
  const sub = await getActiveSub(tenantId);
  if (!sub) {
    // 개발 환경에서 기능 체크 우회 설정이 켜져 있으면 가짜 서브 리턴
    if (process.env.NODE_ENV !== 'production' && process.env.DEV_BYPASS_FEATURES) {
      console.debug('[Subscription] dev bypass no subscription, returning fake active sub');
      return [
        {
          id: 'dev-sub',
          status: 'ACTIVE',
          planId: 'dev',
          planName: 'Developer',
          planTier: 'PROFESSIONAL',
          apiRateLimit: 9999,
          expiresAt: null,
          features: {},
          isDemo: true,
          isTrial: false,
          limits: PLAN_LIMITS.PROFESSIONAL,
        },
        null,
      ];
    }

    return [null, featureLockedResponse('SUBSCRIPTION_REQUIRED')];
  }
  return [sub, null];
}

/**
 * 구독 + 특정 기능 필요.
 * ```ts
 * const [sub, err] = await requireFeature(auth.tenantId, 'ai_forecast');
 * if (err) return err;
 * ```
 */
export async function requireFeature(
  tenantId: string,
  feature: string
): Promise<[ActiveSubscription, null] | [null, NextResponse]> {
  // 개발 환경에서는 기능 제한 건너뛰기 (로컬 테스트 용)
  if (process.env.NODE_ENV !== 'production' && process.env.DEV_BYPASS_FEATURES) {
    console.debug('[Subscription] dev bypass feature check', { tenantId, feature });
    const [sub] = await requireSub(tenantId);
    return [sub || ({} as ActiveSubscription), null];
  }

  const [sub, err] = await requireSub(tenantId);
  if (err) return [null, err];

  if (!hasFeature(sub, feature)) {
    return [null, featureLockedResponse('FEATURE_NOT_IN_PLAN')];
  }
  return [sub, null];
}

// ──────────────────────────────────────────────────────────────
// 정량 한도 확인 헬퍼
// ──────────────────────────────────────────────────────────────

/**
 * 플랜 계층으로 한도 조회 (구독 없이 사용 가능).
 */
export function getPlanLimits(tier: PlanTier): PlanLimits {
  return PLAN_LIMITS[tier] ?? PLAN_LIMITS.FREE;
}

/**
 * 사업장(Site) 추가 가능 여부 확인.
 * @param currentCount 현재 등록된 사업장 수
 */
export async function canAddSite(
  tenantId: string,
  currentCount: number
): Promise<{ allowed: boolean; limit: number | null; current: number }> {
  const sub = await getActiveSub(tenantId);
  const limit = sub?.limits.maxSites ?? PLAN_LIMITS.FREE.maxSites;
  return {
    allowed: limit === null || currentCount < limit,
    limit,
    current: currentCount,
  };
}

/**
 * 센서 추가 가능 여부 확인.
 * @param currentCount 현재 등록된 센서 수
 */
export async function canAddSensor(
  tenantId: string,
  currentCount: number
): Promise<{ allowed: boolean; limit: number | null; current: number }> {
  const sub = await getActiveSub(tenantId);
  const limit = sub?.limits.maxSensors ?? PLAN_LIMITS.FREE.maxSensors;
  return {
    allowed: limit === null || currentCount < limit,
    limit,
    current: currentCount,
  };
}

/**
 * 게이트웨이 추가 가능 여부 확인.
 * @param currentCount 현재 등록된 게이트웨이 수
 */
export async function canAddGateway(
  tenantId: string,
  currentCount: number
): Promise<{ allowed: boolean; limit: number | null; current: number }> {
  const sub = await getActiveSub(tenantId);
  const limit = sub?.limits.maxGateways ?? PLAN_LIMITS.FREE.maxGateways;
  return {
    allowed: limit === null || currentCount < limit,
    limit,
    current: currentCount,
  };
}

/**
 * API 키 추가 가능 여부 확인.
 * @param currentCount 현재 등록된 API 키 수
 */
export async function canAddApiKey(
  tenantId: string,
  currentCount: number
): Promise<{ allowed: boolean; limit: number; current: number }> {
  const sub = await getActiveSub(tenantId);
  const limit = sub?.limits.maxApiKeysPerTenant ?? PLAN_LIMITS.FREE.maxApiKeysPerTenant;
  return {
    allowed: currentCount < limit,
    limit,
    current: currentCount,
  };
}

/**
 * 한도 초과 시 반환 응답 (402 + 업그레이드 안내).
 */
export function limitExceededResponse(resource: string, limit: number | null, current: number) {
  return NextResponse.json(
    {
      success: false,
      code: 'PLAN_LIMIT_EXCEEDED',
      error: `현재 플랜의 ${resource} 한도(${limit ?? '무제한'})에 도달했습니다. 상위 플랜으로 업그레이드하세요.`,
      current,
      limit,
      upgradeUrl: '/settings/subscription',
    },
    { status: 402 }
  );
}
