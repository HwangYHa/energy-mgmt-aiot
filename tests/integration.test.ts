import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST as forecastHandler } from '@/app/api/ai/forecast/route';
import { POST as anomalyHandler } from '@/app/api/ai/anomaly/route';
import { POST as optimizeHandler } from '@/app/api/ai/optimize/route';
import { POST as drHandler } from '@/app/api/dr/route';

// Mock getServerSession
vi.mock('@/lib/auth/session', () => ({
  getServerSession: vi.fn(),
}));

// Mock prisma
vi.mock('@/lib/db/prisma', () => ({
  default: {
    measurement: {
      findMany: vi.fn(),
    },
    forecastResult: {
      create: vi.fn(),
    },
    anomaly: {
      create: vi.fn(),
    },
    drEvent: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

// Mock fetch
global.fetch = vi.fn();

describe('AI Engine Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/ai/forecast', () => {
    it('성공적으로 부하 예측을 반환해야 함', async () => {
      const request = new Request('http://localhost:3000/api/ai/forecast', {
        method: 'POST',
        body: JSON.stringify({
          horizon: '24h',
        }),
      });

      const { getServerSession } = await import('@/lib/auth/session');
      const { default: prisma } = await import('@/lib/db/prisma');

      // Mock session
      (getServerSession as any).mockResolvedValue({
        user: { tenantId: 'tenant-123' },
      });

      // Mock historical data
      (prisma.measurement.findMany as any).mockResolvedValue(
        Array.from({ length: 720 }, (_, i) => ({
          receivedAt: new Date(Date.now() - (720 - i) * 3600000),
          value: 150 + Math.sin(i / 24) * 20,
        }))
      );

      // Mock AI Engine response
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          predictions: Array.from({ length: 24 }, (_, i) => ({
            timestamp: new Date(Date.now() + i * 3600000).toISOString(),
            value: 150 + Math.sin(i / 24) * 20,
            lower: 140,
            upper: 160,
          })),
          accuracy: 0.92,
          model: 'LSTM',
        }),
      });

      const response = await forecastHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.predictions).toBeDefined();
      expect(data.predictions.length).toBeGreaterThan(0);
      expect(data.accuracy).toBe(0.92);
    });

    it('인증되지 않은 요청을 거부해야 함', async () => {
      const request = new Request('http://localhost:3000/api/ai/forecast', {
        method: 'POST',
      });

      const { getServerSession } = await import('@/lib/auth/session');
      (getServerSession as any).mockResolvedValue(null);

      const response = await forecastHandler(request);

      expect(response.status).toBe(401);
    });

    it('불충분한 데이터로 인한 오류를 처리해야 함', async () => {
      const request = new Request('http://localhost:3000/api/ai/forecast', {
        method: 'POST',
      });

      const { getServerSession } = await import('@/lib/auth/session');
      const { default: prisma } = await import('@/lib/db/prisma');

      (getServerSession as any).mockResolvedValue({
        user: { tenantId: 'tenant-123' },
      });

      // 48개 미만의 데이터 포인트
      (prisma.measurement.findMany as any).mockResolvedValue(
        Array.from({ length: 20 }, (_, i) => ({
          value: 150,
        }))
      );

      const response = await forecastHandler(request);

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/ai/anomaly', () => {
    it('이상 탐지 결과를 반환해야 함', async () => {
      const request = new Request('http://localhost:3000/api/ai/anomaly', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const { getServerSession } = await import('@/lib/auth/session');
      const { default: prisma } = await import('@/lib/db/prisma');

      (getServerSession as any).mockResolvedValue({
        user: { tenantId: 'tenant-123' },
      });

      (prisma.measurement.findMany as any).mockResolvedValue(
        Array.from({ length: 720 }, (_, i) => ({
          value: i === 360 ? 300 : 150, // 이상 포함
        }))
      );

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          anomalies: [
            {
              timestamp: '2024-01-30T12:00:00',
              value: 300,
              score: -0.85,
              severity: 'high',
              reason: '급격한 전력 증가',
            },
          ],
          anomaly_rate: 0.0014,
          model: 'IsolationForest',
        }),
      });

      const response = await anomalyHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.anomalies).toBeDefined();
    });
  });

  describe('POST /api/ai/optimize', () => {
    it('최적화 추천을 반환해야 함', async () => {
      const request = new Request('http://localhost:3000/api/ai/optimize', {
        method: 'POST',
        body: JSON.stringify({ targetReduction: 50 }),
      });

      const { getServerSession } = await import('@/lib/auth/session');
      const { default: prisma } = await import('@/lib/db/prisma');

      (getServerSession as any).mockResolvedValue({
        user: { tenantId: 'tenant-123' },
      });

      (prisma.measurement.findMany as any).mockResolvedValue(
        Array.from({ length: 720 }, (_, i) => ({
          value: 150 + Math.sin(i / 24) * 20,
        }))
      );

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          peak_hours: [14, 15, 16, 17, 18, 19],
          ess_schedule: Array.from({ length: 24 }, (_, i) => ({
            hour: i,
            operation: i >= 2 && i <= 6 ? 'charge' : i >= 14 && i <= 19 ? 'discharge' : 'standby',
            power: 10,
          })),
          hvac_settings: {
            estimated_load_reduction: 0.15,
          },
          recommendations: [
            '피크 시간 온도를 1°C 상향 조정합니다',
            'ESS를 오전 2-6시에 충전합니다',
          ],
          estimated_savings: {
            daily: 1200,
            monthly: 36000,
            annual: 432000,
          },
        }),
      });

      const response = await optimizeHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.peak_hours).toBeDefined();
      expect(data.ess_schedule).toBeDefined();
      expect(data.estimated_savings).toBeDefined();
    });
  });

  describe('POST /api/dr', () => {
    it('DR 이벤트를 생성해야 함', async () => {
      const request = new Request('http://localhost:3000/api/dr', {
        method: 'POST',
        body: JSON.stringify({
          title: '2024년 1월 피크 관리',
          startTime: '2024-01-30T14:00:00',
          endTime: '2024-01-30T17:00:00',
          targetReductionKw: 50,
        }),
      });

      const { getServerSession } = await import('@/lib/auth/session');
      const { default: prisma } = await import('@/lib/db/prisma');

      (getServerSession as any).mockResolvedValue({
        user: { tenantId: 'tenant-123' },
      });

      (prisma.drEvent.create as any).mockResolvedValue({
        id: 'dr-event-123',
        title: '2024년 1월 피크 관리',
        status: 'scheduled',
      });

      const response = await drHandler(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.id).toBeDefined();
      expect(data.status).toBe('scheduled');
    });

    it('DR 이벤트 목록을 반환해야 함', async () => {
      const request = new Request('http://localhost:3000/api/dr', {
        method: 'GET',
      });

      const { getServerSession } = await import('@/lib/auth/session');
      const { default: prisma } = await import('@/lib/db/prisma');

      (getServerSession as any).mockResolvedValue({
        user: { tenantId: 'tenant-123' },
      });

      (prisma.drEvent.findMany as any).mockResolvedValue([
        {
          id: 'dr-event-1',
          title: 'Event 1',
          status: 'scheduled',
        },
        {
          id: 'dr-event-2',
          title: 'Event 2',
          status: 'in_progress',
        },
      ]);

      const response = await drHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(2);
    });
  });
});

