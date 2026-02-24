/**
 * 라이브 DB에 누락된 메뉴 항목 추가 스크립트
 * 실행: npx tsx lib/db/add-missing-menus.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking for missing menu items...');

  // 기존 그룹 조회
  const groups = await prisma.menuGroup.findMany();
  const groupMap = new Map(groups.map((g) => [g.code, g.id]));

  // alerts 그룹이 없으면 생성
  if (!groupMap.has('alerts')) {
    const alertsGroup = await prisma.menuGroup.create({
      data: {
        code: 'alerts',
        name: '알람 & 알림',
        icon: 'Bell',
        displayOrder: 60,
        minRole: 'operator',
      },
    });
    groupMap.set('alerts', alertsGroup.id);
    console.log('Created alerts group');
  }

  // 기존 메뉴 아이템 코드 조회
  const existingItems = await prisma.menuItem.findMany({ select: { code: true } });
  const existingCodes = new Set(existingItems.map((i) => i.code));

  // 추가할 메뉴 아이템들
  const newItems = [
    // 대시보드 그룹
    {
      code: 'dashboard_realtime',
      name: '실시간 현황',
      icon: 'Activity',
      path: '/dashboard/realtime',
      menuGroupId: groupMap.get('dashboard'),
      displayOrder: 2,
      minRole: 'viewer' as const,
      badgeType: 'new' as const,
    },
    {
      code: 'dashboard_viewer',
      name: '뷰어 대시보드',
      icon: 'Eye',
      path: '/dashboard/viewer',
      menuGroupId: groupMap.get('dashboard'),
      displayOrder: 3,
      minRole: 'viewer' as const,
    },

    // 모니터링 그룹
    {
      code: 'monitoring_overview',
      name: '종합 모니터링',
      icon: 'Monitor',
      path: '/monitoring',
      menuGroupId: groupMap.get('monitoring'),
      displayOrder: 1,
      minRole: 'viewer' as const,
    },
    {
      code: 'monitoring_pipeline',
      name: '데이터 수집 상태',
      icon: 'Database',
      path: '/monitoring/pipeline',
      menuGroupId: groupMap.get('monitoring'),
      displayOrder: 5,
      minRole: 'site_manager' as const,
      badgeType: 'new' as const,
    },

    // 분석 그룹
    {
      code: 'analytics_cost',
      name: '비용 분석',
      icon: 'DollarSign',
      path: '/analytics/cost',
      menuGroupId: groupMap.get('analytics'),
      displayOrder: 2,
      minRole: 'viewer' as const,
    },
    {
      code: 'analytics_carbon',
      name: '탄소 분석',
      icon: 'Leaf',
      path: '/analytics/carbon',
      menuGroupId: groupMap.get('analytics'),
      displayOrder: 3,
      minRole: 'viewer' as const,
    },
    {
      code: 'analytics_anomaly',
      name: '이상 탐지',
      icon: 'AlertTriangle',
      path: '/analytics/anomaly',
      menuGroupId: groupMap.get('analytics'),
      displayOrder: 4,
      minRole: 'viewer' as const,
    },
    {
      code: 'analytics_simulator',
      name: '절감 시뮬레이터',
      icon: 'Calculator',
      path: '/analytics/simulator',
      menuGroupId: groupMap.get('analytics'),
      displayOrder: 6,
      minRole: 'viewer' as const,
      badgeType: 'new' as const,
    },
    {
      code: 'analytics_templates',
      name: '분석 템플릿',
      icon: 'FileBarChart',
      path: '/analytics/templates',
      menuGroupId: groupMap.get('analytics'),
      displayOrder: 7,
      minRole: 'viewer' as const,
    },
    {
      code: 'analytics_raw_data',
      name: '원시 데이터 탐색',
      icon: 'Table2',
      path: '/analytics/raw-data',
      menuGroupId: groupMap.get('analytics'),
      displayOrder: 9,
      minRole: 'site_manager' as const,
    },
    {
      code: 'analytics_download',
      name: '데이터 다운로드',
      icon: 'Download',
      path: '/analytics/download',
      menuGroupId: groupMap.get('analytics'),
      displayOrder: 10,
      minRole: 'operator' as const,
    },
    {
      code: 'analytics_carbon_trading',
      name: '배출권 거래소',
      icon: 'TrendingUp',
      path: '/analytics/carbon/trading',
      menuGroupId: groupMap.get('analytics'),
      displayOrder: 11,
      minRole: 'viewer' as const,
      badgeType: 'new' as const,
    },
    {
      code: 'analytics_carbon_roadmap',
      name: '탄소중립 로드맵',
      icon: 'Target',
      path: '/analytics/carbon/roadmap',
      menuGroupId: groupMap.get('analytics'),
      displayOrder: 12,
      minRole: 'viewer' as const,
    },

    // 설비 제어 그룹
    {
      code: 'control_optimization',
      name: 'AI 최적 제어',
      icon: 'Brain',
      path: '/control/optimization',
      menuGroupId: groupMap.get('control'),
      displayOrder: 3,
      minRole: 'site_manager' as const,
      badgeType: 'new' as const,
    },

    // 알람 그룹
    {
      code: 'alerts_overview',
      name: '알림 현황',
      icon: 'Bell',
      path: '/alerts',
      menuGroupId: groupMap.get('alerts'),
      displayOrder: 1,
      minRole: 'operator' as const,
    },
    {
      code: 'alerts_rules',
      name: '알림 규칙',
      icon: 'Settings',
      path: '/alerts/rules',
      menuGroupId: groupMap.get('alerts'),
      displayOrder: 2,
      minRole: 'operator' as const,
    },

    // 설정 그룹
    {
      code: 'settings_api',
      name: 'API 키 관리',
      icon: 'Key',
      path: '/settings/api',
      menuGroupId: groupMap.get('settings'),
      displayOrder: 3,
      minRole: 'tenant_admin' as const,
    },
    {
      code: 'settings_gateways',
      name: '게이트웨이 관리',
      icon: 'Router',
      path: '/settings/gateways',
      menuGroupId: groupMap.get('settings'),
      displayOrder: 4,
      minRole: 'site_manager' as const,
    },
    {
      code: 'settings_system',
      name: '시스템 설정',
      icon: 'Settings',
      path: '/settings/system',
      menuGroupId: groupMap.get('settings'),
      displayOrder: 5,
      minRole: 'tenant_admin' as const,
    },

    // Super Admin 그룹
    {
      code: 'admin_menu',
      name: '메뉴 관리',
      icon: 'LayoutGrid',
      path: '/admin/menu',
      menuGroupId: groupMap.get('admin'),
      displayOrder: 20,
      minRole: 'super_admin' as const,
    },
    {
      code: 'admin_traffic',
      name: '트래픽 관리',
      icon: 'Activity',
      path: '/admin/traffic',
      menuGroupId: groupMap.get('admin'),
      displayOrder: 30,
      minRole: 'tenant_admin' as const,
      badgeType: 'new' as const,
    },
    {
      code: 'admin_support',
      name: '고객 지원 관리',
      icon: 'MessageSquare',
      path: '/admin/support',
      menuGroupId: groupMap.get('admin'),
      displayOrder: 40,
      minRole: 'tenant_admin' as const,
    },

    // Super Admin 그룹 - 파트너 포털
    {
      code: 'admin_partners',
      name: '파트너 포털',
      icon: 'Link2',
      path: '/admin/partners',
      menuGroupId: groupMap.get('admin'),
      displayOrder: 50,
      minRole: 'super_admin' as const,
      badgeType: 'new' as const,
    },

    // 설정 그룹 - 지원
    {
      code: 'settings_support',
      name: '문의 / 피드백',
      icon: 'MessageSquare',
      path: '/settings/support',
      menuGroupId: groupMap.get('settings'),
      displayOrder: 10,
      minRole: 'viewer' as const,
    },
  ];

  let addedCount = 0;
  for (const item of newItems) {
    if (existingCodes.has(item.code)) {
      console.log(`  SKIP: ${item.code} (already exists)`);
      continue;
    }
    if (!item.menuGroupId) {
      console.log(`  SKIP: ${item.code} (group not found)`);
      continue;
    }

    await prisma.menuItem.create({ data: item as any });
    console.log(`  ADD: ${item.code} -> ${item.path}`);
    addedCount++;
  }

  console.log(`\nDone! Added ${addedCount} new menu items.`);
}

main()
  .catch((e) => {
    console.error('Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
