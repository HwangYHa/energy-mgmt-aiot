/**
 * lib/services/kakao-alimtalk.service.ts
 *
 * 카카오 알림톡 발송 서비스 (Solapi 연동)
 *
 * ─ 환경변수 ──────────────────────────────────────────────────
 *   SOLAPI_API_KEY         Solapi API 키
 *   SOLAPI_API_SECRET      Solapi API 시크릿
 *   SOLAPI_SENDER_PHONE    발신 번호
 *   SOLAPI_KAKAO_CHANNEL_ID 카카오 채널 ID (pfid)
 *   KAKAO_SENDER_KEY        카카오 발신 프로필 키
 *
 * ─ 미설정 시 ────────────────────────────────────────────────
 *   dev 모드로 동작 — console.info 출력, DB 로그만 저장
 * ─────────────────────────────────────────────────────────────
 */

import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';

// ── 알림톡 템플릿 정의 ────────────────────────────────────────

export const ALIMTALK_TEMPLATES = {
  // 이탈 위험 — 관리자 담당자 알림
  CHURN_CRITICAL: {
    id:      'churn_critical_v1',
    name:    '이탈 위험 고객 긴급 알림',
    message: (v: { tenantName: string; score: number; reasons: string }) =>
      `[탄소이음] ⚠️ 이탈 위험 고객\n\n` +
      `고객사: ${v.tenantName}\n` +
      `이탈 위험 점수: ${v.score}점\n\n` +
      `주요 원인:\n${v.reasons}\n\n` +
      `즉시 고객 컨택이 필요합니다.`,
  },

  // 7일 미접속 고객 리텐션 메시지
  NO_LOGIN_7D: {
    id:      'no_login_7d_v1',
    name:    '7일 미접속 고객 리텐션',
    message: (v: { userName: string; tenantName: string; loginUrl: string }) =>
      `[탄소이음] ${v.userName}님, 안녕하세요!\n\n` +
      `최근 7일간 탄소이음 플랫폼에 접속하지 않으셨습니다.\n\n` +
      `에너지 절감 현황을 확인하고 절감 목표를 달성하세요!\n\n` +
      `📊 지금 확인하기: ${v.loginUrl}`,
  },

  // 온보딩 막힘 — IoT 미연결
  ONBOARDING_IOT_STUCK: {
    id:      'onboarding_iot_stuck_v1',
    name:    '온보딩 IoT 연결 유도',
    message: (v: { userName: string; supportUrl: string }) =>
      `[탄소이음] ${v.userName}님, 안녕하세요!\n\n` +
      `IoT 게이트웨이 연결을 아직 완료하지 않으셨습니다.\n\n` +
      `연결이 완료되면 실시간 에너지 모니터링과 AI 분석이 시작됩니다.\n\n` +
      `📞 설치 지원: ${v.supportUrl}`,
  },

  // ROI 월간 리포트 발송
  ROI_MONTHLY_REPORT: {
    id:      'roi_monthly_report_v1',
    name:    'ROI 월간 리포트',
    message: (v: {
      tenantName: string;
      period: string;
      savedKwh: string;
      savedCost: string;
      co2: string;
      roi: string;
    }) =>
      `[탄소이음] 📊 ${v.period} 에너지 성과 리포트\n\n` +
      `고객사: ${v.tenantName}\n\n` +
      `✅ 에너지 절감: ${v.savedKwh} kWh\n` +
      `💰 비용 절감: ${v.savedCost}원\n` +
      `🌿 탄소 절감: ${v.co2} kg CO₂\n` +
      `📈 투자 대비 수익률: ${v.roi}%\n\n` +
      `탄소이음이 함께 만들어가는 탄소중립을 확인하세요!`,
  },

  // 결제 실패 알림
  PAYMENT_FAILED: {
    id:      'payment_failed_v1',
    name:    '결제 실패 알림',
    message: (v: { tenantName: string; failCount: number; paymentUrl: string }) =>
      `[탄소이음] 결제 오류 안내\n\n` +
      `고객사: ${v.tenantName}\n` +
      `결제 실패 횟수: ${v.failCount}회\n\n` +
      `서비스 연속성을 위해 결제 수단을 확인해주세요.\n\n` +
      `💳 결제 관리: ${v.paymentUrl}`,
  },
} as const;

export type AlimtalkTemplateId = keyof typeof ALIMTALK_TEMPLATES;

export interface SendAlimtalkOptions {
  tenantId?:  string;
  userId?:    string;
  phone:      string;
  templateId: AlimtalkTemplateId;
  variables:  Record<string, string | number>;
}

// ── Solapi 인증 헤더 생성 ─────────────────────────────────────

