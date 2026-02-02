import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { securityHeadersMiddleware } from '@/lib/middleware/security-headers';
import { verifyCsrfToken } from '@/lib/middleware/csrf';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // ✅ 인증 제외 경로
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname === '/'
  ) {
    return securityHeadersMiddleware(NextResponse.next());
  }

  // ✅ NextAuth 토큰 검증 (Google OAuth 등)
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET!,
  });

  // ✅ Naver OAuth 토큰 확인 (별도 JWT)
  const naverToken = request.cookies.get('auth-token')?.value;

  // 둘 중 하나라도 있으면 인증된 것으로 간주
  if (!token && !naverToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 🔒 CSRF 토큰 검증 (POST, PUT, DELETE, PATCH 요청만)
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    // CSRF 토큰 발급 엔드포인트는 제외
    if (pathname === '/api/auth/csrf') {
      return securityHeadersMiddleware(NextResponse.next());
    }

    const csrfTokenFromHeader = request.headers.get('x-csrf-token');
    const csrfTokenFromCookie = request.cookies.get('csrf-token')?.value;

    // 토큰이 없거나 검증 실패 시
    if (!csrfTokenFromHeader || !csrfTokenFromCookie) {
      console.warn('[Security] CSRF token missing:', {
        pathname,
        method,
        hasHeader: !!csrfTokenFromHeader,
        hasCookie: !!csrfTokenFromCookie,
      });

      return NextResponse.json(
        {
          error: 'CSRF token validation failed',
          code: 'CSRF_TOKEN_MISSING',
          message: 'CSRF 토큰이 누락되었습니다. 페이지를 새로고침해주세요.',
        },
        { status: 403 }
      );
    }

    // Timing-safe 비교로 CSRF 토큰 검증
    const isValid = verifyCsrfToken(csrfTokenFromHeader, csrfTokenFromCookie);

    if (!isValid) {
      console.error('[Security] CSRF token validation failed:', {
        pathname,
        method,
        userId: token?.id || 'unknown',
        ip: request.headers.get('x-forwarded-for') || request.ip,
      });

      return NextResponse.json(
        {
          error: 'CSRF token validation failed',
          code: 'CSRF_TOKEN_INVALID',
          message: 'CSRF 토큰 검증에 실패했습니다. 페이지를 새로고침해주세요.',
        },
        { status: 403 }
      );
    }
  }

  let response = NextResponse.next();
  return securityHeadersMiddleware(response);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
