import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, SubscriptionStatus } from '@prisma/client';

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
  children?: MenuItemWithChildren[];
  metadata?: any;
}

@Injectable()
export class MenuService {
  constructor(private prisma: PrismaService) {}

  /**
   * 사용자 역할 및 구독 상태에 따른 메뉴 조회
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

    // 2. 역할 순위 정의
    const roleHierarchy: Record<UserRole, number> = {
      super_admin: 5,
      tenant_admin: 4,
      site_manager: 3,
      operator: 2,
      viewer: 1,
    };

    const userRoleLevel = roleHierarchy[user.role];

    // 3. 메뉴 그룹 조회
    const menuGroups = await this.prisma.menuGroup.findMany({
      where: {
        isActive: true,
        isVisible: true,
      },
      orderBy: { displayOrder: 'asc' },
    });

    // 4. 메뉴 아이템 조회
    const allMenuItems = await this.prisma.menuItem.findMany({
      where: {
        isActive: true,
        isVisible: true,
      },
      orderBy: { displayOrder: 'asc' },
    });

    // 5. 필터링 로직
    const filteredMenuItems = allMenuItems.filter((item) => {
      // 역할 체크
      const itemRoleLevel = roleHierarchy[item.minRole];
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
    const menuStructure = this.buildMenuHierarchy(menuGroups, filteredMenuItems);

    return menuStructure;
  }

  /**
   * 메뉴 계층 구조 빌드
   */
  private buildMenuHierarchy(groups: any[], items: any[]): MenuStructure[] {
    return groups
      .map((group) => {
        // 해당 그룹의 최상위 메뉴만
        const groupItems = items.filter(
          (item) => item.menuGroupId === group.id && !item.parentId
        );

        return {
          id: group.id,
          code: group.code,
          name: group.name,
          icon: group.icon,
          displayOrder: group.displayOrder,
          items: groupItems.map((item) => this.buildMenuItem(item, items)),
        };
      })
      .filter((group) => group.items.length > 0);
  }

  /**
   * 메뉴 아이템 빌드 (재귀)
   */
  private buildMenuItem(item: any, allItems: any[]): MenuItemWithChildren {
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
      children: children.length > 0 
        ? children.map((child) => this.buildMenuItem(child, allItems))
        : undefined,
      metadata: item.metadata,
    };
  }

  /**
   * 즐겨찾기 추가
   */
  async addFavorite(userId: string, menuItemId: string) {
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
    return this.prisma.userMenuFavorite.deleteMany({
      where: {
        userId,
        menuItemId,
      },
    });
  }

  /**
   * 즐겨찾기 목록 조회
   */
  async getFavorites(userId: string) {
    const favorites = await this.prisma.userMenuFavorite.findMany({
      where: { userId },
      include: {
        menuItem: true,
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
    sessionId: string,
    ipAddress: string,
    userAgent: string
  ) {
    return this.prisma.menuAccessLog.create({
      data: {
        userId,
        menuItemId,
        tenantId,
        sessionId,
        ipAddress,
        userAgent,
      },
    });
  }

  /**
   * 인기 메뉴 통계 (관리자용)
   */
  async getPopularMenus(
    tenantId?: string,
    startDate?: Date,
    endDate?: Date
  ) {
    const where: any = {};
    
    if (tenantId) where.tenantId = tenantId;
    if (startDate) where.accessedAt = { gte: startDate };
    if (endDate) where.accessedAt = { ...where.accessedAt, lte: endDate };

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
      take: 20,
    });

    const menuIds = logs.map((log) => log.menuItemId);
    const menuItems = await this.prisma.menuItem.findMany({
      where: {
        id: { in: menuIds },
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
}