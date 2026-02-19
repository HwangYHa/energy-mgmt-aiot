/**
 * /api/admin/menus - 메뉴 관리 API (super_admin 전용)
 *
 * POST: 메뉴 설정 업데이트 (활성/비활성, 역할 변경 등)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth, requireRoleOrHigher } from '@/lib/auth/verify';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  validationErrorResponse,
  serverErrorResponse,
} from '@/lib/api/response';

const VALID_ROLES = ['viewer', 'operator', 'site_manager', 'tenant_admin', 'super_admin'] as const;

const menuItemUpdateSchema = z.object({
  id: z.string().min(1),
  sortOrder: z.number().int().min(0).max(999),
  minRole: z.enum(VALID_ROLES),
  enabled: z.boolean(),
});

const menuGroupUpdateSchema = z.object({
  id: z.string().min(1),
  sortOrder: z.number().int().min(0).max(999),
  minRole: z.enum(VALID_ROLES),
  items: z.array(menuItemUpdateSchema),
});

const menuUpdateBodySchema = z.object({
  groups: z.array(menuGroupUpdateSchema).min(1).max(50),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    if (!requireRoleOrHigher(auth, 'super_admin')) {
      return forbiddenResponse();
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return validationErrorResponse({ body: '올바른 JSON 형식이어야 합니다' });
    }

    const parsed = menuUpdateBodySchema.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        errors[issue.path.join('.') || 'input'] = issue.message;
      });
      return validationErrorResponse(errors);
    }

    const { groups } = parsed.data;

    // 트랜잭션으로 메뉴 업데이트
    await prisma.$transaction(async (tx) => {
      for (const group of groups) {
        // 그룹 업데이트 (존재하지 않으면 무시 - updateMany)
        await tx.menuGroup.updateMany({
          where: { id: group.id },
          data: {
            displayOrder: group.sortOrder,
            minRole: group.minRole,
          },
        });

        // 아이템 업데이트
        for (const item of group.items) {
          await tx.menuItem.updateMany({
            where: { id: item.id },
            data: {
              displayOrder: item.sortOrder,
              minRole: item.minRole,
              isActive: item.enabled,
            },
          });
        }
      }
    });

    return successResponse({ message: '메뉴 설정이 저장되었습니다.' });
  } catch (error) {
    console.error('Menu update error:', error);
    return serverErrorResponse({ message: '메뉴 설정 저장에 실패했습니다.' });
  }
}
