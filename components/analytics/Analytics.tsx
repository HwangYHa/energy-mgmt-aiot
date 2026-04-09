/**
 * components/analytics/Analytics.tsx
 *
 * 통합 Analytics 컴포넌트
 * - Google Tag Manager (GTM)
 * - Google Analytics 4 (GA4) — GTM 경유 또는 직접 주입
 * - 네이버 애널리틱스
 * - Microsoft Clarity (선택)
 *
 * app/layout.tsx의 <head>에 추가:
 *   import { Analytics } from '@/components/analytics/Analytics';
 *   <Analytics />
 */

import Script from 'next/script';

const GTM_ID        = process.env.NEXT_PUBLIC_GTM_ID;            // 'GTM-XXXXXXX'
const GA4_ID        = process.env.NEXT_PUBLIC_GA4_ID;            // 'G-XXXXXXXXXX'
const NAVER_ID      = process.env.NEXT_PUBLIC_NAVER_ANALYTICS_ID; // 나눔고딕 스크립트 ID
const CLARITY_ID    = process.env.NEXT_PUBLIC_CLARITY_ID;        // 선택사항

/** 프로덕션에서만 Analytics 활성화 */
const isProduction = process.env.NODE_ENV === 'production';

export function Analytics() {
  if (!isProduction) return null;

  return (
    <>
      {/* ── Google Tag Manager ── */}
      {GTM_ID && (
        <>
          <Script
            id="gtm-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
(function(w,d,s,l,i){
  w[l]=w[l]||[];
  w[l].push({'gtm.start': new Date().getTime(), event:'gtm.js'});
  var f=d.getElementsByTagName(s)[0],
      j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
  j.async=true;
  j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
  f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');
              `.trim(),
            }}
          />
          {/* GTM NoScript (서버 렌더링 지원) */}
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
        </>
      )}

      {/* ── Google Analytics 4 (GTM 미사용 시 직접 주입) ── */}
      {GA4_ID && !GTM_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
            strategy="afterInteractive"
          />
          <Script
            id="ga4-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA4_ID}', {
  page_path: window.location.pathname,
  send_page_view: true
});
              `.trim(),
            }}
          />
        </>
      )}

      {/* ── 네이버 애널리틱스 ── */}
      {NAVER_ID && (
        <Script
          id="naver-analytics"
          strategy="afterInteractive"
          src={`https://wcs.naver.net/wcslog.js`}
          onLoad={() => {
            // 네이버 애널리틱스 초기화
            if (typeof window !== 'undefined' && (window as any).wcs) {
              (window as any).wcs_add = { wa: NAVER_ID };
              (window as any).wcs.inflow();
              (window as any).wcs_do?.((window as any).wcs_add);
            }
          }}
        />
      )}

      {/* ── Microsoft Clarity (UX 히트맵) ── */}
      {CLARITY_ID && (
        <Script
          id="clarity-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
(function(c,l,a,r,i,t,y){
  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "${CLARITY_ID}");
            `.trim(),
          }}
        />
      )}
    </>
  );
}

// ── GA4 이벤트 추적 유틸 ─────────────────────────────────────────

declare global {
  interface Window {
    dataLayer?: object[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** GA4 커스텀 이벤트 발송 */
export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean>,
) {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', eventName, params);
}

/** 주요 전환 이벤트 모음 */
export const GA4Events = {
  /** 데모 신청 클릭 */
  demoRequest: (source: string) =>
    trackEvent('demo_request', { event_category: 'conversion', source }),

  /** 무료 체험 시작 클릭 */
  trialStart: (plan: string) =>
    trackEvent('trial_start', { event_category: 'conversion', plan }),

  /** 계산기 사용 */
  calculatorUsed: (industry: string) =>
    trackEvent('calculator_used', { event_category: 'engagement', industry }),

  /** 가격 플랜 클릭 */
  pricingClick: (plan: string, cycle: string) =>
    trackEvent('pricing_click', { event_category: 'engagement', plan, billing_cycle: cycle }),

  /** 블로그 읽기 완료 */
  blogRead: (slug: string, category: string) =>
    trackEvent('blog_read_complete', { event_category: 'content', slug, category }),

  /** 결제 완료 */
  purchase: (plan: string, value: number) =>
    trackEvent('purchase', { event_category: 'conversion', plan, value, currency: 'KRW' }),
};

// ── GTM DataLayer 푸시 유틸 ──────────────────────────────────────

/** GTM DataLayer에 이벤트 푸시 */
export function pushDataLayer(event: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(event);
}

/** UTM 파라미터 파싱 */
export function getUTMParams(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  const result: Record<string, string> = {};
  utmKeys.forEach((key) => {
    const val = params.get(key);
    if (val) result[key] = val;
  });
  return result;
}
