/**
 * lib/services/notification.service.ts
 *
 * 권한별 알림 디스패처 (Central Notification Dispatcher)
 *
 * 핵심 변경사항:
 * - notifyByRole() 이 NotificationLog를 생성 → /alerts 페이지에 모든 알림 표시
 * - SMS 채널 지원: rule.smsEnabled + user.phone 조합
 * - 사용자 규칙 없으면 해당 카테고리 기본 규칙 자동 생성
 * - 내부 이벤트 카테고리 → DB AlertCategory enum 자동 매핑
 *
 * 이벤트 → 최소 역할 매핑:
 * ┌─────────────────────────────┬──────────────────────────────────┐
 * │ 이벤트                      │ 수신 대상 (최소 역할)             │
 * ├─────────────────────────────┼──────────────────────────────────┤
 * │ ANOMALY_DETECTED (critical) │ operator 이상                    │
 * │ ANOMALY_DETECTED (high)     │ site_manager 이상                │
 * │ DR_EVENT_CREATED            │ operator 이상                    │
 * │ GATEWAY_OFFLINE             │ site_manager 이상                │
 * │ SUBSCRIPTION_EXPIRING       │ tenant_admin 이상                │
 * │ NEW_USER_JOINED             │ tenant_admin 이상                │
 * │ SUPPORT_STATUS_CHANGED      │ 문의자 이메일 (직접 발송)         │
 * └─────────────────────────────┴──────────────────────────────────┘
 */

import { prisma } from '@/lib/db/prisma';
import { sendNotificationEmail, SUPPORT_EMAIL } from '@/lib/services/email.service';
// [SMS_DISABLED] SMS 서비스 전체 비활성화 — 재활성화 시 아래 주석 해제
// import { sendKakao, sendLoginAlert, type KakaoEventType } from '@/lib/services/kakao.service';
import type { KakaoEventType } from '@/lib/services/kakao.service'; // type만 유지 (notifyByRole 옵션 타입용)

// ─── 역할 계층 ──────────────────────────────────────────────────

const ROLE_HIERARCHY: Record<string, number> = {
  viewer: 0,
  operator: 1,
  site_manager: 2,
  tenant_admin: 3,
  super_admin: 4,
};

function getRolesAtOrAbove(minRole: string): string[] {
  const minLevel = ROLE_HIERARCHY[minRole] ?? 0;
  return Object.entries(ROLE_HIERARCHY)
    .filter(([, level]) => level >= minLevel)
    .map(([role]) => role);
}

// ─── 카테고리 / 심각도 매핑 ──────────────────────────────────────

/** 내부 이벤트 카테고리 → DB AlertCategory enum 매핑 */
const CATEGORY_MAP: Record<string, string> = {
  anomaly:         'energy',
  energy:          'energy',
  dr_event:        'dr',
  dr:              'dr',
  gateway:         'device',
  device:          'device',
  subscription:    'system',
  user_management: 'system',
  support:         'system',
  system:          'system',
  security:        'security',
  carbon:          'carbon',
  cost:            'cost',
};

/** 내부 심각도 → DB AlertSeverity enum 매핑 */
const SEVERITY_MAP: Record<string, 'info' | 'warning' | 'critical'> = {
  critical: 'critical',
  high:     'critical',
  warning:  'warning',
  medium:   'warning',
  info:     'info',
  low:      'info',
};

/** AlertCategory별 기본 규칙 이름 */
const DEFAULT_RULE_NAMES: Record<string, string> = {
  energy:   '에너지 알림',
  device:   '설비 알림',
  system:   '시스템 알림',
  security: '보안 알림',
  dr:       'DR/수요반응 알림',
  carbon:   '탄소 알림',
  cost:     '비용 알림',
};

// ─── 인터페이스 ─────────────────────────────────────────────────

interface NotifyRoleOpts {
  tenantId: string;
  minRole: string;
  ruleName: string;
  category: string;
  severity: 'info' | 'warning' | 'critical' | 'high' | 'medium' | 'low';
  message: string;
  excludeUserId?: string;
  /** 카카오 이벤트 타입 (템플릿 자동 선택에 사용) */
  kakaoEventType?: KakaoEventType;
}

