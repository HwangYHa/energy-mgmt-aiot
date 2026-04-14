/**
 * prisma/seed-demo-data.ts
 * 탄소이음 EMS AIoT — 데모/운영 초기 데이터 (메뉴, 설정, 사이트, 설비, 측정치 등)
 *
 * seed.ts의 main()에서 호출:
 *   import { seedDemoData } from './seed-demo-data';
 *   await seedDemoData(prisma, tenantId, userId);
 */

import { PrismaClient } from '@prisma/client';

// ─────────────────────────────────────────────────────────────
// 1. 메뉴 그룹 + 아이템 (로컬 DB 기준 — 2026-04-14 추출)
// ─────────────────────────────────────────────────────────────

export const MENU_GROUPS = [
  { code: 'dashboard',   name: '대시보드',          icon: 'LayoutDashboard', displayOrder: 1,  minRole: 'viewer'       as const },
  { code: 'monitoring',  name: '모니터링',           icon: 'Activity',        displayOrder: 2,  minRole: 'viewer'       as const },
  { code: 'analytics',   name: '분석 & 예측',        icon: 'BarChart3',       displayOrder: 3,  minRole: 'viewer'       as const },
  { code: 'control',     name: '설비 제어',          icon: 'Zap',             displayOrder: 5,  minRole: 'operator'     as const },
  { code: 'management',  name: '관리',               icon: 'Settings',        displayOrder: 5,  minRole: 'site_manager' as const },
  { code: 'settings',    name: '설정',               icon: 'Settings',        displayOrder: 9,  minRole: 'viewer'       as const },
  { code: 'compliance',  name: '규제/컴플라이언스',  icon: 'Shield',          displayOrder: 55, minRole: 'site_manager' as const },
  { code: 'alerts',      name: '알람 & 알림',        icon: 'Bell',            displayOrder: 60, minRole: 'operator'     as const },
  { code: 'admin',       name: 'Super Admin',        icon: 'Shield',          displayOrder: 70, minRole: 'super_admin'  as const },
];

