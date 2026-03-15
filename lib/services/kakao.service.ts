/**
 * lib/services/kakao.service.ts
 *
 * 탄소이음 카카오 알림톡 발송 서비스 (Solapi ATA)
 *
 * ── 발송 우선순위 ────────────────────────────────────────────────
 *   1. SOLAPI_KAKAO_CHANNEL_ID 설정 → 카카오 알림톡(ATA)
 *      → 알림톡 실패 시 SMS/LMS 자동 폴백 (disableSms: false)
 *   2. 채널 ID 미설정 → SMS/LMS 직접 발송
 *   3. API 키 미설정 → dev 모드 콘솔 출력
 *
 * ── 이벤트 타입별 템플릿 환경변수 ─────────────────────────────────
 *   SOLAPI_KAKAO_TEMPLATE_LOGIN         로그인 보안 알림
 *   SOLAPI_KAKAO_TEMPLATE_POWER         전력 임계값 경고/위험
 *   SOLAPI_KAKAO_TEMPLATE_GATEWAY       게이트웨이 오프라인
 *   SOLAPI_KAKAO_TEMPLATE_DR            DR 이벤트 등록
 *   SOLAPI_KAKAO_TEMPLATE_SUBSCRIPTION  구독 만료 임박
 *   SOLAPI_KAKAO_TEMPLATE_ANOMALY       AI 이상 탐지
 *   SOLAPI_KAKAO_TEMPLATE_BACKUP        백업 결과
 *   SOLAPI_KAKAO_TEMPLATE_SECURITY      보안 이벤트
 *   SOLAPI_KAKAO_TEMPLATE_GENERAL       일반 알림 (기본 폴백)
 *
 * ── 필수 환경변수 ────────────────────────────────────────────────
 *   SOLAPI_API_KEY             Solapi API 키
 *   SOLAPI_API_SECRET          Solapi API 시크릿
 *   SOLAPI_SENDER_PHONE        발신 번호 (사전 등록)
 *   SOLAPI_KAKAO_CHANNEL_ID    카카오 채널 pfId (선택)
 */

import { createHmac } from 'crypto';

// ─── 이벤트 타입 정의 ─────────────────────────────────────────────

export type KakaoEventType =
  | 'login'          // 로그인 보안 알림
  | 'power_warning'  // 전력 경고
  | 'power_critical' // 전력 위험
  | 'gateway'        // 게이트웨이 오프라인
  | 'dr_event'       // DR 이벤트
  | 'subscription'   // 구독 만료 임박
  | 'anomaly'        // AI 이상 탐지
  | 'backup'         // 백업 완료/실패
  | 'security'       // 보안 이벤트 (비밀번호 변경 등)
  | 'general';       // 일반 알림

const TEMPLATE_ENV_KEYS: Record<KakaoEventType, string> = {
  login:         'SOLAPI_KAKAO_TEMPLATE_LOGIN',
  power_warning: 'SOLAPI_KAKAO_TEMPLATE_POWER',
  power_critical:'SOLAPI_KAKAO_TEMPLATE_POWER',
  gateway:       'SOLAPI_KAKAO_TEMPLATE_GATEWAY',
  dr_event:      'SOLAPI_KAKAO_TEMPLATE_DR',
  subscription:  'SOLAPI_KAKAO_TEMPLATE_SUBSCRIPTION',
  anomaly:       'SOLAPI_KAKAO_TEMPLATE_ANOMALY',
  backup:        'SOLAPI_KAKAO_TEMPLATE_BACKUP',
  security:      'SOLAPI_KAKAO_TEMPLATE_SECURITY',
  general:       'SOLAPI_KAKAO_TEMPLATE_GENERAL',
};

const EVENT_TITLES: Record<KakaoEventType, string> = {
  login:         '[탄소이음] 로그인 알림',
  power_warning: '[탄소이음] ⚠ 전력 경고',
  power_critical:'[탄소이음] 🔴 전력 위험',
  gateway:       '[탄소이음] 게이트웨이 오프라인',
  dr_event:      '[탄소이음] DR 이벤트 등록',
  subscription:  '[탄소이음] 구독 만료 임박',
  anomaly:       '[탄소이음] 에너지 이상 탐지',
  backup:        '[탄소이음] 백업 알림',
  security:      '[탄소이음] 보안 알림',
  general:       '[탄소이음] 알림',
};

