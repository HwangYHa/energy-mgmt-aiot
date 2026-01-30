// app/api/realtime/route.ts
import { NextRequest } from 'next/server';
import { MQTTClient } from '@/lib/mqtt/client';

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const mqtt = MQTTClient.getInstance();
      
      mqtt.on('measurement', (data) => {
        const message = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      });
      
      // 클라이언트 연결 종료 시
      request.signal.addEventListener('abort', () => {
        controller.close();
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