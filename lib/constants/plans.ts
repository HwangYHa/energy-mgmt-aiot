/**
 * 구독 플랜 정의 및 기능 제한
 *
 * Starter (무료/체험), Professional, Enterprise 3단계
 */

export interface PlanFeatureSet {
  // 리소스 제한
  maxSites: number | null; // null = 무제한
  maxDevices: number | null;
  maxUsers: number | null;
  dataRetentionDays: number;
  apiRateLimit: number; // req/min

  // 기능 플래그
  features: {
    realtimeMonitoring: boolean;
    historicalAnalytics: boolean;
    aiForecast: boolean;
    anomalyDetection: boolean;
    drEventManagement: boolean;
    scheduleControl: boolean;
    manualControl: boolean;
    optimizationControl: boolean;
    reportGeneration: boolean;
    reportExcel: boolean;
    reportPdf: boolean;
    complianceTracking: boolean;
    carbonAccounting: boolean;
    multiSite: boolean;
    customAlertRules: boolean;
    emailNotifications: boolean;
    smsNotifications: boolean;
    webhookIntegration: boolean;
    apiAccess: boolean;
    ssoIntegration: boolean;
    auditLog: boolean;
    prioritySupport: boolean;
    dedicatedManager: boolean;
    customDevelopment: boolean;
    slaGuarantee: boolean;
  };
}

export const PLAN_FEATURES: Record<string, PlanFeatureSet> = {
  // Starter (무료/체험)
  trial: {
    maxSites: 1,
    maxDevices: 10,
    maxUsers: 2,
    dataRetentionDays: 30,
    apiRateLimit: 100,
    features: {
      realtimeMonitoring: true,
      historicalAnalytics: true,
      aiForecast: false,
      anomalyDetection: false,
      drEventManagement: false,
      scheduleControl: false,
      manualControl: true,
      optimizationControl: false,
      reportGeneration: true,
      reportExcel: true,
      reportPdf: false,
      complianceTracking: false,
      carbonAccounting: false,
      multiSite: false,
      customAlertRules: true,
      emailNotifications: true,
      smsNotifications: false,
      webhookIntegration: false,
      apiAccess: false,
      ssoIntegration: false,
      auditLog: false,
      prioritySupport: false,
      dedicatedManager: false,
      customDevelopment: false,
      slaGuarantee: false,
    },
  },

  // Basic (Starter 유료)
  basic: {
    maxSites: 3,
    maxDevices: 50,
    maxUsers: 10,
    dataRetentionDays: 90,
    apiRateLimit: 500,
    features: {
      realtimeMonitoring: true,
      historicalAnalytics: true,
      aiForecast: true,
      anomalyDetection: false,
      drEventManagement: false,
      scheduleControl: true,
      manualControl: true,
      optimizationControl: false,
      reportGeneration: true,
      reportExcel: true,
      reportPdf: true,
      complianceTracking: false,
      carbonAccounting: true,
      multiSite: true,
      customAlertRules: true,
      emailNotifications: true,
      smsNotifications: false,
      webhookIntegration: false,
      apiAccess: true,
      ssoIntegration: false,
      auditLog: true,
      prioritySupport: false,
      dedicatedManager: false,
      customDevelopment: false,
      slaGuarantee: false,
    },
  },

  // Professional
  pro: {
    maxSites: 10,
    maxDevices: 200,
    maxUsers: 30,
    dataRetentionDays: 365,
    apiRateLimit: 2000,
    features: {
      realtimeMonitoring: true,
      historicalAnalytics: true,
      aiForecast: true,
      anomalyDetection: true,
      drEventManagement: true,
      scheduleControl: true,
      manualControl: true,
      optimizationControl: true,
      reportGeneration: true,
      reportExcel: true,
      reportPdf: true,
      complianceTracking: true,
      carbonAccounting: true,
      multiSite: true,
      customAlertRules: true,
      emailNotifications: true,
      smsNotifications: true,
      webhookIntegration: true,
      apiAccess: true,
      ssoIntegration: false,
      auditLog: true,
      prioritySupport: true,
      dedicatedManager: false,
      customDevelopment: false,
      slaGuarantee: false,
    },
  },

  // Enterprise
  enterprise: {
    maxSites: null,
    maxDevices: null,
    maxUsers: null,
    dataRetentionDays: 730,
    apiRateLimit: 10000,
    features: {
      realtimeMonitoring: true,
      historicalAnalytics: true,
      aiForecast: true,
      anomalyDetection: true,
      drEventManagement: true,
      scheduleControl: true,
      manualControl: true,
      optimizationControl: true,
      reportGeneration: true,
      reportExcel: true,
      reportPdf: true,
      complianceTracking: true,
      carbonAccounting: true,
      multiSite: true,
      customAlertRules: true,
      emailNotifications: true,
      smsNotifications: true,
      webhookIntegration: true,
      apiAccess: true,
      ssoIntegration: true,
      auditLog: true,
      prioritySupport: true,
      dedicatedManager: true,
      customDevelopment: true,
      slaGuarantee: true,
    },
  },
};

