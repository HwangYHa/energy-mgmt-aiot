/**
 * /api/menus - 메뉴 조회 API
 *
 * 역할별 + 테넌트별 동적 메뉴 필터링
 *
 * 테넌트 메뉴 설정 (tenant.settings):
 * {
 *   "menu": {
 *     "allowedGroups": ["DASHBOARD", "MONITORING", "CONTROL"],
 *     "allowedItems": ["dashboard-overview", "monitoring-realtime"],
 *     "disabledItems": ["forecast-detail"]
 *   }
 * }
 *
 * - allowedGroups: 허용된 메뉴 그룹 코드 목록 (미설정 시 전체 허용)
 * - allowedItems: 허용된 메뉴 아이템 코드 목록 (미설정 시 전체 허용)
 * - disabledItems: 비활성화할 메뉴 아이템 코드 목록
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { hasRoleOrHigher } from '@/lib/constants/roles';
import { UserRole } from '@prisma/client';
import {
  successResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from '@/lib/api/response';
import { getCached } from '@/lib/cache/redis';
import { isSuperAdmin } from '@/lib/auth/permissions';
import { getActiveSub, PLAN_FEATURES } from '@/lib/auth/subscription';

interface TenantMenuSettings {
  allowedGroups?: string[];
  allowedItems?: string[];
  disabledItems?: string[];
}

function parseTenantMenuSettings(settings: unknown): TenantMenuSettings {
  if (!settings || typeof settings !== 'object') return {};
  const s = settings as Record<string, unknown>;
  const menu = s.menu as Record<string, unknown> | undefined;
  if (!menu) return {};

  return {
    allowedGroups: Array.isArray(menu.allowedGroups) ? menu.allowedGroups : undefined,
    allowedItems: Array.isArray(menu.allowedItems) ? menu.allowedItems : undefined,
    disabledItems: Array.isArray(menu.disabledItems) ? menu.disabledItems : undefined,
  };
}

export async function GET() {
  try {
    // NextAuth 세션 검증
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return unauthorizedResponse();
    }

    const userRole = session.user.role as UserRole;
    const tenantId = session.user.tenantId as string;
    const userId   = session.user.id as string;
    const superAdmin = isSuperAdmin(userRole);

    // 구독 기반 기능 코드 사전 로드 (SUPER_ADMIN은 건너뜀)
    let allowedFeatureCodes: Set<string> | null = null;
    if (!superAdmin && tenantId) {
      const sub = await getActiveSub(tenantId);
      if (sub) {
        allowedFeatureCodes = new Set<string>();

        // PlanFeature 테이블 조회 — prisma generate 미실행 시 undefined 가능
        let planFeatureRows: Array<{ featureCode: string }> = [];
        try {
          const model = (prisma as any).planFeature;
          if (model?.findMany) {
            planFeatureRows = await model.findMany({
              where: { planId: sub.planId },
              select: { featureCode: true },
            });
          }
        } catch {
          // 테이블 미마이그레이션 → 상수 폴백
        }

        if (planFeatureRows.length > 0) {
          planFeatureRows.forEach((r) =>
            (allowedFeatureCodes as Set<string>).add(r.featureCode)
          );
        } else {
          // 폴백: PLAN_FEATURES 상수 (prisma generate 전 또는 DB 미시딩)
          const tierKey = sub.planTier.toUpperCase() as keyof typeof PLAN_FEATURES;
          const codes = (tierKey === 'ENTERPRISE') ? ['*'] : (PLAN_FEATURES[tierKey] ?? []);
          codes.forEach((c: string) => (allowedFeatureCodes as Set<string>).add(c));
        }
      }
    }

    // 테넌트 메뉴 설정 + 메뉴 그룹: 60초 캐싱 (자주 변경되지 않는 데이터)
    const cacheKey = `menu:${tenantId ?? 'global'}:${userRole}`;
    const { tenantMenuConfig, menuGroups } = await getCached(
      cacheKey,
      60,
      async () => {
        // 테넌트 메뉴 설정 조회
        let config: TenantMenuSettings = {};
        if (tenantId) {
          const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { settings: true },
          });
          if (tenant?.settings) {
            config = parseTenantMenuSettings(tenant.settings);
          }
        }

        // 메뉴 그룹과 아이템 조회
        const groups = await prisma.menuGroup.findMany({
          where: { isActive: true, isVisible: true },
          include: {
            menuItems: {
              where: {
                isActive: true,
                isVisible: true,
                menuGroupId: { not: null },
              },
              orderBy: { displayOrder: 'asc' },
            },
          },
          orderBy: { displayOrder: 'asc' },
        });

        return { tenantMenuConfig: config, menuGroups: groups };
      }
    );

    // 필터링: 역할 + 테넌트 메뉴 설정 + 기능 플랜
    const filteredGroups = menuGroups
      // 1. 역할별 그룹 필터링
      .filter((group) => superAdmin || hasRoleOrHigher(userRole, group.minRole))
      // 2. 테넌트별 그룹 필터링
      .filter((group) => {
        if (superAdmin) return true;
        if (!tenantMenuConfig.allowedGroups) return true; // 미설정 시 전체 허용
        return tenantMenuConfig.allowedGroups.includes(group.code);
      })
      .map((group) => ({
        id: group.id,
        code: group.code,
        name: group.name,
        icon: group.icon,
        displayOrder: group.displayOrder,
        minRole: group.minRole,
        items: group.menuItems
          // 역할별 아이템 필터링 (역할 미달은 완전 숨김)
          .filter((item) => superAdmin || hasRoleOrHigher(userRole, item.minRole))
          // 테넌트별 아이템 필터링 (allowedItems)
          .filter((item) => {
            if (superAdmin) return true;
            if (!tenantMenuConfig.allowedItems) return true;
            return tenantMenuConfig.allowedItems.includes(item.code);
          })
          // 테넌트별 아이템 비활성화 (disabledItems)
          .filter((item) => {
            if (superAdmin) return true;
            if (!tenantMenuConfig.disabledItems) return true;
            return !tenantMenuConfig.disabledItems.includes(item.code);
          })
          .map((item) => {
            // 기능 잠금 여부 판단 (SUPER_ADMIN, featureRequired 없으면 항상 허용)
            let locked = false;
            if (!superAdmin && item.featureRequired && allowedFeatureCodes !== null) {
              const wildcard = allowedFeatureCodes.has('*');
              locked = !wildcard && !allowedFeatureCodes.has(item.featureRequired);
            }

            return {
              id: item.id,
              code: item.code,
              name: item.name,
              icon: item.icon,
              path: item.path,
              displayOrder: item.displayOrder,
              minRole: item.minRole,
              badgeType: item.badgeType,
              badgeColor: item.badgeColor,
              locked,                          // true → UI에서 잠금 아이콘 표시
              featureRequired: item.featureRequired ?? null,
            };
          }),
      }))
      .filter((group) => group.items.length > 0); // 아이템이 없는 그룹 제거

    void userId; // used for session validation above
    return successResponse(filteredGroups);
  } catch (error) {
    console.error('[API] 메뉴 조회 오류:', error);
    return serverErrorResponse();
  }
}