// [SMS_DISABLED] 카테고리 → 카카오 이벤트 타입 기본 매핑 (SMS 재활성화 시 주석 해제)
// const KAKAO_EVENT_MAP: Record<string, KakaoEventType> = {
//   anomaly:         'anomaly',
//   energy:          'power_warning',
//   dr_event:        'dr_event',
//   dr:              'dr_event',
//   gateway:         'gateway',
//   device:          'gateway',
//   subscription:    'subscription',
//   system:          'general',
//   security:        'security',
//   carbon:          'general',
//   cost:            'general',
// };

interface LogEntry {
  ruleId: string;
  channel: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  errorMsg: string | null;
  sentAt: Date | null;
}

// ─── 기본 규칙 자동 생성 ─────────────────────────────────────────

/**
 * 사용자에게 해당 카테고리 알림 규칙이 없으면 기본 규칙을 자동 생성합니다.
 * 생성된 규칙은 알림 설정 페이지에서 사용자가 직접 수정할 수 있습니다.
 */
async function findOrCreateDefaultRule(
  tenantId: string,
  userId: string,
  alertCategory: string,
  alertSeverity: 'info' | 'warning' | 'critical',
) {
  // 기존 규칙 조회
  const existing = await prisma.notificationRule.findFirst({
    where: { tenantId, userId, category: alertCategory as never },
  });
  if (existing) return existing;

  // 없으면 기본 규칙 생성
  try {
    return await prisma.notificationRule.create({
      data: {
        tenantId,
        userId,
        name: DEFAULT_RULE_NAMES[alertCategory] ?? '알림',
        category: alertCategory as never,
        severity: alertSeverity as never,
        emailEnabled: true,
        smsEnabled: false,
        enabled: true,
      },
    });
  } catch {
    // 동시 생성 충돌 → 재조회 후 반환
    return prisma.notificationRule.findFirst({
      where: { tenantId, userId, category: alertCategory as never },
    });
  }
}

// ─── 핵심 디스패처 ──────────────────────────────────────────────

/**
 * 테넌트 내 특정 역할 이상의 모든 활성 사용자에게 알림 발송
 *
 * - 이메일 + SMS 채널 지원
 * - 발송 결과를 NotificationLog에 기록 → /alerts 페이지에 표시
 * - 사용자 규칙 없으면 기본 규칙 자동 생성
 * - 최대 50명 발송 (대량 발송 방지)
 */
