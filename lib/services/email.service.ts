/**
 * lib/services/email.service.ts
 *
 * 탄소이음 이메일 발송 서비스 (Gmail SMTP)
 *
 * 지원 기능:
 * 1. 고객 지원 문의 - 관리자 알림 (carbonieum.official@gmail.com)
 * 2. 고객 지원 문의 - 사용자 접수 확인
 * 3. 비밀번호 재설정 링크
 * 4. 알림 규칙 이메일 발송 (실제 & 테스트)
 *
 * 환경변수:
 *   GMAIL_USER          = carbonieum.official@gmail.com
 *   GMAIL_APP_PASSWORD  = Gmail 앱 비밀번호 (16자리)
 *   SUPPORT_EMAIL       = carbonieum.official@gmail.com (기본값)
 *   NEXT_PUBLIC_SITE_URL = https://carboneum.kr (기본값)
 */

import nodemailer from 'nodemailer';

// ─── 환경변수 ───────────────────────────────────────────────────

const GMAIL_USER = process.env.GMAIL_USER || '';
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || '';
const EMAIL_FROM = `탄소이음 <${GMAIL_USER || 'carbonieum.official@gmail.com'}>`;
export const SUPPORT_EMAIL =
  process.env.SUPPORT_EMAIL || 'carbonieum.official@gmail.com';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://carbonieum.com';

// ─── 카테고리 라벨 ──────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  general: '일반 문의',
  technical: '기술 지원',
  billing: '결제/구독',
  account: '계정 관리',
  feature: '기능 요청',
  bug: '버그 신고',
};

// ─── Transport 생성 ─────────────────────────────────────────────

let _transport: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransport() {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    return null;
  }
  if (!_transport) {
    _transport = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // STARTTLS
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
      },
    });
  }
  return _transport;
}

/** 이메일 발송 가능 여부 */
export function isEmailEnabled(): boolean {
  return Boolean(GMAIL_USER && GMAIL_APP_PASSWORD);
}

// ─── HTML 템플릿 래퍼 ───────────────────────────────────────────

