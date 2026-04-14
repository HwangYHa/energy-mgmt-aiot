import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { jwtVerify } from 'jose';
import { securityHeadersMiddleware, generateNonce } from '@/lib/middleware/security-headers';
import { verifyCsrfToken } from '@/lib/middleware/csrf';
import {
  checkRateLimit,
  getAuthRateLimit,
} from '@/lib/middleware/rate-limit';

// HTTPS 환경에서는 nonce를 request 헤더로 전달 (app/layout.tsx에서 사용)
function makeResponseWithNonce(request: NextRequest, nonce?: string) {
  const isHttps = process.env.NEXTAUTH_URL?.startsWith('https://') ?? false;
  if (!isHttps || !nonce) return NextResponse.next();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

// ── 보안 이벤트 (Edge 런타임 미지원 → 동적 import 패턴) ──────
// isIpBlocked: 메모리 Map 기반이라 Edge 런타임에서도 동작하나,
// Node.js 런타임에서만 AuditLog DB 기록 실행됨 (미들웨어 = Edge)
// → 차단 여부만 빠르게 확인, 실제 DB 기록은 API Route에서 처리
const BLOCKED_IPS = new Map<string, number>(); // ip → expiresAt ms
function isMemoryBlocked(ip: string): boolean {
  const exp = BLOCKED_IPS.get(ip);
  if (!exp) return false;
  if (exp < Date.now()) { BLOCKED_IPS.delete(ip); return false; }
  return true;
}

// ──────────────────────────────────────────────────────────────
// 공개 경로 (인증 불필요)
// ──────────────────────────────────────────────────────────────

const PUBLIC_PREFIXES = [
  '/login',
  '/register',
  '/forgot-password',
  '/api/auth',
  '/api/security/csrf',
  '/api/csp-report',
  '/api/support',       // 고객 문의 접수 (비로그인 가능)
  '/_next',
  '/api/docs',
  '/pricing',
  '/features',
  '/about',
  '/legal',
  '/faq',
  '/solutions',
  '/docs',
  '/community',
  '/support',
  '/demo',
  '/trial',
  '/sw.js',           // service worker should be public
  '/manifest.json',   // manifest must not require auth
];

const EXACT_PUBLIC = ['/'];

// Rate Limit이 강화되는 인증 관련 경로
const AUTH_PATHS = [
  '/api/auth/credentials/login',
  '/api/auth/oauth',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
];

// ──────────────────────────────────────────────────────────────
// IP 추출 헬퍼
// ──────────────────────────────────────────────────────────────

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('cf-connecting-ip') ||       // Cloudflare
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}

// ──────────────────────────────────────────────────────────────
// Rate Limit 응답 헤더 추가
// ──────────────────────────────────────────────────────────────

function withRateLimitHeaders(
  response: NextResponse,
  limit: number,
  remaining: number,
  resetAt: Date
): NextResponse {
  response.headers.set('X-RateLimit-Limit', String(limit));
  response.headers.set('X-RateLimit-Remaining', String(Math.max(0, remaining)));
  response.headers.set('X-RateLimit-Reset', resetAt.toISOString());
  return response;
}