export async function notifyByRole(opts: NotifyRoleOpts): Promise<void> {
  try {
    const eligibleRoles = getRolesAtOrAbove(opts.minRole);
    const alertCategory = CATEGORY_MAP[opts.category] ?? 'system';
    const alertSeverity = SEVERITY_MAP[opts.severity] ?? 'info';
    const subject = `[${opts.ruleName}] ${alertSeverity === 'critical' ? '🔴 위험' : alertSeverity === 'warning' ? '🟡 경고' : '🔵 정보'} 알림`;

    // 대상 사용자 조회 (phone 포함, 규칙은 별도 조회)
    const users = await prisma.user.findMany({
      where: {
        tenantId: opts.tenantId,
        role: { in: eligibleRoles as never[] },
        isActive: true,
        deletedAt: null,
        ...(opts.excludeUserId ? { NOT: { id: opts.excludeUserId } } : {}),
      },
      select: { id: true, email: true, name: true, phone: true },
      take: 50,
    });

    if (users.length === 0) return;

    // 사용자별 병렬 발송 (개별 실패 무시)
    await Promise.allSettled(
      users.map(async (user) => {
        // 규칙 찾기 or 자동 생성
        const rule = await findOrCreateDefaultRule(
          opts.tenantId,
          user.id,
          alertCategory,
          alertSeverity,
        );
        if (!rule || !rule.enabled) return;

        const logs: LogEntry[] = [];

        // ── 이메일 발송 ──────────────────────────────────────────
        if (rule.emailEnabled) {
          let status: 'sent' | 'failed' = 'sent';
          let errorMsg: string | null = null;
          try {
            await sendNotificationEmail({
              to: user.email,
              ruleName: opts.ruleName,
              category: opts.category,
              severity: opts.severity,
              message: opts.message,
              isTest: false,
            });
          } catch (err) {
            status = 'failed';
            errorMsg = err instanceof Error ? err.message : String(err);
          }
          logs.push({
            ruleId:    rule.id,
            channel:   'email',
            recipient: user.email,
            subject,
            body:      opts.message,
            status,
            errorMsg,
            sentAt:    status === 'sent' ? new Date() : null,
          });
        }

        // ── [SMS_DISABLED] 카카오 알림톡/SMS 발송 일시 비활성화 ──────
        // 카카오 비즈니스 채널 미개설로 SMS 기능을 일시 중단합니다.
        // 재활성화: 아래 주석 블록을 해제하세요.
        /*
        if (rule.smsEnabled && user.phone) {
          let status: 'sent' | 'failed' = 'sent';
          let errorMsg: string | null = null;
          const kakaoEventType =
            opts.kakaoEventType ??
            KAKAO_EVENT_MAP[opts.category] ??
            KAKAO_EVENT_MAP[alertCategory] ??
            'general';
          try {
            await sendKakao({
              to:        user.phone,
              eventType: kakaoEventType,
              message:   opts.message,
              variables: {
                '#{alert_name}': opts.ruleName,
                '#{message}':    opts.message.substring(0, 200),
                '#{service}':    '탄소이음 EMS',
              },
            });
          } catch (err) {
            status = 'failed';
            errorMsg = err instanceof Error ? err.message : String(err);
          }
          logs.push({
            ruleId:    rule.id,
            channel:   'kakao',
            recipient: user.phone,
            subject,
            body:      opts.message,
            status,
            errorMsg,
            sentAt:    status === 'sent' ? new Date() : null,
          });
        }
        */

        // ── NotificationLog 일괄 저장 ─────────────────────────────
        if (logs.length > 0) {
          await prisma.notificationLog.createMany({ data: logs });
        }
      })
    );

    console.info(
      `[알림] "${opts.ruleName}" → ${users.length}명 발송 처리 완료 (테넌트: ${opts.tenantId})`
    );
  } catch (err) {
    console.error('[알림] notifyByRole 오류:', err instanceof Error ? err.message : err);
  }
}

// ─── 사용자 기본 알림 규칙 초기화 ───────────────────────────────

/**
 * 새 사용자 가입 시 모든 카테고리 기본 알림 규칙 자동 생성
 * - 이메일 활성화, SMS 비활성화 (사용자가 직접 변경 가능)
 */
export async function initDefaultNotificationRules(
  tenantId: string,
  userId: string,
): Promise<void> {
  const categories = ['energy', 'device', 'system', 'security', 'dr', 'carbon', 'cost'];

  const existingRules = await prisma.notificationRule.findMany({
    where: { tenantId, userId },
    select: { category: true },
  });
  const existingCategories = new Set(existingRules.map((r) => r.category));

  const toCreate = categories
    .filter((cat) => !existingCategories.has(cat as never))
    .map((cat) => ({
      tenantId,
      userId,
      name: DEFAULT_RULE_NAMES[cat] ?? '알림',
      category: cat as never,
      severity: 'warning' as never,
      emailEnabled: true,
      smsEnabled: false,
      enabled: true,
    }));

  if (toCreate.length > 0) {
    await prisma.notificationRule.createMany({ data: toCreate });
  }
}

// ──────────────────────────────────────────────────────────────────
// 이벤트별 알림 함수
// ──────────────────────────────────────────────────────────────────

// ── 1. 고객 지원 문의 상태 변경 ─────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  pending:     '접수 대기',
  in_progress: '처리 중',
  resolved:    '답변 완료',
  closed:      '종료',
};

