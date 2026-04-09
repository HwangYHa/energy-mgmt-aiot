/**
 * lib/seo/metadata.ts
 *
 * Next.js generateMetadata 헬퍼
 * 각 페이지에서 일관된 메타데이터를 쉽게 생성
 */

import type { Metadata } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://carboneum.kr';
const SITE_NAME = '탄소이음';
const DEFAULT_OG_IMAGE = `${SITE_URL}/opengraph-image`;

// ─── 기본 타입 ────────────────────────────────────────────────────

export interface PageSeoProps {
  title: string;
  description: string;
  path: string;                    // e.g. '/features' (SITE_URL 상대 경로)
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  keywords?: string[];
  noIndex?: boolean;               // true = robots: noindex
  publishedAt?: string;            // ISO 날짜 (블로그 등)
  modifiedAt?: string;
  type?: 'website' | 'article';
  twitterSite?: string;            // e.g. '@carboneum_kr'
}

// ─── 기본 키워드 세트 ─────────────────────────────────────────────

export const BASE_KEYWORDS = [
  '에너지 관리 시스템', 'EMS', '에너지 관리', '전력 모니터링',
  '탄소중립', '탄소 배출 관리', 'ESG', 'AIoT',
  '에너지 SaaS', '스마트 팩토리', '에너지 절감',
];

// ─── 메인 헬퍼 ───────────────────────────────────────────────────

/**
 * 페이지별 Metadata 객체 생성
 *
 * @example
 * export const metadata = buildPageMetadata({
 *   title: '제조업 에너지 관리 솔루션',
 *   description: '제조 현장 에너지 비용 30% 절감...',
 *   path: '/solutions/manufacturing',
 *   keywords: ['제조업 에너지', '공장 전력 관리'],
 * });
 */
export function buildPageMetadata(props: PageSeoProps): Metadata {
  const canonicalUrl = `${SITE_URL}${props.path}`;
  const ogImage = props.ogImage ?? DEFAULT_OG_IMAGE;
  const allKeywords = [...BASE_KEYWORDS, ...(props.keywords ?? [])];

  return {
    title: props.title,
    description: props.description,
    keywords: allKeywords,
    authors: [{ name: SITE_NAME, url: SITE_URL }],
    creator: SITE_NAME,
    publisher: SITE_NAME,

    alternates: {
      canonical: canonicalUrl,
      // 다국어 (영어 버전 준비 시 활성화)
      // languages: {
      //   'ko': canonicalUrl,
      //   'en': `${SITE_URL}/en${props.path}`,
      // },
    },

    openGraph: {
      type: props.type ?? 'website',
      locale: 'ko_KR',
      url: canonicalUrl,
      siteName: SITE_NAME,
      title: props.ogTitle ?? props.title,
      description: props.ogDescription ?? props.description,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: props.ogTitle ?? props.title,
        },
      ],
      ...(props.type === 'article' && props.publishedAt ? {
        publishedTime: props.publishedAt,
        modifiedTime: props.modifiedAt ?? props.publishedAt,
      } : {}),
    },

    twitter: {
      card: 'summary_large_image',
      title: props.ogTitle ?? props.title,
      description: props.ogDescription ?? props.description,
      images: [ogImage],
      ...(props.twitterSite ? { site: props.twitterSite } : {}),
    },

    robots: props.noIndex
      ? { index: false, follow: false }
      : {
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
  };
}

// ─── 블로그 포스트용 헬퍼 ────────────────────────────────────────

export function buildBlogPostMetadata(props: {
  title: string;
  description: string;
  slug: string;
  publishedAt: string;
  modifiedAt?: string;
  author?: string;
  image?: string;
  keywords?: string[];
}): Metadata {
  return buildPageMetadata({
    title: `${props.title} | 탄소이음 블로그`,
    description: props.description,
    path: `/blog/${props.slug}`,
    ogTitle: props.title,
    ogDescription: props.description,
    ogImage: props.image,
    keywords: props.keywords,
    publishedAt: props.publishedAt,
    modifiedAt: props.modifiedAt,
    type: 'article',
  });
}

// ─── 솔루션 페이지용 헬퍼 ────────────────────────────────────────

export function buildSolutionMetadata(industry: {
  slug: string;
  name: string;          // e.g. '제조업'
  headline: string;      // e.g. '공장 에너지 비용 30% 절감'
  description: string;
  keywords: string[];
}): Metadata {
  return buildPageMetadata({
    title: `${industry.name} 에너지 관리 솔루션 — ${industry.headline}`,
    description: industry.description,
    path: `/solutions/${industry.slug}`,
    keywords: [
      `${industry.name} 에너지 관리`,
      `${industry.name} 전력 모니터링`,
      `${industry.name} 탄소중립`,
      `${industry.name} ESG`,
      ...industry.keywords,
    ],
  });
}
