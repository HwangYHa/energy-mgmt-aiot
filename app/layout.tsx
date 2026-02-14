// app/layout.tsx
import './globals.css';
import type { Metadata, Viewport } from 'next';
import { SessionProvider } from '@/components/providers/SessionProvider';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://energyai.io';
const SITE_NAME = 'EnergyAI';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f172a',
  colorScheme: 'dark',
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'EnergyAI - AI 기반 에너지 관리 플랫폼',
    template: '%s | EnergyAI',
  },
  description:
    'AI 부하 예측, 실시간 이상 탐지, 자동 최적화로 에너지 비용 15% 절감. 제조업·빌딩·데이터센터를 위한 탄소중립 에너지 관리 SaaS 플랫폼.',
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
    title: 'EnergyAI - AI 기반 에너지 관리 플랫폼',
    description:
      'AI 부하 예측, 실시간 이상 탐지, 자동 최적화로 에너지 비용 15% 절감. 제조업·빌딩·데이터센터를 위한 탄소중립 에너지 관리 SaaS.',
    // OG 이미지는 app/opengraph-image.tsx에서 자동 생성
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EnergyAI - AI 기반 에너지 관리 플랫폼',
    description:
      'AI 부하 예측, 실시간 이상 탐지, 자동 최적화로 에너지 비용 15% 절감.',
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
    name: 'EnergyAI',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description:
      'AI 기반 에너지 관리 플랫폼. 부하 예측, 이상 탐지, 자동 최적화로 에너지 비용 15% 절감.',
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
      </head>
      <body className="bg-dark-bg text-white antialiased">
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
