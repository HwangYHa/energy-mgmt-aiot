/**
 * lib/auth/permission-engine.ts — DB 기반 통합 권한 엔진
 *
 * 접근 제어 계층 (우선순위 순):
 *   1. SUPER_ADMIN → 전체 우회 (Full Bypass)
 *   2. 구독 Plan → PlanFeature DB 테이블 기준 기능 활성 여부 확인
 *   3. RBAC 역할 → MenuItem.minRole 대비 사용자 역할 확인
 *
 * 기존 PLAN_FEATURES 상수는 PlanFeature 테이블 미 시딩 시 폴백으로 사용.
 *
 * 사용 예:
 *   const result = await checkMenuAccess(auth, 'carbon_trading');
 *   if (!result.allowed) return NextResponse.json({ error: result.reason }, { status: 403 });
 *
 *   const ok = await checkFeatureAccess(auth.tenantId, 'ai_forecast');
 *
 *   // 플랜 변경 후 캐시 무효화
 *   await invalidateTenantPermissionCache(tenantId);
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getCached, invalidateCache, invalidateCacheByPrefix } from '@/lib/cache/redis';
import { isSuperAdmin, ROLE_HIERARCHY } from '@/lib/auth/permissions';
import { getActiveSub, hasFeature, PLAN_FEATURES, type ActiveSubscription } from '@/lib/auth/subscription';

// ──────────────────────────────────────────────────────────────
// 타입
// ──────────────────────────────────────────────────────────────

export interface AuthContext {
  userId: string;
  tenantId: string;
  role: string;
}

export interface AccessResult {
  allowed: boolean;
  reason: AccessDenyReason | 'allowed';
  detail?: string;
}

export type AccessDenyReason =
  | 'super_admin_bypass'   // allowed by super admin (not a deny)
  | 'subscription_required'
  | 'subscription_expired'
  | 'feature_not_in_plan'
  | 'role_insufficient'
  | 'menu_not_found'
  | 'menu_inactive';

// ──────────────────────────────────────────────────────────────
// 캐시 키 헬퍼
// ──────────────────────────────────────────────────────────────

const PLAN_FEATURES_TTL = 60;   // 1분 (구독 30s보다 길어도 무방)
const MENU_PERM_TTL     = 120;  // 2분

function planFeaturesCacheKey(planId: string) {
  return `perm:plan_features:${planId}`;
}

function menuPermCacheKey(tenantId: string, menuCode: string) {
  return `perm:menu:${tenantId}:${menuCode}`;
}

// ──────────────────────────────────────────────────────────────
// 플랜 기능 조회 (DB PlanFeature 테이블 → 폴백: PLAN_FEATURES 상수)
// ──────────────────────────────────────────────────────────────

/**
 * planId 기준 허용 feature_code 집합 조회.
 * DB PlanFeature가 시딩되어 있으면 DB 우선; 없으면 PLAN_FEATURES 상수 폴백.
 */
async function getPlanFeatureCodes(sub: ActiveSubscription): Promise<Set<string>> {
  return getCached(
    planFeaturesCacheKey(sub.planId),
    PLAN_FEATURES_TTL,
    async () => {
      // PlanFeature 테이블 조회 — prisma generate 미실행 시 모델이 없을 수 있음
      let rows: Array<{ featureCode: string }> = [];
      try {
        const model = (prisma as any).planFeature;
        if (model?.findMany) {
          rows = await model.findMany({
            where: { planId: sub.planId },
            select: { featureCode: true },
          });
        }
      } catch {
        // 테이블 미마이그레이션 → 상수 폴백
      }

      if (rows.length > 0) {
        return new Set(rows.map(r => r.featureCode));
      }

      // DB 미시딩 폴백 — PLAN_FEATURES 상수 사용
      const tier = sub.planTier.toUpperCase() as keyof typeof PLAN_FEATURES;
      const codes = PLAN_FEATURES[tier] ?? PLAN_FEATURES.FREE;
      if (codes.includes('*')) {
        // ENTERPRISE — 와일드카드 표시로 반환 (checkFeatureAccess에서 처리)
        return new Set(['*']);
      }
      return new Set(codes);
    }
  );
}

// ──────────────────────────────────────────────────────────────
// 핵심 API
// ──────────────────────────────────────────────────────────────

/**
 * 특정 feature_code가 해당 테넌트의 플랜에 포함되는지 확인.
 *
 * SUPER_ADMIN은 이 함수를 거치지 않고 직접 true를 반환 필요.
 */
export async function checkFeatureAccess(
  tenantId: string,
  featureCode: string
): Promise<boolean> {
  const sub = await getActiveSub(tenantId);
  if (!sub) return false;

  const codes = await getPlanFeatureCodes(sub);
  if (codes.has('*')) return true;   // ENTERPRISE wildcard
  return codes.has(featureCode);
}