// 기능 한국어 라벨
export const FEATURE_LABELS: Record<string, string> = {
  realtimeMonitoring: '실시간 모니터링',
  historicalAnalytics: '이력 분석',
  aiForecast: 'AI 부하 예측',
  anomalyDetection: 'AI 이상 감지',
  drEventManagement: 'DR 이벤트 관리',
  scheduleControl: '스케줄 제어',
  manualControl: '수동 제어',
  optimizationControl: '최적화 제어',
  reportGeneration: '리포트 생성',
  reportExcel: 'Excel 내보내기',
  reportPdf: 'PDF 내보내기',
  complianceTracking: '컴플라이언스 추적',
  carbonAccounting: '탄소 회계',
  multiSite: '멀티 사이트',
  customAlertRules: '커스텀 알림 규칙',
  emailNotifications: '이메일 알림',
  smsNotifications: 'SMS 알림',
  webhookIntegration: 'Webhook 연동',
  apiAccess: 'API 접근',
  ssoIntegration: 'SSO 통합',
  auditLog: '감사 로그',
  prioritySupport: '우선 지원',
  dedicatedManager: '전담 매니저',
  customDevelopment: '맞춤 개발',
  slaGuarantee: 'SLA 보장',
};

// 플랜 표시 정보
export const PLAN_DISPLAY: Record<string, {
  name: string;
  description: string;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  /** 초기 1회 설치(공사)비 — null = 별도 견적 */
  installationFee: number | null;
  /** 설치비에 포함된 내용 */
  installationIncludes: string[];
  badge?: string;
  color: string;
}> = {
  trial: {
    name: 'Starter',
    description: '소규모 사업장을 위한 기본 에너지 관리',
    monthlyPrice: 0,
    yearlyPrice: 0,
    installationFee: 0,
    installationIncludes: ['소프트웨어 전용 (하드웨어 미포함)'],
    color: 'slate',
  },
  basic: {
    name: 'Basic',
    description: '성장하는 기업을 위한 확장된 기능',
    monthlyPrice: 99000,
    yearlyPrice: 990000,
    installationFee: 500000,
    installationIncludes: [
      '원격 설치 지원 (4시간)',
      '게이트웨이 1대 설정',
      '센서 최대 5개 등록',
    ],
    color: 'blue',
  },
  pro: {
    name: 'Professional',
    description: 'AI 기반 고급 에너지 최적화',
    monthlyPrice: 299000,
    yearlyPrice: 2990000,
    installationFee: 1500000,
    installationIncludes: [
      '현장 방문 설치 (1일)',
      '게이트웨이 + 센서 커미셔닝',
      'EMS 대시보드 커스터마이징',
      '사용자 교육 (2시간)',
    ],
    badge: '인기',
    color: 'cyan',
  },
  enterprise: {
    name: 'Enterprise',
    description: '대규모 조직을 위한 맞춤형 솔루션',
    monthlyPrice: null,
    yearlyPrice: null,
    installationFee: null,
    installationIncludes: ['전담 PM 배정', '멀티 사이트 통합 설치', '맞춤형 시스템 연동 (PLC/SCADA)', '운영자 교육 프로그램'],
    color: 'purple',
  },
};

/**
 * 특정 플랜 티어에서 기능 사용 가능 여부 확인
 */
export function isFeatureAvailable(
  tier: string,
  feature: keyof PlanFeatureSet['features']
): boolean {
  const plan = PLAN_FEATURES[tier];
  if (!plan) return false;
  return plan.features[feature];
}

/**
 * 특정 플랜의 리소스 제한 확인
 */
export function getResourceLimit(
  tier: string,
  resource: 'maxSites' | 'maxDevices' | 'maxUsers'
): number | null {
  const plan = PLAN_FEATURES[tier];
  if (!plan) return 0;
  return plan[resource];
}
