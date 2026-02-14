'use client';

import { useState, useEffect, useCallback } from 'react';

// CSRF 토큰 전역 상태 (React 외부에서도 사용 가능)
let globalCsrfToken: string | null = null;
let globalCsrfExpiry: number = 0;
const CSRF_CACHE_DURATION = 30 * 60 * 1000; // 30분

/**
 * CSRF 토큰 전역 캐시 초기화
 */
export function clearGlobalCsrfToken(): void {
  globalCsrfToken = null;
  globalCsrfExpiry = 0;
}

/**
 * CSRF 토큰을 가져오는 전역 함수
 * React 컴포넌트 외부에서도 사용 가능
 */
export async function fetchCsrfToken(): Promise<string> {
  const now = Date.now();

  // 캐시된 토큰이 유효하면 반환
  if (globalCsrfToken && globalCsrfExpiry > now) {
    return globalCsrfToken;
  }

  try {
    const response = await fetch('/api/security/csrf', {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`CSRF 토큰 발급 실패: ${response.status}`);
    }

    const data = await response.json();
    globalCsrfToken = data.csrfToken;
    globalCsrfExpiry = now + CSRF_CACHE_DURATION;

    return globalCsrfToken!;
  } catch (error) {
    console.error('[CSRF] 토큰 발급 오류:', error);
    throw new Error('CSRF 토큰을 가져올 수 없습니다. 페이지를 새로고침해주세요.');
  }
}

/**
 * CSRF 토큰을 자동으로 가져와서 관리하는 훅
 *
 * @example
 * const { csrfToken, loading, error, refresh } = useCsrfToken();
 */
export function useCsrfToken() {
  const [csrfToken, setCsrfToken] = useState<string | null>(globalCsrfToken);
  const [loading, setLoading] = useState(!globalCsrfToken);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 캐시 초기화 후 새로 가져오기
      clearGlobalCsrfToken();
      const token = await fetchCsrfToken();
      setCsrfToken(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSRF 토큰 발급 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 이미 유효한 토큰이 있으면 스킵
    if (globalCsrfToken && globalCsrfExpiry > Date.now()) {
      setCsrfToken(globalCsrfToken);
      setLoading(false);
      return;
    }

    // 토큰 발급
    (async () => {
      try {
        const token = await fetchCsrfToken();
        setCsrfToken(token);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'CSRF 토큰 발급 실패');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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

  return fetch(url, {
    ...options,
    headers,
    credentials: 'include', // 쿠키 포함 (인증)
  });
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

  return fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });
}
