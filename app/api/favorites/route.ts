/**
 * /api/favorites
 *
 * 사용자별 메뉴 즐겨찾기 관리 (UserMenuFavorite)
 *
 * GET    → 내 즐겨찾기 목록 (displayOrder 순)
 * POST   → 즐겨찾기 추가 또는 순서 재정렬
 * DELETE ?menuItemId= → 즐겨찾기 제거
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from '@/lib/api/response';

export const dynamic = 'force-dynamic';

const MAX_FAVORITES = 12;

// ──────────────────────────────────────────────────────────────
// GET — 즐겨찾기 목록
// ──────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return unauthorizedResponse();

    const favorites = await prisma.userMenuFavorite.findMany({
      where: { userId: session.user.id },
      include: {
        menuItem: {
          select: {
            id: true,
            code: true,
            name: true,
            icon: true,
            path: true,
          },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });

    return successResponse({
      favorites: favorites.map((f) => ({
        id: f.id,
        menuItemId: f.menuItemId,
        displayOrder: f.displayOrder,
        menuItem: f.menuItem,
      })),
    });
  } catch (error) {
    console.error('[API] 즐겨찾기 조회 오류:', error);
    return serverErrorResponse();
  }
}

// ──────────────────────────────────────────────────────────────
// POST — 즐겨찾기 추가 / 순서 재정렬
// ──────────────────────────────────────────────────────────────

const addSchema = z.object({
  menuItemId: z.string().min(1),
});

const reorderSchema = z.object({
  order: z.array(z.object({ menuItemId: z.string(), displayOrder: z.number().int().min(0) })),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return unauthorizedResponse();

    const body = await request.json();

    // 순서 재정렬 요청
    if ('order' in body) {
      const parsed = reorderSchema.safeParse(body);
      if (!parsed.success) return errorResponse('VALIDATION_ERROR');

      await prisma.$transaction(
        parsed.data.order.map(({ menuItemId, displayOrder }) =>
          prisma.userMenuFavorite.updateMany({
            where: { userId: session.user!.id!, menuItemId },
            data: { displayOrder },
          })
        )
      );
      return successResponse({ reordered: true });
    }

    // 즐겨찾기 추가
    const parsed = addSchema.safeParse(body);
    if (!parsed.success) return errorResponse('VALIDATION_ERROR');

    // 최대 개수 확인
    const count = await prisma.userMenuFavorite.count({
      where: { userId: session.user.id },
    });
    if (count >= MAX_FAVORITES) {
      return errorResponse('VALIDATION_OUT_OF_RANGE', {
        details: { message: `즐겨찾기는 최대 ${MAX_FAVORITES}개까지 등록할 수 있습니다.` },
      });
    }

    // menuItem 존재 확인
    const menuItem = await prisma.menuItem.findUnique({
      where: { id: parsed.data.menuItemId },
      select: { id: true, code: true, name: true, icon: true, path: true },
    });
    if (!menuItem) return errorResponse('RESOURCE_NOT_FOUND');

    const favorite = await prisma.userMenuFavorite.upsert({
      where: {
        userId_menuItemId: {
          userId: session.user.id,
          menuItemId: parsed.data.menuItemId,
        },
      },
      create: {
        userId: session.user.id,
        menuItemId: parsed.data.menuItemId,
        displayOrder: count,
      },
      update: {},
    });

    return successResponse({ favorite: { ...favorite, menuItem } }, { status: 201 });
  } catch (error) {
    console.error('[API] 즐겨찾기 추가 오류:', error);
    return serverErrorResponse();
  }
}

// ──────────────────────────────────────────────────────────────
// DELETE — 즐겨찾기 제거
// ──────────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const menuItemId = searchParams.get('menuItemId');
    if (!menuItemId) return errorResponse('VALIDATION_REQUIRED_FIELD');

    await prisma.userMenuFavorite.deleteMany({
      where: { userId: session.user.id, menuItemId },
    });

    // displayOrder 재정렬
    const remaining = await prisma.userMenuFavorite.findMany({
      where: { userId: session.user.id },
      orderBy: { displayOrder: 'asc' },
    });
    await prisma.$transaction(
      remaining.map((f, idx) =>
        prisma.userMenuFavorite.update({
          where: { id: f.id },
          data: { displayOrder: idx },
        })
      )
    );

    return successResponse({ deleted: menuItemId });
  } catch (error) {
    console.error('[API] 즐겨찾기 삭제 오류:', error);
    return serverErrorResponse();
  }
}
