/**
 * /api/admin/cache - 내부 캐시 상태 진단 및 강제 무효화
 *
 * GET  → in-memory 캐시 / 서킷브레이커 상태 반환
 * DELETE ?key=    → 특정 키 무효화  (super_admin)
 * DELETE ?prefix= → prefix 무효화   (super_admin)
 *
 * ⚠ Redis는 선택적 인프라 — 연결 테스트는 이 API에서 수행하지 않음.
 *   캐시 레이어(lib/cache/redis.ts)가 알아서 폴백·서킷브레이크 처리.
 *   연결 테스트를 여기서 하면 Redis 장애 시 관리자 페이지까지 영향받음.
 */

import { NextRequest } from 'next/server';
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
// GET — 캐시 상태 조회 (Redis 직접 연결 테스트 없음)
// ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!requireRoleOrHigher(auth, 'tenant_admin' as UserRole)) {
      return forbiddenResponse();
    }

    const status = getCacheStatus();
    const redisUrl   = process.env.UPSTASH_REDIS_URL   ?? '';
    const redisToken = process.env.UPSTASH_REDIS_TOKEN ?? '';
    const redisConfigured =
      redisUrl.startsWith('https://') &&
      !redisUrl.includes('your-') &&
      !redisUrl.includes('example') &&
      redisToken.length > 10;

    return successResponse({
      cache: status,
      redis: {
        enabled:  redisConfigured,
        provider: redisConfigured ? 'upstash' : 'none',
        mode:     'optional',
        note:     '장애 시 in-memory 캐시로 자동 폴백됩니다.',
      },
      tips: redisConfigured
        ? status.circuitOpen
          ? [
              'Redis 서킷 오픈 상태 — in-memory 폴백 중 (서비스 정상)',
              `재시도 예정: ${status.circuitOpenUntil ?? '알 수 없음'}`,
              'Upstash 대시보드에서 ACL 권한(GET/SET)을 확인하세요.',
            ]
          : ['Redis 캐시 정상 운영 중']
        : [
            'UPSTASH_REDIS_URL / UPSTASH_REDIS_TOKEN 미설정 → in-memory 캐시로 동작 중',
            '재시작 시 캐시가 초기화됩니다. 운영 환경에서는 Upstash 설정을 권장합니다.',
          ],
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
    const key    = searchParams.get('key');
    const prefix = searchParams.get('prefix');

    if (key) {
      await invalidateCache(key);
      return successResponse({ invalidated: key });
    }
    if (prefix) {
      invalidateCacheByPrefix(prefix);
      return successResponse({ invalidatedPrefix: prefix });
    }

    // 전체 in-memory 초기화 (Redis 키는 TTL 만료 대기)
    invalidateCacheByPrefix('');
    return successResponse({ invalidated: 'all-in-memory' });
  } catch (error) {
    console.error('[API] 캐시 무효화 오류:', error);
    return serverErrorResponse();
  }
}