function wrapTemplate(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#1e293b;border-radius:12px;border:1px solid #334155;overflow:hidden;">
          <!-- 헤더 -->
          <tr>
            <td style="background:linear-gradient(135deg,#065f46 0%,#0e7490 100%);padding:28px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">탄소이음</h1>
              <p style="margin:6px 0 0;color:#a7f3d0;font-size:13px;letter-spacing:0.02em;">에너지 데이터로 세상을 잇다</p>
            </td>
          </tr>
          <!-- 본문 -->
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <!-- 푸터 -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #334155;background:#0f172a;">
              <p style="margin:0;color:#475569;font-size:12px;text-align:center;line-height:1.6;">
                © 2026 탄소이음 · 에너지 데이터로 세상을 잇다<br>
                <a href="${SITE_URL}" style="color:#06b6d4;text-decoration:none;">${SITE_URL}</a>
                &nbsp;·&nbsp;
                <a href="mailto:${SUPPORT_EMAIL}" style="color:#06b6d4;text-decoration:none;">${SUPPORT_EMAIL}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ────────────────────────────────────────────────────────────────
// 1. 고객 지원 문의 — 관리자 알림
//    수신: carbonieum.official@gmail.com
// ────────────────────────────────────────────────────────────────

export async function sendSupportNotificationToAdmin(inquiry: {
  id: string;
  name: string;
  email: string;
  category: string;
  subject: string;
  message: string;
}): Promise<void> {
  const transport = getTransport();
  if (!transport) {
    console.warn('[Email] GMAIL_APP_PASSWORD 미설정 → 관리자 알림 이메일 생략');
    return;
  }

  const categoryLabel = CATEGORY_LABELS[inquiry.category] || inquiry.category;
  const adminUrl = `${SITE_URL}/admin/support`;
  const shortId = inquiry.id.substring(0, 8).toUpperCase();

  const content = `
    <h2 style="margin:0 0 8px;color:#f1f5f9;font-size:20px;font-weight:700;">새 고객 문의가 접수되었습니다</h2>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;">문의 ID: <code style="background:#0f172a;color:#06b6d4;padding:2px 8px;border-radius:4px;font-size:13px;">${shortId}</code></p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:8px;border:1px solid #334155;margin-bottom:28px;">
      <tr>
        <td style="padding:16px 20px;border-bottom:1px solid #1e293b;">
          <p style="margin:0 0 4px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">문의자</p>
          <p style="margin:0;color:#f1f5f9;font-size:15px;font-weight:600;">${inquiry.name}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 20px;border-bottom:1px solid #1e293b;">
          <p style="margin:0 0 4px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">이메일</p>
          <a href="mailto:${inquiry.email}" style="color:#06b6d4;font-size:15px;text-decoration:none;">${inquiry.email}</a>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 20px;border-bottom:1px solid #1e293b;">
          <p style="margin:0 0 8px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">문의 유형</p>
          <span style="background:#065f46;color:#6ee7b7;padding:3px 12px;border-radius:4px;font-size:13px;font-weight:600;">${categoryLabel}</span>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 20px;border-bottom:1px solid #1e293b;">
          <p style="margin:0 0 4px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">제목</p>
          <p style="margin:0;color:#f1f5f9;font-size:15px;font-weight:600;">${inquiry.subject}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 20px;">
          <p style="margin:0 0 8px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">내용</p>
          <p style="margin:0;color:#cbd5e1;font-size:14px;line-height:1.7;white-space:pre-wrap;">${
            inquiry.message.length > 1000
              ? inquiry.message.substring(0, 1000) + '...\n\n[내용이 길어 일부 생략됨]'
              : inquiry.message
          }</p>
        </td>
      </tr>
    </table>

    <a href="${adminUrl}" style="display:inline-block;background:#0e7490;color:#ffffff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;letter-spacing:0.01em;">
      관리자 페이지에서 확인 →
    </a>
  `;

  await transport.sendMail({
    from: EMAIL_FROM,
    to: SUPPORT_EMAIL,
    subject: `[탄소이음] 새 문의 [${categoryLabel}] ${inquiry.subject}`,
    html: wrapTemplate('새 고객 문의', content),
  });

  console.info(`[Email] 관리자 문의 알림 발송 완료 → ${SUPPORT_EMAIL} (ID: ${shortId})`);
}

// ────────────────────────────────────────────────────────────────
// 2. 고객 지원 문의 — 사용자 접수 확인
//    수신: 문의를 제출한 사용자 이메일
// ────────────────────────────────────────────────────────────────

export async function sendSupportConfirmationToUser(inquiry: {
  id: string;
  name: string;
  email: string;
  category: string;
  subject: string;
}): Promise<void> {
  const transport = getTransport();
  if (!transport) {
    console.warn('[Email] GMAIL_APP_PASSWORD 미설정 → 사용자 접수 확인 이메일 생략');
    return;
  }

  const categoryLabel = CATEGORY_LABELS[inquiry.category] || inquiry.category;
  const shortId = inquiry.id.substring(0, 8).toUpperCase();

  const content = `
    <h2 style="margin:0 0 8px;color:#f1f5f9;font-size:20px;font-weight:700;">문의가 접수되었습니다</h2>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;">
      안녕하세요, <strong style="color:#f1f5f9;">${inquiry.name}</strong>님. 문의해주셔서 감사합니다.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:8px;border:1px solid #334155;margin-bottom:24px;">
      <tr>
        <td style="padding:14px 20px;border-bottom:1px solid #1e293b;">
          <p style="margin:0 0 4px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">문의 번호</p>
          <code style="color:#06b6d4;font-size:16px;font-family:monospace;font-weight:700;">${shortId}</code>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 20px;border-bottom:1px solid #1e293b;">
          <p style="margin:0 0 4px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">문의 유형</p>
          <p style="margin:0;color:#f1f5f9;font-size:14px;">${categoryLabel}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 20px;">
          <p style="margin:0 0 4px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">제목</p>
          <p style="margin:0;color:#f1f5f9;font-size:14px;font-weight:600;">${inquiry.subject}</p>
        </td>
      </tr>
    </table>

    <div style="background:#0c4a6e;border:1px solid #0369a1;border-radius:8px;padding:18px 20px;margin-bottom:24px;">
      <p style="margin:0;color:#7dd3fc;font-size:14px;line-height:1.7;">
        ✅ 문의가 정상 접수되었습니다.<br>
        담당자가 검토 후 <strong>영업일 기준 1~2일 이내</strong>에 회신드리겠습니다.<br>
        회신은 <strong style="color:#38bdf8;">${inquiry.email}</strong>으로 발송됩니다.
      </p>
    </div>

    <p style="margin:0;color:#475569;font-size:13px;line-height:1.6;">
      추가 문의사항이 있으시면<br>
      <a href="mailto:${SUPPORT_EMAIL}" style="color:#06b6d4;text-decoration:none;">${SUPPORT_EMAIL}</a>
      로 직접 연락해 주세요.
    </p>
  `;

  await transport.sendMail({
    from: EMAIL_FROM,
    to: inquiry.email,
    subject: `[탄소이음] 문의가 접수되었습니다 (${shortId})`,
    html: wrapTemplate('문의 접수 확인', content),
  });

  console.info(`[Email] 사용자 접수 확인 발송 완료 → ${inquiry.email.substring(0, 3)}*** (ID: ${shortId})`);
}

// ────────────────────────────────────────────────────────────────
// 3. 비밀번호 재설정 링크
//    수신: 재설정을 요청한 사용자 이메일
// ────────────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(
  email: string,
  name: string,
  resetToken: string
): Promise<void> {
  const transport = getTransport();
  if (!transport) {
    console.warn('[Email] GMAIL_APP_PASSWORD 미설정 → 비밀번호 재설정 이메일 생략');
    return;
  }

  const resetUrl = `${SITE_URL}/auth/reset-password?token=${resetToken}`;

  const content = `
    <h2 style="margin:0 0 8px;color:#f1f5f9;font-size:20px;font-weight:700;">비밀번호 재설정</h2>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;">
      안녕하세요, <strong style="color:#f1f5f9;">${name}</strong>님.
    </p>

    <p style="margin:0 0 28px;color:#cbd5e1;font-size:15px;line-height:1.7;">
      탄소이음 계정의 비밀번호 재설정 요청이 접수되었습니다.<br>
      아래 버튼을 클릭하여 새 비밀번호를 설정해주세요.
    </p>

    <div style="margin-bottom:28px;">
      <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#065f46,#0e7490);color:#ffffff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.01em;">
        비밀번호 재설정하기 →
      </a>
    </div>

    <div style="background:#1c1917;border:1px solid #44403c;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;color:#a8a29e;font-size:13px;line-height:1.7;">
        ⚠️ 이 링크는 <strong style="color:#fbbf24;">1시간</strong> 후 자동 만료됩니다.<br>
        본인이 요청하지 않았다면 이 이메일을 무시하세요.<br>
        계정 보안이 우려되시면
        <a href="mailto:${SUPPORT_EMAIL}" style="color:#06b6d4;text-decoration:none;">${SUPPORT_EMAIL}</a>
        로 즉시 문의해 주세요.
      </p>
    </div>

    <p style="margin:0;color:#475569;font-size:12px;line-height:1.6;word-break:break-all;">
      버튼이 작동하지 않으면 아래 링크를 브라우저 주소창에 직접 입력하세요:<br>
      <span style="color:#64748b;">${resetUrl}</span>
    </p>
  `;

  await transport.sendMail({
    from: EMAIL_FROM,
    to: email,
    subject: '[탄소이음] 비밀번호 재설정 링크',
    html: wrapTemplate('비밀번호 재설정', content),
  });

  console.info(`[Email] 비밀번호 재설정 이메일 발송 완료 → ${email.substring(0, 3)}***`);
}

