/**
 * 대시보드 데이터 fetching 훅
 * 5초마다 자동 갱신
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { DashboardOverview } from '@/lib/types/hmi';

interface UseDashboardDataReturn {
  data: DashboardOverview | null;
  isLoading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  refresh: () => Promise<void>;
}

export function useDashboardData(refreshInterval: number = 5000): UseDashboardDataReturn {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);

      // JWT 토큰 가져오기
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // 토큰이 있으면 Authorization 헤더 추가
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/dashboard/overview', {
        method: 'GET',
        headers,
        credentials: 'include', // 세션 쿠키 포함 (폴백용)
        cache: 'no-store',
      });

      if (!response.ok) {
        if (response.status === 401) {
          // 인증 오류 - 조용히 처리 (로그인 페이지로 리디렉션은 middleware가 처리)
          setError('인증이 필요합니다. 로그인 페이지로 이동합니다.');
          setIsLoading(false);
          return;
        }
        throw new Error(`API 요청 실패: ${response.status}`);
      }

      const result: DashboardOverview = await response.json();

      setData(result);
      setLastUpdate(new Date());
      setIsLoading(false);
    } catch (err) {
      console.error('[useDashboardData] Error:', err);
      setError(err instanceof Error ? err.message : '데이터 조회 실패');
      setIsLoading(false);
    }
  }, []);

  // 초기 데이터 로드
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 자동 갱신
  useEffect(() => {
    if (refreshInterval <= 0) return;

    const intervalId = setInterval(() => {
      fetchData();
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [refreshInterval, fetchData]);

  return {
    data,
    isLoading,
    error,
    lastUpdate,
    refresh: fetchData,
  };
}
