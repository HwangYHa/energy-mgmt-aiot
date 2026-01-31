/**
 * lib/middleware/security-headers.ts - 보안 HTTP 헤더
 */

import { NextRequest, NextResponse } from 'next/server';

export function securityHeadersMiddleware(response: NextResponse) {
  // ✅ 클릭재킹 방지 (X-Frame-Options)
  response.headers.set('X-Frame-Options', 'DENY');

  // ✅ MIME 타입 스니핑 방지
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // ✅ XSS 필터 활성화
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // ✅ Referrer Policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // ✅ Content Security Policy
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js 필요
      "style-src 'self' 'unsafe-inline'", // Tailwind 필요
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  );

  // ✅ HSTS (HTTPS 강제)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // ✅ Permissions Policy (Feature-Policy)
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), payment=()'
  );

  return response;
}

/**
 * middleware.ts에서 사용:
 * export function middleware(request: NextRequest) {
 *   let response = NextResponse.next();
 *   response = securityHeadersMiddleware(response);
 *   return response;
 * }
 */