export const MENU_ITEMS = [
  // ── 대시보드 ──────────────────────────────────────────────
  { code: 'dashboard_overview',     name: '개요',              icon: 'LayoutDashboard', path: '/dashboard',                      group: 'dashboard',  order: 1,  role: 'viewer'       as const },
  { code: 'dashboard_realtime',     name: '실시간 현황',       icon: 'Activity',        path: '/dashboard/realtime',             group: 'dashboard',  order: 2,  role: 'viewer'       as const, badge: 'new'   as const },
  { code: 'dashboard_viewer',       name: '뷰어 대시보드',     icon: 'Eye',             path: '/dashboard/viewer',               group: 'dashboard',  order: 3,  role: 'viewer'       as const },
  { code: 'dashboard_digital_twin', name: '디지털 트윈',       icon: 'Boxes',           path: '/digital-twin',                   group: 'dashboard',  order: 4,  role: 'viewer'       as const },
  // ── 모니터링 ──────────────────────────────────────────────
  { code: 'monitoring_overview',    name: '종합 모니터링',     icon: 'Monitor',         path: '/monitoring',                     group: 'monitoring', order: 1,  role: 'viewer'       as const },
  { code: 'monitoring_pipeline',    name: '데이터 수집 상태',  icon: 'Database',        path: '/monitoring/pipeline',            group: 'monitoring', order: 3,  role: 'site_manager' as const, badge: 'new' as const },
  // ── 분석 & 예측 ───────────────────────────────────────────
  { code: 'analytics_energy',       name: '에너지 분석',       icon: 'BarChart3',       path: '/analytics/energy',               group: 'analytics',  order: 1,  role: 'viewer'       as const },
  { code: 'analytics_cost',         name: '비용 분석',         icon: 'DollarSign',      path: '/analytics/cost',                 group: 'analytics',  order: 2,  role: 'viewer'       as const },
  { code: 'analytics_carbon',       name: '탄소 분석',         icon: 'Leaf',            path: '/analytics/carbon',               group: 'analytics',  order: 3,  role: 'viewer'       as const },
  { code: 'analytics_anomaly',      name: '이상 탐지',         icon: 'AlertTriangle',   path: '/analytics/anomaly',              group: 'analytics',  order: 4,  role: 'viewer'       as const },
  { code: 'analytics_forecast',     name: 'AI 예측',           icon: 'TrendingUp',      path: '/analytics/forecast',             group: 'analytics',  order: 5,  role: 'viewer'       as const },
  { code: 'analytics_simulator',    name: '절감 시뮬레이터',   icon: 'Calculator',      path: '/analytics/simulator',            group: 'analytics',  order: 6,  role: 'viewer'       as const, badge: 'new' as const },
  { code: 'analytics_templates',    name: '분석 템플릿',       icon: 'FileBarChart',    path: '/analytics/templates',            group: 'analytics',  order: 7,  role: 'viewer'       as const },
  { code: 'analytics_reports',      name: '리포트',            icon: 'FileText',        path: '/reports',                        group: 'analytics',  order: 8,  role: 'viewer'       as const },
  { code: 'analytics_raw_data',     name: '원시 데이터 탐색',  icon: 'Table2',          path: '/analytics/raw-data',             group: 'analytics',  order: 9,  role: 'site_manager' as const },
  { code: 'analytics_download',     name: '데이터 다운로드',   icon: 'Download',        path: '/analytics/download',             group: 'analytics',  order: 10, role: 'operator'     as const },
  { code: 'analytics_carbon_trading',     name: '배출권 거래소',     icon: 'TrendingUp',  path: '/analytics/carbon/trading',       group: 'analytics',  order: 11, role: 'viewer'       as const, badge: 'new' as const },
  { code: 'analytics_carbon_market_prices', name: '시장 가격',       icon: 'BarChart2',   path: '/analytics/carbon/market-prices', group: 'analytics',  order: 12, role: 'viewer'       as const },
  { code: 'analytics_carbon_roadmap',     name: '탄소중립 로드맵',   icon: 'Target',      path: '/analytics/carbon/roadmap',       group: 'analytics',  order: 13, role: 'viewer'       as const },
  // ── 설비 제어 ─────────────────────────────────────────────
  { code: 'control_manual',         name: '수동 제어',         icon: 'Sliders',         path: '/control/manual',                 group: 'control',    order: 1,  role: 'operator'     as const },
  { code: 'control_schedule',       name: '스케줄 제어',       icon: 'Calendar',        path: '/control/schedule',               group: 'control',    order: 2,  role: 'operator'     as const },
  { code: 'control_optimization',   name: 'AI 최적 제어',      icon: 'Brain',           path: '/control/optimization',           group: 'control',    order: 3,  role: 'site_manager' as const, badge: 'new' as const },
  { code: 'control_dr',             name: 'DR 참여',           icon: 'Zap',             path: '/control/dr',                     group: 'control',    order: 4,  role: 'operator'     as const },
  // ── 관리 ──────────────────────────────────────────────────
  { code: 'management_sites',       name: '사이트 관리',       icon: 'Building2',       path: '/sites',                          group: 'management', order: 1,  role: 'viewer'       as const },
  { code: 'management_users',       name: '사용자 관리',       icon: 'Users',           path: '/admin/users',                    group: 'management', order: 2,  role: 'tenant_admin' as const },
  { code: 'management_subscription',name: '구독 관리',         icon: 'CreditCard',      path: '/settings/subscription',          group: 'management', order: 3,  role: 'tenant_admin' as const },
  { code: 'control_devices',        name: '설비 관리',         icon: 'Cpu',             path: '/devices',                        group: 'management', order: 4,  role: 'operator'     as const },
  { code: 'control_gateways',       name: '게이트웨이 관리',   icon: 'Server',          path: '/settings/gateways',              group: 'management', order: 5,  role: 'operator'     as const },
  { code: 'management_asset',       name: '센서 관리',         icon: 'Radio',           path: '/sensors',                        group: 'management', order: 6,  role: 'operator'     as const },
  // ── 설정 ──────────────────────────────────────────────────
  { code: 'settings_account',       name: '계정 설정',         icon: 'User',            path: '/settings/account',               group: 'settings',   order: 1,  role: 'viewer'       as const },
  { code: 'settings_notifications', name: '알림 설정',         icon: 'Bell',            path: '/settings/notifications',         group: 'settings',   order: 2,  role: 'viewer'       as const },
  { code: 'settings_api',           name: 'API 키 관리',       icon: 'Key',             path: '/settings/api',                   group: 'settings',   order: 3,  role: 'tenant_admin' as const },
  { code: 'settings_system',        name: '시스템 설정',       icon: 'Settings',        path: '/settings/system',                group: 'settings',   order: 5,  role: 'viewer'       as const },
  { code: 'settings_manual',        name: '매뉴얼',            icon: 'FileText',        path: '/manual',                         group: 'settings',   order: 6,  role: 'viewer'       as const },
  { code: 'settings_support',       name: '문의/피드백',       icon: 'MessageSquare',   path: '/settings/support',               group: 'settings',   order: 7,  role: 'viewer'       as const },
  // ── 규제/컴플라이언스 ─────────────────────────────────────
  { code: 'compliance_audit',           name: '감사 추적',       icon: 'FileText',      path: '/compliance/audit-trail',         group: 'compliance', order: 1,  role: 'site_manager' as const },
  { code: 'compliance_emission_factors',name: '배출계수 관리',   icon: 'Leaf',          path: '/compliance/emission-factors',    group: 'compliance', order: 2,  role: 'site_manager' as const },
  { code: 'compliance_reports',         name: '규제 리포트',     icon: 'ClipboardList', path: '/compliance/reports',             group: 'compliance', order: 3,  role: 'site_manager' as const },
  // ── 알람 & 알림 ───────────────────────────────────────────
  { code: 'alerts_overview',        name: '알림 현황',         icon: 'Bell',            path: '/alerts',                         group: 'alerts',     order: 1,  role: 'operator'     as const },
  { code: 'alerts_rules',           name: '알림 규칙',         icon: 'Settings',        path: '/alerts/rules',                   group: 'alerts',     order: 2,  role: 'operator'     as const },
  // ── Super Admin ───────────────────────────────────────────
  { code: 'admin_tenants',          name: '테넌트 관리',       icon: 'Building2',       path: '/admin/tenants',                  group: 'admin',      order: 1,  role: 'super_admin'  as const },
  { code: 'admin_menu',             name: '메뉴 관리',         icon: 'LayoutGrid',      path: '/admin/menu',                     group: 'admin',      order: 2,  role: 'super_admin'  as const },
  { code: 'admin_traffic',          name: '트래픽 관리',       icon: 'Activity',        path: '/admin/traffic',                  group: 'admin',      order: 3,  role: 'tenant_admin' as const },
  { code: 'admin_support',          name: '지원 관리',         icon: 'MessageSquare',   path: '/admin/support',                  group: 'admin',      order: 4,  role: 'tenant_admin' as const },
  { code: 'admin_partners',         name: '파트너 포털',       icon: 'Link2',           path: '/admin/partners',                 group: 'admin',      order: 5,  role: 'super_admin'  as const, badge: 'new' as const },
  { code: 'resource_Management',    name: '자원 관리',         icon: 'Link2',           path: '/admin/equipment',                group: 'admin',      order: 6,  role: 'super_admin'  as const, badge: 'new' as const },
  { code: 'admin_sandbox',          name: '규제 샌드박스',     icon: 'FlaskConical',    path: '/admin/sandbox',                  group: 'admin',      order: 7,  role: 'super_admin'  as const },
  { code: 'admin_security',         name: '보안 모니터링',     icon: 'Shield',          path: '/admin/security',                 group: 'admin',      order: 8,  role: 'super_admin'  as const },
  { code: 'admin_ransomware',       name: '랜섬웨어 대응',     icon: 'ShieldAlert',     path: '/admin/security/ransomware',      group: 'admin',      order: 9,  role: 'super_admin'  as const },
  { code: 'super_admin_retention',  name: '리텐션 대시보드',   icon: 'BarChart3',       path: '/admin/retention',                group: 'admin',      order: 97, role: 'super_admin'  as const },
  { code: 'super_admin_erp',        name: 'ERP 대시보드',      icon: 'TrendingUp',      path: '/admin/erp',                      group: 'admin',      order: 98, role: 'super_admin'  as const },
];

