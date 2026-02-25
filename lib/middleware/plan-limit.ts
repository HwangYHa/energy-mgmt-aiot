/**
 * lib/middleware/plan-limit.ts — 플랜 정량 한도 검증 미들웨어
 *
 * Route Handler에서 리소스 생성 전에 호출하여
 * 현재 플랜의 수량 한도 초과 여부를 중앙에서 검사합니다.
 *
 * 사용 예:
 * ```ts
 * const limitErr = await checkPlanLimit(auth.tenantId, 'site');
 * if (limitErr) return limitErr;
 * ```
 *
 * 내부 처리:
 *   1. getActiveSub(tenantId) → PLAN_LIMITS 조회 (30초 Redis 캐시)
 *   2. DB에서 현재 리소스 카운트
 *   3. 초과 시 402 + upgradeUrl 반환, 미초과 시 null
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getActiveSub, PLAN_LIMITS, type PlanLimits } from '@/lib/auth/subscription';

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

// ──────────────────────────────────────────────────────────────
// 내부 헬퍼
// ──────────────────────────────────────────────────────────────

/** 현재 테넌트의 리소스 수량을 DB에서 조회 */
async function countCurrentResources(
  tenantId: string,
  resource: LimitResource
): Promise<number> {
  switch (resource) {
    case 'site':
      return prisma.site.count({ where: { tenantId, deletedAt: null } });
    case 'sensor':
      return prisma.sensor.count({ where: { tenantId, deletedAt: null } });
    case 'gateway':
      return prisma.gateway.count({ where: { tenantId } });
    case 'apiKey':
      return prisma.apiKey.count({ where: { tenantId, isActive: true } });
  }
}

/** 리소스 타입에 해당하는 한도 값 추출 */
function getLimitForResource(
  limits: PlanLimits,
  resource: LimitResource
): number | null {
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
 * 플랜 한도 초과 여부를 확인하고 응답을 반환합니다.
 *
 * - 구독 없음: FREE 플랜 한도 적용
 * - 한도 null(ENTERPRISE 무제한): 즉시 null 반환
 * - 한도 초과: 402 Payment Required + upgradeUrl
 * - 한도 미초과: null (생성 허용)
 */
export async function checkPlanLimit(
  tenantId: string,
  resource: LimitResource
): Promise<NextResponse | null> {
  // 구독 조회 + 현재 수량 병렬 처리
  const [sub, current] = await Promise.all([
    getActiveSub(tenantId),
    countCurrentResources(tenantId, resource),
  ]);

  const limits = sub?.limits ?? PLAN_LIMITS.FREE;
  const max = getLimitForResource(limits, resource);

  // 무제한 플랜 (ENTERPRISE null 값)
  if (max === null) return null;

  if (current >= max) {
    const label = RESOURCE_LABELS[resource];
    const planName = sub?.planName ?? 'FREE';

    return NextResponse.json(
      {
        success: false,
        code: 'PLAN_LIMIT_EXCEEDED',
        error: `${planName} 플랜의 ${label} 한도(${max}개)에 도달했습니다. 상위 플랜으로 업그레이드하세요.`,
        resource,
        current,
        limit: max,
        upgradeUrl: '/settings/subscription',
      },
      { status: 402 }
    );
  }

  return null;
}
