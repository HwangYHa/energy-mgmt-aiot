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
});

type Env = z.infer<typeof envSchema>;

let env: Env;

try {
  env = envSchema.parse(process.env);
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
    process.exit(1);
  }
  throw error;
}

export default env;