const STATUS_SEVERITIES: Record<string, 'info' | 'warning' | 'critical' | 'high' | 'medium' | 'low'> = {
  pending:     'warning',
  in_progress: 'info',
  resolved:    'low',
  closed:      'low',
};

/**
 * 고객 지원 문의 상태 변경 → 문의자에게 이메일 알림
 * (개인 이메일로 직접 발송 — NotificationRule 불필요)
 */
export async function notifySupportStatusChanged(inquiry: {
  id: string;
  email: string;
  name: string;
  subject: string;
  status: string;
  adminNote?: string | null;
}): Promise<void> {
  const statusLabel = STATUS_LABELS[inquiry.status] ?? inquiry.status;
  const severity    = STATUS_SEVERITIES[inquiry.status] ?? 'info';
  const shortId     = inquiry.id.substring(0, 8).toUpperCase();

  let message = `안녕하세요, ${inquiry.name}님.\n`;
  message += `문의하신 "[${shortId}] ${inquiry.subject}"의 상태가 "${statusLabel}"(으)로 변경되었습니다.\n`;

  if (inquiry.status === 'resolved' && inquiry.adminNote) {
    message += `\n담당자 답변:\n${inquiry.adminNote}`;
  } else if (inquiry.status === 'resolved') {
    message += `\n담당자가 문의를 검토하였습니다. 추가 문의사항은 ${SUPPORT_EMAIL}로 연락해 주세요.`;
  }

  try {
    await sendNotificationEmail({
      to:       inquiry.email,
      ruleName: '고객 지원 문의 상태 업데이트',
      category: 'support',
      severity,
      message,
      isTest:   false,
    });
    console.info(`[알림] 문의 상태 변경 이메일 발송 → ${inquiry.email.substring(0, 3)}*** (${statusLabel})`);
  } catch (err) {
    console.error('[알림] 문의 상태 알림 오류:', err instanceof Error ? err.message : err);
  }
}

// ── 2. 이상 탐지 알림 ───────────────────────────────────────────

/**
 * AI 이상 탐지 결과 → 역할별 사용자 알림
 * - critical/high만 발송 (medium/low 생략)
 */
export async function notifyAnomalyDetected(opts: {
  tenantId: string;
  siteId?: string | null;
  anomalyCount: number;
  criticalCount: number;
  highCount: number;
  topAnomaly: {
    timestamp: string;
    value: number;
    score: number;
    severity: string;
    reason: string;
  };
}): Promise<void> {
  if (opts.criticalCount === 0 && opts.highCount === 0) return;

  const topSeverity = opts.criticalCount > 0 ? 'critical' : 'high';
  const minRole     = opts.criticalCount > 0 ? 'operator' : 'site_manager';

  const message =
    `에너지 이상 데이터가 감지되었습니다.\n\n` +
    `• 총 이상 감지: ${opts.anomalyCount}건\n` +
    `• Critical: ${opts.criticalCount}건 | High: ${opts.highCount}건\n\n` +
    `가장 심각한 이상:\n` +
    `  - 시간: ${new Date(opts.topAnomaly.timestamp).toLocaleString('ko-KR')}\n` +
    `  - 측정값: ${opts.topAnomaly.value.toFixed(2)}\n` +
    `  - 이상 점수: ${opts.topAnomaly.score.toFixed(2)}σ\n` +
    `  - 원인: ${opts.topAnomaly.reason}\n\n` +
    `실시간 모니터링 페이지에서 즉시 확인해 주세요.`;

  await notifyByRole({
    tenantId: opts.tenantId,
    minRole,
    ruleName: 'AI 에너지 이상 탐지',
    category: 'anomaly',
    severity: topSeverity,
    message,
  });

  // Critical 이상이면 운영팀 메일에도 추가 발송
  if (opts.criticalCount > 0) {
    sendNotificationEmail({
      to:       SUPPORT_EMAIL,
      ruleName: 'AI 에너지 이상 탐지 (위험)',
      category: 'anomaly',
      severity: 'critical',
      message:  `[테넌트: ${opts.tenantId}]\n` + message,
      isTest:   false,
    }).catch(() => null);
  }
}