function getTemplateId(eventType: KakaoEventType): string | undefined {
  return process.env[TEMPLATE_ENV_KEYS[eventType]] ?? process.env.SOLAPI_KAKAO_TEMPLATE_GENERAL;
}

// ─── 인증 헤더 빌더 ──────────────────────────────────────────────

function buildAuthHeader(apiKey: string, apiSecret: string): string {
  const date      = new Date().toISOString();
  const salt      = Math.random().toString(36).substring(2, 15);
  const signature = createHmac('sha256', apiSecret)
    .update(date + salt)
    .digest('hex');
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

// ─── 전화번호 정규화 ─────────────────────────────────────────────

function normalizeKoPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('82'))  return '+' + digits;
  if (digits.startsWith('0'))   return '+82' + digits.slice(1);
  return '+82' + digits;
}

// ─── 서비스 활성화 여부 ──────────────────────────────────────────

/** 카카오 알림톡 채널 설정 여부 (알림톡 ATA 전용) */
export function isAlimtalkEnabled(): boolean {
  return isKakaoEnabled() && !!process.env.SOLAPI_KAKAO_CHANNEL_ID;
}

/** Solapi 기본 설정 여부 (API 키 + Secret + 발신번호) */
export function isKakaoEnabled(): boolean {
  return !!(
    process.env.SOLAPI_API_KEY &&
    process.env.SOLAPI_API_SECRET &&
    process.env.SOLAPI_SENDER_PHONE
  );
}

// ─── 발송 옵션 인터페이스 ────────────────────────────────────────

export interface SendKakaoOpts {
  /** 수신 전화번호 (국내 형식 가능: 010-xxxx-xxxx) */
  to: string;
  /** 이벤트 타입 — 템플릿 자동 선택 및 제목 표기에 사용 */
  eventType?: KakaoEventType;
  /**
   * 카카오 알림톡 템플릿 ID (직접 지정 시 eventType보다 우선)
   * 미제공 시 eventType → 환경변수 자동 선택
   */
  templateId?: string;
  /**
   * 알림톡 템플릿 변수 (#{변수명} 형식)
   * 예: { '#{alert_name}': 'DR 이벤트', '#{message}': '내용' }
   */
  variables?: Record<string, string>;
  /** SMS/LMS 폴백 및 알림톡 본문 텍스트 */
  message: string;
  /** 알림톡 버튼 링크 (선택) */
  buttons?: Array<{ name: string; type: 'WL'; url_mobile: string; url_pc?: string }>;
}

// ─── 핵심 발송 함수 ──────────────────────────────────────────────

/**
 * 카카오 알림톡 발송 (SMS/LMS 폴백 포함)
 *
 * - SOLAPI_KAKAO_CHANNEL_ID 설정: 알림톡 → 실패 시 SMS 자동 폴백
 * - SOLAPI_KAKAO_CHANNEL_ID 미설정: SMS/LMS 직접 발송
 * - 환경변수 미설정: dev 모드 콘솔 출력
 */
