/**
 * 구독 플랜 정의 및 기능 제한
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │  탄소이음 가격 공식 (2026 기준)                              │
 * │                                                             │
 * │  고정 운영비: 서버₩135K + 도메인₩20K + 광고₩100K = ₩255K/월 │
 * │  BEP: Pro 1명(₩290K) 또는 Basic 3명(₩297K) → 즉시 흑자    │
 * │  심리가격: ₩99K(10만원미만) / ₩290K(30만원미만)             │
 * │                                                             │
 * │  ROI 공식: 플랜 비용 = 월 절감액의 1/3 이하 (최소 3:1 ROI) │
 * │  Basic ₩99K → 월 전기요금 ₩1M, 10%절감 = ₩100K → ROI 1x  │
 * │  Pro   ₩290K → 월 전기요금 ₩3M, 10%절감 = ₩300K → ROI 1x  │
 * └─────────────────────────────────────────────────────────────┘
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
  // Starter (무료/체험) — 소프트웨어 전용. IoT 하드웨어 최소 지원
  trial: {
    maxSites: 1,
    maxDevices: 3,   // 최소 체험: 게이트웨이 1대 + 센서 2개 (체험 전환율 향상)
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

  // Basic ₩99K — 소규모 공장/건물 (월 전기요금 ₩1M~₩5M, 10% 절감 → 첫달부터 ROI)
  basic: {
    maxSites: 3,
    maxDevices: 50,
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

  // Pro ₩290K — 중견 공장/복합시설 (월 전기요금 ₩3M~₩30M, AI·DR·ESG 완전 대응)
  pro: {
    maxSites: 10,
    maxDevices: 200,
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
    // 목적: 진입 장벽 제거 → 체험 전환율 향상 → 유료 전환 퍼널 구축
    description: '무료로 시작 — 신용카드 불필요, 30일 무제한 체험',
    monthlyPrice: 0,
    yearlyPrice: 0,
    installationFee: 0,
    installationIncludes: [
      '고지서 업로드 · 수동 입력 가능',
      'IoT 센서 최대 3개 체험',
      '30일 데이터 보관',
      '신용카드 정보 불필요',
    ],
    color: 'slate',
  },
  basic: {
    name: 'Basic',
    // 가격 근거:
    //   ① 심리적 가격대: ₩99K = "10만원 미만" (소형 사업장 승인 없이 결제 가능)
    //   ② ROI: 월 전기요금 ₩1M 사업장 10% 절감 = ₩100K/월 → 첫달부터 본전
    //   ③ BEP: Basic 3명 = ₩297K > 고정 운영비 ₩255K → 흑자 전환
    //   ④ 경쟁사 대비: 한전KDN 기본 모니터링 ₩100K대 / 스마트팩토리 ₩200K대
    description: '월 전기요금 ₩1M+ 소규모 공장·건물 — 첫달부터 ROI',
    monthlyPrice: 99000,
    yearlyPrice: 990000,     // 월 ₩82,500 — 17% 절감 (연간 ₩198K 절약)
    installationFee: 300000,
    installationIncludes: [
      '원격 설치 지원 (2시간)',
      '게이트웨이 최대 2대 설정',
      '센서 최대 10개 등록',
      '※ 하드웨어(게이트웨이·센서) 별도 구매',
    ],
    color: 'blue',
  },
  pro: {
    name: 'Professional',
    // 가격 근거:
    //   ① 심리적 가격대: ₩290K = "30만원 미만" (중견 사업장 결재 라인 통과 용이)
    //   ② ROI: 월 전기요금 ₩3M 사업장 10% 절감 = ₩300K/월 → 즉시 ROI
    //   ③ BEP: Pro 1명 = ₩290K > 고정 운영비 ₩255K → 단독 흑자 전환
    //   ④ AI·DR·ESG 컴플라이언스·탄소배출권 포함으로 차별화
    description: '월 전기요금 ₩3M+ 중견 공장 · AI·DR·ESG 완전 대응',
    monthlyPrice: 290000,
    yearlyPrice: 2900000,    // 월 ₩241,667 — 17% 절감 (연간 ₩580K 절약)
    installationFee: 1500000,
    installationIncludes: [
      '현장 방문 설치 (1일)',
      '게이트웨이 + 센서 전체 커미셔닝',
      'EMS 대시보드 커스터마이징',
      '운영자 교육 (2시간)',
      '※ 하드웨어(게이트웨이·센서·PLC) 별도 구매',
    ],
    badge: '인기',
    color: 'cyan',
  },
  enterprise: {
    name: 'Enterprise',
    // 가격 근거:
    //   ① 최소 기준선: ₩890K/월 (운영비 3.5배, 영업이익률 71% 확보)
    //   ② 맞춤 견적: 사이트 수·디바이스 수·커스텀 연동에 따라 상향
    //   ③ 타겟: 월 전기요금 ₩30M+ 대규모 공단·복합시설·데이터센터
    description: '월 전기요금 ₩30M+ 대규모 조직 · 맞춤형 솔루션',
    monthlyPrice: null,      // 맞춤 견적 (최소 ₩890K 내부 기준)
    yearlyPrice: null,
    installationFee: null,
    installationIncludes: [
      '전담 PM 배정',
      '멀티 사이트 통합 설치',
      '맞춤형 시스템 연동 (PLC/SCADA/BMS)',
      '운영자 교육 프로그램',
      'SLA 99.9% 보장',
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
