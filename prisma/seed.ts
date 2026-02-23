import { PrismaClient, UserRole, BadgeType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // ========================================
  // 1. 메뉴 그룹 생성
  // ========================================

  const menuGroups = [
    {
      code: 'dashboard',
      name: '대시보드',
      icon: 'LayoutDashboard',
      displayOrder: 1,
      minRole: 'viewer' as UserRole,
    },
    {
      code: 'monitoring',
      name: '모니터링',
      icon: 'Activity',
      displayOrder: 2,
      minRole: 'viewer' as UserRole,
    },
    {
      code: 'analytics',
      name: '분석 & 예측',
      icon: 'BarChart3',
      displayOrder: 3,
      minRole: 'viewer' as UserRole,
    },
    {
      code: 'control',
      name: '설비 제어',
      icon: 'Zap',
      displayOrder: 5,
      minRole: 'operator' as UserRole,
    },
    {
      code: 'compliance',
      name: '규제/컴플라이언스',
      icon: 'Shield',
      displayOrder: 55,
      minRole: 'site_manager' as UserRole,
    },
    {
      code: 'alerts',
      name: '알람 & 알림',
      icon: 'Bell',
      displayOrder: 60,
      minRole: 'operator' as UserRole,
    },
    {
      code: 'management',
      name: '관리',
      icon: 'Settings',
      displayOrder: 5,
      minRole: 'site_manager' as UserRole,
    },
    {
      code: 'settings',
      name: '설정',
      icon: 'Settings',
      displayOrder: 9,
      minRole: 'viewer' as UserRole,
    },
    {
      code: 'admin',
      name: 'Super Admin',
      icon: 'Shield',
      displayOrder: 70,
      minRole: 'super_admin' as UserRole,
      subscriptionRequired: false,
    },
  ];

  console.log('Creating menu groups...');
  const createdGroups = await Promise.all(
    menuGroups.map((group) =>
      prisma.menuGroup.upsert({
        where: { code: group.code },
        update: group,
        create: group,
      })
    )
  );

  // ========================================
  // 2. 메뉴 아이템 생성
  // ========================================

  const menuItems = [
    // ---- 대시보드 ----
    {
      code: 'dashboard_overview',
      name: '개요',
      icon: 'LayoutDashboard',
      path: '/dashboard',
      menuGroupCode: 'dashboard',
      displayOrder: 1,
      minRole: 'viewer' as UserRole,
    },
    {
      code: 'dashboard_realtime',
      name: '실시간 현황',
      icon: 'Activity',
      path: '/dashboard/realtime',
      menuGroupCode: 'dashboard',
      displayOrder: 2,
      minRole: 'viewer' as UserRole,
      badgeType: 'new' as const,
    },
    {
      code: 'dashboard_viewer',
      name: '뷰어 대시보드',
      icon: 'Eye',
      path: '/dashboard/viewer',
      menuGroupCode: 'dashboard',
      displayOrder: 3,
      minRole: 'viewer' as UserRole,
    },
    {
      code: 'dashboard_digital_twin',
      name: '디지털 트윈',
      icon: 'Boxes',
      path: '/digital-twin',
      menuGroupCode: 'dashboard',
      displayOrder: 4,
      minRole: 'viewer' as UserRole,
    },

    // ---- 모니터링 ----
    {
      code: 'monitoring_overview',
      name: '종합 모니터링',
      icon: 'Monitor',
      path: '/monitoring',
      menuGroupCode: 'monitoring',
      displayOrder: 1,
      minRole: 'viewer' as UserRole,
    },
    {
      code: 'monitoring_equipment',
      name: '설비 모니터링',
      icon: 'Sliders',
      path: '/devices',
      menuGroupCode: 'monitoring',
      displayOrder: 2,
      minRole: 'viewer' as UserRole,
    },
    {
      code: 'monitoring_pipeline',
      name: '데이터 수집 상태',
      icon: 'Database',
      path: '/monitoring/pipeline',
      menuGroupCode: 'monitoring',
      displayOrder: 3,
      minRole: 'site_manager' as UserRole,
      badgeType: 'new' as const,
    },

    // ---- 분석 & 예측 ----
    {
      code: 'analytics_energy',
      name: '에너지 분석',
      icon: 'BarChart3',
      path: '/analytics/energy',
      menuGroupCode: 'analytics',
      displayOrder: 1,
      minRole: 'viewer' as UserRole,
    },
    {
      code: 'analytics_cost',
      name: '비용 분석',
      icon: 'DollarSign',
      path: '/analytics/cost',
      menuGroupCode: 'analytics',
      displayOrder: 2,
      minRole: 'viewer' as UserRole,
    },
    {
      code: 'analytics_carbon',
      name: '탄소 분석',
      icon: 'Leaf',
      path: '/analytics/carbon',
      menuGroupCode: 'analytics',
      displayOrder: 3,
      minRole: 'viewer' as UserRole,
    },
    {
      code: 'analytics_anomaly',
      name: '이상 탐지',
      icon: 'AlertTriangle',
      path: '/analytics/anomaly',
      menuGroupCode: 'analytics',
      displayOrder: 4,
      minRole: 'viewer' as UserRole,
    },
    {
      code: 'analytics_forecast',
      name: 'AI 예측',
      icon: 'TrendingUp',
      path: '/analytics/forecast',
      menuGroupCode: 'analytics',
      displayOrder: 5,
      minRole: 'viewer' as UserRole,
    },
    {
      code: 'analytics_simulator',
      name: '절감 시뮬레이터',
      icon: 'Calculator',
      path: '/analytics/simulator',
      menuGroupCode: 'analytics',
      displayOrder: 6,
      minRole: 'viewer' as UserRole,
      badgeType: 'new' as const,
    },
    {
      code: 'analytics_templates',
      name: '분석 템플릿',
      icon: 'FileBarChart',
      path: '/analytics/templates',
      menuGroupCode: 'analytics',
      displayOrder: 7,
      minRole: 'viewer' as UserRole,
    },
    {
      code: 'analytics_reports',
      name: '리포트',
      icon: 'FileText',
      path: '/reports',
      menuGroupCode: 'analytics',
      displayOrder: 8,
      minRole: 'viewer' as UserRole,
    },
    {
      code: 'analytics_raw_data',
      name: '원시 데이터 탐색',
      icon: 'Table2',
      path: '/analytics/raw-data',
      menuGroupCode: 'analytics',
      displayOrder: 9,
      minRole: 'site_manager' as UserRole,
    },
    {
      code: 'analytics_download',
      name: '데이터 다운로드',
      icon: 'Download',
      path: '/analytics/download',
      menuGroupCode: 'analytics',
      displayOrder: 10,
      minRole: 'operator' as UserRole,
    },
    {
      code: 'analytics_carbon_trading',
      name: '배출권 거래소',
      icon: 'TrendingUp',
      path: '/analytics/carbon/trading',
      menuGroupCode: 'analytics',
      displayOrder: 11,
      minRole: 'viewer' as UserRole,
      badgeType: 'new' as BadgeType,
    },
    {
      code: 'analytics_carbon_roadmap',
      name: '탄소중립 로드맵',
      icon: 'Target',
      path: '/analytics/carbon/roadmap',
      menuGroupCode: 'analytics',
      displayOrder: 12,
      minRole: 'viewer' as UserRole,
    },

    // ---- 설비 제어 ----
    {
      code: 'control_manual',
      name: '수동 제어',
      icon: 'Sliders',
      path: '/control/manual',
      menuGroupCode: 'control',
      displayOrder: 1,
      minRole: 'operator' as UserRole,
    },
    {
      code: 'control_schedule',
      name: '스케줄 제어',
      icon: 'Calendar',
      path: '/control/schedule',
      menuGroupCode: 'control',
      displayOrder: 2,
      minRole: 'operator' as UserRole,
    },
    {
      code: 'control_optimization',
      name: 'AI 최적 제어',
      icon: 'Brain',
      path: '/control/optimization',
      menuGroupCode: 'control',
      displayOrder: 3,
      minRole: 'site_manager' as UserRole,
      badgeType: 'new' as const,
    },
    {
      code: 'control_dr',
      name: 'DR 참여',
      icon: 'Zap',
      path: '/control/dr',
      menuGroupCode: 'control',
      displayOrder: 4,
      minRole: 'operator' as UserRole,
    },

    // ---- 규제/컴플라이언스 ----
    {
      code: 'compliance_audit',
      name: '감사 추적',
      icon: 'FileText',
      path: '/compliance/audit-trail',
      menuGroupCode: 'compliance',
      displayOrder: 1,
      minRole: 'site_manager' as UserRole,
    },
    {
      code: 'compliance_emission_factors',
      name: '배출계수 관리',
      icon: 'Leaf',
      path: '/compliance/emission-factors',
      menuGroupCode: 'compliance',
      displayOrder: 2,
      minRole: 'site_manager' as UserRole,
    },
    {
      code: 'compliance_reports',
      name: '규제 리포트',
      icon: 'ClipboardList',
      path: '/compliance/reports',
      menuGroupCode: 'compliance',
      displayOrder: 3,
      minRole: 'site_manager' as UserRole,
    },

    // ---- 알람 & 알림 ----
    {
      code: 'alerts_overview',
      name: '알림 현황',
      icon: 'Bell',
      path: '/alerts',
      menuGroupCode: 'alerts',
      displayOrder: 1,
      minRole: 'operator' as UserRole,
    },
    {
      code: 'alerts_rules',
      name: '알림 규칙',
      icon: 'Settings',
      path: '/alerts/rules',
      menuGroupCode: 'alerts',
      displayOrder: 2,
      minRole: 'operator' as UserRole,
    },

    // ---- 관리 ----
    {
      code: 'management_sites',
      name: '사이트 관리',
      icon: 'Building2',
      path: '/sites',
      menuGroupCode: 'management',
      displayOrder: 1,
      minRole: 'viewer' as UserRole,
    },
    {
      code: 'management_users',
      name: '사용자 관리',
      icon: 'Users',
      path: '/admin/users',
      menuGroupCode: 'management',
      displayOrder: 2,
      minRole: 'tenant_admin' as UserRole,
    },
    {
      code: 'management_subscription',
      name: '구독 관리',
      icon: 'CreditCard',
      path: '/settings/subscription',
      menuGroupCode: 'management',
      displayOrder: 3,
      minRole: 'tenant_admin' as UserRole,
    },
    {
      code: 'management_asset',
      name: '디바이스 관리',
      icon: 'Radio',
      path: '/sensors',
      menuGroupCode: 'management',
      displayOrder: 4,
      minRole: 'operator' as UserRole,
    },

    // ---- 설정 ----
    {
      code: 'settings_account',
      name: '계정 설정',
      icon: 'User',
      path: '/settings/account',
      menuGroupCode: 'settings',
      displayOrder: 1,
      minRole: 'viewer' as UserRole,
      isVisible: false,
    },
    {
      code: 'settings_notifications',
      name: '알림 설정',
      icon: 'Bell',
      path: '/settings/notifications',
      menuGroupCode: 'settings',
      displayOrder: 2,
      minRole: 'viewer' as UserRole,
    },
    {
      code: 'settings_api',
      name: 'API 키 관리',
      icon: 'Key',
      path: '/settings/api',
      menuGroupCode: 'settings',
      displayOrder: 3,
      minRole: 'tenant_admin' as UserRole,
    },
    {
      code: 'settings_system',
      name: '시스템 설정',
      icon: 'Settings',
      path: '/settings/system',
      menuGroupCode: 'settings',
      displayOrder: 5,
      minRole: 'viewer' as UserRole,
    },
    {
      code: 'settings_manual',
      name: '매뉴얼',
      icon: 'FileText',
      path: '/manual',
      menuGroupCode: 'settings',
      displayOrder: 6,
      minRole: 'viewer' as UserRole,
    },

    // ---- Super Admin ----
    {
      code: 'admin_tenants',
      name: '테넌트 관리',
      icon: 'Building2',
      path: '/admin/tenants',
      menuGroupCode: 'admin',
      displayOrder: 1,
      minRole: 'super_admin' as UserRole,
    },
    {
      code: 'admin_menu',
      name: '메뉴 관리',
      icon: 'LayoutGrid',
      path: '/admin/menu',
      menuGroupCode: 'admin',
      displayOrder: 2,
      minRole: 'super_admin' as UserRole,
    },
  ];

  console.log('Creating menu items...');

  for (const item of menuItems) {
    const { menuGroupCode, ...itemData } = item;

    const menuGroup = createdGroups.find((g) => g.code === menuGroupCode);

    await prisma.menuItem.upsert({
      where: { code: item.code },
      update: {
        ...itemData,
        menuGroupId: menuGroup?.id,
      } as any,
      create: {
        ...itemData,
        menuGroupId: menuGroup?.id,
      } as any,
    });
  }

  console.log('Seed completed successfully');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