// ── 7. 로그인 보안 알림 ──────────────────────────────────────────

/**
 * 로그인 성공 시 해당 사용자 본인의 휴대폰으로 카카오 알림톡 발송.
 * 사용자가 phone을 등록하지 않은 경우 발송 생략.
 *
 * session.ts signIn 콜백에서 fire-and-forget으로 호출.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function notifyUserLogin(_opts: {
  userId: string;
  userName: string;
  loginTime: Date;
  ipAddress?: string;
  provider?: string;
}): Promise<void> { const opts = _opts; void opts; // [SMS_DISABLED]
  try {
    // [SMS_DISABLED] 로그인 알림톡 일시 비활성화 — 재활성화 시 return 제거 + 아래 블록 해제
    return;
    // const user = await prisma.user.findUnique({
    //   where:  { id: opts.userId },
    //   select: { phone: true },
    // });
    /*
    if (!user?.phone) return;
    await sendLoginAlert({
      to:         user.phone,
      userName:   opts.userName,
      loginTime:  opts.loginTime,
      ipAddress:  opts.ipAddress,
      provider:   opts.provider,
    });
    */
  } catch (err) {
    console.warn('[알림] 로그인 알림톡 발송 실패 (비크리티컬):', err instanceof Error ? err.message : err);
  }
}

// ── 8. 역할/권한 변경 보안 알림 ─────────────────────────────────

/**
 * 사용자 역할 변경, 비밀번호 재설정 등 보안 이벤트 시 알림.
 */
export async function notifySecurityEvent(opts: {
  tenantId: string;
  targetUserId: string;
  eventDescription: string;
  performedByName?: string;
}): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where:  { id: opts.targetUserId },
      select: { phone: true, name: true, email: true },
    });

    if (!user) return;

    // [SMS_DISABLED] 보안 이벤트 알림톡 일시 비활성화
    // 재활성화: 아래 주석 블록 해제
    /*
    const { sendSecurityAlert } = await import('@/lib/services/kakao.service');
    if (user.phone) {
      await sendSecurityAlert({
        to:               user.phone,
        userName:         user.name ?? user.email,
        eventDescription: opts.eventDescription,
        eventTime:        new Date(),
      }).catch((err) =>
        console.warn('[알림] 보안 이벤트 알림톡 발송 실패:', err instanceof Error ? err.message : err)
      );
    }
    */

    // 보안 알림은 역할 제한 없이 해당 사용자에게만 발송
    await notifyByRole({
      tenantId:      opts.tenantId,
      minRole:       'tenant_admin',
      ruleName:      '보안 이벤트',
      category:      'security',
      severity:      'warning',
      kakaoEventType: 'security',
      message:
        `보안 이벤트가 발생했습니다.\n\n` +
        `• 대상: ${user.name ?? user.email}\n` +
        `• 내용: ${opts.eventDescription}\n` +
        `• 발생 시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}\n` +
        (opts.performedByName ? `• 처리자: ${opts.performedByName}\n` : ''),
    });
  } catch (err) {
    console.error('[알림] 보안 이벤트 알림 오류:', err instanceof Error ? err.message : err);
  }
}

// ── 3. DR 이벤트 생성 알림 ──────────────────────────────────────

/**
 * DR 이벤트 생성 → operator 이상 사용자 알림
 */
export async function notifyDrEventCreated(opts: {
  tenantId: string;
  eventId: string;
  title: string;
  startTime: Date;
  endTime: Date;
  targetReductionKw: number;
  createdByName?: string;
}): Promise<void> {
  const start    = opts.startTime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  const end      = opts.endTime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  const duration = Math.round((opts.endTime.getTime() - opts.startTime.getTime()) / 60000);

  const message =
    `수요반응(DR) 이벤트가 등록되었습니다.\n\n` +
    `• 이벤트명: ${opts.title}\n` +
    `• 시작: ${start}\n` +
    `• 종료: ${end} (${duration}분)\n` +
    `• 목표 감축량: ${opts.targetReductionKw.toLocaleString()} kW\n` +
    (opts.createdByName ? `• 등록자: ${opts.createdByName}\n` : '') +
    `\n제어 스케줄 페이지에서 DR 이벤트를 확인하고 대응해 주세요.`;

  await notifyByRole({
    tenantId: opts.tenantId,
    minRole:  'operator',
    ruleName: 'DR 이벤트 등록',
    category: 'dr_event',
    severity: 'warning',
    message,
  });
}

