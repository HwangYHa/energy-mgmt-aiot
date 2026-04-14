/**
 * /api/menus - 메뉴 조회 API
 *
 * 역할별 + 테넌트별 동적 메뉴 필터링
 *
 * 쿼리 파라미터:
 *   all=true  → 관리자용 전체 메뉴 조회 (super_admin 전용, 필터링 없음)
 *              label/sortOrder/section/enabled 필드 포함 (admin/menu 페이지용)
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
 * 인증 우선순위:
 * 1. verifyAuth (JWT Bearer, auth-token 쿠키, NextAuth 세션)
 * 2. getServerSession (NextAuth 세션 전용 폴백)
 */

import { NextRequest } from 'next/server';
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
import { verifyAuth } from '@/lib/auth/verify';

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

/** 그룹 코드 → 섹션 매핑 (admin/menu 페이지 표시용) */
const GROUP_SECTION_MAP: Record<string, string> = {
  dashboard:   'monitoring',
  monitoring:  'monitoring',
  analytics:   'monitoring',
  carbon:      'monitoring',
  reports:     'monitoring',
  control:     'control',
  management:  'management',
  settings:    'admin',
  compliance:  'compliance',
  alerts:      'alerts',
  admin:       'admin',
};

export async function GET(request: NextRequest) {
  try {
    // ── 인증: verifyAuth 우선 (JWT/쿠키/NextAuth 세션 모두 지원) ──
    let userRole: UserRole;
    let tenantId: string;
    let userId: string;

    const authCtx = await verifyAuth(request);
    if (authCtx) {
      userRole = authCtx.role as UserRole;
      tenantId = authCtx.tenantId;
      userId   = authCtx.userId;
    } else {
      // 폴백: getServerSession (서버 컴포넌트 환경)
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        return unauthorizedResponse();
      }
      userRole = session.user.role as UserRole;
      tenantId = session.user.tenantId as string;
      userId   = session.user.id as string;
    }

    void userId;

    const superAdmin = isSuperAdmin(userRole);
    const { searchParams } = new URL(request.url);
    const allMode = searchParams.get('all') === 'true';

    // ── 관리자 전체 조회 모드 (super_admin + all=true) ──────────────
    // admin/menu 페이지에서 사용: label/sortOrder/section/enabled 필드 반환
    if (allMode && superAdmin) {
      const groups = await prisma.menuGroup.findMany({
        include: {
          menuItems: {
            where: { menuGroupId: { not: null } },
            orderBy: { displayOrder: 'asc' },
          },
        },
        orderBy: { displayOrder: 'asc' },
      });

      const result = groups.map((group) => ({
        id:        group.id,
        code:      group.code,
        label:     group.name,          // admin/menu 페이지용 필드명
        name:      group.name,          // Sidebar 호환
        icon:      group.icon ?? '',
        minRole:   group.minRole,
        sortOrder: group.displayOrder,  // admin/menu 페이지용 필드명
        displayOrder: group.displayOrder,
        section:   GROUP_SECTION_MAP[group.code] ?? 'general',
        isActive:  group.isActive,
        items: group.menuItems.map((item) => ({
          id:              item.id,
          code:            item.code,
          label:           item.name,       // admin/menu 페이지용
          name:            item.name,       // Sidebar 호환
          icon:            item.icon ?? '',
          path:            item.path ?? '',
          minRole:         item.minRole,
          sortOrder:       item.displayOrder,  // admin/menu 페이지용
          displayOrder:    item.displayOrder,
          enabled:         item.isActive,      // admin/menu 페이지용
          isActive:        item.isActive,
          featureRequired: item.featureRequired ?? null,
          badgeType:       (item.badgeType !== 'none' ? item.badgeType : null) as string | null,
          badgeColor:      item.badgeColor ?? null,
          locked:          false,
        })),
      }));

      return successResponse(result);
    }

    // ── 일반 조회 모드: 역할 + 테넌트 + 구독 필터링 ──────────────────

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
        id:          group.id,
        code:        group.code,
        name:        group.name,
        label:       group.name,
        icon:        group.icon,
        displayOrder: group.displayOrder,
        sortOrder:   group.displayOrder,
        minRole:     group.minRole,
        section:     GROUP_SECTION_MAP[group.code] ?? 'general',
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
              id:              item.id,
              code:            item.code,
              name:            item.name,
              label:           item.name,
              icon:            item.icon,
              path:            item.path,
              displayOrder:    item.displayOrder,
              sortOrder:       item.displayOrder,
              minRole:         item.minRole,
              enabled:         item.isActive,
              badgeType:       (item.badgeType !== 'none' ? item.badgeType : null) as string | null,
              badgeColor:      item.badgeColor,
              locked,
              featureRequired: item.featureRequired ?? null,
            };
          }),
      }))
      .filter((group) => group.items.length > 0); // 아이템이 없는 그룹 제거

    return successResponse(filteredGroups);
  } catch (error) {
    console.error('[API] 메뉴 조회 오류:', error);
    return serverErrorResponse();
  }
}
