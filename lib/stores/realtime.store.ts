/**
 * lib/stores/realtime.store.ts
 * Zustand 기반 실시간 측정값 전역 스토어
 *
 * - SSE /api/realtime 단일 연결로 모든 컴포넌트에 측정값 공유
 * - 30초 heartbeat 감지로 연결 상태 추적
 * - 지수 백오프(최대 30s) 재연결
 * - 브라우저 탭 비활성(visibilitychange) 시 연결 유지/복원
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// ─────────────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────────────

export interface SensorReading {
  sensorId: string;
  value: number;
  unit: string;
  quality: 'good' | 'uncertain' | 'bad';
  timestamp: string;
}

export interface AlertEvent {
  id: string;
  sensorId: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: string;
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface RealtimeState {
  // 측정값 맵: sensorId → 최신 값
  readings: Record<string, SensorReading>;
  // 최근 알림 (최대 50개)
  alerts: AlertEvent[];
  // 연결 상태
  status: ConnectionStatus;
  lastHeartbeat: number | null;
  reconnectAttempts: number;
  // 집계값 (대시보드 KPI용)
  aggregates: {
    totalPower: number;     // kW
    activeSensors: number;
    alertCount: number;
  };
}

interface RealtimeActions {
  connect: () => void;
  disconnect: () => void;
  resetAlerts: () => void;
  getSensorValue: (sensorId: string) => number | null;
}

// ─────────────────────────────────────────────────────
// 내부 상태 (스토어 외부)
// ─────────────────────────────────────────────────────

let eventSource: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
const MAX_RECONNECT_DELAY = 30_000;
const HEARTBEAT_TIMEOUT = 45_000; // 30s heartbeat + 15s 버퍼

// ─────────────────────────────────────────────────────
// Zustand 스토어
// ─────────────────────────────────────────────────────

export const useRealtimeStore = create<RealtimeState & RealtimeActions>()(
  subscribeWithSelector((set, get) => ({
    readings: {},
    alerts: [],
    status: 'disconnected',
    lastHeartbeat: null,
    reconnectAttempts: 0,
    aggregates: { totalPower: 0, activeSensors: 0, alertCount: 0 },

    connect: () => {
      if (eventSource?.readyState === EventSource.OPEN) return;

      // 이전 연결 정리
      eventSource?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);

      set({ status: 'connecting' });

      eventSource = new EventSource('/api/realtime');

      eventSource.onopen = () => {
        set({ status: 'connected', reconnectAttempts: 0, lastHeartbeat: Date.now() });

        // heartbeat 감시 타이머
        heartbeatTimer = setInterval(() => {
          const { lastHeartbeat } = get();
          if (lastHeartbeat && Date.now() - lastHeartbeat > HEARTBEAT_TIMEOUT) {
            set({ status: 'error' });
            scheduleReconnect();
          }
        }, 5_000);
      };

      eventSource.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data) as {
            type: string;
            sensorId?: string;
            value?: number;
            unit?: string;
            quality?: string;
            timestamp?: string;
            alerts?: AlertEvent[];
            readings?: SensorReading[];
          };

          if (payload.type === 'heartbeat') {
            set({ lastHeartbeat: Date.now(), status: 'connected' });
            return;
          }

          if (payload.type === 'measurement' && payload.sensorId !== undefined) {
            const reading: SensorReading = {
              sensorId: payload.sensorId,
              value: payload.value ?? 0,
              unit: payload.unit ?? 'kW',
              quality: (payload.quality as SensorReading['quality']) ?? 'good',
              timestamp: payload.timestamp ?? new Date().toISOString(),
            };

            set(state => {
              const readings = { ...state.readings, [reading.sensorId]: reading };
              // 전력 합산 집계
              const totalPower = Object.values(readings)
                .filter(r => r.unit === 'kW' || r.unit === 'W')
                .reduce((sum, r) => sum + (r.unit === 'W' ? r.value / 1000 : r.value), 0);

              return {
                readings,
                aggregates: {
                  ...state.aggregates,
                  totalPower: Math.round(totalPower * 10) / 10,
                  activeSensors: Object.keys(readings).length,
                },
              };
            });
            return;
          }

          if (payload.type === 'alert' && payload.alerts) {
            set(state => ({
              alerts: [...payload.alerts!, ...state.alerts].slice(0, 50),
              aggregates: {
                ...state.aggregates,
                alertCount: state.aggregates.alertCount + (payload.alerts?.length ?? 0),
              },
            }));
            return;
          }

          // 초기 bulk 데이터 (연결 직후)
          if (payload.type === 'init' && payload.readings) {
            const readingsMap: Record<string, SensorReading> = {};
            for (const r of payload.readings) {
              readingsMap[r.sensorId] = r;
            }
            set({ readings: readingsMap });
          }
        } catch {
          // 파싱 오류 무시
        }
      };

      eventSource.onerror = () => {
        set({ status: 'error' });
        heartbeatTimer && clearInterval(heartbeatTimer);
        scheduleReconnect();
      };

      // 탭 visibility 변경 감지
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', handleVisibilityChange);
      }
    },

    disconnect: () => {
      eventSource?.close();
      eventSource = null;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      set({ status: 'disconnected', reconnectAttempts: 0 });
    },

    resetAlerts: () => {
      set(state => ({
        alerts: [],
        aggregates: { ...state.aggregates, alertCount: 0 },
      }));
    },

    getSensorValue: (sensorId: string) => {
      return get().readings[sensorId]?.value ?? null;
    },
  }))
);

// ─────────────────────────────────────────────────────
// 내부 헬퍼 함수
// ─────────────────────────────────────────────────────

function scheduleReconnect() {
  const { reconnectAttempts, connect } = useRealtimeStore.getState();
  // 지수 백오프: 1s, 2s, 4s, 8s, 16s, 30s(최대)
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);

  useRealtimeStore.setState({ reconnectAttempts: reconnectAttempts + 1 });

  reconnectTimer = setTimeout(() => {
    connect();
  }, delay);
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    const { status, connect } = useRealtimeStore.getState();
    if (status === 'disconnected' || status === 'error') {
      connect();
    }
  }
}
