/**
 * /api/data-collection/generate - 시뮬레이션 데이터 생성 API
 *
 * POST: 센서별 측정 데이터 생성 (site_manager 이상)
 *
 * 실제 센서 데이터 수집 전 개발/테스트용 시뮬레이션 데이터 생성기
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyAuth, requireRoleOrHigher } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import { UserRole } from '@/lib/constants/roles';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  validationErrorResponse,
  serverErrorResponse,
  notFoundResponse,
} from '@/lib/api/response';

const generateSchema = z.object({
  // 생성할 시간 범위 (hours)
  hours: z.number().min(1).max(720).default(24),
  // 데이터 포인트 간격 (minutes)
  intervalMinutes: z.number().min(1).max(60).default(15),
  // 특정 디바이스만 (선택)
  deviceId: z.string().uuid().optional(),
});

// 센서 타입별 데이터 생성 패턴
function generateValue(sensorType: string, hour: number, baseMin: number, baseMax: number): number {
  const range = baseMax - baseMin;
  const mid = (baseMax + baseMin) / 2;

  switch (sensorType) {
    case 'power_meter':
    case 'energy_meter': {
      // 전력: 업무시간(9-18) 높고, 야간 낮음
      const timeWeight = (hour >= 9 && hour <= 18) ? 0.7 + Math.random() * 0.3 : 0.2 + Math.random() * 0.3;
      return baseMin + range * timeWeight + (Math.random() - 0.5) * range * 0.1;
    }
    case 'temperature': {
      // 온도: 낮 높고 밤 낮음
      const tempCycle = Math.sin((hour - 6) * Math.PI / 12) * 0.3;
      return mid + range * tempCycle + (Math.random() - 0.5) * 2;
    }
    case 'humidity': {
      // 습도: 온도 반비례
      const humCycle = -Math.sin((hour - 6) * Math.PI / 12) * 0.2;
      return mid + range * humCycle + (Math.random() - 0.5) * 5;
    }
    case 'pressure':
    case 'flow_meter':
    default: {
      // 기본: 랜덤 변동
      return mid + (Math.random() - 0.5) * range * 0.4;
    }
  }
}

export async function POST(request: NextRequest) {
  // 프로덕션 환경에서는 시뮬레이션 데이터 생성 비활성화
  if (process.env.NODE_ENV === 'production') {
    return notFoundResponse('이 API는 개발/스테이징 환경에서만 사용 가능합니다.');
  }

  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!requireRoleOrHigher(auth, 'site_manager' as UserRole)) {
      return forbiddenResponse();
    }

    const body = await request.json();
    const parsed = generateSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse({ message: '잘못된 파라미터입니다.' });
    }

    const { tenantId } = auth;
    const { hours, intervalMinutes, deviceId } = parsed.data;

    // 센서가 연결된 메트릭 조회
    const sensorWhere: Record<string, unknown> = {
      tenantId,
      deletedAt: null,
    };
    if (deviceId) sensorWhere.deviceId = deviceId;

    const sensors = await prisma.sensor.findMany({
      where: sensorWhere,
      include: {
        metrics: { select: { id: true, key: true, unit: true } },
      },
    });

    if (sensors.length === 0) {
      return validationErrorResponse({
        message: '데이터를 생성할 센서가 없습니다. 먼저 센서를 등록하세요.',
      });
    }

    const now = new Date();
    const startTime = new Date(now.getTime() - hours * 60 * 60 * 1000);
    const pointCount = Math.floor((hours * 60) / intervalMinutes);
    let totalCreated = 0;

    // 센서별 데이터 생성
    for (const sensor of sensors) {
      const minRange = sensor.minRange ? Number(sensor.minRange) : 0;
      const maxRange = sensor.maxRange ? Number(sensor.maxRange) : 1000;

      // 메트릭이 없으면 기본 메트릭 생성
      let metrics = sensor.metrics;
      if (metrics.length === 0) {
        const metric = await prisma.metric.create({
          data: {
            tenantId,
            deviceId: sensor.deviceId,
            sensorId: sensor.id,
            key: `${sensor.code || sensor.sensorType}_value`,
            name: `${sensor.name} 측정값`,
            unit: sensor.unit || '',
            dataType: 'float',
            minValue: minRange,
            maxValue: maxRange,
          },
        });
        metrics = [{ id: metric.id, key: metric.key, unit: metric.unit }];
      }

      // 측정 데이터 배치 생성
      for (const metric of metrics) {
        const measurements: Array<{
          time: Date;
          tenantId: string;
          metricId: string;
          value: number;
          quality: 'good' | 'bad' | 'uncertain';
        }> = [];

        for (let i = 0; i < pointCount; i++) {
          const time = new Date(startTime.getTime() + i * intervalMinutes * 60 * 1000);
          const hour = time.getHours();
          const value = generateValue(sensor.sensorType, hour, minRange, maxRange);

          measurements.push({
            time,
            tenantId,
            metricId: metric.id,
            value: Math.round(value * 100) / 100,
            quality: Math.random() > 0.02 ? 'good' : 'bad',
          });
        }

        // 배치 삽입 (500개씩)
        for (let i = 0; i < measurements.length; i += 500) {
          const batch = measurements.slice(i, i + 500);
          await prisma.measurement.createMany({
            data: batch.map((m) => ({
              time: m.time,
              tenantId: m.tenantId,
              metricId: m.metricId,
              value: m.value,
              quality: m.quality,
            })),
            skipDuplicates: true,
          });
        }

        totalCreated += measurements.length;
      }

      // 센서 마지막 값 업데이트
      const lastValue = generateValue(sensor.sensorType, now.getHours(), minRange, maxRange);
      await prisma.sensor.update({
        where: { id: sensor.id },
        data: {
          lastValue: Math.round(lastValue * 100) / 100,
          lastSeenAt: now,
          status: 'online',
        },
      });
    }

    return successResponse({
      generated: true,
      sensorsProcessed: sensors.length,
      totalMeasurements: totalCreated,
      timeRange: { from: startTime.toISOString(), to: now.toISOString() },
      interval: `${intervalMinutes}분`,
    });
  } catch (error) {
    console.error('[API] 데이터 생성 오류:', error);
    return serverErrorResponse();
  }
}
