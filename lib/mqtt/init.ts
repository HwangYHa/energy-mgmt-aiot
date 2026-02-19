/**
 * lib/mqtt/init.ts — MQTT 초기화 진입점
 *
 * Next.js instrumentation.ts에서 서버 시작 시 호출.
 * MQTT_BROKER_URL 미설정 시 MQTT 비활성 (나머지 기능 정상 동작).
 */

import { MQTTClient } from './client';
import { registerMQTTHandlers } from './handlers';

let initialized = false;

export function initMQTT(): void {
  // 이미 초기화되었거나 브로커 URL 없으면 스킵
  if (initialized || !process.env.MQTT_BROKER_URL) {
    if (!process.env.MQTT_BROKER_URL) {
      console.log('[MQTT] MQTT_BROKER_URL 미설정 — MQTT 기능 비활성');
    }
    return;
  }

  initialized = true;

  const client = MQTTClient.getInstance();

  // 핸들러 등록 (rawMessage → DB 저장 + SSE 푸시)
  registerMQTTHandlers();

  // 브로커 연결
  client.connect();

  // 연결 성공 시 전체 테넌트 와일드카드 구독
  client.once('connected', () => {
    client.subscribe('ems/#');
  });
}
