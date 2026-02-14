/**
 * /api/admin/tenants/menu-config - 테넌트 메뉴 설정 API
 *
 * GET: 현재 테넌트의 메뉴 설정 조회
 * PUT: 테넌트 메뉴 설정 업데이트 (tenant_admin 이상)
 *
 * 설정 예시:
 * {
 *   "menu": {
 *     "allowedGroups": ["DASHBOARD", "MONITORING", "CONTROL"],
 *     "disabledItems": ["forecast-detail"]
 *   }
 * }
 */

import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { verifyAuth, requireRole } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  validationErrorResponse,
  serverErrorResponse,
} from '@/lib/api/response';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    // 테넌트 설정 조회
    const tenant = await prisma.tenant.findUnique({
      where: { id: auth.tenantId },
      select: {
        id: true,
        name: true,
        settings: true,
      },
    });

    if (!tenant) {
      return unauthorizedResponse();
    }

    const settings = tenant.settings as Record<string, unknown> | null;
    const menuConfig = settings?.menu || {};

    // 전체 메뉴 목록도 함께 반환 (설정 UI에서 사용)
    const allMenuGroups = await prisma.menuGroup.findMany({
      where: { isActive: true },
      include: {
        menuItems: {
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
          select: {
            id: true,
            code: true,
            name: true,
            icon: true,
          },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });

    const availableMenus = allMenuGroups.map((group) => ({
      code: group.code,
      name: group.name,
      icon: group.icon,
      items: group.menuItems.map((item) => ({
        code: item.code,
        name: item.name,
        icon: item.icon,
      })),
    }));

    return successResponse({
      tenantId: tenant.id,
      tenantName: tenant.name,
      menuConfig,
      availableMenus,
    });
  } catch (error) {
    console.error('[API] 테넌트 메뉴 설정 조회 오류:', error);
    return serverErrorResponse();
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    // tenant_admin 이상만 메뉴 설정 변경 가능
    if (!requireRole(auth, ['tenant_admin'])) {
      return forbiddenResponse({ requiredRoles: ['tenant_admin'] });
    }

    const body = await request.json();
    const { allowedGroups, allowedItems, disabledItems } = body;

    // 입력 검증
    if (allowedGroups && !Array.isArray(allowedGroups)) {
      return validationErrorResponse({ allowedGroups: '배열 형식이어야 합니다' });
    }
    if (allowedItems && !Array.isArray(allowedItems)) {
      return validationErrorResponse({ allowedItems: '배열 형식이어야 합니다' });
    }
    if (disabledItems && !Array.isArray(disabledItems)) {
      return validationErrorResponse({ disabledItems: '배열 형식이어야 합니다' });
    }

    // 기존 설정 조회
    const tenant = await prisma.tenant.findUnique({
      where: { id: auth.tenantId },
      select: { settings: true },
    });

    const currentSettings = (tenant?.settings as Record<string, unknown>) || {};

    // 메뉴 설정 업데이트 (기존 설정 유지하면서 menu만 업데이트)
    const newMenuConfig: Record<string, unknown> = {};
    if (allowedGroups !== undefined) newMenuConfig.allowedGroups = allowedGroups;
    if (allowedItems !== undefined) newMenuConfig.allowedItems = allowedItems;
    if (disabledItems !== undefined) newMenuConfig.disabledItems = disabledItems;

    const updatedSettings = {
      ...currentSettings,
      menu: newMenuConfig,
    } as Prisma.InputJsonObject;

    // 테넌트 설정 업데이트
    const updated = await prisma.tenant.update({
      where: { id: auth.tenantId },
      data: { settings: updatedSettings },
      select: {
        id: true,
        name: true,
        settings: true,
      },
    });

    // 감사 로그
    await prisma.auditLog.create({
      data: {
        tenantId: auth.tenantId,
        userId: auth.userId,
        action: 'TENANT_MENU_CONFIG_UPDATE',
        resourceType: 'TENANT',
        resourceId: auth.tenantId,
        result: 'success',
        metadata: newMenuConfig as Prisma.InputJsonObject,
      },
    }).catch((err) => console.error('[감사 로그] 기록 실패:', err));

    const updatedMenuConfig = (updated.settings as Record<string, unknown>)?.menu || {};

    return successResponse({
      tenantId: updated.id,
      tenantName: updated.name,
      menuConfig: updatedMenuConfig,
    });
  } catch (error) {
    console.error('[API] 테넌트 메뉴 설정 업데이트 오류:', error);
    return serverErrorResponse();
  }
}