// ─────────────────────────────────────────────────────────────
// 2. 시스템 설정
// ─────────────────────────────────────────────────────────────

export const SYSTEM_SETTINGS = [
  { category: 'general',  key: 'site_name',              value: '탄소이음 EMS AIoT',     type: 'string'  as const, name: '서비스명' },
  { category: 'general',  key: 'default_timezone',       value: 'Asia/Seoul',            type: 'string'  as const, name: '기본 타임존' },
  { category: 'general',  key: 'default_currency',       value: 'KRW',                   type: 'string'  as const, name: '기본 통화' },
  { category: 'general',  key: 'default_language',       value: 'ko',                    type: 'string'  as const, name: '기본 언어' },
  { category: 'energy',   key: 'kwh_unit_price_krw',     value: '120.5',                 type: 'number'  as const, name: 'kWh 단가(원)' },
  { category: 'energy',   key: 'peak_threshold_kw',      value: '500',                   type: 'number'  as const, name: '피크 임계값(kW)' },
  { category: 'energy',   key: 'data_retention_days',    value: '365',                   type: 'number'  as const, name: '측정 데이터 보관(일)' },
  { category: 'energy',   key: 'measurement_interval_s', value: '60',                    type: 'number'  as const, name: '계측 주기(초)' },
  { category: 'carbon',   key: 'grid_emission_factor',   value: '0.4594',                type: 'number'  as const, name: '전력 배출계수(kgCO2/kWh)' },
  { category: 'carbon',   key: 'carbon_credit_price_krw',value: '13500',                 type: 'number'  as const, name: '탄소크레딧 가격(원/tCO2)' },
  { category: 'carbon',   key: 'reporting_scope',        value: '["scope1","scope2"]',   type: 'json'    as const, name: '보고 범위' },
  { category: 'alert',    key: 'alert_cooldown_min',     value: '30',                    type: 'number'  as const, name: '알람 쿨다운(분)' },
  { category: 'alert',    key: 'max_alerts_per_day',     value: '100',                   type: 'number'  as const, name: '일일 최대 알람 수' },
  { category: 'alert',    key: 'auto_resolve_hours',     value: '24',                    type: 'number'  as const, name: '자동 해제(시간)' },
  { category: 'security', key: 'session_timeout_min',    value: '480',                   type: 'number'  as const, name: '세션 만료(분)' },
  { category: 'security', key: 'max_login_attempts',     value: '5',                     type: 'number'  as const, name: '최대 로그인 시도' },
  { category: 'security', key: 'mfa_enabled',            value: 'false',                 type: 'boolean' as const, name: 'MFA 활성화' },
  { category: 'billing',  key: 'billing_cycle_day',      value: '1',                     type: 'number'  as const, name: '과금 기준일' },
  { category: 'billing',  key: 'trial_period_days',      value: '30',                    type: 'number'  as const, name: '무료 체험 기간(일)' },
  { category: 'api',      key: 'rate_limit_per_hour',    value: '1000',                  type: 'number'  as const, name: 'API 시간당 제한' },
];

// ─────────────────────────────────────────────────────────────
// 3. 데모 사이트 정의
// ─────────────────────────────────────────────────────────────

export const DEMO_SITES = [
  {
    name: '서울 상암 공장',
    code: 'FAC-SEL-001',
    address: '서울특별시 마포구 상암산로 48',
    city: '서울',
    siteType: 'factory'    as const,
    areaSqm: 12500,
    floors: 4,
    peakPowerKw: 850,
    latitude: '37.5760',
    longitude: '126.8929',
  },
  {
    name: '판교 R&D 센터',
    code: 'OFF-PAN-001',
    address: '경기도 성남시 분당구 판교역로 166',
    city: '성남',
    siteType: 'office'     as const,
    areaSqm: 5200,
    floors: 8,
    peakPowerKw: 320,
    latitude: '37.3944',
    longitude: '127.1113',
  },
  {
    name: '인천 물류 창고',
    code: 'WH-ICN-001',
    address: '인천광역시 서구 청라국제도시1로 50',
    city: '인천',
    siteType: 'warehouse'  as const,
    areaSqm: 8800,
    floors: 2,
    peakPowerKw: 420,
    latitude: '37.5440',
    longitude: '126.6428',
  },
];

