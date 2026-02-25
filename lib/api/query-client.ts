/**
 * lib/api/query-client.ts
 * SWR 전역 설정 + 공유 키 레지스트리 + 표준 fetcher
 *
 * 사용법:
 *   import { SWR_KEYS, SWR_CONFIG, apiFetcher } from '@/lib/api/query-client';
 *   const { data } = useSWR(SWR_KEYS.carbon.summary(year), apiFetcher, SWR_CONFIG.default);
 */

import type { SWRConfiguration } from 'swr';

// ─── SWR 키 레지스트리 ────────────────────────────────────────────

export const SWR_KEYS = {
  carbon: {
    emissions: (year: number) => `/api/analytics/carbon/emissions?year=${year}`,
    footprint: (year: number, target = 500) =>
      `/api/analytics/carbon/footprint?year=${year}&target=${target}`,
    summary: (year: number) => `/api/analytics/carbon/summary?year=${year}`,
  },
  dashboard: {
    stats: () => '/api/dashboard/stats',
    energy: (siteId?: string) =>
      siteId ? `/api/dashboard/energy?siteId=${siteId}` : '/api/dashboard/energy',
  },
  sensors: {
    list: (siteId?: string) =>
      siteId ? `/api/sensors?siteId=${siteId}` : '/api/sensors',
    readings: (sensorId: string) => `/api/sensors/${sensorId}/readings`,
  },
  sites: {
    list: () => '/api/sites',
    detail: (id: string) => `/api/sites/${id}`,
  },
  ai: {
    anomaly: (sensorId: string) => `/api/ai/anomaly?sensorId=${sensorId}`,
    forecast: (sensorId: string) => `/api/ai/forecast?sensorId=${sensorId}`,
    optimize: () => '/api/ai/optimize',
  },
} as const;

// ─── SWR 전역 설정 프리셋 ─────────────────────────────────────────

const DEFAULT_CONFIG: SWRConfiguration = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  shouldRetryOnError: false,
  dedupingInterval: 5_000,
};

const REALTIME_CONFIG: SWRConfiguration = {
  ...DEFAULT_CONFIG,
  refreshInterval: 10_000,
  dedupingInterval: 2_000,
};

const SLOW_CONFIG: SWRConfiguration = {
  ...DEFAULT_CONFIG,
  revalidateIfStale: true,
  dedupingInterval: 60_000, // 1분 — 탄소/리포트 같은 무거운 쿼리
};

export const SWR_CONFIG = {
  default: DEFAULT_CONFIG,
  realtime: REALTIME_CONFIG,
  slow: SLOW_CONFIG,
} as const;

// ─── 표준 Fetcher ────────────────────────────────────────────────

export class FetchError extends Error {
  status: number;
  info: unknown;

  constructor(message: string, status: number, info: unknown) {
    super(message);
    this.name = 'FetchError';
    this.status = status;
    this.info = info;
  }
}

/**
 * SWR용 표준 JSON fetcher
 * - 401: 로그인 페이지로 리다이렉트
 * - 4xx/5xx: FetchError throw
 */
export async function apiFetcher<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });

  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined') {
      window.location.href = '/auth/login';
    }

    let info: unknown = null;
    try {
      info = await res.json();
    } catch {
      // ignore
    }

    throw new FetchError(
      `API 오류: ${res.status} ${res.statusText}`,
      res.status,
      info,
    );
  }

  const json = await res.json();
  // 표준 응답 래퍼 { success, data } 자동 언래핑
  if (json && typeof json === 'object' && 'data' in json) {
    return json.data as T;
  }
  return json as T;
}
