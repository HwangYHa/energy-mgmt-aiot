/**
 * /api/admin/menus - 메뉴 관리 API (super_admin 전용)
 *
 * POST: 메뉴 전체 상태 일괄 저장
 *   Body: { groups: Group[], deletedGroupIds: string[], deletedItemIds: string[] }
 *   - groups[].id 가 '__new__' 로 시작하면 CREATE, 아니면 UPDATE
 *   - code 는 신규 생성 시 필수
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth, requireRoleOrHigher } from '@/lib/auth/verify';
import {
  successResponse, unauthorizedResponse, forbiddenResponse,
  validationErrorResponse, serverErrorResponse,
} from '@/lib/api/response';

const VALID_ROLES = ['viewer', 'operator', 'site_manager', 'tenant_admin', 'super_admin'] as const;

const itemSchema = z.object({
  id:       z.string().min(1),
  code:     z.string().min(1).max(50).regex(/^[a-z0-9_-]+$/).optional(),
  name:     z.string().min(1).max(100),
  path:     z.string().max(200).default(''),
  icon:     z.string().max(50).default('Circle'),
  minRole:  z.enum(VALID_ROLES).default('viewer'),
  sortOrder:z.number().int().min(0).max(9999).default(0),
  enabled:  z.boolean().default(true),
});

const groupSchema = z.object({
  id:       z.string().min(1),
  code:     z.string().min(1).max(50).regex(/^[a-z0-9_-]+$/).optional(),
  name:     z.string().min(1).max(100),
  icon:     z.string().max(50).default('LayoutGrid'),
  minRole:  z.enum(VALID_ROLES).default('viewer'),
  sortOrder:z.number().int().min(0).max(9999).default(0),
  items:    z.array(itemSchema).default([]),
});

const saveBodySchema = z.object({
  groups:          z.array(groupSchema).max(100),
  deletedGroupIds: z.array(z.string()).default([]),
  deletedItemIds:  z.array(z.string()).default([]),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!requireRoleOrHigher(auth, 'super_admin')) return forbiddenResponse();

    let body: unknown;
    try { body = await request.json(); } catch {
      return validationErrorResponse({ body: '올바른 JSON 형식이어야 합니다' });
    }

    const parsed = saveBodySchema.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      parsed.error.issues.forEach(i => { errors[i.path.join('.') || 'input'] = i.message; });
      return validationErrorResponse(errors);
    }

    const { groups, deletedGroupIds, deletedItemIds } = parsed.data;

    // Validate: new groups/items must have code
    for (const g of groups) {
      if (g.id.startsWith('__new__') && !g.code) {
        return validationErrorResponse({ code: `그룹 "${g.name}"의 코드를 입력하세요` });
      }
      for (const item of g.items) {
        if (item.id.startsWith('__new__') && !item.code) {
          return validationErrorResponse({ code: `항목 "${item.name}"의 코드를 입력하세요` });
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      // 1. Delete items first (before their groups)
      if (deletedItemIds.length > 0) {
        await tx.menuItem.deleteMany({
          where: { id: { in: deletedItemIds } },
        });
      }

      // 2. Delete groups (also cascades remaining items)
      if (deletedGroupIds.length > 0) {
        await tx.menuItem.deleteMany({ where: { menuGroupId: { in: deletedGroupIds } } });
        await tx.menuGroup.deleteMany({ where: { id: { in: deletedGroupIds } } });
      }

      // 3. Create/update groups and their items
      for (const group of groups) {
        let realGroupId: string;

        if (group.id.startsWith('__new__')) {
          // Check code uniqueness
          const existing = await tx.menuGroup.findUnique({ where: { code: group.code! } });
          if (existing) throw new Error(`그룹 코드 "${group.code}"가 이미 사용 중입니다`);

          const created = await tx.menuGroup.create({
            data: {
              code:         group.code!,
              name:         group.name,
              icon:         group.icon,
              minRole:      group.minRole as any,
              displayOrder: group.sortOrder,
              isActive:     true,
              isVisible:    true,
            },
          });
          realGroupId = created.id;
        } else {
          await tx.menuGroup.updateMany({
            where: { id: group.id },
            data:  {
              name:         group.name,
              icon:         group.icon,
              minRole:      group.minRole as any,
              displayOrder: group.sortOrder,
            },
          });
          realGroupId = group.id;
        }

        // 4. Create/update items for this group
        for (const item of group.items) {
          if (item.id.startsWith('__new__')) {
            const existingItem = await tx.menuItem.findUnique({ where: { code: item.code! } });
            if (existingItem) throw new Error(`항목 코드 "${item.code}"가 이미 사용 중입니다`);

            await tx.menuItem.create({
              data: {
                code:         item.code!,
                name:         item.name,
                path:         item.path || null,
                icon:         item.icon,
                minRole:      item.minRole as any,
                displayOrder: item.sortOrder,
                isActive:     item.enabled,
                isVisible:    true,
                menuGroupId:  realGroupId,
              },
            });
          } else {
            await tx.menuItem.updateMany({
              where: { id: item.id },
              data:  {
                name:         item.name,
                path:         item.path || null,
                icon:         item.icon,
                minRole:      item.minRole as any,
                displayOrder: item.sortOrder,
                isActive:     item.enabled,
              },
            });
          }
        }
      }
    });

    return successResponse({ message: '메뉴 설정이 저장되었습니다.' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : '알 수 없는 오류';
    console.error('Menu save error:', msg);
    if (msg.includes('사용 중') || msg.includes('입력하세요')) {
      return validationErrorResponse({ code: msg });
    }
    return serverErrorResponse({ message: `메뉴 저장 실패: ${msg}` });
  }
}
