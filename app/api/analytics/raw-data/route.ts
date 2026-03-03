/**
 * /api/analytics/raw-data - 원시 데이터 탐색 API
 *
 * GET: 센서 측정값 조회
 *   - start + end 제공 시: 날짜 범위 내 전체 측정값 (다운로드용)
 *   - start/end 없을 시: 센서별 최신 측정값 1건 (탐색/표시용)
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
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    // ── 날짜 범위 모드 (다운로드용): start + end 파라미터 제공 시 ──
    if (start && end) {
      const startDate = new Date(start);
      const endDate = new Date(end);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return serverErrorResponse({ message: '유효하지 않은 날짜 형식입니다.' });
      }

      const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '1000', 10), 5000);
      const offset = (page - 1) * pageSize;

      // 조건 프래그먼트 조합
      const typeFilter = type ? Prisma.sql`AND s.sensor_type = ${type}` : Prisma.empty;
      const searchFilter = search
        ? Prisma.sql`AND (s.name LIKE ${'%' + search + '%'} OR s.code LIKE ${'%' + search + '%'})`
        : Prisma.empty;

      const rows = await prisma.$queryRaw<Array<{
        sensor_id: string;
        sensor_code: string;
        sensor_name: string;
        sensor_type: string;
        unit: string;
        value: number | null;
        time: Date;
        quality: string;
      }>>(Prisma.sql`
        SELECT
          s.id           AS sensor_id,
          s.code         AS sensor_code,
          s.name         AS sensor_name,
          s.sensor_type,
          s.unit,
          m.value,
          m.time,
          m.quality
        FROM measurement m
        JOIN metric  mt ON m.metric_id  = mt.id
        JOIN sensor  s  ON mt.sensor_id = s.id
        JOIN device  d  ON s.device_id  = d.id
        JOIN site    si ON d.site_id    = si.id
        WHERE si.tenant_id = ${tenantId}
          AND m.time >= ${startDate}
          AND m.time <= ${endDate}
          ${typeFilter}
          ${searchFilter}
        ORDER BY m.time DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `);

      const data = rows.map((r, i) => ({
        id: `${r.sensor_id}-${i}`,
        timestamp: r.time.toISOString(),
        sensorId: r.sensor_code || r.sensor_id.slice(0, 8),
        sensorName: r.sensor_name,
        type: r.sensor_type,
        value: r.value !== null ? Number(r.value) : null,
        unit: r.unit || '',
        quality: r.quality ?? 'unknown',
      }));

      return successResponse(data);
    }

    // ── 탐색 모드 (기존): 센서별 최신 측정값 1건 ──
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '50', 10), 200);

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
