/**
 * Edge Runtime 호환 레이트 리미터 (in-memory only, Redis 없음)
 * middleware.ts에서만 사용. API 라우트는 rate-limit.ts 사용.
 *
 * Edge Runtime 제약:
 *  - Node.js API 사용 불가 (@upstash/redis의 nodejs.mjs 등)
 *  - setInterval 미지원
 *  - 각 Edge 인스턴스마다 독립된 메모리 → 분산 환경에서 카운트 공유 불가 (허용 범위)
 */

export interface RateLimitConfig {
  key: string;
  limit: number;
  windowMs: number;
  message?: string;
}

// Edge 인스턴스별 메모리 스토어 (TTL은 조회 시점에 만료 체크)
const store = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimitEdge(config: RateLimitConfig): {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
} {
  const { key, limit, windowMs } = config;
  const now = Date.now();

  let entry = store.get(key);
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + windowMs };
  }
  entry.count += 1;
  store.set(key, entry);

  const allowed = entry.count <= limit;
  const remaining = Math.max(0, limit - entry.count);
  const retryAfter = allowed ? undefined : Math.ceil((entry.resetAt - now) / 1000);

  return { allowed, remaining, resetAt: new Date(entry.resetAt), retryAfter };
}

export function getAuthRateLimitEdge(ipAddress: string): RateLimitConfig {
  return {
    key: `ratelimit:auth:${ipAddress}`,
    limit: 10,
    windowMs: 15 * 60 * 1000,
    message: 'Authentication rate limit exceeded. Maximum 10 requests per 15 minutes.',
  };
}