// 게이트웨이 + 디바이스 + 메트릭 정의
interface GatewayDef {
  serial: string;
  name: string;
  model: string;
  fw: string;
  ip: string;
  devices: DeviceDef[];
}

interface DeviceDef {
  name: string;
  code: string;
  type: string;
  manufacturer: string;
  model: string;
  protocol: 'modbus_tcp' | 'bacnet' | 'mqtt';
  controlCapable: boolean;
  metrics: MetricDef[];
}

interface MetricDef {
  key: string;
  name: string;
  unit: string;
  category: 'power_active' | 'power_reactive' | 'energy_kwh' | 'temperature' | 'humidity' | 'pressure' | 'co2' | 'status' | 'other';
  min?: number;
  max?: number;
  baseValue: number;   // 시뮬레이션 기준값
  variance: number;    // 변동폭 비율 (0~1)
}

export function buildSiteGateways(siteIndex: number): GatewayDef[] {
  const prefixes = ['FAC', 'OFF', 'WH'];
  const p = prefixes[siteIndex];

  const gw1Devices: DeviceDef[] = [
    {
      name: '메인 수변전 전력계',
      code: `${p}-MEM-001`,
      type: 'energy_meter',
      manufacturer: 'LS일렉트릭',
      model: 'XGI-CPUE',
      protocol: 'modbus_tcp',
      controlCapable: false,
      metrics: [
        { key: 'power_active_kw',   name: '유효전력',   unit: 'kW',   category: 'power_active',   min: 0,   max: 1000, baseValue: siteIndex === 0 ? 420 : siteIndex === 1 ? 180 : 260, variance: 0.25 },
        { key: 'power_reactive_kvar',name: '무효전력',  unit: 'kVAR', category: 'power_reactive', min: 0,   max: 300,  baseValue: siteIndex === 0 ? 85  : siteIndex === 1 ? 35  : 55,  variance: 0.20 },
        { key: 'energy_total_kwh',  name: '누적전력량', unit: 'kWh',  category: 'energy_kwh',     min: 0,   max: 1e7,  baseValue: 1200000, variance: 0 },
        { key: 'voltage_avg_v',     name: '전압(평균)', unit: 'V',    category: 'other',           min: 200, max: 250,  baseValue: 220, variance: 0.02 },
        { key: 'current_avg_a',     name: '전류(평균)', unit: 'A',    category: 'other',           min: 0,   max: 2000, baseValue: siteIndex === 0 ? 1100 : 480, variance: 0.22 },
        { key: 'power_factor',      name: '역률',       unit: '%',    category: 'other',           min: 60,  max: 100,  baseValue: 92, variance: 0.05 },
      ],
    },
    {
      name: '공조기(AHU-1)',
      code: `${p}-AHU-001`,
      type: 'hvac',
      manufacturer: '캐리어',
      model: 'AHU-500R',
      protocol: 'bacnet',
      controlCapable: true,
      metrics: [
        { key: 'power_kw',      name: '소비전력',  unit: 'kW',  category: 'power_active',  min: 0,  max: 200, baseValue: siteIndex === 0 ? 95 : 45, variance: 0.30 },
        { key: 'supply_temp_c', name: '급기온도',  unit: '°C',  category: 'temperature',   min: 10, max: 30,  baseValue: 22, variance: 0.10 },
        { key: 'return_temp_c', name: '환기온도',  unit: '°C',  category: 'temperature',   min: 15, max: 35,  baseValue: 26, variance: 0.08 },
        { key: 'humidity_rh',   name: '상대습도',  unit: '%RH', category: 'humidity',      min: 30, max: 80,  baseValue: 55, variance: 0.15 },
        { key: 'run_status',    name: '운전상태',  unit: '',    category: 'status',        min: 0,  max: 1,   baseValue: 1,  variance: 0 },
      ],
    },
    {
      name: '압축기(COMP-1)',
      code: `${p}-CMP-001`,
      type: 'compressor',
      manufacturer: '한화',
      model: 'EC-75A',
      protocol: 'modbus_tcp',
      controlCapable: true,
      metrics: [
        { key: 'power_kw',       name: '소비전력',  unit: 'kW',  category: 'power_active',  min: 0,  max: 120, baseValue: 62, variance: 0.25 },
        { key: 'pressure_bar',   name: '출구압력',  unit: 'bar', category: 'pressure',      min: 5,  max: 12,  baseValue: 8.5, variance: 0.10 },
        { key: 'temp_c',         name: '토출온도',  unit: '°C',  category: 'temperature',   min: 20, max: 80,  baseValue: 42, variance: 0.12 },
        { key: 'run_hours',      name: '가동시간',  unit: 'h',   category: 'other',         min: 0,  max: 50000, baseValue: 8765, variance: 0 },
      ],
    },
    {
      name: `태양광 인버터(PV-${siteIndex + 1})`,
      code: `${p}-PV-001`,
      type: 'pv_inverter',
      manufacturer: 'SMA',
      model: 'Sunny Tripower 25000TL',
      protocol: 'modbus_tcp',
      controlCapable: false,
      metrics: [
        { key: 'power_kw',       name: '발전전력',  unit: 'kW',  category: 'power_active',  min: 0,  max: 100, baseValue: 28, variance: 0.60 },
        { key: 'energy_day_kwh', name: '일발전량',  unit: 'kWh', category: 'energy_kwh',    min: 0,  max: 500, baseValue: 120, variance: 0.50 },
        { key: 'dc_voltage_v',   name: 'DC전압',    unit: 'V',   category: 'other',         min: 200, max: 800, baseValue: 540, variance: 0.05 },
        { key: 'efficiency_pct', name: '변환효율',  unit: '%',   category: 'other',         min: 85, max: 99,  baseValue: 97, variance: 0.02 },
      ],
    },
  ];

  const gw2Devices: DeviceDef[] = [
    {
      name: '냉동기(CHILLER-1)',
      code: `${p}-CHI-001`,
      type: 'chiller',
      manufacturer: 'YORK',
      model: 'YVFA-100',
      protocol: 'bacnet',
      controlCapable: true,
      metrics: [
        { key: 'power_kw',        name: '소비전력',   unit: 'kW',  category: 'power_active',  min: 0,  max: 250, baseValue: siteIndex === 0 ? 130 : 60, variance: 0.30 },
        { key: 'chilled_temp_c',  name: '냉수공급온도', unit: '°C', category: 'temperature',   min: 4,  max: 12,  baseValue: 7,  variance: 0.10 },
        { key: 'cop',             name: 'COP',        unit: '',    category: 'other',         min: 2,  max: 7,   baseValue: 4.5, variance: 0.15 },
        { key: 'flow_rate_lm',    name: '유량',       unit: 'L/m', category: 'other',         min: 100,max: 1000,baseValue: 450, variance: 0.20 },
      ],
    },
    {
      name: '조명 분전반(LP-2F)',
      code: `${p}-LTP-001`,
      type: 'lighting_panel',
      manufacturer: '현대일렉트릭',
      model: 'MCC-200A',
      protocol: 'modbus_tcp',
      controlCapable: true,
      metrics: [
        { key: 'power_kw',   name: '소비전력',  unit: 'kW',  category: 'power_active',  min: 0,  max: 50,  baseValue: 18, variance: 0.40 },
        { key: 'energy_kwh', name: '누적전력량', unit: 'kWh', category: 'energy_kwh',    min: 0,  max: 1e5, baseValue: 45000, variance: 0 },
        { key: 'dimming_pct',name: '조도(%)',   unit: '%',   category: 'other',         min: 0,  max: 100, baseValue: 80, variance: 0.20 },
      ],
    },
    {
      name: 'EV 충전소(EV-01)',
      code: `${p}-EVC-001`,
      type: 'ev_charger',
      manufacturer: '에버온',
      model: 'EV-100A',
      protocol: 'mqtt',
      controlCapable: true,
      metrics: [
        { key: 'power_kw',     name: '충전전력',   unit: 'kW',  category: 'power_active',  min: 0,  max: 100, baseValue: 22, variance: 0.70 },
        { key: 'energy_kwh',   name: '누적충전량', unit: 'kWh', category: 'energy_kwh',    min: 0,  max: 1e4, baseValue: 8500, variance: 0 },
        { key: 'sessions_cnt', name: '충전 세션',  unit: 'ea',  category: 'other',         min: 0,  max: 100, baseValue: 12, variance: 0.50 },
      ],
    },
    {
      name: 'CO₂ 환경 센서(ENV-B1)',
      code: `${p}-ENV-001`,
      type: 'env_sensor',
      manufacturer: 'Vaisala',
      model: 'GMW90',
      protocol: 'modbus_tcp',
      controlCapable: false,
      metrics: [
        { key: 'co2_ppm',    name: 'CO₂ 농도',  unit: 'ppm', category: 'co2',          min: 300,  max: 2000, baseValue: 650, variance: 0.25 },
        { key: 'temp_c',     name: '실내온도',  unit: '°C',  category: 'temperature',   min: 15,   max: 35,   baseValue: 23, variance: 0.08 },
        { key: 'humidity_rh',name: '상대습도',  unit: '%RH', category: 'humidity',      min: 30,   max: 80,   baseValue: 52, variance: 0.12 },
        { key: 'pm25_ugm3',  name: 'PM2.5',    unit: 'μg/m³',category: 'other',        min: 0,    max: 150,  baseValue: 18, variance: 0.40 },
      ],
    },
  ];

  return [
    {
      serial: `GW-${p}-A001`,
      name: `${p} 게이트웨이 A`,
      model: 'EMS-GW-Pro',
      fw: '3.4.2',
      ip: `192.168.${10 + siteIndex}.101`,
      devices: gw1Devices,
    },
    {
      serial: `GW-${p}-B001`,
      name: `${p} 게이트웨이 B`,
      model: 'EMS-GW-Lite',
      fw: '3.2.1',
      ip: `192.168.${10 + siteIndex}.102`,
      devices: gw2Devices,
    },
  ];
}

