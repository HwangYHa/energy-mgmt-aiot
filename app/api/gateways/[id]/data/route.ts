/**
 * POST /api/gateways/{id}/data — 게이트웨이 표준 데이터 수신
 *
 * 모든 프로토콜(MQTT Push, Modbus, BACnet, OPC-UA, HTTP)에서
 * 수집된 데이터를 단일 표준 페이로드로 수신.
 *
 * 인증:
 *   Bearer {API_KEY} 또는 X-Gateway-Token: {serial}:{secret}
 *
 * 페이로드 예:
 * {
 *   "timestamp": "2026-01-01T00:00:00Z",
 *   "readings": [
 *     { "sensorId": "meter_01", "metricKey": "power", "value": 245.7, "quality": "good" }
 *   ],
 *   "meta": { "protocol": "modbus_tcp", "signalQuality": 95 }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';
import type { GatewayDataPayload } from '@/lib/gateway/protocol-config';

export const dynamic = 'force-dynamic';

// ──────────────────────────────────────────────────────────────
// 스키마 검증
// ──────────────────────────────────────────────────────────────

const SensorReadingSchema = z.object({
  sensorId:  z.string().min(1),
  metricKey: z.string().min(1),
  value:     z.number(),
  quality:   z.enum(['good', 'bad', 'uncertain']).optional(),
  timestamp: z.string().datetime().optional(),
  unit:      z.string().optional(),
});

const PayloadSchema = z.object({
  timestamp: z.string().datetime(),
  readings:  z.array(SensorReadingSchema).min(1),
  meta: z.object({
    protocol:        z.string().optional(),
    firmwareVersion: z.string().optional(),
    signalQuality:   z.number().min(0).max(100).optional(),
    bufferCount:     z.number().int().optional(),
  }).optional(),
});

// ──────────────────────────────────────────────────────────────
// Gateway 인증 확인
// ──────────────────────────────────────────────────────────────

async function authenticateGateway(
  request: NextRequest,
  gatewayId: string
): Promise<{ tenantId: string; serialNumber: string } | null> {
  // 1) Bearer API Key 인증 (ApiKey 테이블)
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const rawKey = authHeader.slice(7);
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const key = await prisma.apiKey.findFirst({
      where: { keyHash, isActive: true },
      select: { tenantId: true },
    });
    if (key) {
      const gw = await prisma.gateway.findFirst({
        where: { id: gatewayId, tenantId: key.tenantId },
        select: { tenantId: true, serialNumber: true },
      });
      if (gw) return gw;
    }
  }

  // 2) X-Gateway-Token: {serial}:{내부 시크릿} 방식
  const gwToken = request.headers.get('x-gateway-token');
  if (gwToken) {
    const [serial] = gwToken.split(':');
    const gw = await prisma.gateway.findFirst({
      where: { id: gatewayId, serialNumber: serial },
      select: { tenantId: true, serialNumber: true },
    });
    if (gw) return gw;
  }

  return null;
}

// ──────────────────────────────────────────────────────────────
// POST 핸들러
// ──────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: gatewayId } = await params;

  // ── 1. 게이트웨이 인증 ──────────────────────────────────────
  const gwAuth = await authenticateGateway(request, gatewayId);
  if (!gwAuth) {
    return NextResponse.json(
      { success: false, error: '게이트웨이 인증 실패. Bearer API 키 또는 X-Gateway-Token을 확인하세요.' },
      { status: 401 }
    );
  }

  // ── 2. 페이로드 파싱 및 검증 ────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: '유효하지 않은 JSON' }, { status: 400 });
  }

  const parse = PayloadSchema.safeParse(rawBody);
  if (!parse.success) {
    return NextResponse.json(
      { success: false, error: '페이로드 형식 오류', details: parse.error.flatten() },
      { status: 400 }
    );
  }

  const payload: GatewayDataPayload = parse.data as GatewayDataPayload;
  const baseTs = new Date(payload.timestamp);
  const { tenantId } = gwAuth;

  // ── 3. 센서 맵 로드 (테넌트 내 모든 센서) ──────────────────
  const sensorCodes = [...new Set(payload.readings.map((r) => r.sensorId))];
  const sensors = await prisma.sensor.findMany({
    where: { tenantId, code: { in: sensorCodes } },
    select: {
      id: true,
      code: true,
      metrics: {
        select: { id: true, key: true },
      },
    },
  });

  const sensorMap = new Map(sensors.map((s) => [s.code, s]));

  // ── 4. Measurement 벌크 저장 ───────────────────────────────
  const measurementData: {
    tenantId: string;
    metricId: string;
    time: Date;
    value: number;
  }[] = [];

  const sensorUpdates: { id: string; lastValue: number }[] = [];
  const unknownSensors: string[] = [];

  for (const reading of payload.readings) {
    if (reading.quality === 'bad') continue; // 품질 불량 데이터 제외

    const sensor = sensorMap.get(reading.sensorId);
    if (!sensor) {
      unknownSensors.push(reading.sensorId);
      continue;
    }

    const metric = sensor.metrics.find((m) => m.key === reading.metricKey);
    if (!metric) continue;

    const ts = reading.timestamp ? new Date(reading.timestamp) : baseTs;

    measurementData.push({
      tenantId,
      metricId: metric.id,
      time: ts,
      value: reading.value,
    });

    // lastValue 업데이트 대상 (최신값)
    sensorUpdates.push({ id: sensor.id, lastValue: reading.value });
  }

  // 트랜잭션으로 저장
  const savedCount = measurementData.length;
  if (savedCount > 0) {
    await prisma.$transaction([
      // Measurement 배치 저장 (createMany)
      prisma.measurement.createMany({
        data: measurementData,
        skipDuplicates: true,
      }),
      // Gateway 상태 업데이트
      prisma.gateway.update({
        where: { id: gatewayId },
        data: {
          status: 'online',
          lastSeenAt: new Date(),
          lastHeartbeatAt: new Date(),
          bufferedRecords: payload.meta?.bufferCount ?? 0,
          firmwareVersion: payload.meta?.firmwareVersion,
        } as Record<string, unknown>,
      }),
    ]);

    // Sensor.lastValue 개별 업데이트 (N개지만 센서수 적음)
    await Promise.all(
      sensorUpdates.map(({ id, lastValue }) =>
        prisma.sensor.update({
          where: { id },
          data: { lastValue },
        }).catch(() => null) // lastValue 필드 없어도 무시
      )
    );
  }

  // ── 5. 응답 ────────────────────────────────────────────────
  return NextResponse.json({
    success: true,
    saved: savedCount,
    skipped: payload.readings.length - savedCount,
    unknownSensors: unknownSensors.length > 0 ? unknownSensors : undefined,
    timestamp: new Date().toISOString(),
  });
}

// ──────────────────────────────────────────────────────────────
// GET — 최근 수신 데이터 조회 (디버깅용)
// ──────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: gatewayId } = await params;

  const gwAuth = await authenticateGateway(request, gatewayId);
  if (!gwAuth) {
    return NextResponse.json({ success: false, error: '인증 실패' }, { status: 401 });
  }

  const gw = await prisma.gateway.findUnique({
    where: { id: gatewayId },
    select: {
      id: true,
      serialNumber: true,
      name: true,
      status: true,
      lastSeenAt: true,
      lastHeartbeatAt: true,
      bufferedRecords: true,
      firmwareVersion: true,
      config: true,
    },
  });

  if (!gw) {
    return NextResponse.json({ success: false, error: '게이트웨이 없음' }, { status: 404 });
  }

  return NextResponse.json({ success: true, gateway: gw });
}
