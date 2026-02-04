/**
 * 메뉴 시드 데이터
 *
 * 기본 메뉴 구조를 DB에 삽입합니다.
 */

import { PrismaClient, UserRole, BadgeType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting menu seed...');

  // 기존 메뉴 삭제 (개발 환경에서만)
  if (process.env.NODE_ENV === 'development') {
    await prisma.menuItem.deleteMany();
    await prisma.menuGroup.deleteMany();
    console.log('✅ Cleared existing menus');
  }

  // 메뉴 그룹 및 아이템 생성
  const menuData = [
    {
      code: 'dashboard',
      name: '대시보드',
      icon: 'LayoutDashboard',
      displayOrder: 1,
      minRole: 'viewer' as UserRole,
      items: [
        {
          code: 'dashboard_overview',
          name: '개요',
          icon: 'LayoutDashboard',
          path: '/dashboard',
          displayOrder: 1,
          minRole: 'viewer' as UserRole,
        },
        {
          code: 'dashboard_realtime',
          name: '실시간 모니터링',
          icon: 'Activity',
          path: '/dashboard/realtime',
          displayOrder: 2,
          minRole: 'viewer' as UserRole,
        },
        {
          code: 'dashboard_digital_twin',
          name: '디지털 트윈',
          icon: 'Boxes',
          path: '/digital-twin',
          displayOrder: 3,
          minRole: 'viewer' as UserRole,
        },
      ],
    },
    {
      code: 'monitoring',
      name: '모니터링',
      icon: 'Activity',
      displayOrder: 2,
      minRole: 'viewer' as UserRole,
      items: [
        {
          code: 'monitoring_sites',
          name: '사이트 조회',
          icon: 'Building2',
          path: '/sites',
          displayOrder: 1,
          minRole: 'viewer' as UserRole,
        },
        {
          code: 'monitoring_equipment',
          name: '설비 모니터링',
          icon: 'Sliders',
          path: '/equipment',
          displayOrder: 2,
          minRole: 'viewer' as UserRole,
        },
      ],
    },
    {
      code: 'control',
      name: '제어',
      icon: 'Zap',
      displayOrder: 3,
      minRole: 'operator' as UserRole,
      items: [
        {
          code: 'control_manual',
          name: '수동 제어',
          icon: 'Sliders',
          path: '/control/manual',
          displayOrder: 1,
          minRole: 'operator' as UserRole,
        },
        {
          code: 'control_dr',
          name: 'DR 참여',
          icon: 'Zap',
          path: '/control/dr',
          displayOrder: 2,
          minRole: 'tenant_admin' as UserRole,
        },
      ],
    },
    {
      code: 'analytics',
      name: '분석 & 리포트',
      icon: 'BarChart3',
      displayOrder: 4,
      minRole: 'viewer' as UserRole,
      items: [
        {
          code: 'analytics_energy',
          name: '에너지 분석',
          icon: 'BarChart3',
          path: '/analytics',
          displayOrder: 1,
          minRole: 'viewer' as UserRole,
        },
        {
          code: 'analytics_forecast',
          name: 'AI 예측',
          icon: 'Leaf',
          path: '/ai-forecast',
          displayOrder: 2,
          minRole: 'viewer' as UserRole,
        },
        {
          code: 'analytics_reports',
          name: '리포트',
          icon: 'Shield',
          path: '/reports',
          displayOrder: 3,
          minRole: 'viewer' as UserRole,
        },
      ],
    },
    {
      code: 'management',
      name: '관리',
      icon: 'Settings',
      displayOrder: 5,
      minRole: 'site_manager' as UserRole,
      items: [
        {
          code: 'management_sites',
          name: '사이트 관리',
          icon: 'Building2',
          path: '/admin/sites',
          displayOrder: 1,
          minRole: 'site_manager' as UserRole,
        },
        {
          code: 'management_users',
          name: '사용자 관리',
          icon: 'Users',
          path: '/settings/users',
          displayOrder: 2,
          minRole: 'tenant_admin' as UserRole,
        },
        {
          code: 'management_subscription',
          name: '구독 관리',
          icon: 'CreditCard',
          path: '/settings/subscription',
          displayOrder: 3,
          minRole: 'tenant_admin' as UserRole,
        },
      ],
    },
    {
      code: 'settings',
      name: '설정',
      icon: 'Settings',
      displayOrder: 6,
      minRole: 'viewer' as UserRole,
      items: [
        {
          code: 'settings_account',
          name: '계정 설정',
          icon: 'User',
          path: '/settings/account',
          displayOrder: 1,
          minRole: 'viewer' as UserRole,
        },
        {
          code: 'settings_notifications',
          name: '알림 설정',
          icon: 'Bell',
          path: '/settings/notifications',
          displayOrder: 2,
          minRole: 'viewer' as UserRole,
        },
        {
          code: 'settings_manual',
          name: '매뉴얼',
          icon: 'FileText',
          path: '/manual',
          displayOrder: 3,
          minRole: 'viewer' as UserRole,
        },
      ],
    },
  ];

  // 메뉴 그룹 및 아이템 삽입
  for (const groupData of menuData) {
    const { items, ...groupInfo } = groupData;

    const menuGroup = await prisma.menuGroup.create({
      data: {
        ...groupInfo,
        isActive: true,
        isVisible: true,
      },
    });

    console.log(`✅ Created menu group: ${menuGroup.name}`);

    // 메뉴 아이템 생성
    for (const itemData of items) {
      await prisma.menuItem.create({
        data: {
          ...itemData,
          menuGroupId: menuGroup.id,
          isActive: true,
          isVisible: true,
          badgeType: 'none' as BadgeType,
        },
      });
    }

    console.log(`   ✅ Created ${items.length} menu items`);
  }

  console.log('🎉 Menu seed completed!');
}

main()
  .catch((e) => {
    console.error('❌ Menu seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
