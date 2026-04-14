/**
 * lib/middleware/security-headers.ts - 강화된 보안 HTTP 헤더
 *
 * OWASP 보안 헤더 권장 사항 적용:
 * - XSS 방어 (CSP)
 * - Clickjacking 방어 (X-Frame-Options, CSP frame-ancestors)
 * - MIME 스니핑 방지
 * - HTTPS 강제 (HSTS)
 * - 권한 정책 (Permissions Policy)
 *
 * ⚠️ Edge Runtime 호환성:
 * Node.js crypto 대신 Web Crypto API 사용
 */

import { NextResponse } from 'next/server';

/**
 * CSP nonce 생성 (인라인 스크립트/스타일 허용용)
 * Edge Runtime 호환 - Web Crypto API 사용
 */
export function generateNonce(): string {
  // Edge Runtime에서 사용 가능한 Web Crypto API
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);

  // Base64 인코딩
  return btoa(String.fromCharCode(...array));
}

/**
 * 강화된 보안 헤더 미들웨어
 */
export function securityHeadersMiddleware(
  response: NextResponse,
  options?: {
    nonce?: string;
    allowedDomains?: string[]; // for connect-src
    scriptSrcDomains?: string[]; // allowed external script hosts
    frameSrcDomains?: string[]; // allowed iframe / child-src hosts
  }
): NextResponse {
  const isDev = process.env.NODE_ENV !== 'production';
  // HTTPS 보안 헤더는 실제로 HTTPS로 서빙될 때만 활성화
  // (도메인 + SSL 발급 전 HTTP 운영 시 브라우저가 자원을 HTTPS로 업그레이드하여 로딩 실패)
  const isHttps = process.env.NEXTAUTH_URL?.startsWith('https://') ?? false;
  const nonce = options?.nonce || generateNonce();
  const allowedDomains = options?.allowedDomains || [];

  // ==========================================
  // 1. 클릭재킹 방어 (Clickjacking Protection)
  // ==========================================
  // X-Frame-Options: iframe 삽입 완전 차단
  response.headers.set('X-Frame-Options', 'DENY');

  // ==========================================
  // 2. MIME 스니핑 방지 (MIME Sniffing Prevention)
  // ==========================================
  // 브라우저가 Content-Type을 무시하고 파일 내용으로 타입 추측하는 것 방지
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // ==========================================
  // 3. XSS 필터 (구형 브라우저용 - Legacy)
  // ==========================================
  // 최신 브라우저는 CSP 사용, 구형 브라우저용 백업
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // ==========================================
  // 4. Referrer 정책 (Privacy)
  // ==========================================
  // 외부 사이트로 이동 시 Referer 헤더에 origin만 포함
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // ==========================================
  // 5. Content Security Policy (CSP) - 핵심 XSS 방어
  // ==========================================
  // prepare script-src additional hosts
  const extraScriptHosts = options?.scriptSrcDomains?.join(' ') || '';
  const extraFrameHosts = options?.frameSrcDomains?.join(' ') || '';

  // script-src: HTTPS + 프로덕션에서만 nonce 기반 (strict)
  //   - HTTP 운영 중: unsafe-inline 사용 (nonce는 HTTPS 컨텍스트 필요)
  //   - HTTPS + 프로덕션: nonce-based (Next.js가 hydration 스크립트에 nonce 자동 주입)
  //   - 개발: unsafe-eval 추가 (HMR)
  const scriptSrc = isDev
    ? `script-src 'self' ${extraScriptHosts} 'unsafe-inline' 'unsafe-eval'`
    : isHttps
      ? `script-src 'self' ${extraScriptHosts} 'nonce-${nonce}'`
      : `script-src 'self' ${extraScriptHosts} 'unsafe-inline'`;

  // connect-src: WebSocket 프로토콜 포함 (HTTP → ws:, HTTPS → wss:)
  const wsScheme = isHttps ? 'wss:' : 'ws:';
  const connectSrcExtra = allowedDomains.length > 0 ? allowedDomains.join(' ') : '';
  const connectSrc = isHttps
    ? `connect-src 'self' https: ${wsScheme} ${connectSrcExtra}`.trimEnd()
    : `connect-src 'self' http: ${wsScheme} ${connectSrcExtra}`.trimEnd();

  const cspDirectives = [
    "default-src 'self'",
    scriptSrc,

    // 스타일: unsafe-inline 허용 (Tailwind CSS 인라인 + 서드파티 위젯)
    "style-src 'self' 'unsafe-inline'",

    // 이미지: 동일 출처 + data URI + 외부 이미지 (프로필 사진 등)
    "img-src 'self' data: https: http:",

    // 폰트: 동일 출처 + data URI
    "font-src 'self' data:",

    connectSrc,

    // iframe 삽입 금지
    "frame-ancestors 'none'",

    // <base> 태그 제한
    "base-uri 'self'",

    // 폼 제출 제한
    "form-action 'self'",

    // Object/Embed 금지
    "object-src 'none'",

    // Worker
    "worker-src 'self' blob:",

    // Manifest
    "manifest-src 'self'",

    // Media
    "media-src 'self'",

    // 결제창 등 외부 프레임
    extraFrameHosts ? `frame-src 'self' ${extraFrameHosts}` : "frame-src 'self'",

    // HTTPS 전환 (HTTPS 서빙 시에만)
    !isDev && isHttps ? 'upgrade-insecure-requests' : '',
  ]
    .filter(Boolean)
    .join('; ');

  response.headers.set('Content-Security-Policy', cspDirectives);

  // CSP 위반 리포트 (프로덕션만)
  if (!isDev) {
    // CSP 위반 시 /api/csp-report로 리포트 전송
    response.headers.set(
      'Content-Security-Policy-Report-Only',
      cspDirectives + '; report-uri /api/csp-report'
    );
  }

  // ==========================================
  // 6. HSTS (HTTP Strict Transport Security)
  // ==========================================
  // HTTPS 강제 (프로덕션만)
  // - max-age: 1년 (31536000초)
  // - includeSubDomains: 모든 서브도메인에도 적용
  // - preload: 브라우저 HSTS preload 리스트 등록 가능
  if (!isDev && isHttps) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // ==========================================
  // 7. Permissions Policy (Feature Policy)
  // ==========================================
  // 브라우저 기능 접근 제한
  const permissionsPolicy = [
    'camera=()',           // 카메라 사용 금지
    'microphone=()',       // 마이크 사용 금지
    'geolocation=()',      // 위치 정보 금지
    'payment=()',          // 결제 API 금지
    'usb=()',              // USB 접근 금지
    'magnetometer=()',     // 자기계 센서 금지
    'accelerometer=()',    // 가속도계 금지
    'gyroscope=()',        // 자이로스코프 금지
    'interest-cohort=()',  // FLoC (Privacy 보호)
  ].join(', ');

  response.headers.set('Permissions-Policy', permissionsPolicy);

  // ==========================================
  // 8. Cross-Origin 정책
  // ==========================================
  // Cross-Origin-Embedder-Policy: unsafe-none (OAuth, 외부 이미지/CDN 허용)
  response.headers.set('Cross-Origin-Embedder-Policy', 'unsafe-none');

  // Cross-Origin-Opener-Policy: HTTPS에서만 활성화
  // (HTTP에서는 브라우저가 신뢰할 수 없는 origin으로 판단해 경고 발생)
  if (isHttps) {
    response.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  }

  // Cross-Origin-Resource-Policy: cross-origin (외부 리소스 로드 허용)
  response.headers.set('Cross-Origin-Resource-Policy', 'cross-origin');

  // ==========================================
  // 9. 캐시 제어 (민감한 데이터 방지)
  // ==========================================
  // API 응답은 캐시하지 않음
  if (response.headers.get('content-type')?.includes('application/json')) {
    response.headers.set(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate'
    );
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
  }

  // ==========================================
  // 10. 서버 정보 숨김 (정보 노출 방지)
  // ==========================================
  // Server 헤더 제거 (미들웨어에서는 불가능, 서버 설정 필요)
  // X-Powered-By 헤더 제거 (Next.js 자동 처리)

  // nonce를 응답 헤더에 추가 (프론트엔드에서 사용 가능)
  if (!isDev) {
    response.headers.set('X-CSP-Nonce', nonce);
  }

  return response;
}

/**
 * API 라우트용 간소화된 보안 헤더
 */
export function apiSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // API 응답 캐시 방지
  response.headers.set(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate'
  );
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');

  // CORS는 별도 처리 (lib/middleware/cors.ts)

  return response;
}

/**
 * CSP 위반 리포트 핸들러 (API 라우트에서 사용)
 *
 * @example
 * // app/api/csp-report/route.ts
 * export async function POST(request: Request) {
 *   const report = await request.json();
 *   console.error('CSP Violation:', report);
 *   // Sentry, Datadog 등으로 전송
 *   return new Response('OK', { status: 200 });
 * }
 */
export interface CSPViolationReport {
  'csp-report': {
    'document-uri': string;
    'violated-directive': string;
    'effective-directive': string;
    'original-policy': string;
    'blocked-uri': string;
    'source-file'?: string;
    'line-number'?: number;
    'column-number'?: number;
  };
}
