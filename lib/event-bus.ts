/**
 * lib/event-bus.ts
 *
 * 플랫폼 이벤트 버스 — 타입 안전 in-process 이벤트 에미터
 * globalThis 싱글톤 (Next.js hot-reload 안전)
 */

import { EventEmitter } from 'events';

// ── 플랫폼 이벤트 유니온 타입 ────────────────────────────────
export type PlatformEvent =
  | { type: 'MEASUREMENT_INGESTED';  tenantId: string; deviceId: string; value: number; siteId?: string }
  | { type: 'ANOMALY_DETECTED';      tenantId: string; deviceId: string; score: number; alertId?: string }
  | { type: 'PAYMENT_COMPLETED';     tenantId: string; orderId: string;  amount: number }
  | { type: 'PAYMENT_FAILED';        tenantId: string; orderId: string;  reason: string }
  | { type: 'BACKUP_COMPLETED';      path: string;     checksum: string; sizeBytes: number }
  | { type: 'BACKUP_FAILED';         reason: string }
  | { type: 'RANSOMWARE_ALERT';      tenantId?: string; alertType: string; severity: string; userId?: string };

export type PlatformEventType = PlatformEvent['type'];
export type PlatformEventHandler<T extends PlatformEventType> = (
  event: Extract<PlatformEvent, { type: T }>,
) => void | Promise<void>;

// ── 이벤트 버스 클래스 ───────────────────────────────────────
class PlatformEventBusClass {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  /** 이벤트 발행 (fire-and-forget, 핸들러 오류 격리) */
  emit<T extends PlatformEventType>(event: Extract<PlatformEvent, { type: T }>): void {
    const listeners = this.emitter.listeners(event.type);
    for (const listener of listeners) {
      Promise.resolve()
        .then(() => (listener as (e: typeof event) => void | Promise<void>)(event))
        .catch((err) => {
          console.error(`[EventBus] 핸들러 오류 (${event.type}):`, err);
        });
    }
  }

  /** 이벤트 구독 */
  on<T extends PlatformEventType>(
    type: T,
    handler: PlatformEventHandler<T>,
  ): void {
    this.emitter.on(type, handler as (...args: unknown[]) => void);
  }

  /** 이벤트 구독 해제 */
  off<T extends PlatformEventType>(
    type: T,
    handler: PlatformEventHandler<T>,
  ): void {
    this.emitter.off(type, handler as (...args: unknown[]) => void);
  }

  /** 한 번만 구독 */
  once<T extends PlatformEventType>(
    type: T,
    handler: PlatformEventHandler<T>,
  ): void {
    this.emitter.once(type, handler as (...args: unknown[]) => void);
  }
}

// ── globalThis 싱글톤 (hot-reload 안전) ──────────────────────
const GLOBAL_KEY = '__carboneum_event_bus__';
type GlobalWithBus = typeof globalThis & { [GLOBAL_KEY]?: PlatformEventBusClass };

if (!(globalThis as GlobalWithBus)[GLOBAL_KEY]) {
  (globalThis as GlobalWithBus)[GLOBAL_KEY] = new PlatformEventBusClass();
}

export const EventBus = (globalThis as GlobalWithBus)[GLOBAL_KEY]!;

// ── 사용 예제 (삭제하지 말 것 — 문서 목적) ──────────────────
/*
import { EventBus } from '@/lib/event-bus';

// 구독
EventBus.on('ANOMALY_DETECTED', async (event) => {
  console.log(`이상 탐지: ${event.deviceId} score=${event.score}`);
  // 알림 발송 등
});

// 발행
EventBus.emit({ type: 'MEASUREMENT_INGESTED', tenantId: 'abc', deviceId: 'dev1', value: 1250 });
*/