// ── 4. 게이트웨이 오프라인 알림 ─────────────────────────────────

/**
 * 게이트웨이 오프라인 감지 → site_manager 이상 알림
 */
export async function notifyGatewayOffline(opts: {
  tenantId: string;
  gatewayId: string;
  gatewayName: string;
  serialNumber: string;
  lastSeenAt?: Date | null;
}): Promise<void> {
  const lastSeen = opts.lastSeenAt
    ? opts.lastSeenAt.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
    : '알 수 없음';

  const message =
    `게이트웨이 연결이 끊어졌습니다.\n\n` +
    `• 게이트웨이: ${opts.gatewayName}\n` +
    `• 시리얼 번호: ${opts.serialNumber}\n` +
    `• 마지막 통신: ${lastSeen}\n\n` +
    `네트워크 상태 및 장치 전원을 확인해 주세요.\n` +
    `설정 → 게이트웨이 메뉴에서 상세 정보를 확인하실 수 있습니다.`;

  await notifyByRole({
    tenantId: opts.tenantId,
    minRole:  'site_manager',
    ruleName: '게이트웨이 오프라인',
    category: 'gateway',
    severity: 'critical',
    message,
  });
}

// ── 5. 구독 만료 임박 알림 ─────────────────────────────────────

/**
 * 구독 만료 임박 → tenant_admin 이상 알림
 */
export async function notifySubscriptionExpiring(opts: {
  tenantId: string;
  planName: string;
  expiresAt: Date;
  daysLeft: number;
}): Promise<void> {
  const expiresStr = opts.expiresAt.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });

  const message =
    `구독 플랜 만료가 임박했습니다.\n\n` +
    `• 플랜: ${opts.planName}\n` +
    `• 만료일: ${expiresStr}\n` +
    `• 남은 기간: ${opts.daysLeft}일\n\n` +
    `서비스 중단 없이 계속 이용하시려면 구독을 갱신해 주세요.\n` +
    `설정 → 구독 관리 메뉴에서 갱신하실 수 있습니다.`;

  await notifyByRole({
    tenantId: opts.tenantId,
    minRole:  'tenant_admin',
    ruleName: '구독 만료 임박',
    category: 'subscription',
    severity: opts.daysLeft <= 3 ? 'critical' : 'warning',
    message,
  });
}

// ── 6. 새 사용자 가입 알림 ─────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  viewer:       '뷰어',
  operator:     '운영자',
  site_manager: '사이트 관리자',
  tenant_admin: '테넌트 관리자',
};

/**
 * 새 사용자 테넌트 추가 → tenant_admin 이상 알림
 */
export async function notifyNewUserJoined(opts: {
  tenantId: string;
  newUserName: string;
  newUserEmail: string;
  newUserRole: string;
}): Promise<void> {
  const message =
    `새로운 사용자가 워크스페이스에 추가되었습니다.\n\n` +
    `• 이름: ${opts.newUserName}\n` +
    `• 이메일: ${opts.newUserEmail}\n` +
    `• 역할: ${ROLE_LABELS[opts.newUserRole] ?? opts.newUserRole}\n\n` +
    `관리자 → 사용자 관리 메뉴에서 역할 및 권한을 조정하실 수 있습니다.`;

  await notifyByRole({
    tenantId: opts.tenantId,
    minRole:  'tenant_admin',
    ruleName: '새 사용자 추가',
    category: 'user_management',
    severity: 'info',
    message,
  });
}
