/**
 * hooks/use-display-settings.ts
 *
 * 시스템 설정 → 프론트엔드 표시 설정 훅
 *
 * PUT /api/system-settings 저장 후 refresh() 호출 시 즉시 재조회.
 *
 * 사용:
 *   const { displaySettings, isLoading, refresh } = useDisplaySettings();
 *   const { refreshInterval } = displaySettings?.alerts ?? {};
 */

'use client';

import useSWR from 'swr';
import { apiFetcher } from '@/lib/api/query-client';

export interface DisplaySettings {
  dashboard: {
    defaultView:      'overview' | 'realtime' | 'analytics';
    chartType:        'area' | 'bar' | 'line';
    showCarbonWidget: boolean;
    showCostWidget:   boolean;
    showDeviceStatus: boolean;
  };
  alerts: {
    refreshInterval:        number;
    powerThresholdWarning:  number;
    powerThresholdCritical: number;
    emailNotifications:     boolean;
    kakaoNotifications:     boolean;
  };
  general: {
    language:     'ko' | 'en';
    dateFormat:   string;
    numberFormat: string;
  };
  energy: {
    electricityRate: number;
    peakRate:        number;
    offPeakRate:     number;
    carbonFactor:    number;
    targetReduction: number;
    currency:        string;
  };
  organization: {
    name:         string;
    timezone:     string;
    industryType: string;
  };
}

interface ApiResponse {
  success: boolean;
  data: DisplaySettings;
}

export function useDisplaySettings() {
  const { data, error, isLoading, mutate } = useSWR<ApiResponse>(
    '/api/dashboard/display-settings',
    apiFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval:  60_000,  // 60초 중복 요청 방지 (서버 캐시와 동일)
    },
  );

  return {
    displaySettings: data?.data ?? null,
    isLoading,
    error,
    refresh: () => mutate(),
  };
}

/**
 * 대시보드 자동 갱신 주기만 빠르게 조회.
 * 기본값 30초 (설정 미로드 시).
 */
export function useRefreshInterval(): number {
  const { displaySettings } = useDisplaySettings();
  return displaySettings?.alerts.refreshInterval ?? 30;
}

/**
 * 전력 임계값 조회.
 */
export function usePowerThresholds() {
  const { displaySettings } = useDisplaySettings();
  return {
    warning:  displaySettings?.alerts.powerThresholdWarning  ?? 80,
    critical: displaySettings?.alerts.powerThresholdCritical ?? 95,
  };
}
