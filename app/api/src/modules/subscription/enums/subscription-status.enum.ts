// apps/api/src/modules/subscription/enums/subscription-status.enum.ts

/**
 * 구독 상태 Enum
 * 
 * Prisma Schema와 동기화 필요
 * 변경 시 prisma/schema.prisma의 SubscriptionStatus도 함께 수정
 */
export enum SubscriptionStatus {
  PRE_PAYMENT = 'PRE_PAYMENT',           // 결제 전
  PAID = 'PAID',                         // 결제 완료
  INSTALL_SCHEDULED = 'INSTALL_SCHEDULED', // 설치 예정
  INSTALLED = 'INSTALLED',               // 설치 완료 (데이터 미수집)
  ACTIVE = 'ACTIVE',                     // 정상 운영 ✅
  EXPIRE_SOON = 'EXPIRE_SOON',           // 만료 임박 (7일 전)
  EXPIRED = 'EXPIRED',                   // 만료 (읽기 전용)
  SUSPENDED = 'SUSPENDED',               // 일시 정지
  TERMINATED = 'TERMINATED',             // 계약 종료
}

/**
 * 구독 상태별 허용 기능 매트릭스
 */
export const SUBSCRIPTION_PERMISSIONS = {
  [SubscriptionStatus.PRE_PAYMENT]: {
    login: false,
    view: false,
    control: false,
    analytics: false,
    reports: false,
    dataCollection: false,
  },
  [SubscriptionStatus.PAID]: {
    login: true,
    view: true,
    control: false,
    analytics: false,
    reports: false,
    dataCollection: false,
  },
  [SubscriptionStatus.INSTALL_SCHEDULED]: {
    login: true,
    view: true,
    control: false,
    analytics: false,
    reports: false,
    dataCollection: false,
  },
  [SubscriptionStatus.INSTALLED]: {
    login: true,
    view: true,
    control: false,
    analytics: false,
    reports: false,
    dataCollection: true,
  },
  [SubscriptionStatus.ACTIVE]: {
    login: true,
    view: true,
    control: true,
    analytics: true,
    reports: true,
    dataCollection: true,
  },
  [SubscriptionStatus.EXPIRE_SOON]: {
    login: true,
    view: true,
    control: true,
    analytics: true,
    reports: true,
    dataCollection: true,
  },
  [SubscriptionStatus.EXPIRED]: {
    login: true,
    view: true,
    control: false,
    analytics: false,
    reports: true, // 과거 리포트 조회 가능
    dataCollection: false,
  },
  [SubscriptionStatus.SUSPENDED]: {
    login: true,
    view: true,
    control: false,
    analytics: false,
    reports: false,
    dataCollection: false,
  },
  [SubscriptionStatus.TERMINATED]: {
    login: false,
    view: false,
    control: false,
    analytics: false,
    reports: false,
    dataCollection: false,
  },
} as const;

/**
 * 상태 전환 규칙
 */
export const SUBSCRIPTION_TRANSITIONS = {
  [SubscriptionStatus.PRE_PAYMENT]: [SubscriptionStatus.PAID],
  [SubscriptionStatus.PAID]: [
    SubscriptionStatus.INSTALL_SCHEDULED,
    SubscriptionStatus.TERMINATED,
  ],
  [SubscriptionStatus.INSTALL_SCHEDULED]: [
    SubscriptionStatus.INSTALLED,
    SubscriptionStatus.TERMINATED,
  ],
  [SubscriptionStatus.INSTALLED]: [
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.SUSPENDED,
  ],
  [SubscriptionStatus.ACTIVE]: [
    SubscriptionStatus.EXPIRE_SOON,
    SubscriptionStatus.SUSPENDED,
    SubscriptionStatus.TERMINATED,
  ],
  [SubscriptionStatus.EXPIRE_SOON]: [
    SubscriptionStatus.ACTIVE, // 갱신
    SubscriptionStatus.EXPIRED,
    SubscriptionStatus.TERMINATED,
  ],
  [SubscriptionStatus.EXPIRED]: [
    SubscriptionStatus.ACTIVE, // 재활성화
    SubscriptionStatus.TERMINATED,
  ],
  [SubscriptionStatus.SUSPENDED]: [
    SubscriptionStatus.ACTIVE, // 재개
    SubscriptionStatus.TERMINATED,
  ],
  [SubscriptionStatus.TERMINATED]: [], // 최종 상태
} as const;

/**
 * 상태 전환 가능 여부 확인
 */
export function canTransition(
  from: SubscriptionStatus,
  to: SubscriptionStatus,
): boolean {
  return SUBSCRIPTION_TRANSITIONS[from].includes(to);
}

/**
 * 특정 기능 사용 가능 여부 확인
 */
export function canUseFeature(
  status: SubscriptionStatus,
  feature: keyof typeof SUBSCRIPTION_PERMISSIONS[SubscriptionStatus.ACTIVE],
): boolean {
  return SUBSCRIPTION_PERMISSIONS[status]?.[feature] ?? false;
}