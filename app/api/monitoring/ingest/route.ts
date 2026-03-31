/**
 * POST /api/monitoring/ingest
 * IoT 게이트웨이(Raspberry Pi)에서 배치 전력 데이터 수신
 * 인증: X-API-Key 헤더 (게이트웨이 전용)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

interface IngestRecord {
  tenantId:    string;
  siteId:      string;
  gatewayId:   string;
  deviceId:    string;
  timestamp:   string;
  activePower: number;
  voltage:     number;
  current:     number;
  powerFactor: number;
  frequency:   number;
  energy:      number;
}

// metricId 캐시 (deviceId+key → metricId)
const metricCache = new Map<string, string>();

async function getOrCreateMetric(
  tenantId: string,
  deviceId: string,
  key: string,
  unit: string,
): Promise<string> {
  const cacheKey = `${deviceId}:${key}`;
  if (metricCache.has(cacheKey)) return metricCache.get(cacheKey)!;

  const metric = await prisma.metric.upsert({
    where: { deviceId_key: { deviceId, key } },
    create: {
      tenantId,
      deviceId,
      key,
      name: key,
      unit,
      category: 'power_active',
    },
    update: {},
    select: { id: true },
  });

  metricCache.set(cacheKey, metric.id);
  return metric.id;
}

export async function POST(request: NextRequest) {
  // ── API Key 인증 ─────────────────────────────────────────
  const apiKey  = request.headers.get('x-api-key');
  const validKey = process.env.GATEWAY_API_KEY;

  if (!validKey || apiKey !== validKey) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 });
  }

  let records: IngestRecord[];
  try {
    const body = await request.json();
    records = body.records;
    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: 'records 배열이 필요합니다' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: '잘못된 JSON' }, { status: 400 });
  }

  const batch = records.slice(0, 100);

  try {
    // 각 레코드를 activePower 메트릭으로 저장
    const measurements: { metricId: string; tenantId: string; time: Date; value: number; gatewayId: string }[] = [];

    for (const r of batch) {
      const metricId = await getOrCreateMetric(r.tenantId, r.deviceId, 'active_power', 'W');
      measurements.push({
        metricId,
        tenantId:  r.tenantId,
        time:      new Date(r.timestamp),
        value:     r.activePower ?? 0,
        gatewayId: r.gatewayId,
      });
    }

    await prisma.measurement.createMany({
      data: measurements,
      skipDuplicates: true,
    });

    // 게이트웨이 온라인 상태 갱신
    const gwIds = [...new Set(batch.map((r) => r.gatewayId))];
    await Promise.all(
      gwIds.map((gwId) =>
        prisma.gateway.updateMany({
          where: { id: gwId },
          data:  { status: 'online', lastSeenAt: new Date() },
        }).catch(() => {}),
      ),
    );

    return NextResponse.json({ success: true, inserted: measurements.length });
  } catch (error) {
    console.error('[Ingest] DB error:', error);
    return NextResponse.json({ error: 'DB 저장 실패' }, { status: 500 });
  }
}
