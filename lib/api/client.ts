/**
 * lib/api/client.ts - 표준화된 API 클라이언트
 *
 * 특징:
 * ✅ CSRF 토큰 자동 관리
 * ✅ 인증 쿠키 자동 포함
 * ✅ 한국어 에러 메시지
 * ✅ 자동 재시도
 * ✅ 타임아웃 처리
 */

// CSRF 토큰 캐시
let csrfTokenCache: string | null = null;
let csrfTokenExpiry: number = 0;
const CSRF_CACHE_DURATION = 30 * 60 * 1000; // 30분

/**
 * CSRF 토큰 가져오기 (캐싱 적용)
 * 공개 export — FormData 업로드 등 apiRequest를 사용할 수 없는 경우 직접 사용
 */
export async function getCsrfToken(): Promise<string> {
  const now = Date.now();

  // 캐시된 토큰이 유효하면 반환
  if (csrfTokenCache && csrfTokenExpiry > now) {
    return csrfTokenCache;
  }

  // 새 토큰 요청
  try {
    const response = await fetch('/api/security/csrf', {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('CSRF 토큰 발급 실패');
    }

    const data = await response.json();
    csrfTokenCache = data.csrfToken;
    csrfTokenExpiry = now + CSRF_CACHE_DURATION;

    return csrfTokenCache!;
  } catch (error) {
    console.error('[API Client] CSRF 토큰 발급 오류:', error);
    throw new ApiError('CSRF_TOKEN_ERROR', 'CSRF 토큰을 가져올 수 없습니다. 페이지를 새로고침해주세요.');
  }
}

/**
 * CSRF 토큰 캐시 초기화
 */
export function clearCsrfTokenCache(): void {
  csrfTokenCache = null;
  csrfTokenExpiry = 0;
}

/**
 * 표준화된 API 에러
 */
export class ApiError extends Error {
  code: string;
  status?: number;
  details?: Record<string, unknown>;

  constructor(code: string, message: string, status?: number, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/**
 * HTTP 상태 코드별 한국어 에러 메시지
 */
const HTTP_ERROR_MESSAGES: Record<number, string> = {
  400: '잘못된 요청입니다. 입력 값을 확인해주세요.',
  401: '인증이 필요합니다. 다시 로그인해주세요.',
  403: '접근 권한이 없습니다.',
  404: '요청한 리소스를 찾을 수 없습니다.',
  405: '허용되지 않는 요청 방식입니다.',
  408: '요청 시간이 초과되었습니다.',
  409: '리소스 충돌이 발생했습니다.',
  422: '입력 값이 올바르지 않습니다.',
  429: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
  500: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
  502: '서버 연결 오류가 발생했습니다.',
  503: '서비스를 일시적으로 사용할 수 없습니다.',
  504: '서버 응답 시간이 초과되었습니다.',
};

/**
 * API 요청 옵션
 */
export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  /** 요청 본문 (자동 JSON 직렬화) */
  body?: unknown;
  /** 타임아웃 (ms) - 기본값 30초 */
  timeout?: number;
  /** CSRF 토큰 포함 여부 (기본값: POST/PUT/DELETE/PATCH에서 true) */
  includeCsrf?: boolean;
  /** 재시도 횟수 (기본값: 0) */
  retries?: number;
  /** 재시도 지연 시간 (ms) - 기본값 1000 */
  retryDelay?: number;
}

/**
 * API 응답 타입
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
  pagination?: {
    skip: number;
    take: number;
    total: number;
    hasMore: boolean;
  };
  meta?: Record<string, unknown>;
}

/**
 * 표준화된 API 요청 함수
 *
 * @example
 * // GET 요청
 * const sites = await apiRequest<Site[]>('/api/sites');
 *
 * @example
 * // POST 요청 (CSRF 자동 포함)
 * const newSite = await apiRequest<Site>('/api/sites', {
 *   method: 'POST',
 *   body: { name: '새 사이트', code: 'NEW' },
 * });
 */
export async function apiRequest<T = unknown>(
  url: string,
  options: ApiRequestOptions = {}
): Promise<ApiResponse<T>> {
  const {
    method = 'GET',
    body,
    timeout = 30000,
    includeCsrf,
    retries = 0,
    retryDelay = 1000,
    headers: customHeaders,
    ...restOptions
  } = options;

  // CSRF 토큰 필요 여부 결정
  const needsCsrf = includeCsrf ?? ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase());

  // 헤더 구성
  const headers = new Headers(customHeaders);

  if (!headers.has('Content-Type') && body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  // CSRF 토큰 추가
  if (needsCsrf) {
    try {
      const csrfToken = await getCsrfToken();
      headers.set('X-CSRF-Token', csrfToken);
    } catch (error) {
      throw error;
    }
  }

  // 요청 본문 직렬화
  const serializedBody = body !== undefined ? JSON.stringify(body) : undefined;

  // 타임아웃 처리
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // 재시도 로직
  let lastError: Error | null = null;
  let attempt = 0;
  let csrfRetried = false; // CSRF 오류 시 자동 1회 재시도 플래그

  while (attempt <= retries) {
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: serializedBody,
        credentials: 'include', // 쿠키 포함 (인증)
        signal: controller.signal,
        ...restOptions,
      });

      clearTimeout(timeoutId);

      // JSON 응답 파싱
      let responseData: ApiResponse<T>;
      const contentType = response.headers.get('Content-Type');

      if (contentType?.includes('application/json')) {
        responseData = await response.json();
      } else {
        const text = await response.text();
        responseData = { success: response.ok, data: text as unknown as T };
      }

      // 성공 응답
      if (response.ok) {
        return {
          ...responseData,
          success: true, // 명시적으로 success 설정
        };
      }

      // CSRF 토큰 오류 시 캐시 초기화 후 자동 1회 재시도 (retries 설정과 무관)
      if (response.status === 403 && responseData.code?.includes('CSRF') && !csrfRetried) {
        csrfRetried = true;
        clearCsrfTokenCache();
        // 새 CSRF 토큰 발급 후 헤더 갱신
        try {
          const newToken = await getCsrfToken();
          headers.set('X-CSRF-Token', newToken);
        } catch { /* ignore — next attempt will also fail and throw */ }
        continue; // attempt 증가 없이 재시도
      }

      // 402 Payment Required — fetchWithCsrf와 동일하게 ems:upgrade 이벤트 발행
      if (response.status === 402 && typeof window !== 'undefined') {
        try {
          window.dispatchEvent(new CustomEvent('ems:upgrade', {
            detail: {
              message: responseData.error || responseData.message || '구독 플랜이 필요합니다.',
              upgradeUrl: (responseData as unknown as Record<string, unknown>).upgradeUrl ?? '/settings/subscription',
            },
          }));
        } catch { /* noop */ }
      }

      // 에러 응답
      const errorMessage =
        responseData.message ||
        responseData.error ||
        HTTP_ERROR_MESSAGES[response.status] ||
        '알 수 없는 오류가 발생했습니다.';

      throw new ApiError(
        responseData.code || `HTTP_${response.status}`,
        errorMessage,
        response.status,
        responseData.details
      );
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ApiError('TIMEOUT', '요청 시간이 초과되었습니다.', 408);
      }

      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < retries) {
        attempt++;
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        continue;
      }

      throw new ApiError(
        'NETWORK_ERROR',
        '네트워크 연결을 확인해주세요.',
        undefined,
        { originalError: lastError.message }
      );
    }
  }

  throw lastError || new ApiError('UNKNOWN_ERROR', '알 수 없는 오류가 발생했습니다.');
}

