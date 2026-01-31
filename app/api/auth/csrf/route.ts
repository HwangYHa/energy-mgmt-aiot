import { NextRequest, NextResponse } from 'next/server';
import { generateCsrfToken } from '@/lib/middleware/csrf';
import { logHttpRequest, logHttpResponse } from '@/lib/logger';
import crypto from 'crypto';

/**
 * CSRF 토큰 발급 엔드포인트
 * GET /api/auth/csrf
 *
 * 응답:
 * {
 *   csrfToken: "...",
 *   cookie: "Set via Set-Cookie header"
 * }
 *
 * 사용법:
 * 1. 페이지 로드 시 이 엔드포인트 호출
 * 2. 응답에서 csrfToken 추출
 * 3. Form 데이터나 Header에 토큰 포함:
 *    - Hidden input: <input type="hidden" name="csrf-token" value="..." />
 *    - Header: X-CSRF-Token: ...
 * 4. 서버에서 자동으로 검증됨 (middleware)
 */

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    // 요청 로깅
    logHttpRequest({
      requestId,
      method: 'GET',
      path: '/api/auth/csrf',
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    });

    // CSRF 토큰 생성
    const csrfToken = generateCsrfToken();

    // 응답 생성
    const response = NextResponse.json(
      {
        csrfToken,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );

    // CSRF 토큰을 쿠키로도 설정
    // (middleware에서 검증할 때 사용)
    response.cookies.set('csrf-token', csrfToken, {
      httpOnly: false, // JavaScript에서 접근 가능하도록 (요청 시 X-CSRF-Token 헤더에 포함)
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24시간
      path: '/',
    });

    // 응답 로깅
    logHttpResponse({
      requestId,
      method: 'GET',
      path: '/api/auth/csrf',
      statusCode: 200,
      duration: 5,
    });

    return response;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    logHttpResponse({
      requestId,
      method: 'GET',
      path: '/api/auth/csrf',
      statusCode: 500,
      duration: 10,
    });

    return NextResponse.json(
      { error: 'Failed to generate CSRF token', details: errorMsg },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS 요청 처리 (CORS preflight)
 */
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
