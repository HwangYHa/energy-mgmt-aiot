/**
 * app/api/dashboard/stats 단위 테스트
 *
 * - 인증 없이 401 반환
 * - 실제 데이터 없을 때 simulation 응답 구조
 * - 응답 필드 검증 (kpis, realtime, devices, sensors, dataSource)
 */

import { GET } from '@/app/api/dashboard/stats/route';

// 의존성 모킹
jest.mock('@/lib/auth/verify', () => ({
  verifyAuth: jest.fn(),
}));

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    site: { count: jest.fn().mockResolvedValue(0) },
    device: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    sensor: {
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    measurement: {
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue({ _sum: null, _avg: null, _max: null }),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    drEvent: { count: jest.fn().mockResolvedValue(3) },
    emissionFactor: { findFirst: jest.fn().mockResolvedValue(null) },
    tenant: {
      findUnique: jest.fn().mockResolvedValue({ settings: null }),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
  },
}));

const { verifyAuth } = require('@/lib/auth/verify');

function makeRequest() {
  return {
    headers: { get: () => null },
    cookies: { get: () => null },
    signal: { addEventListener: jest.fn() },
    url: 'http://localhost/api/dashboard/stats',
    method: 'GET',
  } as unknown as import('next/server').NextRequest;
}

describe('GET /api/dashboard/stats', () => {
  afterEach(() => jest.clearAllMocks());

  it('인증 없이 요청하면 401을 반환한다', async () => {
    verifyAuth.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('인증된 요청에서 올바른 응답 구조를 반환한다', async () => {
    verifyAuth.mockResolvedValue({
      tenantId: 'tenant-test-1',
      userId: 'user-test-1',
      role: 'admin',
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();

    const { data } = body;
    // kpis 필드 검증
    expect(data.kpis).toBeDefined();
    expect(typeof data.kpis.totalConsumption).toBe('number');
    expect(typeof data.kpis.equipmentRate).toBe('number');
    expect(typeof data.kpis.drParticipation).toBe('number');

    // realtime 필드 검증
    expect(data.realtime).toBeDefined();
    expect(typeof data.realtime.currentPower).toBe('number');

    // 배열 필드 검증
    expect(Array.isArray(data.monthlyConsumption)).toBe(true);
    expect(Array.isArray(data.weeklyTrend)).toBe(true);
    expect(Array.isArray(data.hourlyLoad)).toBe(true);

    // devices/sensors 검증
    expect(data.devices).toBeDefined();
    expect(data.sensors).toBeDefined();

    // 데이터 소스 검증 (실제 데이터 없으므로 simulation)
    expect(data.dataSource).toBe('simulation');
  });

  it('drParticipation이 DrEvent count와 일치한다', async () => {
    verifyAuth.mockResolvedValue({ tenantId: 't1', userId: 'u1', role: 'admin' });
    const { prisma } = require('@/lib/db/prisma');
    prisma.drEvent.count.mockResolvedValue(7);

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.data.kpis.drParticipation).toBe(7);
  });

  it('EmissionFactor DB에 값이 있으면 그 값을 탄소계수로 사용한다', async () => {
    verifyAuth.mockResolvedValue({ tenantId: 't1', userId: 'u1', role: 'admin' });
    const { prisma } = require('@/lib/db/prisma');
    prisma.emissionFactor.findFirst.mockResolvedValue({ factor: '0.4593' });
    prisma.measurement.count.mockResolvedValue(100); // 실제 데이터 있는 척
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.measurement.aggregate.mockResolvedValue({
      _sum: { value: '1000' },
      _avg: { value: '100' },
      _max: { value: '200' },
    });
    prisma.measurement.findFirst.mockResolvedValue({ value: '150', time: new Date() });

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.meta.carbonFactorSource).toBe('db');
  });

  it('hourlyLoad는 6개 항목을 반환한다', async () => {
    verifyAuth.mockResolvedValue({ tenantId: 't1', userId: 'u1', role: 'admin' });
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.data.hourlyLoad).toHaveLength(6);
  });
});