/**
 * MenuItem(code 기준) 접근 권한 통합 확인.
 *
 * 계층:
 *   1. SUPER_ADMIN → 전체 허용
 *   2. 구독 없음/만료 → 402
 *   3. MenuItem.featureRequired → PlanFeature 확인
 *   4. MenuItem.minRole → RBAC 확인
 */
export async function checkMenuAccess(
  auth: AuthContext,
  menuCode: string
): Promise<AccessResult> {
  // 1. SUPER_ADMIN 전체 우회
  if (isSuperAdmin(auth.role)) {
    return { allowed: true, reason: 'super_admin_bypass' };
  }

  // 캐시 (role 포함 — 역할 변경 시 서로 다른 캐시 키)
  const cacheKey = `${menuPermCacheKey(auth.tenantId, menuCode)}:${auth.role}`;
  return getCached(
    cacheKey,
    MENU_PERM_TTL,
    async () => _computeMenuAccess(auth, menuCode)
  );
}

async function _computeMenuAccess(
  auth: AuthContext,
  menuCode: string
): Promise<AccessResult> {
  // 메뉴 아이템 조회 (code 기준)
  const menuItem = await (prisma as any).menuItem.findUnique({
    where: { code: menuCode },
    select: {
      code: true,
      minRole: true,
      featureRequired: true,
      isActive: true,
      subscriptionRequired: true,
    },
  }) as {
    code: string;
    minRole: string;
    featureRequired: string | null;
    isActive: boolean;
    subscriptionRequired: boolean;
  } | null;

  if (!menuItem) {
    return { allowed: false, reason: 'menu_not_found', detail: `menuCode=${menuCode}` };
  }
  if (!menuItem.isActive) {
    return { allowed: false, reason: 'menu_inactive' };
  }

  // 2. 구독 확인
  if (menuItem.subscriptionRequired) {
    const sub = await getActiveSub(auth.tenantId);
    if (!sub) {
      return { allowed: false, reason: 'subscription_required' };
    }

    // 3. 기능 확인 (featureRequired가 설정된 경우)
    if (menuItem.featureRequired) {
      const codes = await getPlanFeatureCodes(sub);
      if (!codes.has('*') && !codes.has(menuItem.featureRequired)) {
        // PLAN_FEATURES 폴백으로도 확인 (hasFeature 사용)
        if (!hasFeature(sub, menuItem.featureRequired)) {
          return {
            allowed: false,
            reason: 'feature_not_in_plan',
            detail: `required=${menuItem.featureRequired} plan=${sub.planTier}`,
          };
        }
      }
    }
  }

  // 4. RBAC 역할 확인
  const userLevel = ROLE_HIERARCHY[auth.role] ?? -1;
  const minLevel  = ROLE_HIERARCHY[menuItem.minRole] ?? 0;
  if (userLevel < minLevel) {
    return {
      allowed: false,
      reason: 'role_insufficient',
      detail: `required=${menuItem.minRole} current=${auth.role}`,
    };
  }

  return { allowed: true, reason: 'allowed' };
}

/**
 * 접근 가능한 MenuItem 목록 반환 (메뉴 렌더링용).
 *
 * @param auth  인증 컨텍스트
 * @param codes 확인할 menuCode 목록 (생략 시 전체 조회)
 * @returns     { code, allowed, locked } 배열
 *   - allowed: true → 표시/접근 가능
 *   - locked:  true → 표시하되 잠금 아이콘 (업그레이드 유도)
 */
export async function buildAccessibleMenu(
  auth: AuthContext,
  codes?: string[]
): Promise<Array<{ code: string; allowed: boolean; locked: boolean; reason?: string }>> {
  // SUPER_ADMIN은 전체 허용
  if (isSuperAdmin(auth.role)) {
    const items = await _fetchMenuItems(codes);
    return items.map(item => ({ code: item.code, allowed: true, locked: false }));
  }

  const sub = await getActiveSub(auth.tenantId);
  const planCodes = sub ? await getPlanFeatureCodes(sub) : new Set<string>();

  const items = await _fetchMenuItems(codes);

  return items.map(item => {
    // 비활성 메뉴 제외
    if (!item.isActive) return null;

    // RBAC 역할 확인
    const userLevel = ROLE_HIERARCHY[auth.role] ?? -1;
    const minLevel  = ROLE_HIERARCHY[item.minRole] ?? 0;
    if (userLevel < minLevel) {
      return null; // 역할 미달 → 메뉴 숨김
    }

    // 구독 불필요 메뉴
    if (!item.subscriptionRequired) {
      return { code: item.code, allowed: true, locked: false };
    }

    // 구독 없음 → locked
    if (!sub) {
      return { code: item.code, allowed: false, locked: true, reason: 'subscription_required' };
    }

    // 기능 확인
    if (item.featureRequired) {
      const hasIt =
        planCodes.has('*') ||
        planCodes.has(item.featureRequired) ||
        hasFeature(sub, item.featureRequired);
      if (!hasIt) {
        return { code: item.code, allowed: false, locked: true, reason: 'feature_not_in_plan' };
      }
    }

    return { code: item.code, allowed: true, locked: false };
  }).filter((x): x is NonNullable<typeof x> => x !== null);
}

