/**
 * 메뉴 조회 API - 역할별 필터링
 *
 * 사용자의 역할에 따라 접근 가능한 메뉴만 반환
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { hasRoleOrHigher } from '@/lib/constants/roles';
import { UserRole } from '@prisma/client';

export async function GET() {
  try {
    // NextAuth 세션 검증
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;

    // 메뉴 그룹과 아이템 조회 (역할별 필터링)
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

    // 역할별 필터링
    const filteredGroups = menuGroups
      .filter((group) => hasRoleOrHigher(userRole, group.minRole))
      .map((group) => ({
        id: group.id,
        code: group.code,
        name: group.name,
        icon: group.icon,
        displayOrder: group.displayOrder,
        minRole: group.minRole,
        items: group.menuItems
          .filter((item) => hasRoleOrHigher(userRole, item.minRole))
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

    return NextResponse.json({
      success: true,
      data: filteredGroups,
    });
  } catch (error) {
    console.error('[API] Menu fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
