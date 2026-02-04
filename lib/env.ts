/**
 * lib/env.ts - 환경 변수 검증 및 로드
 * 
 * 사용:
 * import env from '@/lib/env';
 * console.log(env.DATABASE_URL);
 */

import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url().min(1, 'DATABASE_URL is required'),

  // NextAuth
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z
    .string()
    .min(32, 'NEXTAUTH_SECRET must be at least 32 characters'),

  // JWT
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters'),

  // AI Engine
  AI_ENGINE_URL: z.string().url(),
  AI_ENGINE_API_KEY: z.string().min(20),

  // Application
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  WEB_APP_URL: z.string().url(),
  LOG_LEVEL: z
    .enum(['debug', 'info', 'warn', 'error'])
    .default('info'),

  // Optional: Redis
  REDIS_URL: z.string().url().optional(),
  REDIS_TOKEN: z.string().optional(),

  // Optional: AWS
  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),

  // OAuth Providers
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  NAVER_CLIENT_ID: z.string().optional(),
  NAVER_CLIENT_SECRET: z.string().optional(),

  // Payment (Iamport)
  IAMPORT_API_KEY: z.string().optional(),
  IAMPORT_API_SECRET: z.string().optional(),
});

type Env = z.infer<typeof envSchema>;

let env: Env | null = null;

/**
 * 환경 변수 검증 및 로드 (지연 초기화)
 * 서버 사이드에서만 실행되도록 보장
 */
function getEnv(): Env {
  // ✅ 이미 검증된 경우 캐시 반환
  if (env !== null) {
    return env;
  }

  // ✅ 클라이언트 사이드에서 실행 방지
  if (typeof window !== 'undefined') {
    throw new Error(
      'lib/env.ts는 서버 사이드에서만 사용할 수 있습니다. ' +
      '클라이언트 컴포넌트에서 import하지 마세요.'
    );
  }

  try {
    env = envSchema.parse(process.env);
    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment variable validation failed:');
      error.errors.forEach((err) => {
        const path = err.path.join('.');
        const message = err.message;
        console.error(`   ${path}: ${message}`);
      });
      console.error(
        '\n💡 Tip: Copy .env.example to .env.local and fill in required values'
      );
      
      // ✅ 개발 환경에서는 process.exit() 대신 에러만 throw
      // 프로덕션 빌드 시에는 여전히 실패하지만, 개발 중에는 더 나은 에러 메시지 제공
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
      throw new Error('Environment variable validation failed. See console for details.');
    }
    throw error;
  }
}

// ✅ 기본 export는 getter 함수로 변경 (지연 초기화)
const envProxy = new Proxy({} as Env, {
  get(_target, prop) {
    return getEnv()[prop as keyof Env];
  },
});

export default envProxy;
