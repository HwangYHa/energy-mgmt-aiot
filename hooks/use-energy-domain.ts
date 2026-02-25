/**
 * hooks/use-energy-domain.ts
 * 에너지 도메인 공통 훅 — SSE Overlay 패턴
 *
 * Zustand 실시간 값(SSE)을 API 폴백 위에 오버레이합니다.
 * SSE 연결 시: Zustand 값 우선
 * SSE 미연결:  SWR(API) 값 사용
 */
'use client';

import useSWR from 'swr';
import { useRealtimeStore } from '@/lib/stores/realtime.store';
import { apiFetcher, SWR_KEYS, SWR_CONFIG } from '@/lib/api/query-client';

// ─── 에너지 사이트별 전력 오버레이 훅 ─────────────────────────────

interface DashboardStats {
  totalPower: number;
  activeSensors: number;
  alertCount: number;
  carbonEmission?: number;
  [key: string]: unknown;
}

/**
 * 대시보드 통계 + SSE 실시간 totalPower 오버레이
 */
export function useDashboardStats(_siteId?: string) {
  const { data, error, isLoading, mutate } = useSWR<DashboardStats>(
    SWR_KEYS.dashboard.stats(),
    apiFetcher<DashboardStats>,
    SWR_CONFIG.realtime,
  );

  const sseStatus = useRealtimeStore(s => s.status);
  const sseAggregates = useRealtimeStore(s => s.aggregates);

  // SSE 연결 중이면 totalPower를 SSE값으로 오버레이
  const totalPower =
    sseStatus === 'connected'
      ? sseAggregates.totalPower
      : data?.totalPower ?? 0;

  const activeSensors =
    sseStatus === 'connected'
      ? sseAggregates.activeSensors
      : data?.activeSensors ?? 0;

  return {
    data: data ? { ...data, totalPower, activeSensors } : undefined,
    error,
    isLoading,
    mutate,
    sseConnected: sseStatus === 'connected',
  };
}

// ─── 센서 실시간 값 훅 ────────────────────────────────────────────

interface SensorRecentReading {
  value: number;
  unit: string;
  quality: string;
  timestamp: string;
  [key: string]: unknown;
}

/**
 * 특정 센서의 최신 측정값 + SSE 오버레이
 */
export function useSensorReading(sensorId: string | null) {
  const { data, error, isLoading } = useSWR<SensorRecentReading>(
    sensorId ? SWR_KEYS.sensors.readings(sensorId) : null,
    apiFetcher<SensorRecentReading>,
    SWR_CONFIG.realtime,
  );

  const sseReading = useRealtimeStore(s =>
    sensorId ? s.readings[sensorId] : undefined,
  );

  const sseStatus = useRealtimeStore(s => s.status);

  const value =
    sseStatus === 'connected' && sseReading
      ? sseReading.value
      : data?.value ?? null;

  return {
    value,
    unit: sseReading?.unit ?? data?.unit ?? '-',
    quality: sseReading?.quality ?? data?.quality ?? 'unknown',
    timestamp: sseReading?.timestamp ?? data?.timestamp ?? null,
    isLoading,
    error,
    isLive: sseStatus === 'connected' && !!sseReading,
  };
}

// ─── 사이트 목록 훅 ───────────────────────────────────────────────

interface Site {
  id: string;
  name: string;
  address?: string;
  [key: string]: unknown;
}

export function useSiteList() {
  return useSWR<Site[]>(
    SWR_KEYS.sites.list(),
    apiFetcher<Site[]>,
    SWR_CONFIG.default,
  );
}