/**
 * GET 요청 헬퍼
 */
export async function apiGet<T = unknown>(
  url: string,
  options?: Omit<ApiRequestOptions, 'method' | 'body'>
): Promise<ApiResponse<T>> {
  return apiRequest<T>(url, { ...options, method: 'GET' });
}

/**
 * POST 요청 헬퍼
 */
export async function apiPost<T = unknown>(
  url: string,
  body?: unknown,
  options?: Omit<ApiRequestOptions, 'method' | 'body'>
): Promise<ApiResponse<T>> {
  return apiRequest<T>(url, { ...options, method: 'POST', body });
}

/**
 * PUT 요청 헬퍼
 */
export async function apiPut<T = unknown>(
  url: string,
  body?: unknown,
  options?: Omit<ApiRequestOptions, 'method' | 'body'>
): Promise<ApiResponse<T>> {
  return apiRequest<T>(url, { ...options, method: 'PUT', body });
}

/**
 * PATCH 요청 헬퍼
 */
export async function apiPatch<T = unknown>(
  url: string,
  body?: unknown,
  options?: Omit<ApiRequestOptions, 'method' | 'body'>
): Promise<ApiResponse<T>> {
  return apiRequest<T>(url, { ...options, method: 'PATCH', body });
}

/**
 * DELETE 요청 헬퍼
 */
export async function apiDelete<T = unknown>(
  url: string,
  options?: Omit<ApiRequestOptions, 'method'>
): Promise<ApiResponse<T>> {
  return apiRequest<T>(url, { ...options, method: 'DELETE' });
}
