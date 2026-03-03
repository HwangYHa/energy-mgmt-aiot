/**
 * lib/services/kakao.service.ts
 *
 * 카카오 알림톡 (Solapi ATA) 발송 서비스
 *
 * - SOLAPI_KAKAO_CHANNEL_ID 설정 시 카카오 알림톡(ATA) 우선 발송
 * - disableSms: false → 알림톡 실패 시 SMS/LMS 자동 폴백
 * - SOLAPI_KAKAO_CHANNEL_ID 미설정 시 SMS/LMS로만 발송
 * - 모든 환경변수 미설정 시 콘솔 출력 (dev mode)
 *
 * 필요 환경변수:
 *   SOLAPI_API_KEY             Solapi API 키
 *   SOLAPI_API_SECRET          Solapi API Secret
 *   SOLAPI_SENDER_PHONE        발신 번호 (사전 등록)
 *   SOLAPI_KAKAO_CHANNEL_ID    카카오 채널 pfId (선택, 없으면 SMS 전용)
 *   SOLAPI_KAKAO_TEMPLATE_ID   기본 알림톡 템플릿 ID (선택)
 */

import { createHmac } from 'crypto';

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
  /**
   * 카카오 알림톡 템플릿 ID (선택)
   * 미제공 시 SOLAPI_KAKAO_TEMPLATE_ID 환경변수 사용
   */
  templateId?: string;
  /**
   * 알림톡 템플릿 변수 (선택)
   * 예: { '#{alert_name}': 'DR 이벤트', '#{message}': '내용' }
   */
  variables?: Record<string, string>;
  /** SMS/LMS 폴백 및 알림톡 본문 텍스트 */
  message: string;
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
  const defaultTemplateId = process.env.SOLAPI_KAKAO_TEMPLATE_ID;

  // dev 모드: 환경변수 미설정 시 콘솔 출력
  if (!apiKey || !apiSecret || !from) {
    console.info(
      `[Kakao:dev] → ${opts.to.substring(0, 7)}*** : ${opts.message.substring(0, 80)}${opts.message.length > 80 ? '...' : ''}`
    );
    return;
  }

  const to   = normalizeKoPhone(opts.to);
  const text = opts.message;

  // 메시지 객체 구성
  const message: Record<string, unknown> = { to, from, text };

  if (pfId) {
    // 카카오 알림톡 (ATA) — SMS 폴백 활성화
    const templateId = opts.templateId ?? defaultTemplateId;
    message.type = 'ATA';
    message.kakaoOptions = {
      pfId,
      ...(templateId ? { templateId } : {}),
      variables: opts.variables ?? {
        '#{alert_name}': opts.message.split('\n')[0] ?? '알림',
        '#{message}':    opts.message,
      },
      disableSms: false, // 알림톡 실패 시 SMS 자동 폴백
    };
  } else {
    // 알림톡 미설정 → SMS/LMS 직접 발송
    const byteLen = Buffer.byteLength(text, 'utf8');
    message.type = byteLen <= 90 ? 'SMS' : 'LMS';
  }

  const response = await fetch('https://api.solapi.com/messages/v4/send', {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization:  buildAuthHeader(apiKey, apiSecret),
    },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`카카오/SMS 발송 실패: HTTP ${response.status} ${errText}`);
  }
}