// ──────────────────────────────────────────────────────────────
// 미들웨어 메인
// ──────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;
  const ip = getClientIp(request);

  // ── 0. IP 차단 체크 (가장 먼저 처리) ─────────────────────
  if (isMemoryBlocked(ip)) {
    return NextResponse.json(
      { success: false, error: '접근이 차단되었습니다. 보안팀에 문의하세요.', code: 'IP_BLOCKED' },
      { status: 403 }
    );
  }

  // ── 1. 공개 경로 처리 ─────────────────────────────────────
  const isPublic =
    PUBLIC_PREFIXES.some(p => pathname.startsWith(p)) ||
    EXACT_PUBLIC.includes(pathname);

  if (isPublic) {
    // 인증 경로는 강화 Rate Limit 적용 (로그인 브루트포스 방지)
    if (AUTH_PATHS.some(p => pathname.startsWith(p)) && method === 'POST') {
      const authLimit = getAuthRateLimit(ip);
      const result = await checkRateLimit(authLimit);

      if (!result.allowed) {
        // 반복 초과 시 Edge 메모리 IP 차단 (30분)
        const prevCount = Number(request.headers.get('x-brute-count') ?? 0);
        if (prevCount >= 3) {
          BLOCKED_IPS.set(ip, Date.now() + 30 * 60 * 1000);
        }

        return NextResponse.json(
          {
            success: false,
            error: '요청 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.',
            retryAfter: result.retryAfter,
          },
          {
            status: 429,
            headers: {
              'Retry-After': String(result.retryAfter ?? 60),
              'X-RateLimit-Limit': String(authLimit.limit),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': result.resetAt.toISOString(),
            },
          }
        );
      }
    }

    const nonce = generateNonce();
    return securityHeadersMiddleware(makeResponseWithNonce(request, nonce), {
      nonce,
      scriptSrcDomains: ['https://js.tosspayments.com', 'https://js.stripe.com'],
      frameSrcDomains: ['https://payment-gateway-sandbox.tosspayments.com', 'https://js.stripe.com'],
    });
  }

  // ── 2. 인증 검증 ──────────────────────────────────────────
  // session.ts cookies 설정과 반드시 동기화
  // HTTPS일 때만 __Secure- prefix 사용
  const isHttpsEnv = process.env.NEXTAUTH_URL?.startsWith('https://') ?? false;
  const cookieName = isHttpsEnv
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token';

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET!,
    cookieName,
  });

  // Naver OAuth JWT 검증 및 페이로드 추출
  const naverToken = request.cookies.get('auth-token')?.value;
  let naverTokenValid = false;
  let naverPayload: { tenantId?: string; apiRateLimit?: number } = {};
  if (naverToken) {
    try {
      const jwtSecret = new TextEncoder().encode(process.env.JWT_SECRET!);
      const { payload } = await jwtVerify(naverToken, jwtSecret);
      naverTokenValid = true;
      naverPayload = payload as typeof naverPayload;
    } catch {
      naverTokenValid = false;
    }
  }

  if (!token && !naverTokenValid) {
    // request.url이 내부 바인딩 주소(0.0.0.0:3000)로 오는 경우를 방어
    // NEXTAUTH_URL을 기준으로 callbackUrl 구성
    const appBase = (process.env.NEXTAUTH_URL ?? '').replace(/\/$/, '');
    const callbackPath = request.nextUrl.pathname + (request.nextUrl.search || '');
    const loginBase = appBase || request.url;
    const loginUrl = new URL('/login', loginBase);
    loginUrl.searchParams.set(
      'callbackUrl',
      appBase ? `${appBase}${callbackPath}` : request.url
    );
    return NextResponse.redirect(loginUrl);
  }

  // ── 3. API Rate Limiting (인증된 사용자) ─────────────────
  if (pathname.startsWith('/api/')) {
    // NextAuth 토큰 우선, 없으면 Naver JWT에서 tenantId 추출
    const tenantId =
      ((token as Record<string, unknown>)?.tenantId as string | undefined) ??
      naverPayload.tenantId;

    // 테넌트 키 우선, 없으면 IP 키 사용
    const rateLimitKey = tenantId
      ? `ratelimit:api:tenant:${tenantId}`
      : `ratelimit:api:ip:${ip}`;

    // 플랜별 실제 Rate Limit: JWT에 포함된 값 사용 (로그인 시점 기준)
    // NextAuth JWT → token.apiRateLimit, Naver JWT → naverPayload.apiRateLimit
    const planLimit =
      ((token as Record<string, unknown>)?.apiRateLimit as number | undefined) ??
      naverPayload.apiRateLimit;
    const limit = tenantId ? (planLimit ?? 1000) : 100;
    const result = await checkRateLimit({
      key: rateLimitKey,
      limit,
      windowMs: 60 * 60 * 1000, // 1시간
      message: '요청 한도를 초과했습니다.',
    });

    if (!result.allowed) {
      return NextResponse.json(
        {
          success: false,
          code: 'RATE_LIMIT_EXCEEDED',
          error: `API 요청 한도(${limit}회/시간)를 초과했습니다.`,
          retryAfter: result.retryAfter,
          upgradeUrl: '/settings/subscription',
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(result.retryAfter ?? 3600),
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': result.resetAt.toISOString(),
          },
        }
      );
    }

    // 남은 요청 수를 헤더로 전달
    const nonce = generateNonce();
    const response = securityHeadersMiddleware(makeResponseWithNonce(request, nonce), {
      nonce,
      scriptSrcDomains: ['https://js.tosspayments.com', 'https://js.stripe.com'],
      frameSrcDomains: ['https://payment-gateway-sandbox.tosspayments.com', 'https://js.stripe.com'],
    });
    withRateLimitHeaders(response, limit, result.remaining, result.resetAt);
    // CSRF 검증 (POST/PUT/DELETE/PATCH)
    // 웹훅은 외부 서버(Stripe, Toss)에서 오므로 CSRF 제외
    const isWebhookPath = pathname.startsWith('/api/webhook/');
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      if (pathname !== '/api/security/csrf' && !isWebhookPath) {
        const csrfHeader = request.headers.get('x-csrf-token');
        const csrfCookie = request.cookies.get('csrf-token')?.value;

        if (!csrfHeader || !csrfCookie) {
          return NextResponse.json(
            {
              error: 'CSRF 토큰이 누락되었습니다. 페이지를 새로고침해주세요.',
              code: 'CSRF_TOKEN_MISSING',
            },
            { status: 403 }
          );
        }

        if (!verifyCsrfToken(csrfHeader, csrfCookie)) {
          // 반복 CSRF 위반 IP → 10분 임시 차단
          BLOCKED_IPS.set(ip, Date.now() + 10 * 60 * 1000);
          return NextResponse.json(
            {
              error: 'CSRF 토큰 검증에 실패했습니다. 페이지를 새로고침해주세요.',
              code: 'CSRF_TOKEN_INVALID',
            },
            { status: 403 }
          );
        }
      }
    }

    return response;
  }

  // ── 4. 온보딩 리다이렉트 (신규 사용자 → /onboarding) ────────
  if (
    method === 'GET' &&
    !pathname.startsWith('/api/') &&
    !pathname.startsWith('/onboarding') &&
    !pathname.startsWith('/payment') &&
    !pathname.startsWith('/settings') &&
    !pathname.startsWith('/manual')
  ) {
    const onboardingCompleted =
      (token as Record<string, unknown>)?.onboardingCompleted as boolean | undefined;
    if (onboardingCompleted === false) {
      return NextResponse.redirect(new URL('/onboarding', request.url));
    }
  }

  // ── 5. 페이지 라우트 CSRF 처리 ──────────────────────────────
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    if (pathname !== '/api/security/csrf') {
      const csrfHeader = request.headers.get('x-csrf-token');
      const csrfCookie = request.cookies.get('csrf-token')?.value;

      if (!csrfHeader || !csrfCookie) {
        console.warn('[Security] CSRF token missing:', { pathname, method });
        return NextResponse.json(
          {
            error: 'CSRF 토큰 유효성 검사에 실패했습니다.',
            code: 'CSRF_TOKEN_MISSING',
            message: 'CSRF 토큰이 누락되었습니다. 페이지를 새로고침해주세요.',
          },
          { status: 403 }
        );
      }

      const isValid = verifyCsrfToken(csrfHeader, csrfCookie);
      if (!isValid) {
        console.error('[Security] CSRF 검증 실패:', {
          pathname,
          method,
          userId: (token as Record<string, unknown>)?.id ?? 'unknown',
          ip,
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
  }

  const nonce = generateNonce();
  return securityHeadersMiddleware(makeResponseWithNonce(request, nonce), {
    nonce,
    scriptSrcDomains: ['https://js.tosspayments.com'],
    frameSrcDomains: ['https://payment-gateway-sandbox.tosspayments.com'],
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
