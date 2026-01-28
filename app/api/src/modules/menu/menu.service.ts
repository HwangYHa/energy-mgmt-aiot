// app/api/src/modules/menu/menu.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole, SubscriptionStatus } from '@prisma/client';

/**
 * 🔐 메뉴 서비스 (통합판)
 * 
 * 핵심 기능:
 * - 역할별 메뉴 필터링 (계층 구조)
 * - 구독 상태별 기능 제한
 * - 즐겨찾기 관리
 * - 메뉴 접근 로그
 * - 인기 메뉴 통계
 */

interface MenuStructure {
  id: string;
  code: string;
  name: string;
  icon?: string;
  displayOrder: number;
  items: MenuItemWithChildren[];
}

interface MenuItemWithChildren {
  id: string;
  code: string;
  name: string;
  icon?: string;
  path?: string;
  externalUrl?: string;
  badgeType?: string;
  badgeColor?: string;
  isFavorite?: boolean;
  children?: MenuItemWithChildren[];
  metadata?: any;
}

@Injectable()
export class MenuService {
  // 역할 계층 레벨
  private readonly roleHierarchy: Record<UserRole, number> = {
    super_admin: 5,
    tenant_admin: 4,
    site_manager: 3,
    operator: 2,
    viewer: 1,
  };

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 사용자별 메뉴 조회 (계층 구조)
   */
  async getMenuForUser(userId: string): Promise<MenuStructure[]> {
    // 1. 사용자 정보 조회
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: {
          include: {
            subscriptions: {
              where: {
                status: {
                  in: [
                    SubscriptionStatus.ACTIVE,
                    SubscriptionStatus.EXPIRE_SOON,
                    SubscriptionStatus.EXPIRED,
                  ],
                },
              },
              orderBy: { endDate: 'desc' },
              take: 1,
              include: {
                plan: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const currentSubscription = user.tenant.subscriptions[0];
    const planFeatures = (currentSubscription?.plan?.features as any) || {};
    const subscriptionStatus = currentSubscription?.status || SubscriptionStatus.EXPIRED;
    const userRoleLevel = this.roleHierarchy[user.role];

    // 2. 메뉴 그룹 조회
    const menuGroups = await this.prisma.menuGroup.findMany({
      where: {
        isActive: true,
        isVisible: true,
      },
      orderBy: { displayOrder: 'asc' },
    });

    // 3. 모든 메뉴 아이템 조회
    const allMenuItems = await this.prisma.menuItem.findMany({
      where: {
        isActive: true,
        isVisible: true,
      },
      orderBy: { displayOrder: 'asc' },
    });

    // 4. 즐겨찾기 조회
    const favorites = await this.prisma.userMenuFavorite.findMany({
      where: { userId },
      select: { menuItemId: true },
    });
    const favoriteIds = new Set(favorites.map(f => f.menuItemId));

    // 5. 필터링
    const filteredMenuItems = allMenuItems.filter((item) => {
      // 역할 체크
      const itemRoleLevel = this.roleHierarchy[item.minRole];
      if (userRoleLevel < itemRoleLevel) {
        return false;
      }

      // 구독 상태 체크
      if (item.subscriptionRequired) {
        if (!currentSubscription) {
          return false;
        }

        if (item.minSubscriptionStatus) {
          const requiredStatuses = [
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.EXPIRE_SOON,
          ];
          if (!requiredStatuses.includes(subscriptionStatus)) {
            return false;
          }
        }
      }

      // 기능 체크
      if (item.featureRequired) {
        if (!planFeatures[item.featureRequired]) {
          return false;
        }
      }

      return true;
    });

    // 6. 계층 구조 생성
    const menuStructure = this.buildMenuHierarchy(
      menuGroups,
      filteredMenuItems,
      favoriteIds,
    );

    return menuStructure;
  }

  /**
   * 메뉴 계층 구조 빌드
   */
  private buildMenuHierarchy(
    groups: any[],
    items: any[],
    favoriteIds: Set<string>,
  ): MenuStructure[] {
    return groups
      .map((group) => {
        // 해당 그룹의 최상위 메뉴만 (parentId가 없는 것)
        const groupItems = items.filter(
          (item) => item.menuGroupId === group.id && !item.parentId
        );

        return {
          id: group.id,
          code: group.code,
          name: group.name,
          icon: group.icon,
          displayOrder: group.displayOrder,
          items: groupItems.map((item) =>
            this.buildMenuItem(item, items, favoriteIds)
          ),
        };
      })
      .filter((group) => group.items.length > 0);
  }

  /**
   * 메뉴 아이템 빌드 (재귀 - 하위 메뉴 포함)
   */
  private buildMenuItem(
    item: any,
    allItems: any[],
    favoriteIds: Set<string>,
  ): MenuItemWithChildren {
    const children = allItems.filter((child) => child.parentId === item.id);

    return {
      id: item.id,
      code: item.code,
      name: item.name,
      icon: item.icon,
      path: item.path,
      externalUrl: item.externalUrl,
      badgeType: item.badgeType,
      badgeColor: item.badgeColor,
      isFavorite: favoriteIds.has(item.id),
      children:
        children.length > 0
          ? children.map((child) => this.buildMenuItem(child, allItems, favoriteIds))
          : undefined,
      metadata: item.metadata,
    };
  }

  /**
   * 역할 레벨에 해당하는 모든 역할 반환
   */
  private getRolesForLevel(level: number): UserRole[] {
    return Object.entries(this.roleHierarchy)
      .filter(([_, roleLevel]) => roleLevel <= level)
      .map(([role]) => role as UserRole);
  }

  /**
   * 즐겨찾기 추가
   */
  async addFavorite(userId: string, menuItemId: string) {
    // 메뉴 아이템 존재 확인
    const menuItem = await this.prisma.menuItem.findUnique({
      where: { id: menuItemId },
    });

    if (!menuItem) {
      throw new NotFoundException('Menu item not found');
    }

    // 중복 확인
    const existing = await this.prisma.userMenuFavorite.findFirst({
      where: { userId, menuItemId },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.userMenuFavorite.create({
      data: {
        userId,
        menuItemId,
      },
    });
  }

  /**
   * 즐겨찾기 제거
   */
  async removeFavorite(userId: string, menuItemId: string) {
    await this.prisma.userMenuFavorite.deleteMany({
      where: {
        userId,
        menuItemId,
      },
    });

    return { message: 'Favorite removed' };
  }

  /**
   * 즐겨찾기 목록 조회
   */
  async getFavorites(userId: string) {
    const favorites = await this.prisma.userMenuFavorite.findMany({
      where: { userId },
      include: {
        menuItem: {
          include: {
            menuGroup: {
              select: {
                code: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });

    return favorites.map((fav) => fav.menuItem);
  }

  /**
   * 메뉴 접근 로깅
   */
  async logAccess(
    userId: string,
    menuItemId: string,
    tenantId: string,
    sessionId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.prisma.menuAccessLog.create({
      data: {
        userId,
        menuItemId,
        tenantId,
        sessionId,
        ipAddress,
        userAgent,
        action: 'view',
      },
    });
  }

  /**
   * 인기 메뉴 통계 (관리자용)
   */
  async getPopularMenus(
    tenantId?: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 20,
  ) {
    const where: any = {};

    if (tenantId) where.tenantId = tenantId;
    if (startDate || endDate) {
      where.accessedAt = {};
      if (startDate) where.accessedAt.gte = startDate;
      if (endDate) where.accessedAt.lte = endDate;
    }

    const logs = await this.prisma.menuAccessLog.groupBy({
      by: ['menuItemId'],
      where,
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: limit,
    });

    const menuIds = logs.map((log) => log.menuItemId);
    const menuItems = await this.prisma.menuItem.findMany({
      where: {
        id: { in: menuIds },
      },
      include: {
        menuGroup: {
          select: {
            name: true,
          },
        },
      },
    });

    return logs.map((log) => {
      const menuItem = menuItems.find((item) => item.id === log.menuItemId);
      return {
        menuItem,
        accessCount: log._count.id,
      };
    });
  }

  /**
   * 메뉴 접근 통계 (기간별)
   */
  async getMenuStats(tenantId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.getPopularMenus(tenantId, startDate, new Date(), 10);
  }
}