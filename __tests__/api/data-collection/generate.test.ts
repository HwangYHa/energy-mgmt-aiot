/**
 * app/api/data-collection/generate 단위 테스트
 *
 * - 프로덕션 환경에서 404 반환 검증
 * - 인증 없이 401 반환 검증
 * - 권한 부족 시 403 반환 검증
 */

import { POST } from '@/app/api/data-collection/generate/route';

// 의존성 모킹
jest.mock('@/lib/auth/verify', () => ({
  verifyAuth: jest.fn(),
  requireRoleOrHigher: jest.fn(),
}));

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    sensor: { findMany: jest.fn(), update: jest.fn() },
    metric: { create: jest.fn() },
    measurement: { createMany: jest.fn() },
  },
}));

const { verifyAuth, requireRoleOrHigher } = require('@/lib/auth/verify');

function makeRequest(body = {}) {
  return {
    json: async () => body,
    headers: { get: () => null },
    cookies: { get: () => null },
    signal: { addEventListener: jest.fn() },
    url: 'http://localhost/api/data-collection/generate',
    method: 'POST',
  } as unknown as import('next/server').NextRequest;
}

describe('POST /api/data-collection/generate', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: originalEnv, writable: true });
    jest.clearAllMocks();
  });

  it('프로덕션 환경에서 404를 반환한다', async () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', writable: true });
    const res = await POST(makeRequest({ hours: 1 }));
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
  });

  it('인증 없이 요청하면 401을 반환한다', async () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', writable: true });
    verifyAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ hours: 1 }));
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it('site_manager 미만 권한이면 403을 반환한다', async () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', writable: true });
    verifyAuth.mockResolvedValue({ tenantId: 'tenant-1', userId: 'user-1', role: 'viewer' });
    requireRoleOrHigher.mockReturnValue(false);
    const res = await POST(makeRequest({ hours: 1 }));
    expect(res.status).toBe(403);
  });

  it('잘못된 파라미터로 요청하면 400/422를 반환한다', async () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', writable: true });
    verifyAuth.mockResolvedValue({ tenantId: 'tenant-1', userId: 'user-1', role: 'site_manager' });
    requireRoleOrHigher.mockReturnValue(true);

    // hours가 최대값(720) 초과
    const res = await POST(makeRequest({ hours: 9999 }));
    const body = await res.json();
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(body.success).toBe(false);
  });
});