// ─────────────────────────────────────────────────────────────
// 4. 측정 데이터 생성 (7일 hourly)
// ─────────────────────────────────────────────────────────────

function generateMeasurements(
  metricId: string,
  tenantId: string,
  gatewayId: string,
  baseValue: number,
  variance: number,
  isAccumulator: boolean,
  days = 7
) {
  const records: { time: Date; tenantId: string; metricId: string; value: number; gatewayId: string }[] = [];
  const now = new Date();
  const totalHours = days * 24;
  let accumValue = baseValue;

  for (let h = totalHours; h >= 0; h--) {
    const t = new Date(now.getTime() - h * 3600_000);
    const hourOfDay = t.getHours();
    // 시간대별 부하 패턴 (0~23h)
    const loadFactor = hourOfDay >= 8 && hourOfDay <= 20
      ? 0.8 + Math.random() * 0.4   // 업무시간: 80~120%
      : 0.2 + Math.random() * 0.15; // 야간: 20~35%

    let val: number;
    if (isAccumulator) {
      // 누적값: 단조 증가
      accumValue += (baseValue / (365 * 24)) * (0.5 + loadFactor);
      val = Math.round(accumValue * 10) / 10;
    } else if (variance === 0) {
      val = baseValue;
    } else {
      const noise = (Math.random() - 0.5) * 2 * variance;
      val = Math.max(0, baseValue * (loadFactor + noise));
      val = Math.round(val * 100) / 100;
    }

    records.push({ time: t, tenantId, metricId, value: val, gatewayId });
  }
  return records;
}