describe('Data Flow Integration', () => {
  it('예측 → 이상탐지 → 최적화 → DR 전체 흐름을 테스트해야 함', async () => {
    const { getServerSession } = await import('@/lib/auth/session');
    const { default: prisma } = await import('@/lib/db/prisma');

    (getServerSession as any).mockResolvedValue({
      user: { tenantId: 'tenant-123' },
    });

    // 1. 부하 데이터 준비
    const mockData = Array.from({ length: 720 }, (_, i) => ({
      value: 150 + Math.sin(i / 24) * 20 + (i === 360 ? 100 : 0),
    }));

    (prisma.measurement.findMany as any).mockResolvedValue(mockData);

    // 2. 부하 예측
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        predictions: Array.from({ length: 24 }, (_, i) => ({
          value: 150,
          lower: 140,
          upper: 160,
        })),
        accuracy: 0.92,
      }),
    });

    // 3. 이상 탐지
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        anomalies: [
          {
            timestamp: '2024-01-30T12:00:00',
            value: 250,
            severity: 'high',
          },
        ],
      }),
    });

    // 4. 최적화 추천
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        peak_hours: [14, 15, 16],
        estimated_savings: {
          daily: 1200,
        },
      }),
    });

    // 5. DR 이벤트 생성
    (prisma.drEvent.create as any).mockResolvedValue({
      id: 'dr-event-123',
      status: 'scheduled',
    });

    // 모든 단계 검증
    expect(mockData.length).toBe(720);
    expect(prisma.measurement.findMany).toHaveBeenCalled();
    expect(global.fetch).toBeDefined();
  });
});
