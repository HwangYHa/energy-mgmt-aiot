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
  // Starter (무료/체험) — 소프트웨어 전용. IoT 하드웨어 미지원
  trial: {
    maxSites: 1,
    maxDevices: 0,   // IoT 디바이스 미지원 (고지서·수동 입력만 가능)
    maxUsers: 2,
    dataRetentionDays: 30,
    apiRateLimit: 60,
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

  // Basic — 소규모 공장/건물 (월 전기요금 ₩2-5M 타겟, 10% 절감 시 ROI 2~3x)
  basic: {
    maxSites: 3,
    maxDevices: 30,
    maxUsers: 10,
    dataRetentionDays: 365,
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

  // Professional — 중견 공장/복합시설 (월 전기요금 ₩5-30M 타겟, ROI 1.5~7x)
  pro: {
    maxSites: 10,
    maxDevices: 150,
    maxUsers: 50,
    dataRetentionDays: 730,
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
    description: '소프트웨어 무료 체험 — 고지서 업로드·수동 입력 전용',
    monthlyPrice: 0,
    yearlyPrice: 0,
    installationFee: 0,
    installationIncludes: [
      '소프트웨어 전용 (IoT 하드웨어 미지원)',
      '고지서 업로드 · 수동 입력 가능',
      '30일 무료 체험',
    ],
    color: 'slate',
  },
  basic: {
    name: 'Starter',
    // 가격 근거 (2026 ROI 기반): 소규모 사업장 절감액 50~100만원 → ROI 5~10x
    // 월 전기요금 ₩2-5M 타겟, 10% 절감 시 ₩20~50만원 효과
    description: '소규모 공장·건물을 위한 IoT 에너지 관리',
    monthlyPrice: 99000,
    yearlyPrice: 990000,     // 월 ₩82,500 — 17% 절감
    installationFee: 0,
    installationIncludes: [
      '원격 설치 지원 (4시간)',
      '게이트웨이 최대 2대 설정',
      '센서 최대 10개 등록',
      '셀프 온보딩 (원격 지원 포함)',
      '※ 하드웨어(게이트웨이·센서) 별도 구매',
    ],
    color: 'blue',
  },
  pro: {
    name: 'Business',
    // 가격 근거 (2026 ROI 기반): 중소기업 절감액 300~500만원 → ROI 10~16x
    // 월 전기요금 ₩5-30M 타겟, 10% 절감 시 ₩50~300만원 효과
    description: 'AI 기반 고급 최적화 · 탄소중립 대응',
    monthlyPrice: 299000,
    yearlyPrice: 2990000,    // 월 ₩249,167 — 17% 절감
    installationFee: 500000,
    installationIncludes: [
      '현장 방문 설치 (1일)',
      '게이트웨이 + 센서 전체 커미셔닝',
      'EMS 대시보드 커스터마이징',
      '사용자 교육 (2시간)',
      '※ 하드웨어(게이트웨이·센서·PLC) 별도 구매',
    ],
    badge: '인기',
    color: 'cyan',
  },
  enterprise: {
    name: 'Enterprise',
    description: '대규모 조직·멀티사이트를 위한 맞춤형 솔루션',
    monthlyPrice: null,
    yearlyPrice: null,
    installationFee: null,
    installationIncludes: [
      '전담 PM 배정',
      '멀티 사이트 통합 설치',
      '맞춤형 시스템 연동 (PLC/SCADA)',
      '운영자 교육 프로그램',
      '※ 하드웨어·공사비 별도 견적',
    ],
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
