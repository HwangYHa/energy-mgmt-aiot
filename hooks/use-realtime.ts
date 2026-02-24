/**
 * hooks/use-realtime.ts
 * Zustand 실시간 스토어 래퍼 훅
 *
 * - 컴포넌트 마운트 시 SSE 연결, 언마운트 시 연결 유지 (전역 단일 연결)
 * - selector 패턴으로 불필요한 리렌더 최소화
 */
'use client';

import { useEffect, useRef } from 'react';
import {
  useRealtimeStore,
  type SensorReading,
  type AlertEvent,
} from '@/lib/stores/realtime.store';

// ─────────────────────────────────────────────────────
// 타입 재수출
// ─────────────────────────────────────────────────────
export type { SensorReading, AlertEvent };

// ─────────────────────────────────────────────────────
// 메인 훅: SSE 연결 + 상태 구독
// ─────────────────────────────────────────────────────

/**
 * SSE 연결을 관리하고 실시간 상태를 반환하는 훅
 *
 * @param autoConnect - 마운트 시 자동 연결 여부 (기본: true)
 */
export function useRealtime(autoConnect = true) {
  const connect = useRealtimeStore(s => s.connect);
  const disconnect = useRealtimeStore(s => s.disconnect);
  const status = useRealtimeStore(s => s.status);
  const aggregates = useRealtimeStore(s => s.aggregates);
  const alerts = useRealtimeStore(s => s.alerts);
  const lastHeartbeat = useRealtimeStore(s => s.lastHeartbeat);
  const reconnectAttempts = useRealtimeStore(s => s.reconnectAttempts);
  const resetAlerts = useRealtimeStore(s => s.resetAlerts);

  // 연결 레퍼런스 카운터 (여러 컴포넌트가 훅을 사용해도 단 1회만 연결)
  const connectedRef = useRef(false);

  useEffect(() => {
    if (!autoConnect) return;
    if (!connectedRef.current) {
      connect();
      connectedRef.current = true;
    }
    // 언마운트 시에는 disconnect 하지 않음 — 전역 단일 연결 유지
    // disconnect는 로그아웃 등 명시적 상황에서만 호출
  }, [autoConnect, connect]);

  return {
    status,
    aggregates,
    alerts,
    lastHeartbeat,
    reconnectAttempts,
    resetAlerts,
    connect,
    disconnect,
    isConnected: status === 'connected',
    isConnecting: status === 'connecting',
    hasError: status === 'error',
  };
}

// ─────────────────────────────────────────────────────
// 특정 센서 값 구독 훅
// ─────────────────────────────────────────────────────

/**
 * 특정 센서의 실시간 값만 구독하는 훅 (selector로 최적화)
 */
export function useSensorValue(sensorId: string): SensorReading | null {
  return useRealtimeStore(s => s.readings[sensorId] ?? null);
}

/**
 * 여러 센서의 실시간 값을 한 번에 구독하는 훅
 */
export function useSensorValues(sensorIds: string[]): Record<string, SensorReading> {
  return useRealtimeStore(s => {
    const result: Record<string, SensorReading> = {};
    for (const id of sensorIds) {
      const reading = s.readings[id];
      if (reading) result[id] = reading;
    }
    return result;
  });
}

// ─────────────────────────────────────────────────────
// 집계값 전용 훅 (KPI 카드용)
// ─────────────────────────────────────────────────────

export function useRealtimeAggregates() {
  return useRealtimeStore(s => s.aggregates);
}

// ─────────────────────────────────────────────────────
// 연결 상태 전용 훅
// ─────────────────────────────────────────────────────

export function useRealtimeStatus() {
  const status = useRealtimeStore(s => s.status);
  const reconnectAttempts = useRealtimeStore(s => s.reconnectAttempts);
  const lastHeartbeat = useRealtimeStore(s => s.lastHeartbeat);

  return {
    status,
    reconnectAttempts,
    lastHeartbeat,
    isConnected: status === 'connected',
    isConnecting: status === 'connecting',
    hasError: status === 'error',
    isDisconnected: status === 'disconnected',
  };
}
