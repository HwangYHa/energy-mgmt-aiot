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
    '/api/security/csrf', // CSRF 토큰 발급 (회원가입 등 비로그인 상태에서도 필요)
    '/api/csp-report',    // CSP 위반 리포트 (브라우저 자동 전송, 인증 불필요)
    '/_next',
    '/api/docs',
    '/pricing',
    '/features',
    '/about',
    '/legal',        // 개인정보처리방침, 이용약관, 보안정책
    '/faq',          // FAQ
    '/solutions',    // 솔루션 (제조업, 빌딩, 데이터센터, 산업단지)
    '/docs',         // 문서
    '/community',    // 커뮤니티
    '/support',      // 고객센터
    '/demo',         // 데모
    '/trial',        // 무료 체험
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
          error: 'CSRF 토큰 유효성 검사에 실패했습니다.',
          code: 'CSRF_TOKEN_MISSING',
          message: 'CSRF 토큰이 누락되었습니다. 페이지를 새로고침해주세요.',
        },
        { status: 403 }
      );
    }

    // Timing-safe 비교로 CSRF 토큰 검증
    const isValid = verifyCsrfToken(csrfTokenFromHeader, csrfTokenFromCookie);

    if (!isValid) {
      console.error('[보안] CSRF 토큰 유효성 검사 실패:', {
        pathname,
        method,
        userId: token?.id || 'unknown',
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      });

      return NextResponse.json(
        {
          error: 'CSRF 토큰 유효성 검사에 실패했습니다.',
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