async function _fetchMenuItems(codes?: string[]) {
  const where = codes?.length
    ? { code: { in: codes }, isActive: true }
    : { isActive: true };

  return (prisma as any).menuItem.findMany({
    where,
    select: {
      code: true,
      minRole: true,
      featureRequired: true,
      isActive: true,
      subscriptionRequired: true,
    },
    orderBy: { displayOrder: 'asc' },
  }) as Promise<Array<{
    code: string;
    minRole: string;
    featureRequired: string | null;
    isActive: boolean;
    subscriptionRequired: boolean;
  }>>;
}

// ──────────────────────────────────────────────────────────────
// 캐시 무효화 (플랜 변경 / 역할 변경 시 호출)
// ──────────────────────────────────────────────────────────────

/**
 * 테넌트의 권한 관련 캐시 전체 무효화.
 * 플랜 업그레이드/다운그레이드, 역할 변경 후 반드시 호출.
 */
export async function invalidateTenantPermissionCache(tenantId: string): Promise<void> {
  // 구독 캐시
  await invalidateCache(`sub:${tenantId}`);
  // 메뉴 권한 캐시 (prefix 기반 일괄 삭제)
  invalidateCacheByPrefix(`perm:menu:${tenantId}:`);
}

/**
 * 특정 플랜의 기능 캐시 무효화.
 * Plan.features 또는 PlanFeature 테이블 변경 시 호출.
 */
export async function invalidatePlanFeatureCache(planId: string): Promise<void> {
  await invalidateCache(planFeaturesCacheKey(planId));
}

// ──────────────────────────────────────────────────────────────
// NextResponse 가드 헬퍼 (API 라우트용)
// ──────────────────────────────────────────────────────────────

/**
 * 메뉴 접근 불가 시 적절한 HTTP 에러 반환.
 *
 * ```ts
 * const guard = await requireMenuAccess(auth, 'carbon_trading');
 * if (guard) return guard;
 * ```
 */
export async function requireMenuAccess(
  auth: AuthContext,
  menuCode: string
): Promise<NextResponse | null> {
  const result = await checkMenuAccess(auth, menuCode);
  if (result.allowed) return null;

  const statusMap: Record<AccessDenyReason, number> = {
    super_admin_bypass:    200,  // never reaches here
    subscription_required: 402,
    subscription_expired:  402,
    feature_not_in_plan:   402,
    role_insufficient:     403,
    menu_not_found:        404,
    menu_inactive:         404,
  };

  const msgMap: Record<AccessDenyReason, string> = {
    super_admin_bypass:    '',
    subscription_required: '구독 후 이용 가능합니다.',
    subscription_expired:  '구독이 만료되었습니다.',
    feature_not_in_plan:   '현재 플랜에서 지원하지 않는 기능입니다. 업그레이드 후 이용하세요.',
    role_insufficient:     '이 메뉴에 접근할 권한이 없습니다.',
    menu_not_found:        '메뉴를 찾을 수 없습니다.',
    menu_inactive:         '현재 비활성화된 메뉴입니다.',
  };

  const reason = result.reason as AccessDenyReason;
  return NextResponse.json(
    {
      success: false,
      code: reason.toUpperCase(),
      error: msgMap[reason],
      upgradeUrl: reason.includes('subscription') || reason === 'feature_not_in_plan'
        ? '/settings/subscription'
        : undefined,
    },
    { status: statusMap[reason] ?? 403 }
  );
}

/**
 * 기능 접근 불가 시 402 반환.
 *
 * ```ts
 * const guard = await requireFeatureAccess(auth, 'ai_forecast');
 * if (guard) return guard;
 * ```
 */
export async function requireFeatureAccess(
  auth: AuthContext,
  featureCode: string
): Promise<NextResponse | null> {
  if (isSuperAdmin(auth.role)) return null;

  const ok = await checkFeatureAccess(auth.tenantId, featureCode);
  if (ok) return null;

  return NextResponse.json(
    {
      success: false,
      code: 'FEATURE_NOT_IN_PLAN',
      error: '현재 플랜에서 지원하지 않는 기능입니다. 상위 플랜으로 업그레이드하세요.',
      upgradeUrl: '/settings/subscription',
    },
    { status: 402 }
  );
}
