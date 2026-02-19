/**
 * lib/mqtt/handlers.ts — MQTT 메시지 핸들러
 *
 * MQTT 메시지 수신 → DB measurement 테이블 저장 → SSE 이벤트 발행
 *
 * 토픽 규칙: ems/{tenantId}/{sensorCode}/data
 * 페이로드:  {"value": 245.7, "quality": "good", "timestamp": "2026-02-19T14:30:00Z"}
 *
 * 호출 위치: lib/mqtt/init.ts → registerMQTTHandlers()
 */

import { prisma } from '@/lib/db/prisma';
import { MQTTClient } from './client';

// 센서 조회 캐시 (메모리 캐시, 5분 TTL)
const sensorCache = new Map<string, { metricId: string; sensorId: string; expiry: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

// 만료 항목 주기 정리 (10분마다) — 무한 성장 방지
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of sensorCache) {
    if (entry.expiry <= now) sensorCache.delete(key);
  }
}, 10 * 60 * 1000).unref(); // .unref(): 이 타이머가 프로세스 종료를 막지 않도록

async function getSensorMetric(
  tenantId: string,
  sensorCode: string
): Promise<{ metricId: string; sensorId: string } | null> {
  const cacheKey = `${tenantId}:${sensorCode}`;
  const cached = sensorCache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return { metricId: cached.metricId, sensorId: cached.sensorId };
  }

  const sensor = await prisma.sensor.findFirst({
    where: { tenantId, code: sensorCode, deletedAt: null },
    include: { metrics: { select: { id: true }, take: 1 } },
  });

  const firstMetric = sensor?.metrics[0];
  if (!sensor || !firstMetric) return null;

  const result = { metricId: firstMetric.id, sensorId: sensor.id };
  sensorCache.set(cacheKey, { ...result, expiry: Date.now() + CACHE_TTL_MS });
  return result;
}

export function registerMQTTHandlers(): void {
  const mqtt = MQTTClient.getInstance();

  mqtt.on('rawMessage', async (topic: string, payload: Buffer) => {
    try {
      // 토픽 파싱: ems/{tenantId}/{sensorCode}/data
      const parts = topic.split('/');
      if (parts.length < 4 || parts[0] !== 'ems' || parts[3] !== 'data') return;

      const tenantId = parts[1];
      const sensorCode = parts[2];
      if (!tenantId || !sensorCode) return;

      const rawData = JSON.parse(payload.toString()) as {
        value?: unknown;
        quality?: string;
        timestamp?: string;
      };

      const value = Number(rawData.value);
      if (isNaN(value)) {
        console.warn('[MQTT Handler] 유효하지 않은 value:', topic, rawData.value);
        return;
      }

      const quality = (rawData.quality === 'bad' || rawData.quality === 'uncertain')
        ? rawData.quality
        : 'good';

      const time = rawData.timestamp ? new Date(rawData.timestamp) : new Date();
      if (isNaN(time.getTime())) {
        console.warn('[MQTT Handler] 유효하지 않은 timestamp:', rawData.timestamp);
        return;
      }

      const cached = await getSensorMetric(tenantId, sensorCode);
      if (!cached) {
        console.warn('[MQTT Handler] 센서 없음:', tenantId, sensorCode);
        return;
      }

      // DB 저장
      await prisma.measurement.create({
        data: {
          time,
          tenantId,
          metricId: cached.metricId,
          value,
          quality,
        },
      });

      // sensor.lastValue, lastSeenAt 비동기 갱신 (응답 지연 없이)
      prisma.sensor.update({
        where: { id: cached.sensorId },
        data: { lastValue: value, lastSeenAt: time, status: 'online' },
      }).catch(() => {});

      // SSE 스트림으로 프론트엔드에 푸시
      mqtt.emit('measurement', { tenantId, sensorCode, value, time: time.toISOString(), quality });

    } catch (err) {
      console.error('[MQTT Handler] 처리 오류:', err instanceof Error ? err.message : err);
    }
  });

  console.log('[MQTT Handler] 핸들러 등록 완료');
}
