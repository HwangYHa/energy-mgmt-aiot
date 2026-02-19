/**
 * /api/analytics/raw-data - 원시 데이터 탐색 API
 *
 * GET: 센서별 원본 데이터 조회 (센서 목록 + 최근 측정값)
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
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
    const { searchParams } = new URL(request.url);

    const type = searchParams.get('type');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '50', 10), 200);

    // 센서 목록 조회 (필터링 적용)
    const sensors = await prisma.sensor.findMany({
      where: {
        device: {
          site: { tenantId },
        },
        ...(type ? { sensorType: type } : {}),
        ...(search ? {
          OR: [
            { name: { contains: search } },
            { code: { contains: search } },
          ],
        } : {}),
      },
      include: {
        device: {
          select: { name: true, protocol: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // 센서 ID 목록으로 최근 측정값 조회 (메트릭 → 측정값 조인)
    const sensorIds = sensors.map((s) => s.id);
    let latestValues: Array<{ sensor_id: string; value: number; time: Date; quality: string }> = [];

    if (sensorIds.length > 0) {
      // 각 센서의 첫 번째 메트릭 기준 최신 측정값
      latestValues = await prisma.$queryRaw<Array<{ sensor_id: string; value: number; time: Date; quality: string }>>`
        SELECT mt.sensor_id, m.value, m.time, m.quality
        FROM measurement m
        INNER JOIN (
          SELECT mt2.id as metric_id, mt2.sensor_id,
                 ROW_NUMBER() OVER (PARTITION BY mt2.sensor_id ORDER BY m2.time DESC) as rn
          FROM metric mt2
          JOIN measurement m2 ON m2.metric_id = mt2.id
          WHERE mt2.sensor_id IN (${Prisma.join(sensorIds)})
        ) mt ON m.metric_id = mt.metric_id AND mt.rn = 1
      `;
    }

    const valueMap = new Map(latestValues.map((v) => [v.sensor_id, v]));

    const data = sensors.map((sensor) => {
      const latest = valueMap.get(sensor.id);
      return {
        id: sensor.id,
        timestamp: latest?.time?.toISOString() ?? sensor.updatedAt?.toISOString() ?? sensor.createdAt.toISOString(),
        sensorId: sensor.code || sensor.id.slice(0, 8),
        sensorName: sensor.name,
        type: sensor.sensorType,
        value: latest ? Number(latest.value) : null,
        unit: sensor.unit || '',
        quality: latest?.quality ?? 'unknown',
      };
    });

    return successResponse(data);
  } catch (error) {
    console.error('Raw data query error:', error);
    return serverErrorResponse({ message: '원시 데이터를 조회할 수 없습니다.' });
  }
}
