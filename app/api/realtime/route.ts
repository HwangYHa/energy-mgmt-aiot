/**
 * GET /api/realtime — Server-Sent Events 실시간 스트림
 *
 * MQTT → SSE 브리지: 인증된 테넌트의 측정 데이터만 실시간 푸시
 *
 * 클라이언트 사용법:
 *   const es = new EventSource('/api/realtime');
 *   es.addEventListener('measurement', (e) => { const d = JSON.parse(e.data); });
 *   es.addEventListener('heartbeat',   (e) => { / keep-alive / });
 */

import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { MQTTClient } from '@/lib/mqtt/client';

export const dynamic = 'force-dynamic';

// SSE 이벤트 포맷 헬퍼
function sseEvent(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { tenantId } = auth;

  const stream = new ReadableStream({
    start(controller) {
      // 최초 연결 확인 이벤트
      try {
        controller.enqueue(sseEvent('connected', { tenantId, timestamp: new Date().toISOString() }));
      } catch { /* 이미 닫힘 */ }

      // MQTT 측정 데이터 → 테넌트 격리 후 SSE 발행
      const mqtt = MQTTClient.getInstance();

      const measurementHandler = (data: { tenantId: string; sensorCode: string; value: number; time: string; quality: string }) => {
        if (data.tenantId !== tenantId) return; // 타 테넌트 데이터 차단
        try {
          controller.enqueue(sseEvent('measurement', data));
        } catch { /* 스트림 닫힘 */ }
      };

      mqtt.on('measurement', measurementHandler);

      // 30초 heartbeat — 프록시/nginx 타임아웃 방지
      const heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(sseEvent('heartbeat', { timestamp: new Date().toISOString() }));
        } catch {
          clearInterval(heartbeatTimer);
        }
      }, 30_000);

      // 연결 종료 시 정리
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeatTimer);
        mqtt.off('measurement', measurementHandler);
        try { controller.close(); } catch { /* 이미 닫힘 */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Nginx 버퍼링 비활성 (프록시 환경)
    },
  });
}
