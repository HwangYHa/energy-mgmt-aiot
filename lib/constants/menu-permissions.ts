import { UserRole } from '@prisma/client';

export interface MenuItemConfig {
  name: string;
  icon: string;
  path: string;
  minRole: UserRole;
  badge?: 'new' | 'beta';
}

export interface MenuGroupConfig {
  name: string;
  icon: string;
  minRole: UserRole;
  items: MenuItemConfig[];
}

export const MENU_GROUPS: MenuGroupConfig[] = [
  {
    name: '대시보드',
    icon: 'LayoutDashboard',
    minRole: 'viewer' as UserRole,
    items: [
      {
        name: '개요',
        icon: 'LayoutDashboard',
        path: '/dashboard',
        minRole: 'viewer' as UserRole,
      },
      {
        name: '실시간 모니터링',
        icon: 'Activity',
        path: '/dashboard/realtime',
        minRole: 'viewer' as UserRole,
      },
    ],
  },
  {
    name: '모니터링',
    icon: 'Activity',
    minRole: 'viewer' as UserRole,
    items: [
      {
        name: '사이트 조회',
        icon: 'Building2',
        path: '/sites',
        minRole: 'viewer' as UserRole,
      },
      {
        name: '설비 모니터링',
        icon: 'Sliders',
        path: '/equipment',
        minRole: 'viewer' as UserRole,
      },
    ],
  },
  {
    name: '제어',
    icon: 'Zap',
    minRole: 'operator' as UserRole,
    items: [
      {
        name: '수동 제어',
        icon: 'Sliders',
        path: '/control/manual',
        minRole: 'operator' as UserRole,
      },
      {
        name: 'DR 참여',
        icon: 'Zap',
        path: '/control/dr',
        minRole: 'tenant_admin' as UserRole,
      },
    ],
  },
  {
    name: '분석 & 리포트',
    icon: 'BarChart3',
    minRole: 'viewer' as UserRole,
    items: [
      {
        name: '에너지 분석',
        icon: 'BarChart3',
        path: '/analytics',
        minRole: 'viewer' as UserRole,
      },
      {
        name: 'AI 예측',
        icon: 'Leaf',
        path: '/ai-forecast',
        minRole: 'viewer' as UserRole,
      },
      {
        name: '리포트',
        icon: 'Shield',
        path: '/reports',
        minRole: 'viewer' as UserRole,
      },
    ],
  },
  {
    name: '관리',
    icon: 'Settings',
    minRole: 'site_manager' as UserRole,
    items: [
      {
        name: '사이트 관리',
        icon: 'Building2',
        path: '/admin/sites',
        minRole: 'site_manager' as UserRole,
      },
      {
        name: '사용자 관리',
        icon: 'Users',
        path: '/settings/users',
        minRole: 'tenant_admin' as UserRole,
      },
      {
        name: '구독 관리',
        icon: 'CreditCard',
        path: '/settings/subscription',
        minRole: 'tenant_admin' as UserRole,
      },
    ],
  },
  {
    name: '설정',
    icon: 'Settings',
    minRole: 'viewer' as UserRole,
    items: [
      {
        name: '계정 설정',
        icon: 'User',
        path: '/settings/account',
        minRole: 'viewer' as UserRole,
      },
      {
        name: '알림 설정',
        icon: 'Bell',
        path: '/settings/notifications',
        minRole: 'viewer' as UserRole,
      },
      {
        name: '매뉴얼',
        icon: 'FileText',
        path: '/manual',
        minRole: 'viewer' as UserRole,
      },
    ],
  },
];
