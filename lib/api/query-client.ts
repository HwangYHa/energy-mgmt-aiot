/**
 * lib/api/query-client.ts — 전역 SWR 설정 + 공유 fetcher
 *
 * 모든 페이지에서 동일한 SWR 키를 사용하면 캐시가 자동 공유됩니다.
 * Dashboard에서 로드한 stats가 Sidebar의 배지에도 자동 반영.
 *
 * 사용법:
 *   import useSWR from 'swr';
 *   import { apiFetcher, SWR_KEYS } from '@/lib/api/query-client';
 *   const { data } = useSWR(SWR_KEYS.dashboardStats, apiFetcher);
 */

import { apiGet } from './client';

// ──────────────────────────────────────────────────────────────
// 표준 SWR 키 (화면 간 캐시 공유의 핵심)
// 같은 키 = 같은 캐시 = 한 번 로드 → 여러 화면 공유
// ──────────────────────────────────────────────────────────────

export const SWR_KEYS = {
  // 대시보드
  dashboardStats:    '/api/dashboard/stats',
  dashboardOverview: '/api/dashboard/overview',

  // 모니터링
  sensors:     '/api/sensors',
  devices:     '/api/devices',
  sites:       '/api/sites',
  gateways:    '/api/gateways',

  // 탄소
  carbonSummary:   (year: number)    => `/api/analytics/carbon?year=${year}`,
  carbonEmissions: (period: string)  => `/api/analytics/carbon/emissions?period=${period}`,
  emissionFactors: ()                => `/api/analytics/carbon/emission-factors`,

  // 에너지
  energySummary:   (period: string)  => `/api/analytics/energy?period=${period}`,

  // 구독
  subscription: '/api/subscriptions',

  // 알림
  alertRules: '/api/notifications/rules',
} as const;

// ──────────────────────────────────────────────────────────────
// 표준 SWR 설정 (전역 적용)
// ──────────────────────────────────────────────────────────────

export const SWR_CONFIG = {
  // 기본 재검증 주기 (30초)
  refreshInterval: 30_000,

  // 창 포커스 복귀 시 재검증
  revalidateOnFocus: true,

  // 재연결 시 재검증
  revalidateOnReconnect: true,

  // 에러 시 재시도 (최대 3회)
  errorRetryCount: 3,

  // Fetcher: CSRF 자동 포함 API 클라이언트 사용
  fetcher: apiFetcher,

  // 낙관적 UI: 뮤테이션 후 즉시 로컬 업데이트
  revalidateOnMount: true,
} as const;

// ──────────────────────────────────────────────────────────────
// Fetcher (CSRF + 에러 처리 표준화)
// ──────────────────────────────────────────────────────────────

export async function apiFetcher<T = unknown>(url: string): Promise<T> {
  const res = await apiGet<T>(url);
  if (!res.success) {
    throw new Error(res.error ?? res.message ?? 'API 오류');
  }
  return res.data as T;
}
