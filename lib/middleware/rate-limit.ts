import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import env from '@/lib/env';
import { logSecurityEvent } from '@/lib/logger';

/**
 * Upstash Redis 기반 레이트 제한
 * 
 * 전략:
 * - IP별 일반 요청: 100/시간
 * - 로그인/회원가입: 10/15분
 * - API 엔드포인트: 1000/시간
 * 
 * 구현: Sliding Window Counter
 */

// 선택적 Redis 클라이언트 (없으면 로컬 메모리 사용)
let redis: Redis | null = null;

try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
} catch (error) {
  console.warn('Redis 연결 실패, 로컬 메모리 사용:', error instanceof Error ? error.message : 'unknown');
}

// ========================================
// 로컬 메모리 폴백 (개발 환경용)
// ========================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitEntry>();

function cleanupMemoryStore() {
  const now = Date.now();
  for (const [key, entry] of memoryStore.entries()) {
    if (entry.resetAt < now) {
      memoryStore.delete(key);
    }
  }
}

// 5분마다 정리
setInterval(cleanupMemoryStore, 5 * 60 * 1000);

// ========================================
// 레이트 제한 설정
// ========================================

export interface RateLimitConfig {
  key: string; // Redis 키 (예: "ip:192.168.1.1", "user:user-id")
  limit: number; // 최대 요청 수
  windowMs: number; // 시간 창 (밀리초)
  message?: string; // 제한 메시지
  skipSuccessfulRequests?: boolean; // 성공한 요청만 카운트
  skipFailedRequests?: boolean; // 실패한 요청만 카운트
}

/**
 * 레이트 제한 확인
 */
export async function checkRateLimit(config: RateLimitConfig): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
}> {
  const { key, limit, windowMs } = config;
  const now = Date.now();
  const windowStart = now - windowMs;

  try {
    if (redis) {
      // Redis 사용
      const count = await redis.incr(key);

      if (count === 1) {
        // 첫 요청이면 TTL 설정
        await redis.expire(key, Math.ceil(windowMs / 1000));
      }

      // 소수 자릿수 제거
      const requests = Math.min(count, limit + 10);

      if (requests > limit) {
        const ttl = await redis.ttl(key);
        const resetAt = new Date(now + (ttl ?? windowMs));
        const retryAfter = Math.ceil(((ttl ?? 0) * 1000) / 1000);

        return {
          allowed: false,
          remaining: 0,
          resetAt,
          retryAfter,
        };
      }

      return {
        allowed: true,
        remaining: limit - requests,
        resetAt: new Date(now + windowMs),
      };
    } else {
      // 로컬 메모리 사용
      const entry = memoryStore.get(key) || { count: 0, resetAt: now + windowMs };

      // 시간 창이 지났으면 리셋
      if (entry.resetAt < now) {
        entry.count = 0;
        entry.resetAt = now + windowMs;
      }

      entry.count += 1;
      memoryStore.set(key, entry);

      const remaining = Math.max(0, limit - entry.count);
      const allowed = entry.count <= limit;

      if (!allowed) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(entry.resetAt),
          retryAfter,
        };
      }

      return {
        allowed: true,
        remaining,
        resetAt: new Date(entry.resetAt),
      };
    }
  } catch (error) {
    console.error('Rate limit check error:', error instanceof Error ? error.message : 'unknown');
    // 오류 시 허용 (서비스 계속 진행)
    return {
      allowed: true,
      remaining: limit,
      resetAt: new Date(now + windowMs),
    };
  }
}

/**
 * 레이트 제한 미들웨어
 */
export async function rateLimitMiddleware(
  request: NextRequest,
  config: RateLimitConfig
): Promise<NextResponse | null> {
  const result = await checkRateLimit(config);

  if (!result.allowed) {
    // 보안 이벤트 로깅
    logSecurityEvent({
      type: 'RATE_LIMIT',
      severity: 'medium',
      reason: `Rate limit exceeded: ${config.key}`,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    });

    const response = NextResponse.json(
      {
        error: config.message || 'Too many requests',
        retryAfter: result.retryAfter,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(result.retryAfter || 60),
          'X-RateLimit-Limit': String(config.limit),
          'X-RateLimit-Remaining': String(result.remaining),
          'X-RateLimit-Reset': result.resetAt.toISOString(),
        },
      }
    );

    return response;
  }

  // 정상 응답 헤더
  const headers = new Headers();
  headers.set('X-RateLimit-Limit', String(config.limit));
  headers.set('X-RateLimit-Remaining', String(result.remaining));
  headers.set('X-RateLimit-Reset', result.resetAt.toISOString());

  return null; // 계속 진행
}

// ========================================
// 사전 설정된 레이트 제한
// ========================================

/**
 * 일반 API 레이트 제한 (IP당 100/시간)
 */
export function getApiRateLimit(ipAddress: string): RateLimitConfig {
  return {
    key: `ratelimit:api:${ipAddress}`,
    limit: 100,
    windowMs: 60 * 60 * 1000, // 1시간
    message: 'API rate limit exceeded. Maximum 100 requests per hour.',
  };
}

/**
 * 인증 엔드포인트 레이트 제한 (IP당 10/15분)
 */
export function getAuthRateLimit(ipAddress: string): RateLimitConfig {
  return {
    key: `ratelimit:auth:${ipAddress}`,
    limit: 10,
    windowMs: 15 * 60 * 1000, // 15분
    message: 'Authentication rate limit exceeded. Maximum 10 requests per 15 minutes.',
  };
}

/**
 * 로그인 시도 레이트 제한 (사용자당 5회/15분)
 */
export function getLoginRateLimit(email: string): RateLimitConfig {
  return {
    key: `ratelimit:login:${email}`,
    limit: 5,
    windowMs: 15 * 60 * 1000, // 15분
    message: 'Too many login attempts. Please try again later.',
  };
}

/**
 * 회원가입 레이트 제한 (IP당 3회/시간)
 */
export function getSignupRateLimit(ipAddress: string): RateLimitConfig {
  return {
    key: `ratelimit:signup:${ipAddress}`,
    limit: 3,
    windowMs: 60 * 60 * 1000, // 1시간
    message: 'Sign up rate limit exceeded. Maximum 3 attempts per hour.',
  };
}

/**
 * 비밀번호 재설정 레이트 제한 (이메일당 3회/시간)
 */
export function getResetPasswordRateLimit(email: string): RateLimitConfig {
  return {
    key: `ratelimit:password-reset:${email}`,
    limit: 3,
    windowMs: 60 * 60 * 1000, // 1시간
    message: 'Password reset rate limit exceeded. Maximum 3 attempts per hour.',
  };
}

/**
 * AI Engine 요청 레이트 제한 (테넌트당 100/시간)
 */
export function getAiEngineRateLimit(tenantId: string): RateLimitConfig {
  return {
    key: `ratelimit:ai-engine:${tenantId}`,
    limit: 100,
    windowMs: 60 * 60 * 1000, // 1시간
    message: 'AI engine rate limit exceeded.',
  };
}

/**
 * 예보 요청 레이트 제한 (사용자당 50/시간)
 */
export function getForecastRateLimit(userId: string): RateLimitConfig {
  return {
    key: `ratelimit:forecast:${userId}`,
    limit: 50,
    windowMs: 60 * 60 * 1000, // 1시간
    message: 'Forecast request limit exceeded.',
  };
}
