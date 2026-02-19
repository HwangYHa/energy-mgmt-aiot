// app/api/realtime/route.ts
import { NextRequest } from 'next/server';
import { MQTTClient } from '@/lib/mqtt/client';

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const mqtt = MQTTClient.getInstance();

      // 핸들러를 변수로 보관해야 abort 시 동일 참조로 제거 가능
      const measurementHandler = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // 스트림이 이미 닫힌 경우 무시
        }
      };

      mqtt.on('measurement', measurementHandler);

      // 클라이언트 연결 종료 시 리스너 제거 + 스트림 닫기
      request.signal.addEventListener('abort', () => {
        mqtt.off('measurement', measurementHandler);
        try {
          controller.close();
        } catch {
          // 이미 닫힌 경우 무시
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
