/**
 * lib/mqtt/client.ts — MQTT 브로커 클라이언트
 *
 * 환경변수:
 *   MQTT_BROKER_URL  mqtt://host:1883 | mqtts:// | ws://  (미설정 시 비활성)
 *   MQTT_USERNAME    선택
 *   MQTT_PASSWORD    선택
 *   MQTT_CLIENT_ID   기본값: ems-server
 *
 * 토픽 규칙: ems/{tenantId}/{sensorCode}/data
 * 페이로드:  {"value": 245.7, "quality": "good", "timestamp": "ISO8601"}
 */

import type { MqttClient as MqttClientType } from 'mqtt';
import { EventEmitter } from 'events';

export class MQTTClient extends EventEmitter {
  private static instance: MQTTClient;
  private client: MqttClientType | null = null;
  private isConnected = false;

  private constructor() {
    super();
    this.setMaxListeners(50);
  }

  static getInstance(): MQTTClient {
    if (!MQTTClient.instance) {
      MQTTClient.instance = new MQTTClient();
    }
    return MQTTClient.instance;
  }

  connect(): void {
    const url = process.env.MQTT_BROKER_URL;
    if (!url) {
      console.warn('[MQTT] MQTT_BROKER_URL 미설정 — MQTT 비활성');
      return;
    }

    // 동적 import (서버 사이드 전용)
    import('mqtt').then((mqttModule) => {
      const mqtt = mqttModule.default || mqttModule;
      this.client = mqtt.connect(url, {
        username: process.env.MQTT_USERNAME || undefined,
        password: process.env.MQTT_PASSWORD || undefined,
        clientId: process.env.MQTT_CLIENT_ID || 'ems-server',
        reconnectPeriod: 5000,
        connectTimeout: 10000,
        clean: true,
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        console.log('[MQTT] 브로커 연결됨:', url);
        this.emit('connected');
      });

      this.client.on('message', (topic: string, payload: Buffer) => {
        this.emit('rawMessage', topic, payload);
      });

      this.client.on('error', (err: Error) => {
        console.error('[MQTT] 연결 오류:', err.message);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        this.isConnected = false;
        console.log('[MQTT] 연결 종료 (재연결 대기)');
      });

      this.client.on('reconnect', () => {
        console.log('[MQTT] 재연결 시도...');
      });
    }).catch((err) => {
      console.error('[MQTT] mqtt 패키지 로드 실패:', err);
    });
  }

  disconnect(): void {
    if (this.client) {
      this.client.end();
      this.client = null;
      this.isConnected = false;
    }
  }

  subscribe(topic: string): void {
    if (!this.client || !this.isConnected) {
      console.warn('[MQTT] subscribe 실패 — 연결 안됨:', topic);
      return;
    }
    this.client.subscribe(topic, { qos: 1 }, (err) => {
      if (err) {
        console.error('[MQTT] 구독 실패:', topic, err.message);
      } else {
        console.log('[MQTT] 구독 완료:', topic);
      }
    });
  }

  publish(topic: string, message: string): void {
    if (!this.client || !this.isConnected) {
      console.warn('[MQTT] publish 실패 — 연결 안됨:', topic);
      return;
    }
    this.client.publish(topic, message, { qos: 1 }, (err) => {
      if (err) console.error('[MQTT] 발행 실패:', topic, err.message);
    });
  }

  getStatus(): 'connected' | 'disconnected' {
    return this.isConnected ? 'connected' : 'disconnected';
  }
}