// ────────────────────────────────────────────────────────────────
// 4. 알림 규칙 이메일 발송 (실제 알림 & 테스트)
//    수신: 알림 규칙을 설정한 사용자 이메일
// ────────────────────────────────────────────────────────────────

export async function sendNotificationEmail(opts: {
  to: string;
  ruleName: string;
  category: string;
  severity: string;
  message: string;
  isTest?: boolean;
}): Promise<void> {
  const transport = getTransport();
  if (!transport) {
    console.warn('[Email] GMAIL_APP_PASSWORD 미설정 → 알림 이메일 생략');
    return;
  }

  const SEVERITY_STYLES: Record<string, { bg: string; color: string; label: string }> = {
    critical: { bg: '#450a0a', color: '#f87171', label: 'CRITICAL' },
    high:     { bg: '#431407', color: '#fb923c', label: 'HIGH' },
    medium:   { bg: '#422006', color: '#facc15', label: 'MEDIUM' },
    low:      { bg: '#052e16', color: '#4ade80', label: 'LOW' },
  };

  const style = SEVERITY_STYLES[opts.severity] || { bg: '#1e293b', color: '#94a3b8', label: opts.severity.toUpperCase() };
  const testBadge = opts.isTest ? ' [테스트]' : '';
  const monitoringUrl = `${SITE_URL}/dashboard/realtime`;

  const content = `
    <h2 style="margin:0 0 20px;color:#f1f5f9;font-size:20px;font-weight:700;">
      ${opts.isTest ? '🔔 알림 테스트 발송' : '⚡ 에너지 알림 발생'}
    </h2>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:8px;border:1px solid #334155;margin-bottom:28px;">
      <tr>
        <td style="padding:16px 20px;border-bottom:1px solid #1e293b;">
          <p style="margin:0 0 4px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">알림 규칙</p>
          <p style="margin:0;color:#f1f5f9;font-size:15px;font-weight:600;">${opts.ruleName}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 20px;border-bottom:1px solid #1e293b;">
          <p style="margin:0 0 8px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">심각도</p>
          <span style="background:${style.bg};color:${style.color};border:1px solid ${style.color}44;padding:3px 12px;border-radius:4px;font-size:13px;font-weight:700;letter-spacing:0.05em;">
            ${style.label}
          </span>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 20px;">
          <p style="margin:0 0 4px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">내용</p>
          <p style="margin:0;color:#cbd5e1;font-size:14px;line-height:1.7;">${opts.message}</p>
        </td>
      </tr>
    </table>

    ${
      !opts.isTest
        ? `<a href="${monitoringUrl}" style="display:inline-block;background:#0e7490;color:#ffffff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin-bottom:20px;">
        실시간 모니터링 확인 →
      </a>`
        : `<div style="background:#1e3a5f;border:1px solid #2563eb;border-radius:8px;padding:14px 20px;">
        <p style="margin:0;color:#93c5fd;font-size:13px;">
          ✅ 테스트 이메일이 정상적으로 수신되었습니다.<br>알림 규칙이 올바르게 설정되어 있습니다.
        </p>
      </div>`
    }
  `;

  await transport.sendMail({
    from: EMAIL_FROM,
    to: opts.to,
    subject: `[탄소이음${testBadge}] ${style.label} 알림: ${opts.ruleName}`,
    html: wrapTemplate('에너지 알림', content),
  });

  console.info(`[Email] 알림 이메일 발송 완료 → ${opts.to.substring(0, 3)}*** (${opts.ruleName})`);
}

