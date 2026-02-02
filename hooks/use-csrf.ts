'use client';

import { useState, useEffect } from 'react';

/**
 * CSRF 토큰을 자동으로 가져와서 관리하는 훅
 */
export function useCsrfToken() {
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCsrfToken() {
      try {
        const res = await fetch('/api/auth/csrf');
        if (res.ok) {
          const data = await res.json();
          setCsrfToken(data.csrfToken);
        }
      } catch (error) {
        console.error('Failed to fetch CSRF token:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchCsrfToken();
  }, []);

  return { csrfToken, loading };
}

/**
 * CSRF 토큰을 포함한 fetch 래퍼
 */
export async function fetchWithCsrf(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // CSRF 토큰 가져오기
  const csrfRes = await fetch('/api/auth/csrf');
  const csrfData = await csrfRes.json();
  const csrfToken = csrfData.csrfToken;

  // 기존 헤더에 CSRF 토큰 추가
  const headers = new Headers(options.headers);
  headers.set('X-CSRF-Token', csrfToken);

  return fetch(url, {
    ...options,
    headers,
    credentials: 'include', // 쿠키 포함
  });
}
