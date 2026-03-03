'use client';

import { useState, useEffect, useCallback } from 'react';
// lib/api/client의 단일 캐시 사용 — 두 캐시 desync 방지
import { getCsrfToken, clearCsrfTokenCache } from '@/lib/api/client';

/**
 * CSRF 토큰 전역 캐시 초기화 — lib/api/client 캐시를 초기화
 */
export function clearGlobalCsrfToken(): void {
  clearCsrfTokenCache();
}

/**
 * CSRF 토큰을 가져오는 전역 함수 (lib/api/client의 단일 캐시 사용)
 * @deprecated lib/api/client의 getCsrfToken 직접 사용 권장
 */
export async function fetchCsrfToken(): Promise<string> {
  return getCsrfToken();
}

/**
 * CSRF 토큰을 자동으로 가져와서 관리하는 훅 (lib/api/client 단일 캐시 사용)
 *
 * @example
 * const { csrfToken, loading, error, refresh } = useCsrfToken();
 */
export function useCsrfToken() {
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadToken = useCallback(async (invalidate = false) => {
    setLoading(true);
    setError(null);
    try {
      if (invalidate) clearGlobalCsrfToken();
      const token = await fetchCsrfToken();
      setCsrfToken(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSRF 토큰 발급 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => loadToken(true), [loadToken]);

  useEffect(() => { loadToken(); }, [loadToken]);

  return { csrfToken, loading, error, refresh };
}

/**
 * CSRF 토큰을 포함한 fetch 래퍼
 *
 * @deprecated lib/api/client.ts의 apiRequest 사용 권장
 *
 * @example
 * const response = await fetchWithCsrf('/api/sites', {
 *   method: 'POST',
 *   body: JSON.stringify({ name: 'New Site' }),
 * });
 */
export async function fetchWithCsrf(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // CSRF 토큰 가져오기
  const csrfToken = await fetchCsrfToken();

  // 기존 헤더에 CSRF 토큰 추가
  const headers = new Headers(options.headers);
  headers.set('X-CSRF-Token', csrfToken);

  // Content-Type 기본값 설정
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // 쿠키 포함 (인증)
  });

  // 전역적 플랜/권한 응답 처리: 402(구독 필요), 403(권한 없음)
  if (typeof window !== 'undefined' && (res.status === 402 || res.status === 403)) {
    // 읽은 바디가 재사용되지 않도록 clone 후 확인
    try {
      const clone = res.clone();
      const data = await clone.json().catch(() => null);
      const msg = data?.error || data?.message || (res.status === 402 ? '구독 플랜이 필요합니다. 업그레이드 해주세요.' : '권한이 없습니다.');
      // 동작: 사용자에게 비침해성 토스트 알림 제공
      // toast는 전역 이벤트 방식이므로 여기서 import하여 호출
      const { toast } = await import('@/lib/toast');
      toast.warn(msg);
      // 또한 전역 업그레이드 이벤트를 발행하여 모달을 열 수 있게 함
      try {
        const detail = { message: msg, upgradeUrl: data?.upgradeUrl };
        window.dispatchEvent(new CustomEvent('ems:upgrade', { detail }));
      } catch (e) {
        // noop
      }
    } catch (e) {
      // 실패해도 원본 응답을 그대로 반환
      // eslint-disable-next-line no-console
      console.warn('[fetchWithCsrf] failed to show upgrade toast', e);
    }
  }

  return res;
}

/**
 * useCsrfToken 훅과 함께 사용하는 fetch 헬퍼
 *
 * @example
 * const { csrfToken } = useCsrfToken();
 *
 * const handleSubmit = async () => {
 *   const response = await fetchWithToken(csrfToken, '/api/sites', {
 *     method: 'POST',
 *     body: JSON.stringify(data),
 *   });
 * };
 */
export async function fetchWithToken(
  csrfToken: string | null,
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers);

  if (csrfToken) {
    headers.set('X-CSRF-Token', csrfToken);
  }

  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (typeof window !== 'undefined' && (res.status === 402 || res.status === 403)) {
    try {
      const clone = res.clone();
      const data = await clone.json().catch(() => null);
      const msg = data?.error || data?.message || (res.status === 402 ? '구독 플랜이 필요합니다. 업그레이드 해주세요.' : '권한이 없습니다.');
      const { toast } = await import('@/lib/toast');
      toast.warn(msg);
      try {
        const detail = { message: msg, upgradeUrl: data?.upgradeUrl };
        window.dispatchEvent(new CustomEvent('ems:upgrade', { detail }));
      } catch (e) {
        // noop
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[fetchWithToken] failed to show upgrade toast', e);
    }
  }

  return res;
}
