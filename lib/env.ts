/**
 * lib/env.ts - 환경 변수 검증 및 로드
 *
 * 사용:
 *   import env from '@/lib/env';
 *   console.log(env.DATABASE_URL);
 *
 * 규칙:
 *   - 서버에서 반드시 필요한 값 → z.string().min(1) (필수)
 *   - 선택적이거나 폴백이 있는 값 → .optional() 또는 .default(...)
 *   - 이 파일은 서버 사이드 전용 — 클라이언트 컴포넌트에서 import 금지
 */

import { z } from 'zod';

const envSchema = z.object({

  // ── 데이터베이스 ────────────────────────────────────────────
  DATABASE_URL: z.string().url().min(1, 'DATABASE_URL is required'),

  // ── 인증 ────────────────────────────────────────────────────
  NEXTAUTH_URL:    z.string().url().optional(),  // Vercel 배포 시 자동 감지 — 로컬에서 선택
  NEXTAUTH_SECRET: z.string().min(32, 'NEXTAUTH_SECRET must be at least 32 characters'),
  JWT_SECRET:      z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

  // Google / Naver OAuth (미설정 시 해당 로그인 방법 비활성화)
  GOOGLE_CLIENT_ID:     z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  NAVER_CLIENT_ID:      z.string().optional(),
  NAVER_CLIENT_SECRET:  z.string().optional(),
  NAVER_REDIRECT_URI:   z.string().url().optional(),

  // ── 애플리케이션 기본 ────────────────────────────────────────
  NODE_ENV:    z.enum(['development', 'production', 'test']).default('development'),
  WEB_APP_URL: z.string().url().optional(),  // NEXTAUTH_URL 폴백, 네이버 OAuth 콜백용

  // ── AI 엔진 (외부 FastAPI — 미설정 시 로컬 룰 기반 폴백) ─────
  AI_ENGINE_URL:    z.string().url().optional(),
  AI_ENGINE_API_KEY: z.string().optional(),  // AI 엔진 인증 키 (외부 엔진 미사용 시 불필요)

  // ── 결제 ────────────────────────────────────────────────────
  TOSS_SECRET_KEY:   z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET:           z.string().optional(),
  STRIPE_BASIC_MONTHLY_PRICE_ID:   z.string().optional(),
  STRIPE_BASIC_YEARLY_PRICE_ID:    z.string().optional(),
  STRIPE_PRO_MONTHLY_PRICE_ID:     z.string().optional(),
  STRIPE_PRO_YEARLY_PRICE_ID:      z.string().optional(),

  // ── 이메일 (Gmail SMTP) ──────────────────────────────────────
  GMAIL_USER:        z.string().email().optional(),
  GMAIL_APP_PASSWORD: z.string().optional(),
  SUPPORT_EMAIL:     z.string().email().optional(),
  SECURITY_ALERT_EMAIL: z.string().email().optional(),

  // ── 이메일 (SMTP 보조 — AWS SES) ────────────────────────────
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  // ── SMS / 카카오 알림톡 (Solapi) ────────────────────────────
  SOLAPI_API_KEY:     z.string().optional(),
  SOLAPI_API_SECRET:  z.string().optional(),
  SOLAPI_SENDER_PHONE: z.string().optional(),
  KAKAO_SENDER_KEY:   z.string().optional(),
  SOLAPI_KAKAO_CHANNEL_ID: z.string().optional(),

  // ── IoT / MQTT ───────────────────────────────────────────────
  MQTT_BROKER_URL: z.string().optional(),
  MQTT_USERNAME:   z.string().optional(),
  MQTT_PASSWORD:   z.string().optional(),
  MQTT_CLIENT_ID:  z.string().optional(),
  GATEWAY_API_KEY: z.string().optional(),

  // ── 캐시 / Redis ─────────────────────────────────────────────
  REDIS_URL:          z.string().url().optional(),
  UPSTASH_REDIS_URL:   z.string().url().optional(),
  UPSTASH_REDIS_TOKEN: z.string().optional(),

  // ── 탄소 거래 / 블록체인 ─────────────────────────────────────
  CARBON_BLOCKCHAIN_PROTOCOL: z.string().optional(),
  CARBON_ESG_BRIDGE_ENABLED:  z.coerce.boolean().optional(),
  KETS_MARKET_PRICE:          z.coerce.number().optional(),
  ELECTRICITY_PRICE_KRW:      z.coerce.number().optional(),
  CARBON_CREDIT_KRW:          z.coerce.number().optional(),
  POLYGON_RPC_URL:            z.string().url().optional(),
  CARBON_WALLET_PRIVATE_KEY:  z.string().optional(),
  TOUCAN_NETWORK:             z.string().optional(),
  TOUCAN_DEFAULT_POOL:        z.string().optional(),
  TOUCAN_MAX_GAS_PRICE_GWEI:  z.coerce.number().optional(),
  KLIMADAO_DEFAULT_TOKEN:     z.string().optional(),
  KLIMADAO_MAX_GAS_PRICE_GWEI: z.coerce.number().optional(),

  // ── 보안 / 크론 ───────────────────────────────────────────────
  CRON_SECRET:        z.string().optional(),
  DEV_BYPASS_FEATURES: z.coerce.boolean().optional(),

  // ── 백업 ─────────────────────────────────────────────────────
  BACKUP_DIR:    z.string().optional(),
  MYSQLDUMP_PATH: z.string().optional(),

  // ── Claude AI API ─────────────────────────────────────────────
  ANTHROPIC_API_KEY: z.string().optional(),

  // ── AWS (파일 스토리지 등 — 미사용 준비) ──────────────────────
  AWS_REGION:            z.string().optional(),
  AWS_ACCESS_KEY_ID:     z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),

});

type Env = z.infer<typeof envSchema>;

let env: Env | null = null;

/**
 * 환경 변수 검증 및 로드 (지연 초기화)
 * 서버 사이드에서만 실행되도록 보장
 */
function getEnv(): Env {
  if (env !== null) return env;

  if (typeof window !== 'undefined') {
    throw new Error(
      'lib/env.ts는 서버 사이드에서만 사용할 수 있습니다. ' +
      '클라이언트 컴포넌트에서 import하지 마세요.'
    );
  }

  try {
    // 빈 문자열('')을 undefined로 변환 — 빈값으로 설정된 optional 필드가 URL 검증 오류를 내지 않도록
    const normalized = Object.fromEntries(
      Object.entries(process.env).map(([k, v]) => [k, v === '' ? undefined : v])
    );
    env = envSchema.parse(normalized);
    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment variable validation failed:');
      error.errors.forEach((err) => {
        console.error(`   ${err.path.join('.')}: ${err.message}`);
      });
      console.error('\n💡 Tip: Copy .env.example to .env.local and fill in required values');

      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
      throw new Error('Environment variable validation failed. See console for details.');
    }
    throw error;
  }
}

const envProxy = new Proxy({} as Env, {
  get(_target, prop) {
    return getEnv()[prop as keyof Env];
  },
});

export default envProxy;