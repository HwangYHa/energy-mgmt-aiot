/**
 * /api/monitoring/pipeline - 데이터 수집 파이프라인 상태 API
 *
 * GET: 센서/디바이스별 데이터 수집 상태 반환
 * recordsToday: 이론값(pollIntervalMs 기반) → 실제 measurement 테이블 카운트로 교체
 */

import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify';
import {
  successResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from '@/lib/api/response';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const { tenantId } = auth;

    // 오늘 자정
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // 디바이스 + 센서 수 조회
    const devices = await prisma.device.findMany({
      where: { site: { tenantId } },
      include: {
        site: { select: { name: true } },
        _count: { select: { sensors: true } },
      },
      orderBy: { lastSeenAt: 'desc' },
    });

    if (devices.length === 0) {
      return successResponse({
        sources: [],
        stats: {
          totalSources: 0,
          activeSources: 0,
          errorSources: 0,
          totalRecordsToday: 0,
          avgLatencyMs: 0,
          lastUpdated: new Date().toISOString(),
        },
      });
    }

    // 디바이스별 오늘 실제 수신 레코드 수 (measurement 테이블 실제 카운트)
    const deviceIds = devices.map((d) => d.id);
    type RecordCountRow = { device_id: string; cnt: bigint };
    const recordCounts = await prisma.$queryRaw<RecordCountRow[]>`
      SELECT d.id as device_id, COUNT(m.metric_id) as cnt
      FROM device d
      LEFT JOIN metric mt ON mt.device_id = d.id
      LEFT JOIN measurement m ON m.metric_id = mt.id AND m.time >= ${todayStart}
      WHERE d.id IN (${Prisma.join(deviceIds)})
      GROUP BY d.id
    `;

    // device_id → count 맵
    const countMap = new Map<string, number>(
      recordCounts.map((r) => [r.device_id, Number(r.cnt)])
    );

    const now = new Date();

    const sources = devices.map((device) => {
      const lastReceived = device.lastSeenAt;
      const diffMs = lastReceived
        ? now.getTime() - new Date(lastReceived).getTime()
        : Infinity;

      let status: 'active' | 'inactive' | 'error' | 'maintenance' = 'active';
      if (device.status === 'maintenance') {
        status = 'maintenance';
      } else if (device.status === 'error') {
        status = 'error';
      } else if (!lastReceived || diffMs > 3600000) {
        status = 'inactive';
      } else if (device.status === 'offline') {
        status = 'inactive';
      }

      return {
        id: device.id,
        name: `${device.name} (${device.site.name})`,
        type: device.protocol || 'unknown',
        status,
        lastReceived: lastReceived?.toISOString() || null,
        recordsToday: countMap.get(device.id) ?? 0,
        errorRate: status === 'error' ? 100 : 0,
        latencyMs: device.responseTimeMs || 0,
      };
    });

    const activeSources = sources.filter((s) => s.status === 'active').length;
    const errorSources = sources.filter((s) => s.status === 'error').length;
    const totalRecordsToday = sources.reduce((sum, s) => sum + s.recordsToday, 0);
    const activeOnly = sources.filter((s) => s.status === 'active');
    const avgLatencyMs =
      activeOnly.length > 0
        ? Math.round(
            activeOnly.reduce((sum, s) => sum + s.latencyMs, 0) / activeOnly.length
          )
        : 0;

    return successResponse({
      sources,
      stats: {
        totalSources: sources.length,
        activeSources,
        errorSources,
        totalRecordsToday,
        avgLatencyMs,
        lastUpdated: now.toISOString(),
      },
    });
  } catch (error) {
    console.error('Pipeline status error:', error);
    return serverErrorResponse({ message: '데이터 수집 상태를 조회할 수 없습니다.' });
  }
}
