import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

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
  const _url   = process.env.UPSTASH_REDIS_URL   ?? 'redis://localhost:6379';
  const _token = process.env.UPSTASH_REDIS_TOKEN ?? '';
  // 플레이스홀더 URL 필터링 (에러 스팸 방지)
  const _valid =
    _url.startsWith('https://') &&
    !_url.includes('your-') &&
    !_url.includes('example') &&
    _token.length > 10 &&
    !_token.includes('your-');
  if (_valid) {
    redis = new Redis({ url: _url, token: _token });
  }
} catch (error) {
  console.warn('[RateLimit] Redis 초기화 실패, 로컬 메모리 사용:', error instanceof Error ? error.message : 'unknown');
}

// EVAL(Lua) 권한 없는 Redis 인스턴스 대응 (Upstash ACL 제한 등)
// EVAL NOPERM → INCR 폴백 시도, INCR도 NOPERM → Redis 비활성화 (in-memory 전환)
let evalSupported = true;
let redisDisabled = false; // INCR도 NOPERM이면 Redis 완전 비활성화

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

  try {
    if (redis && !redisDisabled) {
      const ttlSeconds = Math.ceil(windowMs / 1000);
      let count: number;

      if (evalSupported) {
        try {
          // Lua 스크립트로 원자적 INCR+EXPIRE
          count = await redis.eval(
            `local c = redis.call('INCR', KEYS[1])
             if c == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
             return c`,
            [key],
            [ttlSeconds]
          ) as number;
        } catch (evalErr) {
          const msg = evalErr instanceof Error ? evalErr.message : String(evalErr);
          if (msg.includes('NOPERM') || msg.includes('no permissions') || msg.includes('eval')) {
            evalSupported = false;
            console.warn('[RateLimit] Redis EVAL 권한 없음 — INCR 폴백 시도');
            try {
              count = await redis.incr(key) as number;
              if (count === 1) await redis.expire(key, ttlSeconds);
            } catch (incrErr) {
              const incrMsg = incrErr instanceof Error ? incrErr.message : String(incrErr);
              if (incrMsg.includes('NOPERM') || incrMsg.includes('no permissions')) {
                // INCR도 NOPERM → Redis ACL이 너무 제한적, in-memory로 완전 전환
                redisDisabled = true;
                console.warn('[RateLimit] Redis INCR 권한도 없음 → in-memory 레이트리밋으로 전환 (재시작 전까지)');
              } else {
                throw incrErr;
              }
              // in-memory 폴백 (아래 else 블록으로 이동)
              const entry = memoryStore.get(key) || { count: 0, resetAt: now + windowMs };
              if (entry.resetAt < now) { entry.count = 0; entry.resetAt = now + windowMs; }
              entry.count += 1;
              memoryStore.set(key, entry);
              return { allowed: entry.count <= limit, remaining: Math.max(0, limit - entry.count), resetAt: new Date(entry.resetAt) };
            }
          } else {
            throw evalErr;
          }
        }
      } else {
        // EVAL 비지원 환경 — 단순 INCR+EXPIRE
        count = await redis.incr(key) as number;
        if (count === 1) await redis.expire(key, ttlSeconds);
      }

      if (count > limit) {
        const remainingTtl = await redis.ttl(key);
        const resetAt = new Date(now + Math.max(0, remainingTtl ?? ttlSeconds) * 1000);
        return {
          allowed: false,
          remaining: 0,
          resetAt,
          retryAfter: Math.ceil(Math.max(0, remainingTtl ?? ttlSeconds)),
        };
      }

      return {
        allowed: true,
        remaining: limit - count,
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
    console.warn('[RateLimit] exceeded:', config.key, request.headers.get('x-forwarded-for') ?? 'unknown');

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
