/**
 * HMI (Human-Machine Interface) 타입 정의
 * 산업용 에너지 관리 대시보드에서 사용하는 데이터 구조
 */

export type HMIStatus = 'normal' | 'warning' | 'danger';

/**
 * 에너지 모니터링 데이터
 */
export interface EnergyData {
  currentUsage: number; // 현재 전력 사용량 (kW)
  targetUsage: number; // 목표 전력 사용량 (kW)
  peakLimit: number; // 계약 전력 (피크 제한, kW)
  savings: number; // 절감량 (kWh)
  savingsCost: number; // 절감 비용 (₩)
  usageRate: number; // 목표 대비 사용률 (%)
  peakRate: number; // 피크 대비 사용률 (%)
  trend: number[]; // 실시간 차트 데이터 (최근 24시간, 시간당 평균)
  status: HMIStatus;
  lastUpdate: Date;
}

/**
 * 설비 상태 데이터
 */
export interface EquipmentData {
  normalCount: number; // 정상 설비 개수
  warningCount: number; // 경고 설비 개수
  dangerCount: number; // 위험 설비 개수
  totalCount: number; // 전체 설비 개수
  abnormalDevices: AbnormalDevice[]; // 이상 설비 목록 (최근 5개)
  status: HMIStatus;
  lastUpdate: Date;
}

export interface AbnormalDevice {
  id: string;
  deviceName: string;
  deviceType: string;
  status: HMIStatus;
  message: string;
  timestamp: Date;
  siteId: string;
  siteName: string;
}

/**
 * 탄소 배출 데이터
 */
export interface CarbonData {
  currentEmissions: number; // 당일 누적 배출량 (kg CO2)
  baselineEmissions: number; // 기준선 배출량 (kg CO2)
  targetReductionRate: number; // 목표 감축률 (%)
  actualReductionRate: number; // 실제 감축률 (%)
  savingsEmissions: number; // 절감량 (kg CO2) - 음수면 초과
  trend: number[]; // 시간별 배출량 추이 (최근 24시간)
  status: HMIStatus;
  lastUpdate: Date;
}

/**
 * 알람 데이터
 */
export interface Alert {
  id: string;
  type: 'energy' | 'equipment' | 'carbon' | 'dr' | 'system';
  severity: HMIStatus;
  title: string;
  message: string;
  timestamp: Date;
  siteId?: string;
  siteName?: string;
  deviceId?: string;
  deviceName?: string;
  acknowledged: boolean;
  actionRequired: boolean;
}

/**
 * 사이트별 상태
 */
export interface SiteStatus {
  siteId: string;
  siteName: string;
  status: HMIStatus;
  currentUsage: number; // kW
  peakRate: number; // 피크 사용률 (%)
  warningCount: number; // 경고 개수
  dangerCount: number; // 위험 개수
  message?: string; // 상태 메시지
  lastUpdate: Date;
}

/**
 * AI 예측 및 최적화 추천
 */
export interface OptimizationRecommendation {
  id: string;
  type: 'peak_shaving' | 'ess_control' | 'hvac_optimization' | 'dr_participation';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  expectedSavings: number; // kWh
  expectedCost: number; // ₩
  targetTime?: Date;
  siteId?: string;
  siteName?: string;
}

/**
 * 대시보드 전체 데이터
 */
export interface DashboardOverview {
  energy: EnergyData;
  equipment: EquipmentData;
  carbon: CarbonData;
  alerts: Alert[];
  sites: SiteStatus[];
  recommendations: OptimizationRecommendation[];
  timestamp: Date;
}

/**
 * HMI 색상 시스템
 */
export const HMI_STATUS_COLORS = {
  normal: {
    bg: 'bg-green-900/20',
    border: 'border-green-500',
    text: 'text-green-400',
    glow: 'shadow-green-500/20',
  },
  warning: {
    bg: 'bg-yellow-900/20',
    border: 'border-yellow-500',
    text: 'text-yellow-400',
    glow: 'shadow-yellow-500/20',
  },
  danger: {
    bg: 'bg-red-900/20',
    border: 'border-red-500',
    text: 'text-red-400',
    glow: 'shadow-red-500/20',
  },
} as const;

/**
 * 상태 계산 로직
 */
export function calculateEnergyStatus(
  currentUsage: number,
  targetUsage: number,
  peakLimit: number
): HMIStatus {
  const usageRate = (currentUsage / targetUsage) * 100;
  const peakRate = (currentUsage / peakLimit) * 100;

  // 피크 전력 초과가 가장 위험
  if (peakRate >= 95 || usageRate >= 100) {
    return 'danger';
  }

  if (peakRate >= 80 || usageRate >= 90) {
    return 'warning';
  }

  return 'normal';
}

export function calculateEquipmentStatus(
  dangerCount: number,
  warningCount: number
): HMIStatus {
  if (dangerCount > 0) {
    return 'danger';
  }

  if (warningCount > 0) {
    return 'warning';
  }

  return 'normal';
}

export function calculateCarbonStatus(
  actualReductionRate: number,
  targetReductionRate: number
): HMIStatus {
  const deviation = actualReductionRate - targetReductionRate;

  // 목표 대비 10% 이상 초과 배출
  if (deviation < -10) {
    return 'danger';
  }

  // 목표 대비 5% 이상 초과 배출
  if (deviation < -5) {
    return 'warning';
  }

  return 'normal';
}
