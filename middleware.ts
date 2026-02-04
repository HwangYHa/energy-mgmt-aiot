import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { securityHeadersMiddleware } from '@/lib/middleware/security-headers';
import { verifyCsrfToken } from '@/lib/middleware/csrf';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // ✅ 인증 제외 경로 (public routes)
  const publicRoutes = [
    '/login',
    '/register',
    '/forgot-password',
    '/api/auth',
    '/_next',
    '/api/docs', // API 문서는 public
    '/pricing', // 가격 페이지
    '/features', // 기능 소개
    '/about', // 회사 소개
  ];

  // 정확히 매칭되는 공개 경로
  const exactPublicRoutes = [
    '/', // 랜딩 페이지
  ];

  const isPublicRoute =
    publicRoutes.some(route => pathname.startsWith(route)) ||
    exactPublicRoutes.includes(pathname);

  if (isPublicRoute) {
    return securityHeadersMiddleware(NextResponse.next());
  }

  // ✅ NextAuth 토큰 검증 (Google OAuth 등)
  // CRITICAL: 개발환경에서는 쿠키 이름이 다름 (__Secure- 접두사 없음)
  const cookieName =
    process.env.NODE_ENV === 'production'
      ? '__Secure-next-auth.session-token'
      : 'next-auth.session-token';

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET!,
    cookieName,
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
    if (pathname === '/api/security/csrf') {
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
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
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
