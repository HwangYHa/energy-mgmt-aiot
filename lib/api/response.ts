/**
 * lib/api/response.ts - 표준화된 API 응답 헬퍼
 *
 * 모든 API 라우트에서 일관된 응답 형식 사용
 */

import { NextResponse } from 'next/server';
import { ErrorCode, createErrorResponse } from '@/lib/constants/error-messages';

/**
 * 성공 응답 생성
 */
export function successResponse<T>(
  data: T,
  options?: {
    status?: number;
    meta?: Record<string, unknown>;
    pagination?: {
      skip: number;
      take: number;
      total: number;
      hasMore: boolean;
    };
  }
) {
  const { status = 200, meta, pagination } = options || {};

  return NextResponse.json(
    {
      success: true,
      data,
      ...(pagination && { pagination }),
      ...(meta && { meta }),
    },
    { status }
  );
}

/**
 * 에러 응답 생성
 */
export function errorResponse(
  code: ErrorCode,
  options?: {
    status?: number;
    details?: Record<string, unknown>;
  }
) {
  const { status, details } = options || {};

  // 에러 코드별 기본 HTTP 상태 코드
  const defaultStatus = getDefaultStatusCode(code);

  return NextResponse.json(createErrorResponse(code, details), {
    status: status || defaultStatus,
  });
}

/**
 * 에러 코드별 기본 HTTP 상태 코드 매핑
 */
function getDefaultStatusCode(code: ErrorCode): number {
  const statusMap: Partial<Record<ErrorCode, number>> = {
    // 인증 관련 (401)
    AUTH_REQUIRED: 401,
    AUTH_INVALID_TOKEN: 401,
    AUTH_EXPIRED_TOKEN: 401,
    AUTH_INVALID_CREDENTIALS: 401,
    AUTH_USER_INACTIVE: 401,
    AUTH_EMAIL_NOT_VERIFIED: 401,

    // 권한 관련 (403)
    PERMISSION_DENIED: 403,
    PERMISSION_INSUFFICIENT_ROLE: 403,
    PERMISSION_TENANT_MISMATCH: 403,
    CSRF_TOKEN_MISSING: 403,
    CSRF_TOKEN_INVALID: 403,
    CSRF_TOKEN_EXPIRED: 403,

    // 리소스 관련 (404)
    RESOURCE_NOT_FOUND: 404,

    // 입력 검증 (400)
    VALIDATION_ERROR: 400,
    VALIDATION_REQUIRED_FIELD: 400,
    VALIDATION_INVALID_FORMAT: 400,
    VALIDATION_OUT_OF_RANGE: 400,

    // 충돌 (409)
    RESOURCE_ALREADY_EXISTS: 409,
    RESOURCE_CONFLICT: 409,

    // 요청 제한 (429)
    RATE_LIMIT_EXCEEDED: 429,

    // 서버 오류 (500)
    SERVER_ERROR: 500,
    DATABASE_ERROR: 500,
    EXTERNAL_SERVICE_ERROR: 502,
    UNKNOWN_ERROR: 500,
  };

  return statusMap[code] || 500;
}

/**
 * 인증 필요 응답 (401)
 */
export function unauthorizedResponse(details?: Record<string, unknown>) {
  return errorResponse('AUTH_REQUIRED', { details });
}

/**
 * 권한 없음 응답 (403)
 */
export function forbiddenResponse(details?: Record<string, unknown>) {
  return errorResponse('PERMISSION_DENIED', { details });
}

/**
 * 리소스 없음 응답 (404)
 */
export function notFoundResponse(resource?: string) {
  return errorResponse('RESOURCE_NOT_FOUND', {
    details: resource ? { resource } : undefined,
  });
}

/**
 * 입력 검증 오류 응답 (400)
 */
export function validationErrorResponse(details: Record<string, unknown>) {
  return errorResponse('VALIDATION_ERROR', { details });
}

/**
 * 서버 오류 응답 (500)
 */
export function serverErrorResponse(details?: Record<string, unknown>) {
  return errorResponse('SERVER_ERROR', { details });
}

/**
 * Zod 검증 오류를 표준 형식으로 변환
 */
export function formatZodErrors(zodError: { issues: Array<{ path: (string | number)[]; message: string }> }) {
  const errors: Record<string, string> = {};

  for (const issue of zodError.issues) {
    const path = issue.path.join('.');
    errors[path] = issue.message;
  }

  return errors;
}