// ────────────────────────────────────────────────────────────────
// 5. 설치 예약 접수 알림 (관리자 + 고객 확인)
// ────────────────────────────────────────────────────────────────

export interface InstallationRequest {
  contactName: string;
  phone: string;
  email?: string;
  preferredDate: string;
  address?: string;
  planTier?: string;
  tenantName?: string;
  notes?: string;
}

const PLAN_NAME_MAP: Record<string, string> = {
  basic: 'Basic (₩149,000/월)',
  pro: 'Professional (₩399,000/월)',
  enterprise: 'Enterprise (맞춤 견적)',
};

export async function sendInstallationRequestEmail(req: InstallationRequest): Promise<void> {
  const transport = getTransport();
  const planLabel = PLAN_NAME_MAP[req.planTier ?? ''] ?? req.planTier ?? '미지정';
  const dateLabel = req.preferredDate
    ? new Date(req.preferredDate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
    : req.preferredDate;

  // ── 관리자 알림 ──────────────────────────────────────────────
  const adminContent = `
    <h2 style="margin:0 0 20px;color:#ffffff;font-size:20px;font-weight:700;">
      📋 설치 예약 접수
    </h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      ${[
        ['담당자', req.contactName],
        ['연락처', req.phone],
        ['이메일', req.email || '미입력'],
        ['희망 방문일', dateLabel],
        ['사업장 주소', req.address || '미입력'],
        ['선택 플랜', planLabel],
        ['테넌트', req.tenantName || '미확인'],
        ['추가 요청사항', req.notes || '없음'],
      ].map(([label, value]) => `
        <tr>
          <td style="padding:10px 14px;background:#1e293b;border:1px solid #334155;width:120px;color:#94a3b8;font-size:13px;font-weight:600;">${label}</td>
          <td style="padding:10px 14px;background:#0f172a;border:1px solid #334155;color:#e2e8f0;font-size:13px;">${value}</td>
        </tr>
      `).join('')}
    </table>
    <div style="padding:14px 16px;background:#0c4a6e;border-radius:8px;border-left:3px solid #0ea5e9;">
      <p style="margin:0;color:#7dd3fc;font-size:13px;line-height:1.6;">
        <strong>처리 안내:</strong><br>
        1. 위 연락처로 고객에게 연락하여 최종 방문 일정 확정<br>
        2. 현장 실측 후 설치비 최종 확정 (Basic ₩500,000 / Pro ₩1,800,000 기준)<br>
        3. 세금계산서 발행 후 계좌이체 안내<br>
        4. 설치 완료 후 게이트웨이 등록 지원
      </p>
    </div>
  `;

  if (transport) {
    await transport.sendMail({
      from: EMAIL_FROM,
      to: SUPPORT_EMAIL,
      subject: `[설치예약] ${req.contactName} — ${planLabel} — ${req.preferredDate}`,
      html: wrapTemplate('설치 예약 접수', adminContent),
    }).catch(e => console.error('[Email] 설치예약 관리자 알림 실패:', e));
  }

  // ── 고객 확인 메일 (이메일 있을 때만) ───────────────────────
  if (!req.email || !transport) return;

  const customerContent = `
    <h2 style="margin:0 0 8px;color:#ffffff;font-size:20px;font-weight:700;">설치 예약이 접수되었습니다</h2>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;">
      안녕하세요, ${req.contactName}님. 탄소이음 설치 예약이 정상적으로 접수되었습니다.
    </p>
    <div style="padding:16px;background:#0f172a;border-radius:8px;border:1px solid #334155;margin-bottom:24px;">
      <p style="margin:0 0 8px;color:#e2e8f0;font-size:14px;font-weight:600;">접수 내용</p>
      <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.8;">
        • 희망 방문일: <strong style="color:#e2e8f0;">${dateLabel}</strong><br>
        • 선택 플랜: <strong style="color:#e2e8f0;">${planLabel}</strong><br>
        • 연락처: <strong style="color:#e2e8f0;">${req.phone}</strong>
      </p>
    </div>
    <div style="padding:14px 16px;background:#1c1917;border-radius:8px;border-left:3px solid #f59e0b;margin-bottom:24px;">
      <p style="margin:0;color:#fbbf24;font-size:13px;line-height:1.6;">
        <strong>다음 단계 안내</strong><br>
        영업일 1~2일 내 담당자가 연락드려 최종 방문 일정을 확정합니다.<br>
        현장 실측 후 설치비가 확정되며, <strong>세금계산서 발행 → 계좌이체</strong> 방식으로 청구됩니다.<br>
        설치 당일 게이트웨이 등록 및 센서 연결을 지원해 드립니다.
      </p>
    </div>
    <p style="margin:0;color:#64748b;font-size:12px;">
      문의: <a href="mailto:${SUPPORT_EMAIL}" style="color:#06b6d4;">${SUPPORT_EMAIL}</a>
    </p>
  `;

  await transport.sendMail({
    from: EMAIL_FROM,
    to: req.email,
    subject: '[탄소이음] 설치 예약이 접수되었습니다',
    html: wrapTemplate('설치 예약 확인', customerContent),
  }).catch(e => console.error('[Email] 설치예약 고객 확인 메일 실패:', e));

  console.info(`[Email] 설치예약 이메일 발송 → admin + ${req.email?.substring(0, 3)}***`);
}