export async function sendKakao(opts: SendKakaoOpts): Promise<void> {
  const apiKey    = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  const from      = process.env.SOLAPI_SENDER_PHONE;
  const pfId      = process.env.SOLAPI_KAKAO_CHANNEL_ID;

  const eventType  = opts.eventType ?? 'general';
  const eventTitle = EVENT_TITLES[eventType];

  // dev 모드: API 키 미설정 시 콘솔 출력
  if (!apiKey || !apiSecret || !from) {
    console.info(
      `[카카오:dev] ${eventTitle} → ${opts.to.substring(0, 7)}*** :\n` +
      opts.message.substring(0, 100) +
      (opts.message.length > 100 ? '...' : '')
    );
    return;
  }

  const to   = normalizeKoPhone(opts.to);
  const text = opts.message;
  const msgPayload: Record<string, unknown> = { to, from, text };

  if (pfId) {
    // 카카오 알림톡 (ATA) — SMS/LMS 자동 폴백
    const templateId = opts.templateId ?? getTemplateId(eventType);
    msgPayload.type = 'ATA';
    msgPayload.kakaoOptions = {
      pfId,
      ...(templateId ? { templateId } : {}),
      variables: opts.variables ?? {
        '#{alert_name}': eventTitle,
        '#{message}':    text,
        '#{service}':    '탄소이음 EMS',
      },
      disableSms: false, // 알림톡 실패 시 SMS/LMS 자동 폴백
      ...(opts.buttons?.length
        ? {
            buttons: opts.buttons.map((btn) => ({
              buttonName: btn.name,
              buttonType: btn.type,
              linkMo:     btn.url_mobile,
              linkPc:     btn.url_pc ?? btn.url_mobile,
            })),
          }
        : {}),
    };
    console.info(
      `[카카오:알림톡] ${eventTitle} → ${to.substring(0, 8)}*** ` +
      `(채널=${pfId.substring(0, 8)}, 템플릿=${templateId ?? '기본'})`
    );
  } else {
    // SMS / LMS 직접 발송
    const byteLen = Buffer.byteLength(text, 'utf8');
    msgPayload.type = byteLen <= 90 ? 'SMS' : 'LMS';
    if (byteLen > 90) msgPayload.subject = eventTitle;
    console.info(`[카카오:${msgPayload.type}] ${eventTitle} → ${to.substring(0, 8)}***`);
  }

  const response = await fetch('https://api.solapi.com/messages/v4/send', {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization:  buildAuthHeader(apiKey, apiSecret),
    },
    body: JSON.stringify({ message: msgPayload }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    // IP 차단 오류 명시적 안내 (console.solapi.com → API 키 → IP 허용 목록)
    if (response.status === 403 && errText.includes('허용되지 않은 IP')) {
      const ipMatch = errText.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
      const blockedIp = ipMatch ? ipMatch[1] : '(IP 확인 불가)';
      throw new Error(
        `[Solapi IP 차단] 서버 IP(${blockedIp})가 허용 목록에 없습니다. ` +
        `해결: console.solapi.com → API 키 관리 → IP 허용 목록에 ${blockedIp} 추가 (또는 IP 제한 비활성화)`
      );
    }
    throw new Error(`카카오/SMS 발송 실패: HTTP ${response.status} - ${errText.substring(0, 200)}`);
  }
}

// ─── 편의 함수 ───────────────────────────────────────────────────

/**
 * 로그인 보안 알림 발송.
 * 로그인 성공 시 해당 계정 본인의 휴대폰으로 발송.
 */
export async function sendLoginAlert(opts: {
  to: string;
  userName: string;
  loginTime: Date;
  ipAddress?: string;
  provider?: string;
}): Promise<void> {
  const timeStr = opts.loginTime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  const method  = opts.provider === 'google' ? 'Google 로그인' :
                  opts.provider === 'naver'  ? '네이버 로그인' : '이메일/비밀번호';

  const message =
    `탄소이음 EMS 로그인이 감지되었습니다.\n\n` +
    `• 이름: ${opts.userName}\n` +
    `• 방법: ${method}\n` +
    `• 시각: ${timeStr}\n` +
    (opts.ipAddress ? `• IP: ${opts.ipAddress}\n` : '') +
    `\n본인이 아닌 경우 즉시 비밀번호를 변경하고 관리자에게 연락하세요.`;

  await sendKakao({
    to:        opts.to,
    eventType: 'login',
    message,
    variables: {
      '#{user_name}':    opts.userName,
      '#{login_time}':   timeStr,
      '#{login_method}': method,
      '#{ip_address}':   opts.ipAddress ?? '알 수 없음',
      '#{service}':      '탄소이음 EMS',
    },
  });
}

/**
 * 보안 이벤트 알림 (비밀번호 변경, 역할 변경 등).
 */
export async function sendSecurityAlert(opts: {
  to: string;
  userName: string;
  eventDescription: string;
  eventTime?: Date;
}): Promise<void> {
  const timeStr = (opts.eventTime ?? new Date()).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

  const message =
    `[탄소이음] 보안 이벤트가 발생했습니다.\n\n` +
    `• 대상: ${opts.userName}\n` +
    `• 내용: ${opts.eventDescription}\n` +
    `• 시각: ${timeStr}\n\n` +
    `본인이 요청하지 않은 경우 즉시 관리자에게 연락하세요.`;

  await sendKakao({
    to:        opts.to,
    eventType: 'security',
    message,
    variables: {
      '#{user_name}':  opts.userName,
      '#{event}':      opts.eventDescription,
      '#{event_time}': timeStr,
      '#{service}':    '탄소이음 EMS',
    },
  });
}
