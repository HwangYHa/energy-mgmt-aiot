import { NextResponse } from 'next/server';
import { generateCsrfToken } from '@/lib/middleware/csrf';

/**
 * CSRF 토큰 발급 엔드포인트
 * GET /api/security/csrf
 *
 * 응답: { csrfToken: string, timestamp: string }
 * 쿠키: csrf-token (httpOnly: false — 클라이언트에서 X-CSRF-Token 헤더로 포함)
 *
 * 사용법:
 * 1. 페이지 로드 시 이 엔드포인트를 호출해 토큰 발급
 * 2. POST/PUT/DELETE/PATCH 요청 시 X-CSRF-Token 헤더에 포함
 * 3. 미들웨어(csrf.ts)에서 헤더 ↔ 쿠키 값을 비교해 자동 검증
 *
 * 주의: 이 엔드포인트는 CSRF 검증 제외 경로(CSRF_EXEMPT_PATHS)에 포함되어 있어야 함
 */
export async function GET() {
  try {
    const csrfToken = generateCsrfToken();

    const response = NextResponse.json(
      { csrfToken, timestamp: new Date().toISOString() },
      { status: 200 }
    );

    // 클라이언트 JS가 읽어 X-CSRF-Token 헤더로 포함할 수 있도록 httpOnly: false
    // secure: NEXTAUTH_URL 기준 (NODE_ENV가 아닌 실제 프로토콜로 판단)
    // HTTP 서버에서 secure: true 쿠키는 브라우저가 전송하지 않으므로 HTTPS일 때만 활성화
    const isHttps = process.env.NEXTAUTH_URL?.startsWith('https://') ?? false;
    response.cookies.set('csrf-token', csrfToken, {
      httpOnly: false,
      secure: isHttps,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24시간
      path: '/',
    });

    return response;
  } catch (error) {
    const msg = error instanceof Error ? error.message : '알 수 없는 오류';
    console.error('[CSRF] 토큰 생성 오류:', msg);
    return NextResponse.json(
      { error: 'CSRF 토큰 생성에 실패했습니다.', details: msg },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS 요청 처리 (CORS preflight)
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
