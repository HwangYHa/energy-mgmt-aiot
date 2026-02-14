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

    // 테넌트 메뉴 설정 조회
    let tenantMenuConfig: TenantMenuSettings = {};
    if (tenantId) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { settings: true },
      });

      if (tenant?.settings) {
        tenantMenuConfig = parseTenantMenuSettings(tenant.settings);
      }
    }

    // 메뉴 그룹과 아이템 조회
    const menuGroups = await prisma.menuGroup.findMany({
      where: {
        isActive: true,
        isVisible: true,
      },
      include: {
        menuItems: {
          where: {
            isActive: true,
            isVisible: true,
            menuGroupId: {
              not: null,
            },
          },
          orderBy: {
            displayOrder: 'asc',
          },
        },
      },
      orderBy: {
        displayOrder: 'asc',
      },
    });

    // 필터링: 역할 + 테넌트 메뉴 설정
    const filteredGroups = menuGroups
      // 1. 역할별 그룹 필터링
      .filter((group) => hasRoleOrHigher(userRole, group.minRole))
      // 2. 테넌트별 그룹 필터링
      .filter((group) => {
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
          // 역할별 아이템 필터링
          .filter((item) => hasRoleOrHigher(userRole, item.minRole))
          // 테넌트별 아이템 필터링 (allowedItems)
          .filter((item) => {
            if (!tenantMenuConfig.allowedItems) return true;
            return tenantMenuConfig.allowedItems.includes(item.code);
          })
          // 테넌트별 아이템 비활성화 (disabledItems)
          .filter((item) => {
            if (!tenantMenuConfig.disabledItems) return true;
            return !tenantMenuConfig.disabledItems.includes(item.code);
          })
          .map((item) => ({
            id: item.id,
            code: item.code,
            name: item.name,
            icon: item.icon,
            path: item.path,
            displayOrder: item.displayOrder,
            minRole: item.minRole,
            badgeType: item.badgeType,
            badgeColor: item.badgeColor,
          })),
      }))
      .filter((group) => group.items.length > 0); // 아이템이 없는 그룹 제거

    return successResponse(filteredGroups);
  } catch (error) {
    console.error('[API] 메뉴 조회 오류:', error);
    return serverErrorResponse();
  }
}
