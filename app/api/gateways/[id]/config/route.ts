/**
 * GET /api/gateways/{id}/config
 *
 * OTA(Over-The-Air) 설정 조회 — Collector 전용
 *
 * 플랫폼 DB의 Device + Metric 정보를 Collector config.yaml 형식으로 변환하여 반환.
 * 수집기는 이 엔드포인트를 통해 장치 설정을 자동으로 가져오므로
 * config.yaml에 devices 섹션을 직접 작성할 필요 없음.
 *
 * 인증: Bearer {API_KEY} 또는 X-Gateway-Token: {serial}
 * (세션 불필요 — 현장 장치에서 직접 호출)
 *
 * 응답:
 * {
 *   "gateway_id": "gw_xxx",
 *   "config_hash": "sha256...",  // 변경 감지용
 *   "fetched_at": "ISO8601",
 *   "devices": [
 *     {
 *       "id": "device-uuid",
 *       "name": "1층 전력계량기",
 *       "protocol": "modbus_tcp",
 *       "enabled": true,
 *       "poll_interval_ms": 5000,
 *       "connection": { "host": "...", "port": 502, "unit_id": 1 },
 *       "registers": [
 *         { "address": 40001, "type": "holding", "data_type": "float32",
 *           "sensor_code": "METER-01-KWH", "metric_key": "energy_kwh",
 *           "unit": "kWh", "scale": 0.001 }
 *       ]
 *     }
 *   ]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

// ── API Key / Gateway Token 인증 ──────────────────────────────────

async function authenticateGateway(
  request: NextRequest,
  gatewayId: string,
): Promise<{ tenantId: string; gatewayId: string } | null> {
  // 1) Bearer API Key
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const rawKey  = authHeader.slice(7);
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const key = await (prisma as any).apiKey.findFirst({
      where: { keyHash, isActive: true },
      select: { tenantId: true },
    });
    if (key) {
      const gw = await prisma.gateway.findFirst({
        where: { id: gatewayId, tenantId: key.tenantId },
        select: { id: true, tenantId: true },
      });
      if (gw) return { tenantId: gw.tenantId, gatewayId: gw.id };
    }
  }

  // 2) X-Gateway-Token: {serial}
  const gwToken = request.headers.get('x-gateway-token');
  if (gwToken) {
    const [serial] = gwToken.split(':');
    const gw = await prisma.gateway.findFirst({
      where: { id: gatewayId, serialNumber: serial },
      select: { id: true, tenantId: true },
    });
    if (gw) return { tenantId: gw.tenantId, gatewayId: gw.id };
  }

  return null;
}

// ── Collector 형식 변환 헬퍼 ──────────────────────────────────────

function normalizeProtocol(protocol: string): string {
  // DB enum → collector protocol key 통일
  const map: Record<string, string> = {
    modbus_tcp:         'modbus_tcp',
    modbus_rtu:         'modbus_rtu',
    modbus_tcp_gateway: 'modbus_tcp',
    bacnet:             'bacnet',
    bacnet_ip:          'bacnet',
    bacnet_mstp:        'modbus_rtu', // RS-485 계열
    opcua:              'opcua',
    mqtt:               'mqtt',
    http:               'http',
  };
  return map[protocol] ?? protocol;
}

function buildConnection(protocol: string, connCfg: Record<string, unknown>): Record<string, unknown> {
  const proto = normalizeProtocol(protocol);

  if (proto === 'modbus_tcp') {
    return {
      host:        connCfg.host    ?? '',
      port:        Number(connCfg.port   ?? 502),
      unit_id:     Number(connCfg.unitId ?? 1),
      timeout_sec: Math.round(Number(connCfg.timeout ?? 5000) / 1000),
    };
  }
  if (proto === 'modbus_rtu') {
    return {
      serial_port: connCfg.serialPort ?? connCfg.comPort ?? '',
      baudrate:    Number(connCfg.baudRate ?? 9600),
      parity:      String(connCfg.parity ?? 'N').charAt(0).toUpperCase(),
      stopbits:    Number(connCfg.stopBits ?? 1),
      unit_id:     Number(connCfg.unitId ?? 1),
    };
  }
  if (proto === 'mqtt') {
    return {
      broker_host:       connCfg.host        ?? connCfg.brokerHost ?? '',
      broker_port:       Number(connCfg.port ?? connCfg.brokerPort ?? 1883),
      username:          connCfg.username    ?? undefined,
      password:          connCfg.password    ?? undefined,
      subscribe_topics:  connCfg.topics      ?? connCfg.subscribeTopics ?? ['sensors/#'],
      qos:               Number(connCfg.qos  ?? 1),
    };
  }
  if (proto === 'http') {
    return {
      base_url:  connCfg.baseUrl ?? connCfg.url ?? `http://${connCfg.host}:${connCfg.port}`,
      api_key:   connCfg.apiKey  ?? undefined,
      timeout_sec: Math.round(Number(connCfg.timeout ?? 10000) / 1000),
    };
  }
  if (proto === 'opcua') {
    return {
      endpoint: connCfg.endpoint ?? `opc.tcp://${connCfg.host}:${connCfg.port ?? 4840}`,
      username: connCfg.username ?? undefined,
      password: connCfg.password ?? undefined,
    };
  }
  // fallback
  return connCfg;
}

function buildRegister(metric: {
  registerAddress: number | null;
  registerType:    string | null;
  key:             string;
  dataType:        string;
  scaleFactor:     string | number;
  unit:            string | null;
  sensor?:         { code: string | null } | null;
}): Record<string, unknown> | null {
  if (metric.registerAddress === null) return null;

  const sensorCode = metric.sensor?.code ?? metric.key;

  return {
    address:     metric.registerAddress,
    type:        metric.registerType ?? 'holding',
    data_type:   metric.dataType === 'float' ? 'float32' : metric.dataType,
    sensor_code: sensorCode,
    metric_key:  metric.key,
    unit:        metric.unit ?? '',
    scale:       Number(metric.scaleFactor ?? 1.0),
  };
}

// ── 핸들러 ───────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: gatewayId } = await params;

  // 인증
  const auth = await authenticateGateway(request, gatewayId);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: '인증 실패 — Bearer API 키 또는 X-Gateway-Token 헤더 확인' },
      { status: 401 },
    );
  }

  // 게이트웨이에 연결된 모든 장치 + 메트릭 조회
  const devices = await prisma.device.findMany({
    where: {
      gatewayId:  auth.gatewayId,
      tenantId:   auth.tenantId,
      deletedAt:  null,
    },
    select: {
      id:               true,
      name:             true,
      code:             true,
      protocol:         true,
      connectionConfig: true,
      pollIntervalMs:   true,
      controlCapable:   true,
      metrics: {
        select: {
          id:              true,
          key:             true,
          dataType:        true,
          unit:            true,
          registerAddress: true,
          registerType:    true,
          scaleFactor:     true,
          sensor: {
            select: { code: true },
          },
        },
        orderBy: { registerAddress: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Collector 형식으로 변환
  const collectorDevices = devices.map((dev) => {
    const connCfg = (dev.connectionConfig ?? {}) as Record<string, unknown>;
    const proto   = normalizeProtocol(dev.protocol);

    const registers = dev.metrics
      .map((m) => buildRegister({
        ...m,
        registerAddress: m.registerAddress,
        registerType:    m.registerType,
        scaleFactor:     m.scaleFactor?.toString() ?? '1.0',
      }))
      .filter(Boolean);

    return {
      id:               dev.id,
      name:             dev.name,
      protocol:         proto,
      enabled:          true,
      poll_interval_ms: dev.pollIntervalMs,
      connection:       buildConnection(dev.protocol, connCfg),
      registers:        registers,
    };
  });

  // 변경 감지용 해시 (장치/메트릭이 바뀌면 hash 변경)
  const configHash = createHash('sha256')
    .update(JSON.stringify(collectorDevices))
    .digest('hex')
    .slice(0, 16);

  return NextResponse.json({
    success:      true,
    gateway_id:   auth.gatewayId,
    config_hash:  configHash,
    fetched_at:   new Date().toISOString(),
    device_count: collectorDevices.length,
    devices:      collectorDevices,
  });
}