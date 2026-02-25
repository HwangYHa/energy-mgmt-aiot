/**
 * lib/services/notification.service.ts
 *
 * 권한별 알림 디스패처 (Central Notification Dispatcher)
 *
 * 이벤트 → 대상 역할 매핑:
 * ┌────────────────────────────┬────────────────────────────────────┐
 * │ 이벤트                     │ 수신 대상 (최소 역할)               │
 * ├────────────────────────────┼────────────────────────────────────┤
 * │ SUPPORT_STATUS_CHANGED     │ 문의자 이메일 (직접 지정)           │
 * │ ANOMALY_DETECTED (critical)│ operator 이상 모든 사용자           │
 * │ ANOMALY_DETECTED (high)    │ site_manager 이상 모든 사용자       │
 * │ DR_EVENT_CREATED           │ operator 이상 모든 사용자           │
 * │ GATEWAY_OFFLINE            │ site_manager 이상 모든 사용자       │
 * │ SUBSCRIPTION_EXPIRING      │ tenant_admin 이상 모든 사용자       │
 * │ NEW_USER_JOINED            │ tenant_admin 이상 모든 사용자       │
 * └────────────────────────────┴────────────────────────────────────┘
 */

import { prisma } from '@/lib/db/prisma';
import { sendNotificationEmail, SUPPORT_EMAIL } from '@/lib/services/email.service';

// ─── 역할 계층 ──────────────────────────────────────────────────

const ROLE_HIERARCHY: Record<string, number> = {
  viewer: 0,
  operator: 1,
  site_manager: 2,
  tenant_admin: 3,
  super_admin: 4,
};

/** 최소 역할 이상인 역할 목록 반환 */
function getRolesAtOrAbove(minRole: string): string[] {
  const minLevel = ROLE_HIERARCHY[minRole] ?? 0;
  return Object.entries(ROLE_HIERARCHY)
    .filter(([, level]) => level >= minLevel)
    .map(([role]) => role);
}

// ─── 이메일 템플릿 기본 구조 ─────────────────────────────────────

interface NotifyRoleOpts {
  tenantId: string;
  minRole: string;                        // operator | site_manager | tenant_admin
  ruleName: string;                       // 알림 규칙명 (제목 표시용)
  category: string;                       // 알림 카테고리
  severity: 'info' | 'warning' | 'critical' | 'high' | 'medium' | 'low';
  message: string;                        // 이메일 본문
  excludeUserId?: string;                 // 이 userId는 발송 제외 (본인 제외)
}

/**
 * 테넌트 내 특정 역할 이상의 모든 활성 사용자에게 이메일 알림 발송
 * - 최대 50명까지 발송 (대량 발송 방지)
 * - 발송 실패가 전체 처리를 막지 않도록 개별 에러 처리
 */
export async function notifyByRole(opts: NotifyRoleOpts): Promise<void> {
  try {
    const eligibleRoles = getRolesAtOrAbove(opts.minRole);

    const users = await prisma.user.findMany({
      where: {
        tenantId: opts.tenantId,
        role: { in: eligibleRoles as never[] },
        isActive: true,
        deletedAt: null,
        NOT: opts.excludeUserId ? { id: opts.excludeUserId } : undefined,
      },
      select: { id: true, email: true, name: true },
      take: 50,
    });

    if (users.length === 0) return;

    // 병렬 발송 (개별 실패 무시)
    await Promise.allSettled(
      users.map((user) =>
        sendNotificationEmail({
          to: user.email,
          ruleName: opts.ruleName,
          category: opts.category,
          severity: opts.severity,
          message: opts.message,
          isTest: false,
        })
      )
    );

    console.info(
      `[Notification] ${opts.ruleName} → ${users.length}명 발송 (tenantId: ${opts.tenantId})`
    );
  } catch (err) {
    console.error('[Notification] notifyByRole 오류:', err instanceof Error ? err.message : err);
  }
}

// ────────────────────────────────────────────────────────────────
// 이벤트별 알림 함수
// ────────────────────────────────────────────────────────────────

// ── 1. 고객 지원 문의 상태 변경 ─────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  pending: '접수 대기',
  in_progress: '처리 중',
  resolved: '답변 완료',
  closed: '종료',
};

const STATUS_COLORS: Record<string, 'info' | 'warning' | 'high' | 'low'> = {
  pending: 'warning',
  in_progress: 'info',
  resolved: 'low',
  closed: 'low',
};

/**
 * 고객 지원 문의 상태 변경 → 문의자에게 이메일 알림
 */
