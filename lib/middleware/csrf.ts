/**
 * lib/middleware/csrf.ts - CSRF 토큰 검증
 *
 * ⚠️ Edge Runtime 호환성:
 * Node.js crypto 대신 Web Crypto API 사용
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * CSRF 토큰 생성 (서버 전용)
 * Edge Runtime 호환 - Web Crypto API 사용
 */
export function generateCsrfToken(): string {
  // Web Crypto API로 32바이트 랜덤 생성
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);

  // Hex 인코딩
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * CSRF 토큰 검증
 *
 * Edge Runtime에서는 crypto.timingSafeEqual을 사용할 수 없으므로
 * 대신 constant-time 비교 알고리즘 구현
 *
 * ⚠️ 보안 참고:
 * - 길이가 다르면 즉시 false 반환
 * - 길이가 같으면 모든 문자를 순회하여 비교
 * - XOR 연산으로 timing attack 방지
 */
export function verifyCsrfToken(token: string, storedToken: string): boolean {
  try {
    // 1. 길이 검증 (같지 않으면 바로 false)
    if (token.length !== storedToken.length) {
      return false;
    }

    // 2. Constant-time 비교 (timing attack 방지)
    let result = 0;
    for (let i = 0; i < token.length; i++) {
      result |= token.charCodeAt(i) ^ storedToken.charCodeAt(i);
    }

    return result === 0;
  } catch (error) {
    console.error('[CSRF] Token verification error:', error);
    return false;
  }
}

/**
 * CSRF 검증이 제외되는 경로 목록
 */
const CSRF_EXEMPT_PATHS = [
  '/api/auth/csrf', // CSRF 토큰 발급 엔드포인트
  '/api/auth/[...nextauth]', // NextAuth 엔드포인트
  '/api/auth/login', // NextAuth를 사용하므로 제외
  '/api/auth/callback', // OAuth 콜백
];

/**
 * CSRF 미들웨어
 * POST, PUT, DELETE 요청만 검증
 */
export function csrfMiddleware(request: NextRequest): NextResponse | null {
  // 읽기 요청은 CSRF 검증 불필요
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return null;
  }

  // ✅ 제외 경로 확인
  const pathname = request.nextUrl.pathname;
  const isExempt = CSRF_EXEMPT_PATHS.some((path) => {
    if (path.includes('[...')) {
      // 동적 경로 처리 (예: /api/auth/[...nextauth])
      const basePath = path.replace('[...nextauth]', '');
      return pathname.startsWith(basePath);
    }
    return pathname === path;
  });

  if (isExempt) {
    return null;
  }

  // POST, PUT, DELETE 요청에서 CSRF 토큰 검증
  const csrfToken = request.headers.get('x-csrf-token');
  const sessionCsrfToken = request.cookies.get('csrf-token')?.value;

  if (!csrfToken || !sessionCsrfToken) {
    console.warn(
      `CSRF_MISSING: method=${request.method}, path=${pathname}`
    );
    return NextResponse.json(
      { error: 'CSRF 토큰이 없거나 유효하지 않습니다' },
      { status: 403 }
    );
  }

  if (!verifyCsrfToken(csrfToken, sessionCsrfToken)) {
    console.warn(
      `CSRF_INVALID: method=${request.method}, path=${pathname}`
    );
    return NextResponse.json(
      { error: 'CSRF 토큰 검증에 실패했습니다' },
      { status: 403 }
    );
  }

  return null;
}
