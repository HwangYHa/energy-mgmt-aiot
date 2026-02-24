/**
 * lib/cache/redis.ts — Redis 캐싱 레이어 (서킷브레이커 포함)
 *
 * Upstash Redis가 설정되어 있으면 사용, 없으면 in-memory Map으로 폴백.
 * Redis 연속 실패 시 서킷브레이커(Circuit Breaker)가 동작하여 불필요한 요청과 로그를 억제.
 *
 * 환경변수:
 *   UPSTASH_REDIS_REST_URL   Upstash REST URL
 *   UPSTASH_REDIS_REST_TOKEN Upstash REST Token
 */

import { Redis } from '@upstash/redis';

// ──────────────────────────────────────────────
// Upstash Redis 클라이언트 (선택적)
// ──────────────────────────────────────────────

let redisClient: Redis | null = null;

if (
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN
) {
  try {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  } catch (err) {
    console.warn('[Cache] Upstash Redis 초기화 실패, in-memory 폴백:', err instanceof Error ? err.message : err);
  }
}

// ──────────────────────────────────────────────
// 서킷브레이커 (Circuit Breaker)
// ──────────────────────────────────────────────
// Redis가 반복 실패하면 일정 시간 동안 요청 중단 → 로그 노이즈 억제

const CIRCUIT_MAX_FAILS = 3;        // 연속 실패 허용 횟수
const CIRCUIT_COOLDOWN_MS = 2 * 60 * 1000; // 실패 후 재시도 대기 (2분)

let circuitFailCount = 0;
let circuitOpenUntil = 0;  // 이 시간까지 Redis 비활성
let circuitWasOpen = false; // 복구 감지용

function isCircuitOpen(): boolean {
  if (circuitOpenUntil === 0) return false;
  if (Date.now() >= circuitOpenUntil) {
    // 쿨다운 만료 → half-open 상태 (한 번 시도 허용)
    return false;
  }
  return true;
}

function onRedisSuccess(): void {
  if (circuitFailCount > 0) {
    if (circuitWasOpen) {
      console.info('[Cache] Redis 연결 복구됨 → 캐시 재활성화');
      circuitWasOpen = false;
    }
    circuitFailCount = 0;
    circuitOpenUntil = 0;
  }
}

function onRedisFailure(key: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  circuitFailCount++;

  if (circuitFailCount === 1) {
    // 첫 번째 실패만 경고 로그
    console.warn(`[Cache] Redis 오류, in-memory 폴백: ${key} — ${msg}`);
  }

  if (circuitFailCount >= CIRCUIT_MAX_FAILS && circuitOpenUntil === 0) {
    circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
    circuitWasOpen = true;
    console.warn(
      `[Cache] Redis ${CIRCUIT_MAX_FAILS}회 연속 실패 → 서킷 오픈 (${CIRCUIT_COOLDOWN_MS / 60000}분 비활성)`
    );
  }
}

// ──────────────────────────────────────────────
// In-memory 폴백 (개발 환경 / Redis 미설정)
// ──────────────────────────────────────────────

interface MemEntry<T> {
  value: T;
  expiresAt: number;
}

const memStore = new Map<string, MemEntry<unknown>>();

// 만료 항목 주기 정리 (5분마다)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memStore) {
    if (entry.expiresAt <= now) memStore.delete(key);
  }
}, 5 * 60 * 1000).unref();

function memGet<T>(key: string): T | null {
  const entry = memStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memStore.delete(key);
    return null;
  }
  return entry.value as T;
}

function memSet<T>(key: string, value: T, ttlSeconds: number): void {
  memStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

// ──────────────────────────────────────────────
// 공개 API
// ──────────────────────────────────────────────

/**
 * 캐시에서 값을 조회하고, 없으면 fetcher를 실행해 캐싱 후 반환.
 *
 * @param key       캐시 키 (예: `menu:tenantId:role`)
 * @param ttl       TTL (초)
 * @param fetcher   캐시 미스 시 실행할 비동기 함수
 */
export async function getCached<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  // Redis 사용 가능 + 서킷 닫힘 상태
  if (redisClient && !isCircuitOpen()) {
    try {
      const cached = await redisClient.get<T>(key);
      if (cached !== null && cached !== undefined) {
        onRedisSuccess();
        return cached;
      }

      const fresh = await fetcher();
      await redisClient.set(key, fresh, { ex: ttl });
      onRedisSuccess();
      return fresh;
    } catch (err) {
      onRedisFailure(key, err);
      // Redis 오류 시 in-memory로 폴백 (아래 계속)
    }
  }

  // In-memory 폴백
  const cached = memGet<T>(key);
  if (cached !== null) return cached;

  const fresh = await fetcher();
  memSet(key, fresh, ttl);
  return fresh;
}

/**
 * 특정 키 캐시 무효화.
 */
export async function invalidateCache(key: string): Promise<void> {
  if (redisClient && !isCircuitOpen()) {
    try {
      await redisClient.del(key);
    } catch (err) {
      onRedisFailure(key, err);
    }
  }
  memStore.delete(key);
}

/**
 * 접두사가 일치하는 in-memory 캐시 항목 전체 무효화.
 */
export function invalidateCacheByPrefix(prefix: string): void {
  for (const key of memStore.keys()) {
    if (key.startsWith(prefix)) memStore.delete(key);
  }
}

export const isCacheEnabled = (): boolean =>
  redisClient !== null && !isCircuitOpen();

/** 서킷브레이커 현황 (진단용) */
export function getCacheStatus() {
  return {
    redisConfigured: redisClient !== null,
    circuitOpen: isCircuitOpen(),
    circuitOpenUntil: circuitOpenUntil > 0 ? new Date(circuitOpenUntil).toISOString() : null,
    failCount: circuitFailCount,
    memStoreSize: memStore.size,
  };
}