function makeSolapiAuthHeader(apiKey: string, apiSecret: string): string {
  const date      = new Date().toISOString();
  const salt      = crypto.randomBytes(16).toString('hex');
  const hmac      = crypto.createHmac('sha256', apiSecret);
  hmac.update(date + salt);
  const signature = hmac.digest('hex');
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

// ── 발송 함수 ─────────────────────────────────────────────────

export async function sendAlimtalk(opts: SendAlimtalkOptions): Promise<boolean> {
  // [SMS_DISABLED] Solapi 알림톡 일시 비활성화 — 재활성화 시 아래 3줄 제거
  console.info(`[SMS_DISABLED] sendAlimtalk 비활성화됨 → template=${opts.templateId}, phone=${opts.phone.substring(0, 7)}***`);
  return false;

  const {
    tenantId, userId, phone, templateId, variables,
  } = opts;

  const template = ALIMTALK_TEMPLATES[templateId];
  const message  = template.message(variables as any);
  const isDev    = !process.env.SOLAPI_API_KEY || !process.env.KAKAO_SENDER_KEY;

  if (isDev) {
    console.info('[KakaoAlimtalk][DEV]', {
      phone,
      templateId: template.id,
      message,
    });
    await saveLog(tenantId, userId, phone, template.id, variables, 'sent', 'dev-mode-key');
    return true;
  }

  try {
    const authHeader = makeSolapiAuthHeader(
      process.env.SOLAPI_API_KEY!,
      process.env.SOLAPI_API_SECRET!,
    );

    const body = {
      messages: [{
        to:   phone,
        from: process.env.SOLAPI_SENDER_PHONE,
        kakaoOptions: {
          pfId:      process.env.SOLAPI_KAKAO_CHANNEL_ID,
          templateId: template.id,
          variables,
        },
        text: message, // fallback SMS
      }],
    };

    const res = await fetch('https://api.solapi.com/messages/v4/send-many', {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  authHeader,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    const msgKey = data?.messages?.[0]?.messageId ?? null;

    if (res.ok) {
      await saveLog(tenantId, userId, phone, template.id, variables, 'sent', msgKey);
      return true;
    } else {
      await saveLog(tenantId, userId, phone, template.id, variables, 'failed', null, JSON.stringify(data));
      return false;
    }
  } catch (err: any) {
    console.error('[KakaoAlimtalk] 발송 오류:', err.message);
    await saveLog(tenantId, userId, phone, template.id, variables, 'failed', null, err.message);
    return false;
  }
}

async function saveLog(
  tenantId:   string | undefined,
  userId:     string | undefined,
  phone:      string,
  templateId: string,
  variables:  Record<string, unknown>,
  status:     string,
  msgKey:     string | null,
  failReason?: string,
): Promise<void> {
  const model = (prisma as any).kakaoAlimtalkLog;
  if (!model) return;
  await model.create({
    data: { tenantId, userId, phone, templateId, variables, status, msgKey, failReason },
  }).catch((e: Error) => console.warn('[KakaoAlimtalk] 로그 저장 실패:', e.message));
}

// ── 리텐션 자동 액션 ──────────────────────────────────────────

export interface RetentionActionContext {
  tenantId:    string;
  churnScore:  number;
  trigger:     string;
  recipientId: string;
  phone:       string;
  templateId:  AlimtalkTemplateId;
  variables:   Record<string, string | number>;
  channel:     'kakao' | 'sms';
}

export async function executeRetentionAction(ctx: RetentionActionContext): Promise<void> {
  const sent = await sendAlimtalk({
    tenantId:   ctx.tenantId,
    userId:     ctx.recipientId,
    phone:      ctx.phone,
    templateId: ctx.templateId,
    variables:  ctx.variables,
  });

  const actionModel = (prisma as any).retentionAction;
  if (actionModel) {
    await actionModel.create({
      data: {
        tenantId:      ctx.tenantId,
        trigger:       ctx.trigger,
        churnScore:    ctx.churnScore,
        channel:       ctx.channel,
        templateId:    ALIMTALK_TEMPLATES[ctx.templateId].id,
        recipientId:   ctx.recipientId,
        recipientPhone: ctx.phone,
        status:        sent ? 'sent' : 'failed',
        metadata:      { variables: ctx.variables },
      },
    }).catch((e: Error) => console.warn('[RetentionAction] 저장 실패:', e.message));
  }
}

// ── 이탈 위험 자동 알림 파이프라인 ───────────────────────────

export async function runRetentionPipeline(tenantId: string, churnScore: number, riskLevel: string): Promise<void> {
  // [SMS_DISABLED] Solapi 일시 비활성화 — 재활성화 시 아래 2줄 제거
  console.info(`[SMS_DISABLED] runRetentionPipeline 비활성화됨 → tenantId=${tenantId}, score=${churnScore}`);
  return;

  if (riskLevel !== 'critical' && riskLevel !== 'warning') return;

  // 관리자(super_admin/admin) 담당자 조회
  const admins = await prisma.user.findMany({
    where: {
      role: { in: ['super_admin', 'tenant_admin'] },
      isActive: true,
      phone: { not: null },
    },
    select: { id: true, name: true, phone: true },
    take: 3,
  }).catch(() => []);

  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId },
    select: { name: true },
  });
  if (!tenant) return;

  // 오늘 이미 발송됐는지 중복 체크 (24시간 내)
  const actionModel = (prisma as any).retentionAction;
  if (actionModel) {
    const recentAction = await actionModel.findFirst({
      where: {
        tenantId,
        trigger:  riskLevel === 'critical' ? 'churn_critical' : 'churn_warning',
        sentAt:   { gte: new Date(Date.now() - 86400_000) },
      },
    }).catch(() => null);
    if (recentAction) return; // 24시간 이내 이미 발송
  }

  const reasons = `· 이탈 위험 점수 ${churnScore}점\n· 관리자 즉시 확인 요망`;

  for (const admin of admins) {
    if (!admin.phone) continue;
    await executeRetentionAction({
      tenantId,
      churnScore,
      trigger:     riskLevel === 'critical' ? 'churn_critical' : 'churn_warning',
      recipientId: admin.id,
      phone:       admin.phone as string,
      templateId:  'CHURN_CRITICAL',
      variables: {
        tenantName: tenant!.name,
        score:      churnScore,
        reasons,
      },
      channel: 'kakao',
    });
  }
}
