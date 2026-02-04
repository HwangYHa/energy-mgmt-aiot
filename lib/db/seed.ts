import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

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
      name: '실시간 모니터링',
      icon: 'Activity',
      displayOrder: 2,
      minRole: 'viewer' as UserRole,
    },
    {
      code: 'assets',
      name: '자산 관리',
      icon: 'Building2',
      displayOrder: 3,
      minRole: 'operator' as UserRole,
    },
    {
      code: 'control',
      name: '설비 제어',
      icon: 'Sliders',
      displayOrder: 4,
      minRole: 'operator' as UserRole,
    },
    {
      code: 'analytics',
      name: '분석 & 예측',
      icon: 'BarChart3',
      displayOrder: 5,
      minRole: 'viewer' as UserRole,
    },
    {
      code: 'carbon',
      name: '탄소중립',
      icon: 'Leaf',
      displayOrder: 6,
      minRole: 'viewer' as UserRole,
    },
    {
      code: 'compliance',
      name: '규제 & 컴플라이언스',
      icon: 'Shield',
      displayOrder: 7,
      minRole: 'site_manager' as UserRole,
    },
    {
      code: 'alerts',
      name: '알람 & 이벤트',
      icon: 'Bell',
      displayOrder: 8,
      minRole: 'operator' as UserRole,
    },
    {
      code: 'dr',
      name: 'DR 수요반응',
      icon: 'Zap',
      displayOrder: 9,
      minRole: 'operator' as UserRole,
    },
    {
      code: 'settings',
      name: '설정',
      icon: 'Settings',
      displayOrder: 10,
      minRole: 'viewer' as UserRole,
    },
    {
      code: 'admin',
      name: '시스템 관리',
      icon: 'ShieldCheck',
      displayOrder: 11,
      minRole: 'super_admin' as UserRole,
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
    // 📊 대시보드
    {
      code: 'dashboard',
      name: '대시보드',
      icon: 'LayoutDashboard',
      path: '/dashboard',
      menuGroupCode: 'dashboard',
      displayOrder: 1,
      minRole: 'viewer' as UserRole,
    },

    // 📈 실시간 모니터링
    {
      code: 'monitoring-overview',
      name: '통합 모니터링',
      icon: 'Gauge',
      path: '/monitoring',
      menuGroupCode: 'monitoring',
      displayOrder: 1,
      minRole: 'viewer' as UserRole,
    },
    {
      code: 'monitoring-realtime',
      name: '실시간 데이터',
      icon: 'Activity',
      path: '/monitoring/realtime',
      menuGroupCode: 'monitoring',
      displayOrder: 2,
      minRole: 'viewer' as UserRole,
    },
    {
      code: 'monitoring-sites',
      name: '사업장별 현황',
      icon: 'Building',
      path: '/monitoring/sites',
      menuGroupCode: 'monitoring',
      displayOrder: 3,
      minRole: 'viewer' as UserRole,
    },
    {
      code: 'monitoring-devices',
      name: '설비별 현황',
      icon: 'Cpu',
      path: '/monitoring/devices',
      menuGroupCode: 'monitoring',
      displayOrder: 4,
      minRole: 'viewer' as UserRole,
    },
    {
      code: 'monitoring-pipeline',
      name: '데이터 파이프라인',
      icon: 'Database',
      path: '/monitoring/pipeline',
      menuGroupCode: 'monitoring',
      displayOrder: 5,
      minRole: 'site_manager' as UserRole,
      description: '데이터 수집 상태 및 품질 모니터링',
    },

    // 🏭 자산 관리
    {
      code: 'assets-sites',
      name: '사업장 관리',
      icon: 'Building',
      path: '/assets/sites',
      menuGroupCode: 'assets',
      displayOrder: 1,
      minRole: 'operator' as UserRole,
    },
    {
      code: 'assets-devices',
      name: '설비 관리',
      icon: 'Cpu',
      path: '/assets/devices',
      menuGroupCode: 'assets',
      displayOrder: 2,
      minRole: 'operator' as UserRole,
    },
    {
      code: 'assets-gateways',
      name: 'Gateway 관리',
      icon: 'Radio',
      path: '/assets/gateways',
      menuGroupCode: 'assets',
      displayOrder: 3,
      minRole: 'site_manager' as UserRole,
    },
    {
      code: 'assets-groups',
      name: '그룹 관리',
      icon: 'Layers',
      path: '/assets/groups',
      menuGroupCode: 'assets',
      displayOrder: 4,
      minRole: 'operator' as UserRole,
    },

    // 🎮 설비 제어
    {
      code: 'control-manual',
      name: '수동 제어',
      icon: 'Hand',
      path: '/control/manual',
      menuGroupCode: 'control',
      displayOrder: 1,
      minRole: 'operator' as UserRole,
      featureRequired: 'control',
    },
    {
      code: 'control-schedule',
      name: '스케줄 제어',
      icon: 'Calendar',
      path: '/control/schedule',
      menuGroupCode: 'control',
      displayOrder: 2,
      minRole: 'operator' as UserRole,
      featureRequired: 'control',
    },
    {
      code: 'control-automation',
      name: '자동화 규칙',
      icon: 'Workflow',
      path: '/control/automation',
      menuGroupCode: 'control',
      displayOrder: 3,
      minRole: 'site_manager' as UserRole,
      featureRequired: 'control',
    },
    {
      code: 'control-optimization',
      name: 'AI 최적 제어',
      icon: 'Brain',
      path: '/control/optimization',
      menuGroupCode: 'control',
      displayOrder: 4,
      minRole: 'site_manager' as UserRole,
      featureRequired: 'ai_forecast',
      badgeType: 'new',
    },
    {
      code: 'control-history',
      name: '제어 이력',
      icon: 'History',
      path: '/control/history',
      menuGroupCode: 'control',
      displayOrder: 5,
      minRole: 'operator' as UserRole,
    },

    // 📊 분석 & 예측
    {
      code: 'analytics-energy',
      name: '에너지 분석',
      icon: 'Zap',
      path: '/analytics/energy',
      menuGroupCode: 'analytics',
      displayOrder: 1,
      minRole: 'viewer' as UserRole,
    },
    {
      code: 'analytics-cost',
      name: '비용 분석',
      icon: 'DollarSign',
      path: '/analytics/cost',
      menuGroupCode: 'analytics',
      displayOrder: 2,
      minRole: 'viewer' as UserRole,
    },
    {
      code: 'analytics-efficiency',
      name: '효율 분석',
      icon: 'TrendingUp',
      path: '/analytics/efficiency',
      menuGroupCode: 'analytics',
      displayOrder: 3,
      minRole: 'viewer' as UserRole,
    },
    {
      code: 'analytics-forecast',
      name: '부하 예측',
      icon: 'TrendingUp',
      path: '/analytics/forecast',
      menuGroupCode: 'analytics',
      displayOrder: 4,
      minRole: 'operator' as UserRole,
      featureRequired: 'ai_forecast',
    },
    {
      code: 'analytics-anomaly',
      name: '이상 탐지',
      icon: 'AlertTriangle',
      path: '/analytics/anomaly',
      menuGroupCode: 'analytics',
      displayOrder: 5,
      minRole: 'operator' as UserRole,
      featureRequired: 'ai_forecast',
    },
    {
      code: 'analytics-simulator',
      name: '절감 시뮬레이터',
      icon: 'FlaskConical',
      path: '/analytics/simulator',
      menuGroupCode: 'analytics',
      displayOrder: 6,
      minRole: 'operator' as UserRole,
      featureRequired: 'ai_forecast',
    },
    {
      code: 'analytics-templates',
      name: '분석 템플릿',
      icon: 'FileText',
      path: '/analytics/templates',
      menuGroupCode: 'analytics',
      displayOrder: 7,
      minRole: 'viewer' as UserRole,
    },
    {
      code: 'analytics-download',
      name: '데이터 다운로드',
      icon: 'Download',
      path: '/analytics/download',
      menuGroupCode: 'analytics',
      displayOrder: 8,
      minRole: 'viewer' as UserRole,
    },
    {
      code: 'analytics-raw-data',
      name: '원시 데이터 탐색',
      icon: 'Database',
      path: '/analytics/raw-data',
      menuGroupCode: 'analytics',
      displayOrder: 9,
      minRole: 'site_manager' as UserRole,
    },

    // 🌿 탄소중립
    {
      code: 'carbon-overview',
      name: '탄소 배출 현황',
      icon: 'Leaf',
      path: '/carbon',
      menuGroupCode: 'carbon',
      displayOrder: 1,
      minRole: 'viewer' as UserRole,
    },
    {
      code: 'carbon-emissions',
      name: '배출량 계산',
      icon: 'Calculator',
      path: '/carbon/emissions',
      menuGroupCode: 'carbon',
      displayOrder: 2,
      minRole: 'operator' as UserRole,
    },
    {
      code: 'carbon-targets',
      name: '감축 목표',
      icon: 'Target',
      path: '/carbon/targets',
      menuGroupCode: 'carbon',
      displayOrder: 3,
      minRole: 'site_manager' as UserRole,
    },
    {
      code: 'carbon-factors',
      name: '배출계수 관리',
      icon: 'Database',
      path: '/carbon/factors',
      menuGroupCode: 'carbon',
      displayOrder: 4,
      minRole: 'site_manager' as UserRole,
    },
    {
      code: 'carbon-scope',
      name: 'Scope 분석',
      icon: 'Layers',
      path: '/carbon/scope',
      menuGroupCode: 'carbon',
      displayOrder: 5,
      minRole: 'viewer' as UserRole,
    },

    // 🛡️ 규제 & 컴플라이언스
    {
      code: 'compliance-reports',
      name: '규제 보고서',
      icon: 'FileText',
      path: '/compliance/reports',
      menuGroupCode: 'compliance',
      displayOrder: 1,
      minRole: 'site_manager' as UserRole,
      featureRequired: 'reports',
    },
    {
      code: 'compliance-checklist',
      name: '컴플라이언스 체크리스트',
      icon: 'CheckSquare',
      path: '/compliance/checklist',
      menuGroupCode: 'compliance',
      displayOrder: 2,
      minRole: 'site_manager' as UserRole,
    },
    {
      code: 'compliance-audit',
      name: '감사 추적',
      icon: 'FileSearch',
      path: '/compliance/audit',
      menuGroupCode: 'compliance',
      displayOrder: 3,
      minRole: 'site_manager' as UserRole,
    },
    {
      code: 'compliance-calc-engine',
      name: '계산 엔진 버전',
      icon: 'Code',
      path: '/compliance/calc-engine',
      menuGroupCode: 'compliance',
      displayOrder: 4,
      minRole: 'tenant_admin' as UserRole,
      description: '배출량/비용 계산 엔진 버전 관리',
    },

    // 🔔 알람 & 이벤트
    {
      code: 'alerts-overview',
      name: '알람 현황',
      icon: 'Bell',
      path: '/alerts',
      menuGroupCode: 'alerts',
      displayOrder: 1,
      minRole: 'operator' as UserRole,
    },
    {
      code: 'alerts-rules',
      name: '알람 규칙',
      icon: 'Settings',
      path: '/alerts/rules',
      menuGroupCode: 'alerts',
      displayOrder: 2,
      minRole: 'operator' as UserRole,
    },
    {
      code: 'alerts-history',
      name: '알람 이력',
      icon: 'History',
      path: '/alerts/history',
      menuGroupCode: 'alerts',
      displayOrder: 3,
      minRole: 'operator' as UserRole,
    },
    {
      code: 'alerts-notifications',
      name: '알림 설정',
      icon: 'MessageSquare',
      path: '/alerts/notifications',
      menuGroupCode: 'alerts',
      displayOrder: 4,
      minRole: 'viewer' as UserRole,
    },

    // ⚡ DR 수요반응
    {
      code: 'dr-dashboard',
      name: 'DR 대시보드',
      icon: 'Zap',
      path: '/dr',
      menuGroupCode: 'dr',
      displayOrder: 1,
      minRole: 'operator' as UserRole,
      featureRequired: 'dr',
    },
    {
      code: 'dr-events',
      name: 'DR 이벤트',
      icon: 'Calendar',
      path: '/dr/events',
      menuGroupCode: 'dr',
      displayOrder: 2,
      minRole: 'operator' as UserRole,
      featureRequired: 'dr',
    },
    {
      code: 'dr-execution',
      name: '실행 이력',
      icon: 'History',
      path: '/dr/execution',
      menuGroupCode: 'dr',
      displayOrder: 3,
      minRole: 'operator' as UserRole,
      featureRequired: 'dr',
    },
    {
      code: 'dr-performance',
      name: '성과 분석',
      icon: 'TrendingUp',
      path: '/dr/performance',
      menuGroupCode: 'dr',
      displayOrder: 4,
      minRole: 'site_manager' as UserRole,
      featureRequired: 'dr',
    },

    // ⚙️ 설정
    {
      code: 'settings-account',
      name: '계정 설정',
      icon: 'User',
      path: '/settings/account',
      menuGroupCode: 'settings',
      displayOrder: 1,
      minRole: 'viewer' as UserRole,
    },
    {
      code: 'settings-users',
      name: '사용자 관리',
      icon: 'Users',
      path: '/settings/users',
      menuGroupCode: 'settings',
      displayOrder: 2,
      minRole: 'tenant_admin' as UserRole,
    },
    {
      code: 'settings-subscription',
      name: '구독 & 결제',
      icon: 'CreditCard',
      path: '/settings/subscription',
      menuGroupCode: 'settings',
      displayOrder: 3,
      minRole: 'tenant_admin' as UserRole,
    },
    {
      code: 'settings-organization',
      name: '조직 정보',
      icon: 'Building2',
      path: '/settings/organization',
      menuGroupCode: 'settings',
      displayOrder: 4,
      minRole: 'tenant_admin' as UserRole,
    },
    {
      code: 'settings-integrations',
      name: 'API & 통합',
      icon: 'Plug',
      path: '/settings/integrations',
      menuGroupCode: 'settings',
      displayOrder: 5,
      minRole: 'tenant_admin' as UserRole,
      featureRequired: 'api_access',
    },

    // 🛡️ 시스템 관리 (슈퍼 관리자)
    {
      code: 'admin-tenants',
      name: '테넌트 관리',
      icon: 'Building2',
      path: '/admin/tenants',
      menuGroupCode: 'admin',
      displayOrder: 1,
      minRole: 'super_admin' as UserRole,
    },
    {
      code: 'admin-subscriptions',
      name: '구독 관리',
      icon: 'CreditCard',
      path: '/admin/subscriptions',
      menuGroupCode: 'admin',
      displayOrder: 2,
      minRole: 'super_admin' as UserRole,
    },
    {
      code: 'admin-analytics',
      name: '통합 분석',
      icon: 'BarChart',
      path: '/admin/analytics',
      menuGroupCode: 'admin',
      displayOrder: 3,
      minRole: 'super_admin' as UserRole,
    },
    {
      code: 'admin-system',
      name: '시스템 설정',
      icon: 'Settings',
      path: '/admin/system',
      menuGroupCode: 'admin',
      displayOrder: 4,
      minRole: 'super_admin' as UserRole,
    },
    {
      code: 'admin-menu',
      name: '메뉴 관리',
      icon: 'Layout',
      path: '/admin/menu',
      menuGroupCode: 'admin',
      displayOrder: 5,
      minRole: 'super_admin' as UserRole,
    },
  ];

  console.log('Creating menu items...');
  
  for (const item of menuItems) {
    const { menuGroupCode, ...itemData } = item;
    
    const menuGroup = createdGroups.find(g => g.code === menuGroupCode);
    
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

  console.log('✅ Seed completed successfully');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });