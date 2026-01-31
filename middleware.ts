/**
 * middleware.ts - Next.js 미들웨어 (요청 전처리)
 * 
 * 실행 순서:
 * 1. 보안 헤더 추가
 * 2. CORS 검증
 * 3. CSRF 검증 (필요한 경우)
 */

import { NextRequest, NextResponse } from 'next/server';
import { securityHeadersMiddleware } from '@/lib/middleware/security-headers';
import { corsMiddleware } from '@/lib/middleware/cors';
import { csrfMiddleware } from '@/lib/middleware/csrf';

export function middleware(request: NextRequest) {
  // 1. CSRF 검증 (POST, PUT, DELETE)
  const csrfResponse = csrfMiddleware(request);
  if (csrfResponse) {
    return csrfResponse;
  }

  // 2. CORS 검증 (OPTIONS 및 크로스 오리진 요청)
  const corsResponse = corsMiddleware(request);
  if (corsResponse) {
    // Preflight 응답이거나 CORS 오류
    if (corsResponse.status === 403) {
      return corsResponse;
    }
    // CORS 헤더가 추가된 응답인 경우, 계속 진행
  }

  // 3. 다음 미들웨어/라우트로 진행
  let response = NextResponse.next();

  // 4. 보안 헤더 추가
  response = securityHeadersMiddleware(response);

  // 5. CORS 응답 헤더 병합
  if (corsResponse && corsResponse.status === 200) {
    corsResponse.headers.forEach((value, key) => {
      response.headers.set(key, value);
    });
  }

  return response;
}

// 미들웨어가 적용될 경로
export const config = {
  matcher: [
    /*
     * 다음 경로를 제외한 모든 요청에 미들웨어 적용:
     * - api/health (헬스 체크)
     * - _next/static (정적 파일)
     * - _next/image (이미지)
     * - favicon.ico (파비콘)
     */
    '/((?!api/health|_next/static|_next/image|favicon.ico).*)',
  ],
};
