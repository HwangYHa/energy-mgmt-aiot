/**
 * /api/admin/cache - Redis 캐시 상태 진단 및 강제 무효화
 *
 * GET  → 캐시/서킷브레이커 상태 + Redis 연결 테스트
 * DELETE ?key=  → 특정 키 무효화  (super_admin)
 * DELETE ?prefix= → prefix 무효화 (super_admin)
 */

import { NextRequest } from 'next/server';
import { Redis } from '@upstash/redis';
import { getCacheStatus, invalidateCache, invalidateCacheByPrefix } from '@/lib/cache/redis';
import { verifyAuth, requireRoleOrHigher } from '@/lib/auth/verify';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  serverErrorResponse,
} from '@/lib/api/response';
import { UserRole } from '@/lib/constants/roles';

export const dynamic = 'force-dynamic';

// ──────────────────────────────────────────────────────────────
// GET — 캐시 상태 + Redis 연결 테스트
// ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!requireRoleOrHigher(auth, 'tenant_admin' as UserRole)) {
      return forbiddenResponse();
    }

    const status = getCacheStatus();

    // Upstash Redis 직접 연결 테스트
    let redisTestResult: {
      ok: boolean;
      latencyMs?: number;
      error?: string;
      configured: boolean;
    } = { ok: false, configured: false };

    const url = process.env.UPSTASH_REDIS_URL;
    const token = process.env.UPSTASH_REDIS_TOKEN;

    if (url && token) {
      redisTestResult.configured = true;
      const startMs = Date.now();
      try {
        const testClient = new Redis({ url, token });
        await testClient.set('__health_check__', '1', { ex: 10 });
        const val = await testClient.get('__health_check__');
        redisTestResult = {
          configured: true,
          ok: val === '1',
          latencyMs: Date.now() - startMs,
        };
      } catch (err) {
        redisTestResult = {
          configured: true,
          ok: false,
          latencyMs: Date.now() - startMs,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    return successResponse({
      cache: {
        ...status,
        redisUrl: url
          ? url.replace(/\/\/[^@]+@/, '//**@').substring(0, 40) + '...'
          : null,
      },
      redisTest: redisTestResult,
      tips: !redisTestResult.configured
        ? ['UPSTASH_REDIS_URL, UPSTASH_REDIS_TOKEN 환경변수를 .env에 추가하세요.']
        : !redisTestResult.ok
        ? [
            '1) Upstash 대시보드에서 Redis DB가 활성 상태인지 확인',
            '2) UPSTASH_REDIS_URL / TOKEN이 올바른지 확인',
            '3) 로컬 Docker: docker run -d -p 6379:6379 redis:alpine',
            '4) 개발 중에는 in-memory 폴백이 자동 사용됨 (기능 정상)',
          ]
        : ['Redis 연결 정상'],
    });
  } catch (error) {
    console.error('[API] 캐시 상태 조회 오류:', error);
    return serverErrorResponse();
  }
}

// ──────────────────────────────────────────────────────────────
// DELETE — 캐시 무효화
// ──────────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!requireRoleOrHigher(auth, 'super_admin' as UserRole)) {
      return forbiddenResponse();
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    const prefix = searchParams.get('prefix');

    if (key) {
      await invalidateCache(key);
      return successResponse({ invalidated: key });
    }
    if (prefix) {
      invalidateCacheByPrefix(prefix);
      return successResponse({ invalidatedPrefix: prefix });
    }

    // 전체 in-memory 초기화 (Redis는 유지)
    invalidateCacheByPrefix('');
    return successResponse({ invalidated: 'all-in-memory' });
  } catch (error) {
    console.error('[API] 캐시 무효화 오류:', error);
    return serverErrorResponse();
  }
}
