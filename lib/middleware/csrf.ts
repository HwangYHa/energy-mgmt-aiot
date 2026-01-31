/**
 * lib/middleware/csrf.ts - CSRF 토큰 검증
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * CSRF 토큰 생성
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * CSRF 토큰 검증 (timing-safe)
 */
export function verifyCsrfToken(token: string, storedToken: string): boolean {
  try {
    return crypto.timingSafeEqual(
      Buffer.from(token),
      Buffer.from(storedToken)
    );
  } catch (error) {
    return false;
  }
}

/**
 * CSRF 미들웨어
 * POST, PUT, DELETE 요청만 검증
 */
export function csrfMiddleware(request: NextRequest): NextResponse | null {
  // 읽기 요청은 CSRF 검증 불필요
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return null;
  }

  // POST, PUT, DELETE 요청에서 CSRF 토큰 검증
  const csrfToken = request.headers.get('x-csrf-token');
  const sessionCsrfToken = request.cookies.get('csrf-token')?.value;

  if (!csrfToken || !sessionCsrfToken) {
    console.warn(
      `CSRF_MISSING: method=${request.method}, path=${request.nextUrl.pathname}`
    );
    return NextResponse.json(
      { error: 'CSRF token missing or invalid' },
      { status: 403 }
    );
  }

  if (!verifyCsrfToken(csrfToken, sessionCsrfToken)) {
    console.warn(
      `CSRF_INVALID: method=${request.method}, path=${request.nextUrl.pathname}`
    );
    return NextResponse.json(
      { error: 'CSRF token validation failed' },
      { status: 403 }
    );
  }

  return null;
}