export async function notifySupportStatusChanged(inquiry: {
  id: string;
  email: string;     // 문의자 이메일
  name: string;      // 문의자 이름
  subject: string;   // 문의 제목
  status: string;    // 변경된 상태
  adminNote?: string | null;
}): Promise<void> {
  const statusLabel = STATUS_LABELS[inquiry.status] ?? inquiry.status;
  const severity = STATUS_COLORS[inquiry.status] ?? 'info';
  const shortId = inquiry.id.substring(0, 8).toUpperCase();

  let message = `안녕하세요, ${inquiry.name}님.\n`;
  message += `문의하신 "[${shortId}] ${inquiry.subject}"의 상태가 "${statusLabel}"(으)로 변경되었습니다.\n`;

  if (inquiry.status === 'resolved' && inquiry.adminNote) {
    message += `\n담당자 답변:\n${inquiry.adminNote}`;
  } else if (inquiry.status === 'resolved') {
    message += `\n담당자가 문의를 검토하였습니다. 추가 문의사항이 있으시면 ${SUPPORT_EMAIL}로 연락해 주세요.`;
  }

  try {
    await sendNotificationEmail({
      to: inquiry.email,
      ruleName: `고객 지원 문의 상태 업데이트`,
      category: 'support',
      severity,
      message,
      isTest: false,
    });
    console.info(`[Notification] 문의 상태 변경 알림 → ${inquiry.email.substring(0, 3)}*** (${statusLabel})`);
  } catch (err) {
    console.error('[Notification] 문의 상태 알림 오류:', err instanceof Error ? err.message : err);
  }
}

// ── 2. 이상 탐지 알림 ──────────────────────────────────────────

/**
 * AI 이상 탐지 결과 → 역할별 사용자 이메일 알림
 * - critical/high → operator 이상 모든 사용자
 * - critical만 → 관리자 메일(SUPPORT_EMAIL)에도 추가 발송
 *
 * 스팸 방지: critical/high 이상만 발송
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
  // critical 또는 high 이상만 알림 (medium/low는 알림 생략)
  if (opts.criticalCount === 0 && opts.highCount === 0) return;

  const topSeverity = opts.criticalCount > 0 ? 'critical' : 'high';
  const minRole = opts.criticalCount > 0 ? 'operator' : 'site_manager';

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

  // critical 이상이면 관리자 메일에도 추가 발송
  if (opts.criticalCount > 0) {
    sendNotificationEmail({
      to: SUPPORT_EMAIL,
      ruleName: 'AI 에너지 이상 탐지 (Critical)',
      category: 'anomaly',
      severity: 'critical',
      message: `[테넌트: ${opts.tenantId}]\n` + message,
      isTest: false,
    }).catch(() => null);
  }
}

// ── 3. DR 이벤트 생성 알림 ──────────────────────────────────────

/**
 * DR 이벤트 생성 → operator 이상 모든 사용자 알림
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
  const start = opts.startTime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  const end = opts.endTime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
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
    minRole: 'operator',
    ruleName: 'DR 이벤트 등록',
    category: 'dr_event',
    severity: 'warning',
    message,
  });
}

// ── 4. 게이트웨이 오프라인 알림 ─────────────────────────────────

/**
 * 게이트웨이 오프라인 → site_manager 이상 알림
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
    minRole: 'site_manager',
    ruleName: '게이트웨이 오프라인',
    category: 'gateway',
    severity: 'high',
    message,
  });
}

// ── 5. 구독 만료 임박 알림 ─────────────────────────────────────

/**
 * 구독 만료 임박 → tenant_admin 알림
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
    minRole: 'tenant_admin',
    ruleName: '구독 만료 임박',
    category: 'subscription',
    severity: opts.daysLeft <= 3 ? 'critical' : 'warning',
    message,
  });
}

// ── 6. 새 사용자 가입 알림 ─────────────────────────────────────

/**
 * 새 사용자 테넌트 가입 → tenant_admin 알림
 */
export async function notifyNewUserJoined(opts: {
  tenantId: string;
  newUserName: string;
  newUserEmail: string;
  newUserRole: string;
}): Promise<void> {
  const roleLabel: Record<string, string> = {
    viewer: '뷰어',
    operator: '운영자',
    site_manager: '사이트 관리자',
    tenant_admin: '테넌트 관리자',
  };

  const message =
    `새로운 사용자가 워크스페이스에 추가되었습니다.\n\n` +
    `• 이름: ${opts.newUserName}\n` +
    `• 이메일: ${opts.newUserEmail}\n` +
    `• 역할: ${roleLabel[opts.newUserRole] ?? opts.newUserRole}\n\n` +
    `관리자 → 사용자 관리 메뉴에서 역할 및 권한을 조정하실 수 있습니다.`;

  await notifyByRole({
    tenantId: opts.tenantId,
    minRole: 'tenant_admin',
    ruleName: '새 사용자 추가',
    category: 'user_management',
    severity: 'info',
    message,
  });
}
