// app/layout.tsx
import './globals.css';
import type { Metadata, Viewport } from 'next';
import { SessionProvider } from '@/components/providers/SessionProvider';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://carboneum.kr';
const SITE_NAME = '탄소이음';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f172a',
  colorScheme: 'dark',
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: '탄소이음 - 에너지 데이터로 세상을 잇다',
    template: '%s | 탄소이음',
  },
  description:
    '에너지 데이터로 탄소중립을 실현하는 구독형 에너지 관리 SaaS. AI 부하 예측, 실시간 이상 탐지, 자동 최적화로 에너지 비용 절감과 탄소 감축을 동시에.',
  keywords: [
    '에너지 관리', '에너지 관리 시스템', 'EMS', 'BEMS', 'FEMS',
    'AI 에너지', '부하 예측', '이상 탐지', '에너지 최적화',
    '탄소 중립', '탄소 배출 관리', 'K-ETS', 'RE100',
    '수요 반응', 'DR', 'ESS 최적화', 'Peak Shaving',
    '스마트 팩토리', '스마트 빌딩', '데이터센터 PUE',
    'IoT 에너지', 'AIoT', '에너지 SaaS',
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: '탄소이음 - 에너지 데이터로 세상을 잇다',
    description:
      '에너지 데이터로 탄소중립을 실현하는 구독형 에너지 관리 SaaS. AI 부하 예측, 실시간 이상 탐지, 자동 최적화로 에너지 비용 절감과 탄소 감축을 동시에.',
    // OG 이미지는 app/opengraph-image.tsx에서 자동 생성
  },
  twitter: {
    card: 'summary_large_image',
    title: '탄소이음 - 에너지 데이터로 세상을 잇다',
    description:
      '에너지 데이터로 탄소중립을 실현하는 구독형 에너지 관리 SaaS. 에너지 비용 절감과 탄소 감축을 동시에.',
    // Twitter 이미지도 opengraph-image.tsx에서 자동 적용
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
  },
  verification: {
    // Google Search Console / Naver 웹마스터 등록 후 값 입력
    // google: 'your-google-verification-code',
    // other: { 'naver-site-verification': 'your-naver-code' },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: '탄소이음',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description:
      '에너지 데이터로 탄소중립을 실현하는 SaaS 플랫폼. 부하 예측, 이상 탐지, 자동 최적화로 에너지 비용 절감과 탄소 감축을 동시에.',
    url: SITE_URL,
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'KRW',
      lowPrice: '0',
      highPrice: '299000',
      offerCount: '3',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      reviewCount: '1200',
    },
  };

  return (
    <html lang="ko" className="dark">
      <head>
        {/* Favicon은 app/icon.tsx에서 자동 생성 */}
        <link rel="manifest" href="/manifest.json" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* PWA 서비스워커 등록 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(function(reg) {
        reg.addEventListener('updatefound', function() {
          var newSW = reg.installing;
          if (newSW) {
            newSW.addEventListener('statechange', function() {
              if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
                // 새 버전 감지 — 사용자에게 새로고침 안내는 ToastContainer에서 처리
                window.dispatchEvent(new CustomEvent('sw-update-available'));
              }
            });
          }
        });
      })
      .catch(function(err) { console.warn('[SW] 등록 실패:', err); });
  });
}
            `.trim(),
          }}
        />
      </head>
      <body className="bg-dark-bg text-white antialiased">
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
