/**
 * /api/admin/menus - 메뉴 관리 API (super_admin 전용)
 *
 * POST (bulk)   : { groups: [...] }                        — 활성/비활성, 역할, 순서 일괄 저장
 * POST (action) : { action: 'create_group', ... }          — 그룹 생성
 *                 { action: 'delete_group', id }           — 그룹 삭제 (하위 항목 포함)
 *                 { action: 'create_item', groupId, ... }  — 항목 생성
 *                 { action: 'delete_item', id }            — 항목 삭제
 *                 { action: 'update_group', id, ... }      — 그룹 이름/아이콘/역할 수정
 *                 { action: 'update_item',  id, ... }      — 항목 이름/경로/아이콘/역할 수정
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

// ── 기존 벌크 저장 스키마 ─────────────────────────────────────────
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
const bulkSaveSchema = z.object({
  groups: z.array(menuGroupUpdateSchema).min(1).max(50),
});

// ── 액션 스키마 ───────────────────────────────────────────────────
const createGroupSchema = z.object({
  action: z.literal('create_group'),
  code: z.string().min(1).max(50).regex(/^[a-z0-9_-]+$/, '소문자, 숫자, _ - 만 허용'),
  name: z.string().min(1).max(100),
  icon: z.string().max(50).default('LayoutGrid'),
  minRole: z.enum(VALID_ROLES).default('viewer'),
  sortOrder: z.number().int().min(0).max(999).default(99),
});
const deleteGroupSchema = z.object({
  action: z.literal('delete_group'),
  id: z.string().min(1),
});
const createItemSchema = z.object({
  action: z.literal('create_item'),
  groupId: z.string().min(1),
  code: z.string().min(1).max(50).regex(/^[a-z0-9_-]+$/, '소문자, 숫자, _ - 만 허용'),
  name: z.string().min(1).max(100),
  path: z.string().max(200).default(''),
  icon: z.string().max(50).default('Circle'),
  minRole: z.enum(VALID_ROLES).default('viewer'),
  sortOrder: z.number().int().min(0).max(999).default(99),
});
const deleteItemSchema = z.object({
  action: z.literal('delete_item'),
  id: z.string().min(1),
});
const updateGroupSchema = z.object({
  action: z.literal('update_group'),
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  icon: z.string().max(50).optional(),
  minRole: z.enum(VALID_ROLES).optional(),
});
const updateItemSchema = z.object({
  action: z.literal('update_item'),
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  path: z.string().max(200).optional(),
  icon: z.string().max(50).optional(),
  minRole: z.enum(VALID_ROLES).optional(),
});

const actionSchema = z.discriminatedUnion('action', [
  createGroupSchema,
  deleteGroupSchema,
  createItemSchema,
  deleteItemSchema,
  updateGroupSchema,
  updateItemSchema,
]);

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!requireRoleOrHigher(auth, 'super_admin')) return forbiddenResponse();

    let body: unknown;
    try { body = await request.json(); } catch {
      return validationErrorResponse({ body: '올바른 JSON 형식이어야 합니다' });
    }

    // ── 액션 분기 ──────────────────────────────────────────────────
    if (body && typeof body === 'object' && 'action' in (body as object)) {
      const parsed = actionSchema.safeParse(body);
      if (!parsed.success) {
        const errors: Record<string, string> = {};
        parsed.error.issues.forEach(i => { errors[i.path.join('.') || 'input'] = i.message; });
        return validationErrorResponse(errors);
      }

      const data = parsed.data;

      switch (data.action) {
        case 'create_group': {
          // code 중복 검사
          const existing = await prisma.menuGroup.findUnique({ where: { code: data.code } });
          if (existing) return validationErrorResponse({ code: '이미 사용 중인 코드입니다' });
          const group = await prisma.menuGroup.create({
            data: {
              code:         data.code,
              name:         data.name,
              icon:         data.icon,
              minRole:      data.minRole as any,
              displayOrder: data.sortOrder,
              isActive:     true,
              isVisible:    true,
            },
          });
          return successResponse({ id: group.id, message: '그룹이 생성되었습니다.' });
        }

        case 'delete_group': {
          const group = await prisma.menuGroup.findUnique({ where: { id: data.id } });
          if (!group) return validationErrorResponse({ id: '존재하지 않는 그룹입니다' });
          await prisma.$transaction([
            prisma.menuItem.deleteMany({ where: { menuGroupId: data.id } }),
            prisma.menuGroup.delete({ where: { id: data.id } }),
          ]);
          return successResponse({ message: '그룹과 하위 항목이 삭제되었습니다.' });
        }

        case 'create_item': {
          const group = await prisma.menuGroup.findUnique({ where: { id: data.groupId } });
          if (!group) return validationErrorResponse({ groupId: '존재하지 않는 그룹입니다' });
          const existing = await prisma.menuItem.findUnique({ where: { code: data.code } });
          if (existing) return validationErrorResponse({ code: '이미 사용 중인 코드입니다' });
          const item = await prisma.menuItem.create({
            data: {
              code:         data.code,
              name:         data.name,
              path:         data.path || null,
              icon:         data.icon,
              minRole:      data.minRole as any,
              displayOrder: data.sortOrder,
              menuGroupId:  data.groupId,
              isActive:     true,
              isVisible:    true,
            },
          });
          return successResponse({ id: item.id, message: '메뉴 항목이 생성되었습니다.' });
        }

        case 'delete_item': {
          const item = await prisma.menuItem.findUnique({ where: { id: data.id } });
          if (!item) return validationErrorResponse({ id: '존재하지 않는 항목입니다' });
          await prisma.menuItem.delete({ where: { id: data.id } });
          return successResponse({ message: '메뉴 항목이 삭제되었습니다.' });
        }

        case 'update_group': {
          const update: Record<string, unknown> = { name: data.name };
          if (data.icon !== undefined) update.icon = data.icon;
          if (data.minRole !== undefined) update.minRole = data.minRole;
          await prisma.menuGroup.update({ where: { id: data.id }, data: update as any });
          return successResponse({ message: '그룹이 수정되었습니다.' });
        }

        case 'update_item': {
          const update: Record<string, unknown> = { name: data.name };
          if (data.path !== undefined) update.path = data.path || null;
          if (data.icon !== undefined) update.icon = data.icon;
          if (data.minRole !== undefined) update.minRole = data.minRole;
          await prisma.menuItem.update({ where: { id: data.id }, data: update as any });
          return successResponse({ message: '메뉴 항목이 수정되었습니다.' });
        }
      }
    }

    // ── 기존 벌크 저장 ──────────────────────────────────────────────
    const parsed = bulkSaveSchema.safeParse(body);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      parsed.error.issues.forEach(i => { errors[i.path.join('.') || 'input'] = i.message; });
      return validationErrorResponse(errors);
    }

    const { groups } = parsed.data;
    await prisma.$transaction(async (tx) => {
      for (const group of groups) {
        await tx.menuGroup.updateMany({
          where: { id: group.id },
          data: { displayOrder: group.sortOrder, minRole: group.minRole as any },
        });
        for (const item of group.items) {
          await tx.menuItem.updateMany({
            where: { id: item.id },
            data: {
              displayOrder: item.sortOrder,
              minRole:      item.minRole as any,
              isActive:     item.enabled,
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
