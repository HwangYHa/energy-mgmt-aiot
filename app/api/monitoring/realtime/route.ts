/**
 * /api/dashboard/realtime - 실시간 모니터링 데이터 API
 *
 * GET: 센서/디바이스 실시간 상태 + 최근 측정값 (Polling 방식)
 */

import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
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
    const now = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);

    // 병렬 쿼리
    const [
      devices,
      sensors,
      recentMeasurements,
      alertRules,
    ] = await Promise.all([
      // 디바이스 목록 + 상태
      prisma.device.findMany({
        where: { tenantId, deletedAt: null },
        select: {
          id: true,
          name: true,
          code: true,
          deviceType: true,
          status: true,
          lastSeenAt: true,
          controlCapable: true,
          controlMode: true,
          site: { select: { id: true, name: true } },
        },
        orderBy: { name: 'asc' },
      }),
      // 센서 목록 + 최근값
      prisma.sensor.findMany({
        where: { tenantId, deletedAt: null },
        select: {
          id: true,
          name: true,
          code: true,
          sensorType: true,
          unit: true,
          status: true,
          lastValue: true,
          lastSeenAt: true,
          minRange: true,
          maxRange: true,
          device: { select: { id: true, name: true, siteId: true } },
        },
        orderBy: { name: 'asc' },
      }),
      // 최근 5분간 측정 데이터 (최신 100건)
      prisma.measurement.findMany({
        where: { tenantId, time: { gte: fiveMinAgo } },
        select: {
          time: true,
          value: true,
          quality: true,
          metricId: true,
          metric: { select: { key: true, unit: true, sensorId: true, device: { select: { name: true } } } },
        },
        orderBy: { time: 'desc' },
        take: 200,
      }),
      // 활성 알림 규칙 수
      prisma.alertRule.count({
        where: { tenantId, enabled: true },
      }),
    ]);

    // 디바이스 상태 집계
    const deviceSummary = {
      total: devices.length,
      online: devices.filter((d) => d.status === 'online').length,
      offline: devices.filter((d) => d.status === 'offline').length,
      error: devices.filter((d) => d.status === 'error').length,
      maintenance: devices.filter((d) => d.status === 'maintenance').length,
    };

    // 센서 상태 집계
    const sensorSummary = {
      total: sensors.length,
      online: sensors.filter((s) => s.status === 'online').length,
      offline: sensors.filter((s) => s.status === 'offline').length,
      error: sensors.filter((s) => s.status === 'error').length,
    };

    // 센서별 최근 측정값 맵핑
    const sensorLatestMap = new Map<string, { value: number; time: Date; quality: string }>();
    for (const m of recentMeasurements) {
      const sensorId = m.metric.sensorId;
      if (sensorId && !sensorLatestMap.has(sensorId)) {
        sensorLatestMap.set(sensorId, {
          value: Number(m.value),
          time: m.time,
          quality: m.quality,
        });
      }
    }

    // 센서 + 실시간값 결합
    const sensorData = sensors.map((s) => {
      const latest = sensorLatestMap.get(s.id);
      return {
        ...s,
        lastValue: latest ? latest.value : (s.lastValue ? Number(s.lastValue) : null),
        lastSeenAt: latest ? latest.time : s.lastSeenAt,
        quality: latest?.quality || 'good',
        minRange: s.minRange ? Number(s.minRange) : null,
        maxRange: s.maxRange ? Number(s.maxRange) : null,
      };
    });

    // 이상값 감지 (범위 초과 센서)
    const anomalies = sensorData.filter((s) => {
      if (s.lastValue === null) return false;
      if (s.minRange !== null && s.lastValue < s.minRange) return true;
      if (s.maxRange !== null && s.lastValue > s.maxRange) return true;
      return false;
    }).map((s) => ({
      sensorId: s.id,
      sensorName: s.name,
      value: s.lastValue,
      unit: s.unit,
      minRange: s.minRange,
      maxRange: s.maxRange,
      type: s.lastValue !== null && s.minRange !== null && s.lastValue < s.minRange ? 'below_range' : 'above_range',
    }));

    return successResponse({
      timestamp: now.toISOString(),
      devices: devices.map((d) => ({
        ...d,
        lastSeenAt: d.lastSeenAt?.toISOString() || null,
      })),
      deviceSummary,
      sensors: sensorData.map((s) => ({
        ...s,
        lastSeenAt: s.lastSeenAt ? (s.lastSeenAt instanceof Date ? s.lastSeenAt.toISOString() : s.lastSeenAt) : null,
      })),
      sensorSummary,
      anomalies,
      activeAlertRules: alertRules,
      recentMeasurementCount: recentMeasurements.length,
    });
  } catch (error) {
    console.error('[API] 실시간 모니터링 오류:', error);
    return serverErrorResponse();
  }
}