// ─────────────────────────────────────────────────────────────
// 5. 알람 규칙
// ─────────────────────────────────────────────────────────────

export function buildAlertRules(tenantId: string) {
  return [
    {
      tenantId,
      name: '전력 피크 초과 경보',
      description: '전체 전력 사용량이 피크 임계값을 초과할 때 경보',
      category: 'energy'   as const,
      severity: 'critical' as const,
      scope: 'tenant'      as const,
      condition: { metric: 'power_active_kw', operator: 'gt', threshold: 800, windowMin: 5 },
      channels: { email: true, sms: false },
      enabled: true,
    },
    {
      tenantId,
      name: '에너지 급증 감지',
      description: '전력 사용량이 30분 이내 30% 이상 급증',
      category: 'energy'   as const,
      severity: 'warning'  as const,
      scope: 'tenant'      as const,
      condition: { metric: 'power_active_kw', operator: 'increase_pct', threshold: 30, windowMin: 30 },
      channels: { email: true, sms: false },
      enabled: true,
    },
    {
      tenantId,
      name: '게이트웨이 오프라인',
      description: '게이트웨이가 30분 이상 응답 없음',
      category: 'device'   as const,
      severity: 'critical' as const,
      scope: 'tenant'      as const,
      condition: { type: 'gateway_offline', durationMin: 30 },
      channels: { email: true, sms: true },
      enabled: true,
    },
    {
      tenantId,
      name: '설비 오류 알람',
      description: '설비 status 태그가 오류 상태',
      category: 'device'   as const,
      severity: 'warning'  as const,
      scope: 'tenant'      as const,
      condition: { metric: 'run_status', operator: 'eq', threshold: 0 },
      channels: { email: true, sms: false },
      enabled: true,
    },
    {
      tenantId,
      name: '월 탄소 예산 초과',
      description: '월 탄소 배출량이 목표치 90%를 초과',
      category: 'carbon'   as const,
      severity: 'warning'  as const,
      scope: 'tenant'      as const,
      condition: { type: 'monthly_carbon_budget', thresholdPct: 90 },
      channels: { email: true, sms: false },
      enabled: true,
    },
    {
      tenantId,
      name: 'DR 이벤트 시작',
      description: '수요반응(DR) 이벤트 15분 전 사전 알림',
      category: 'dr'       as const,
      severity: 'info'     as const,
      scope: 'tenant'      as const,
      condition: { type: 'dr_event_start', advanceMin: 15 },
      channels: { email: true, sms: true },
      enabled: true,
    },
    {
      tenantId,
      name: '실내 CO₂ 농도 초과',
      description: '실내 CO₂ 농도가 1,000ppm 초과',
      category: 'energy'   as const,
      severity: 'info'     as const,
      scope: 'tenant'      as const,
      condition: { metric: 'co2_ppm', operator: 'gt', threshold: 1000, windowMin: 10 },
      channels: { email: false, sms: false },
      enabled: true,
    },
    {
      tenantId,
      name: '구독 만료 7일 전',
      description: '구독 만료 7일 전 사전 알림',
      category: 'system'   as const,
      severity: 'warning'  as const,
      scope: 'tenant'      as const,
      condition: { type: 'subscription_expiry', daysBeforeExpiry: 7 },
      channels: { email: true, sms: false },
      enabled: true,
    },
  ];
}

// ─────────────────────────────────────────────────────────────
// seedDemoData — 데모 테넌트 전용 운영 데이터
// (feature/plan/menu/emission_factor 등 정적 데이터는 seed-data.sql 에서 처리)
// ─────────────────────────────────────────────────────────────

