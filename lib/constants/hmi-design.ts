/**
 * HMI (Human-Machine Interface) Design System
 *
 * 산업용 HMI + 현대적 SaaS UI/UX 결합
 * - 사용자 친화적이고 직관적인 인터페이스
 * - 한눈에 파악 가능한 정보 구조
 * - 빠른 조작, 실수 최소화
 */

// ━━━━━━━━━━━━━━━━━━━━
// 상태 색상 (Status Colors)
// ━━━━━━━━━━━━━━━━━━━━
export const STATUS_COLORS = {
  // 정상 상태 (Normal/OK)
  normal: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    icon: 'text-emerald-500',
    glow: 'shadow-emerald-500/20',
    hex: '#10b981',
  },
  // 경고 상태 (Warning)
  warning: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    icon: 'text-amber-500',
    glow: 'shadow-amber-500/20',
    hex: '#f59e0b',
  },
  // 위험 상태 (Critical/Error)
  critical: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    icon: 'text-red-500',
    glow: 'shadow-red-500/20',
    hex: '#ef4444',
  },
  // 비활성 상태 (Inactive/Offline)
  inactive: {
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/30',
    text: 'text-slate-400',
    icon: 'text-slate-500',
    glow: 'shadow-slate-500/20',
    hex: '#64748b',
  },
  // 정보 상태 (Info)
  info: {
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    text: 'text-cyan-400',
    icon: 'text-cyan-500',
    glow: 'shadow-cyan-500/20',
    hex: '#06b6d4',
  },
} as const;

// ━━━━━━━━━━━━━━━━━━━━
// 에너지 관련 색상
// ━━━━━━━━━━━━━━━━━━━━
export const ENERGY_COLORS = {
  consumption: '#06b6d4', // 소비량 (Cyan)
  production: '#22c55e',  // 생산량 (Green)
  savings: '#10b981',     // 절감 (Emerald)
  cost: '#f97316',        // 비용 (Orange)
  peak: '#eab308',        // 피크 (Yellow)
  carbon: '#a855f7',      // 탄소 (Purple)
  solar: '#fbbf24',       // 태양광 (Amber)
  wind: '#38bdf8',        // 풍력 (Sky)
  ess: '#8b5cf6',         // ESS (Violet)
} as const;

// ━━━━━━━━━━━━━━━━━━━━
// 차트 색상 팔레트
// ━━━━━━━━━━━━━━━━━━━━
export const CHART_COLORS = [
  '#06b6d4', // Cyan
  '#22c55e', // Green
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#f97316', // Orange
  '#ec4899', // Pink
  '#3b82f6', // Blue
  '#14b8a6', // Teal
] as const;

// ━━━━━━━━━━━━━━━━━━━━
// 배경 색상
// ━━━━━━━━━━━━━━━━━━━━
export const BG_COLORS = {
  primary: '#0f172a',    // 메인 배경 (Slate 900)
  secondary: '#1e293b',  // 보조 배경 (Slate 800)
  tertiary: '#334155',   // 3차 배경 (Slate 700)
  card: '#1e293b',       // 카드 배경
  hover: '#334155',      // 호버 배경
  active: '#475569',     // 활성 배경
} as const;

// ━━━━━━━━━━━━━━━━━━━━
// 텍스트 색상
// ━━━━━━━━━━━━━━━━━━━━
export const TEXT_COLORS = {
  primary: '#f8fafc',    // 주요 텍스트 (Slate 50)
  secondary: '#cbd5e1',  // 보조 텍스트 (Slate 300)
  muted: '#64748b',      // 흐린 텍스트 (Slate 500)
  accent: '#06b6d4',     // 강조 텍스트 (Cyan)
} as const;

// ━━━━━━━━━━━━━━━━━━━━
// 테두리 색상
// ━━━━━━━━━━━━━━━━━━━━
export const BORDER_COLORS = {
  default: '#334155',    // 기본 테두리 (Slate 700)
  light: '#475569',      // 밝은 테두리 (Slate 600)
  accent: '#06b6d4',     // 강조 테두리 (Cyan)
} as const;

// ━━━━━━━━━━━━━━━━━━━━
// 알림 우선순위
// ━━━━━━━━━━━━━━━━━━━━
export const ALERT_PRIORITY = {
  critical: { label: '긴급', priority: 1, color: STATUS_COLORS.critical },
  warning: { label: '주의', priority: 2, color: STATUS_COLORS.warning },
  info: { label: '정보', priority: 3, color: STATUS_COLORS.info },
  normal: { label: '정상', priority: 4, color: STATUS_COLORS.normal },
} as const;

// ━━━━━━━━━━━━━━━━━━━━
// 사이드바 메뉴 아이콘 매핑
// ━━━━━━━━━━━━━━━━━━━━
export const MENU_ICONS = {
  dashboard: 'LayoutDashboard',
  analytics: 'BarChart3',
  devices: 'Cpu',
  alerts: 'Bell',
  reports: 'FileText',
  settings: 'Settings',
  users: 'Users',
  energy: 'Zap',
  schedule: 'Calendar',
  carbon: 'Leaf',
} as const;

// ━━━━━━━━━━━━━━━━━━━━
// 반응형 브레이크포인트
// ━━━━━━━━━━━━━━━━━━━━
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

// ━━━━━━━━━━━━━━━━━━━━
// 애니메이션 설정
// ━━━━━━━━━━━━━━━━━━━━
export const ANIMATIONS = {
  fast: 'duration-150',
  normal: 'duration-300',
  slow: 'duration-500',
  easeOut: 'ease-out',
  easeInOut: 'ease-in-out',
} as const;

// ━━━━━━━━━━━━━━━━━━━━
// 간격 (Spacing)
// ━━━━━━━━━━━━━━━━━━━━
export const SPACING = {
  sidebarWidth: 256,        // 사이드바 너비
  sidebarCollapsed: 64,     // 접힌 사이드바 너비
  headerHeight: 64,         // 헤더 높이
  contentPadding: 24,       // 콘텐츠 패딩
  cardGap: 16,              // 카드 간격
} as const;
