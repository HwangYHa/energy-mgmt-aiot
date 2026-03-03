/**
 * lib/middleware/plan-limit.ts — 플랜 정량 한도 검증 미들웨어
 *
 * 원칙:
 *   1. DB가 단일 진실원(Source of Truth) — Redis/캐시는 사용하지 않음
 *   2. Fail-open — 쿼리 자체가 실패하면 생성 허용 (서비스 중단 방지)
 *   3. 한도 null(ENTERPRISE 무제한) → 즉시 허용
 *
 * 사용 예:
 * ```ts
 * const limitErr = await checkPlanLimit(auth.tenantId, 'site');
 * if (limitErr) return limitErr;
 * ```
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { PLAN_LIMITS, type PlanLimits, type PlanTier } from '@/lib/auth/subscription';

// ──────────────────────────────────────────────────────────────
// 타입
// ──────────────────────────────────────────────────────────────

export type LimitResource = 'site' | 'sensor' | 'gateway' | 'apiKey';

const RESOURCE_LABELS: Record<LimitResource, string> = {
  site:    '사업장',
  sensor:  '센서',
  gateway: '게이트웨이',
  apiKey:  'API 키',
};

// DB PlanTier 값 → PLAN_LIMITS 키 변환 (lib/auth/subscription의 TIER_MAP 복제)
const TIER_MAP: Record<string, PlanTier> = {
  trial:        'FREE',
  basic:        'STARTER',
  pro:          'PROFESSIONAL',
  enterprise:   'ENTERPRISE',
  FREE:         'FREE',
  STARTER:      'STARTER',
  PROFESSIONAL: 'PROFESSIONAL',
  ENTERPRISE:   'ENTERPRISE',
};

// ──────────────────────────────────────────────────────────────
// 내부 헬퍼
// ──────────────────────────────────────────────────────────────

/** DB에서 현재 테넌트의 리소스 수량 조회 */
async function countCurrentResources(
  tenantId: string,
  resource: LimitResource,
): Promise<number> {
  switch (resource) {
    case 'site':    return prisma.site.count({ where: { tenantId, deletedAt: null } });
    case 'sensor':  return prisma.sensor.count({ where: { tenantId, deletedAt: null } });
    case 'gateway': return prisma.gateway.count({ where: { tenantId } });
    case 'apiKey':  return prisma.apiKey.count({ where: { tenantId, isActive: true } });
  }
}

/** DB에서 테넌트의 활성 구독 플랜 한도를 직접 조회 */
async function getLimitsFromDb(tenantId: string): Promise<{ limits: PlanLimits; planName: string }> {
  const sub = await prisma.subscription.findFirst({
    where: {
      tenantId,
      status: { in: ['ACTIVE', 'EXPIRE_SOON'] },
    },
    orderBy: { startDate: 'desc' },
    select: {
      plan: {
        select: {
          name: true,
          tier: true,
          maxSites: true,          // DB 직접 조회 (단일 진실원)
          maxDevices: true,        // DB 직접 조회 (센서/디바이스 합산 한도)
          dataRetentionDays: true, // DB 직접 조회
        },
      },
    },
  });

  if (!sub) {
    return { limits: PLAN_LIMITS.FREE, planName: 'FREE' };
  }

  const rawTier  = (sub.plan.tier as string);
  const tier     = TIER_MAP[rawTier] ?? TIER_MAP[rawTier.toUpperCase()] ?? 'FREE';

  // feature flags / maxGateways / maxApiKeysPerTenant 등 DB에 없는 필드는 코드 상수 사용
  const baseLimits = PLAN_LIMITS[tier] ?? PLAN_LIMITS.FREE;

  // DB 값이 있으면 DB 우선 (수량 한도 — DB가 단일 진실원)
  const limits: PlanLimits = {
    ...baseLimits,
    maxSites:          sub.plan.maxSites   ?? baseLimits.maxSites,
    maxSensors:        sub.plan.maxDevices ?? baseLimits.maxSensors,
    dataRetentionDays: sub.plan.dataRetentionDays,
  };

  return { limits, planName: sub.plan.name };
}

/** 리소스 타입에 해당하는 한도 값 추출 */
function getLimitForResource(limits: PlanLimits, resource: LimitResource): number | null {
  switch (resource) {
    case 'site':    return limits.maxSites;
    case 'sensor':  return limits.maxSensors;
    case 'gateway': return limits.maxGateways;
    case 'apiKey':  return limits.maxApiKeysPerTenant;
  }
}

// ──────────────────────────────────────────────────────────────
// 메인 함수
// ──────────────────────────────────────────────────────────────

/**
 * 플랜 한도 초과 여부를 확인합니다.
 *
 * - DB에서 직접 조회 (Redis/캐시 미사용 → 인프라 장애에 독립적)
 * - 쿼리 실패 시 null 반환 (fail-open → 서비스 중단 방지)
 * - 한도 null (ENTERPRISE 무제한) → null 반환
 * - 한도 초과 → 402 + upgradeUrl
 * - 한도 미초과 → null (생성 허용)
 */
export async function checkPlanLimit(
  tenantId: string,
  resource: LimitResource,
): Promise<NextResponse | null> {
  try {
    // DB 직접 쿼리 — Redis/캐시 불사용
    const [{ limits, planName }, current] = await Promise.all([
      getLimitsFromDb(tenantId),
      countCurrentResources(tenantId, resource),
    ]);

    const max = getLimitForResource(limits, resource);

    // 무제한 플랜 (ENTERPRISE)
    if (max === null) return null;

    if (current >= max) {
      const label = RESOURCE_LABELS[resource];
      return NextResponse.json(
        {
          success:    false,
          code:       'PLAN_LIMIT_EXCEEDED',
          error:      `${planName} 플랜의 ${label} 한도(${max}개)에 도달했습니다. 상위 플랜으로 업그레이드하세요.`,
          resource,
          current,
          limit:      max,
          upgradeUrl: '/settings/subscription',
        },
        { status: 402 },
      );
    }

    return null;
  } catch (err) {
    // Fail-open: DB/캐시/기타 오류 발생 시 생성 허용 (서비스 중단 방지)
    console.error('[PlanLimit] 한도 확인 실패 → 생성 허용 (fail-open):', err instanceof Error ? err.message : err);
    return null;
  }
}