export async function seedDemoData(
  prisma: PrismaClient,
  demoTenantId: string,
  demoUserId: string,
) {
  // ── Sites / Gateways / Devices / Metrics ────────────────────
  console.log('\n📦 [데모] Sites → Gateways → Devices → Metrics');

  let totalDevices = 0, totalMetrics = 0;
  const siteIds: string[] = [];
  const allMetrics: { id: string; baseValue: number; variance: number; isAccum: boolean; gatewayId: string }[] = [];

  for (let si = 0; si < DEMO_SITES.length; si++) {
    const s = DEMO_SITES[si]!;
    const site = await (prisma.site as any).upsert({
      where: { id: `demo-site-${si + 1}` },
      update: { name: s.name },
      create: {
        id: `demo-site-${si + 1}`,
        tenantId: demoTenantId,
        name: s.name, code: s.code,
        address: s.address, city: s.city, country: 'KR',
        siteType: s.siteType,
        areaSqm: s.areaSqm, floors: s.floors,
        peakPowerKw: s.peakPowerKw,
        latitude: s.latitude, longitude: s.longitude,
        timezone: 'Asia/Seoul', isActive: true,
      },
    });
    siteIds.push(site.id);

    const gateways = buildSiteGateways(si);
    for (let gi = 0; gi < gateways.length; gi++) {
      const gd = gateways[gi]!;
      const gw = await (prisma.gateway as any).upsert({
        where: { serialNumber: gd.serial },
        update: { name: gd.name },
        create: {
          id: `demo-gw-${si * 2 + gi + 1}`,
          tenantId: demoTenantId,
          siteId: site.id,
          serialNumber: gd.serial,
          name: gd.name, model: gd.model,
          firmwareVersion: gd.fw, ipAddress: gd.ip,
          primaryConnection: 'ethernet', fallbackConnection: 'lte',
          status: 'online',
          lastSeenAt: new Date(),
          lastHeartbeatAt: new Date(),
          bufferSizeMb: 100, bufferedRecords: 0,
          ownership: 'company',
        },
      });

      for (let di = 0; di < gd.devices.length; di++) {
        const dd = gd.devices[di]!;
        const devId = `demo-dev-${si * 8 + gi * 4 + di + 1}`;
        const dev = await (prisma.device as any).upsert({
          where: { id: devId },
          update: { name: dd.name },
          create: {
            id: devId,
            tenantId: demoTenantId,
            siteId: site.id,
            gatewayId: gw.id,
            name: dd.name, code: dd.code,
            deviceType: dd.type,
            manufacturer: dd.manufacturer, model: dd.model,
            protocol: dd.protocol,
            connectionConfig: { host: gd.ip, port: 502 },
            controlCapable: dd.controlCapable,
            controlMode: dd.controlCapable ? 'auto' : 'disabled',
            status: 'online',
            lastSeenAt: new Date(),
            pollIntervalMs: 60000,
          },
        });
        totalDevices++;

        for (const md of dd.metrics) {
          const metricId = `demo-metric-${devId}-${md.key}`;
          await (prisma.metric as any).upsert({
            where: { deviceId_key: { deviceId: dev.id, key: md.key } },
            update: { name: md.name },
            create: {
              id: metricId,
              tenantId: demoTenantId,
              deviceId: dev.id,
              key: md.key, name: md.name,
              unit: md.unit, category: md.category,
              dataType: 'float',
              scaleFactor: 1.0,
              minValue: md.min ?? null,
              maxValue: md.max ?? null,
              accessLevel: 'read',
            },
          });
          totalMetrics++;

          const isAccum = md.category === 'energy_kwh' || md.key.includes('hour') || md.key.includes('energy_day');
          allMetrics.push({ id: metricId, baseValue: md.baseValue, variance: md.variance, isAccum, gatewayId: gw.id });
        }
      }
    }
    console.log(`  ✅ Site[${si + 1}] ${s.name}: 디바이스 ${totalDevices}개 누적`);
  }
  console.log(`  ✅ 총 Device ${totalDevices}개, Metric ${totalMetrics}개`);

  // ── Measurements (7일 hourly) ────────────────────────────────
  console.log('\n📦 [데모] Measurements (7일 hourly 데이터 생성 중...)');
  let measCount = 0;
  for (const m of allMetrics) {
    const records = generateMeasurements(m.id, demoTenantId, m.gatewayId, m.baseValue, m.variance, m.isAccum, 7);

    // MySQL upsert with createMany (ON DUPLICATE KEY UPDATE)
    // Prisma의 createMany skipDuplicates 사용
    await (prisma.measurement as any).createMany({
      data: records.map(r => ({
        time: r.time,
        tenantId: r.tenantId,
        metricId: r.metricId,
        value: r.value,
        gatewayId: r.gatewayId,
        quality: 'good',
        source: 'sensor',
        receivedAt: r.time,
      })),
      skipDuplicates: true,
    });
    measCount += records.length;
  }
  console.log(`  ✅ Measurement ${measCount.toLocaleString()}건 삽입`);

  // ── Alert Rules ─────────────────────────────────────────────
  console.log('\n📦 [데모] AlertRule');
  const alertRules = buildAlertRules(demoTenantId);
  for (const ar of alertRules) {
    const existing = await prisma.alertRule.findFirst({ where: { tenantId: demoTenantId, name: ar.name } });
    if (!existing) {
      await prisma.alertRule.create({ data: ar });
    }
    process.stdout.write('.');
  }
  console.log(`\n  ✅ AlertRule ${alertRules.length}개`);

  // ── Notification Rules ──────────────────────────────────────
  console.log('\n📦 [데모] NotificationRule');
  const notifCategories: Array<{ category: any; severity: any; name: string }> = [
    { category: 'energy',  severity: 'critical', name: '에너지 긴급 알림'   },
    { category: 'energy',  severity: 'warning',  name: '에너지 경고 알림'   },
    { category: 'device',  severity: 'critical', name: '설비 긴급 알림'     },
    { category: 'device',  severity: 'warning',  name: '설비 경고 알림'     },
    { category: 'carbon',  severity: 'warning',  name: '탄소 경고 알림'     },
    { category: 'dr',      severity: 'info',     name: 'DR 이벤트 알림'     },
    { category: 'system',  severity: 'warning',  name: '시스템 경고 알림'   },
    { category: 'security',severity: 'critical', name: '보안 긴급 알림'     },
  ];
  for (const nc of notifCategories) {
    const ex = await prisma.notificationRule.findFirst({ where: { tenantId: demoTenantId, userId: demoUserId, name: nc.name } });
    if (!ex) {
      await prisma.notificationRule.create({
        data: {
          tenantId: demoTenantId, userId: demoUserId,
          name: nc.name, category: nc.category, severity: nc.severity,
          emailEnabled: true, smsEnabled: false, pushEnabled: false,
          enabled: true,
        },
      });
    }
    process.stdout.write('.');
  }
  console.log(`\n  ✅ NotificationRule ${notifCategories.length}개`);

  // ── KPI Snapshots (최근 6개월) ─────────────────────────────
  console.log('\n📦 [데모] KpiSnapshot (6개월)');
  const kwh_base = [185000, 192000, 178000, 201000, 188000, 175000];
  for (let m = 5; m >= 0; m--) {
    const d = new Date();
    d.setMonth(d.getMonth() - m);
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const kwh = kwh_base[5 - m]! * (0.9 + Math.random() * 0.2);
    const ex = await (prisma.kpiSnapshot as any).findFirst({ where: { tenantId: demoTenantId, period } });
    if (!ex) {
      await (prisma.kpiSnapshot as any).create({
        data: {
          tenantId: demoTenantId, period,
          totalKwh: kwh,
          peakKw: kwh / (720 * 0.35),  // 720h, 35% load factor
          baselineKwh: kwh * 1.08,
          savedKwh: kwh * 0.08,
          totalCo2Kg: kwh * 0.4594,
          savedCo2Kg: kwh * 0.08 * 0.4594,
          energyCostKrw: kwh * 120.5,
          savedCostKrw: kwh * 0.08 * 120.5,
          investmentKrw: 5000000,
          roiPercent: 14.5 + (Math.random() - 0.5) * 3,
          paybackMonths: 24,
        },
      });
    }
    process.stdout.write('.');
  }
  console.log('\n  ✅ KpiSnapshot 6개월');

  // ── EmissionsData (최근 6개월, Scope1+2) ──────────────────
  console.log('\n📦 [데모] EmissionsData (6개월 Scope1+2)');
  for (let m = 5; m >= 0; m--) {
    const d = new Date();
    d.setMonth(d.getMonth() - m);
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const kwh = kwh_base[5 - m]! * (0.9 + Math.random() * 0.2);
    // Scope2 (전력)
    const s2ex = await (prisma.emissionsData as any).findFirst({ where: { tenantId: demoTenantId, period, emissionType: 'scope2' } });
    if (!s2ex) {
      await (prisma.emissionsData as any).create({
        data: {
          tenantId: demoTenantId,
          emissionType: 'scope2',
          sourceType: 'electricity',
          amount: kwh,
          unit: 'kWh',
          emissionFactor: 0.4594,
          calculatedEmission: kwh * 0.4594 / 1000,
          period,
          calculationMethod: 'auto',
          dataSource: 'SENSOR',
        },
      });
    }
    // Scope1 (가스)
    const s1ex = await (prisma.emissionsData as any).findFirst({ where: { tenantId: demoTenantId, period, emissionType: 'scope1' } });
    if (!s1ex) {
      const gasM3 = 1500 + Math.random() * 300;
      await (prisma.emissionsData as any).create({
        data: {
          tenantId: demoTenantId,
          emissionType: 'scope1',
          sourceType: 'natural_gas',
          amount: gasM3,
          unit: 'm3',
          emissionFactor: 2.176,
          calculatedEmission: gasM3 * 2.176 / 1000,
          period,
          calculationMethod: 'manual',
          dataSource: 'MANUAL',
        },
      });
    }
    process.stdout.write('.');
  }
  console.log('\n  ✅ EmissionsData Scope1+2 12건');

  // ── DR Events ───────────────────────────────────────────────
  console.log('\n📦 [데모] DrEvent');
  const drEvents = [
    { title: '2024-12 동계 피크 수요감축', daysAgo: 35, durationH: 3, targetKw: 120, status: 'completed' as const },
    { title: '2025-01 한파 DR 발령',       daysAgo: 12, durationH: 2, targetKw: 90,  status: 'completed' as const },
    { title: '2025-01 하계 예비 DR',       daysAgo: -3, durationH: 4, targetKw: 150, status: 'scheduled' as const },
  ];
  for (const dr of drEvents) {
    const start = new Date(Date.now() - dr.daysAgo * 86400_000);
    const end   = new Date(start.getTime() + dr.durationH * 3600_000);
    const ex = await prisma.drEvent.findFirst({ where: { tenantId: demoTenantId, title: dr.title } });
    if (!ex) {
      await prisma.drEvent.create({
        data: {
          tenantId: demoTenantId, title: dr.title,
          startTime: start, endTime: end,
          targetReductionKw: dr.targetKw,
          actualReductionKw: dr.status === 'completed' ? dr.targetKw * (0.85 + Math.random() * 0.2) : null,
          revenue: dr.status === 'completed' ? dr.targetKw * dr.durationH * 150 : null,
          status: dr.status,
        },
      });
    }
    process.stdout.write('.');
  }
  console.log('\n  ✅ DrEvent 3개');

  // ── Users (사이트 관리자, 운영자 추가) ──────────────────────
  console.log('\n📦 [데모] 추가 사용자');
  const bcrypt = await import('bcryptjs');
  const extraUsers = [
    { email: 'manager@carbonieum.com', name: '김사이트', role: 'site_manager', site: siteIds[0] },
    { email: 'operator@carbonieum.com',name: '이운영자', role: 'operator',     site: siteIds[1] },
    { email: 'viewer@carbonieum.com',  name: '박조회자', role: 'viewer',       site: null },
  ];
  for (const eu of extraUsers) {
    const ex = await prisma.user.findUnique({ where: { email: eu.email } });
    if (!ex) {
      const hash = await bcrypt.default.hash('Password1!', 12);
      await prisma.user.create({
        data: {
          tenantId: demoTenantId,
          email: eu.email, name: eu.name,
          passwordHash: hash, role: eu.role as any,
          isActive: true, isEmailVerified: true,
        },
      });
    }
    process.stdout.write('.');
  }
  console.log('\n  ✅ 추가 사용자 3명 (site_manager, operator, viewer)');
}
