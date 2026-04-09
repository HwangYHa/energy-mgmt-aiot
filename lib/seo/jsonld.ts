/**
 * lib/seo/jsonld.ts
 *
 * 탄소이음 JSON-LD 구조화 데이터 생성 유틸
 *
 * Google Rich Results + 네이버 검색 최적화
 * 지원 스키마: Organization, SoftwareApplication, Product, BreadcrumbList,
 *             FAQPage, BlogPosting, HowTo, Article, LocalBusiness
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://carboneum.kr';
const SITE_NAME = '탄소이음';

// ─── 기본 타입 ────────────────────────────────────────────────────

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface BlogPostSchemaProps {
  title: string;
  description: string;
  slug: string;
  publishedAt: string;
  modifiedAt?: string;
  author?: string;
  image?: string;
  category?: string;
  keywords?: string[];
}

// ─── Organization Schema ─────────────────────────────────────────

export function buildOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME,
    alternateName: 'Carboneum',
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: `${SITE_URL}/icon.png`,
      width: 512,
      height: 512,
    },
    description: '에너지 데이터로 세상을 잇다 — 탄소중립 SaaS 에너지 관리 전문기업',
    foundingDate: '2024',
    areaServed: {
      '@type': 'Country',
      name: '대한민국',
      '@id': 'https://www.wikidata.org/wiki/Q884',
    },
    sameAs: [
      // 등록 후 활성화
      // 'https://www.linkedin.com/company/carboneum',
      // 'https://github.com/carboneum',
      // 'https://blog.naver.com/carboneum',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: 'support@carboneum.kr',
      availableLanguage: ['Korean'],
      contactOption: 'TollFree',
    },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: '탄소이음 에너지 관리 플랫폼 서비스',
      itemListElement: [
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Trial 플랜', description: '무료 체험' } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Basic 플랜', description: '월 ₩99,000' } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Pro 플랜', description: '월 ₩299,000' } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Enterprise 플랜', description: '맞춤 견적' } },
      ],
    },
  };
}

// ─── SoftwareApplication Schema ──────────────────────────────────

export function buildSoftwareAppSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': `${SITE_URL}/#software`,
    name: SITE_NAME,
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Energy Management Software',
    operatingSystem: 'Web Browser',
    description:
      'AI 기반 에너지 관리 SaaS. 부하 예측(MAPE 8%), 이상 탐지(F1 0.92), 자동 최적화로 에너지 비용 최대 30% 절감, 탄소 배출 50% 감축.',
    url: SITE_URL,
    inLanguage: 'ko',
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'KRW',
      lowPrice: '0',
      highPrice: '299000',
      offerCount: '4',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '120',
      reviewCount: '87',
      bestRating: '5',
      worstRating: '1',
    },
    featureList: [
      'AI 부하 예측 (MAPE 8%)',
      '실시간 이상 탐지 (F1-Score 0.92)',
      '자동 에너지 최적화',
      '수요반응(DR) 관리',
      '탄소 배출량 추적 (Scope 1/2/3)',
      'ESG 보고서 자동 생성',
      'K-ETS 탄소 거래소 연동',
      'IoT/PLC 실시간 모니터링',
    ],
    screenshot: `${SITE_URL}/images/dashboard-screenshot.png`,
    softwareVersion: '2.0',
    releaseNotes: `${SITE_URL}/docs/changelog`,
    author: {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
    },
  };
}

// ─── Product Schema (플랜별) ─────────────────────────────────────

export function buildProductSchema(plan: {
  name: string;
  description: string;
  price: number | null;
  features: string[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `탄소이음 ${plan.name}`,
    description: plan.description,
    brand: {
      '@type': 'Brand',
      name: SITE_NAME,
    },
    offers: plan.price === null
      ? { '@type': 'Offer', availability: 'https://schema.org/InStock', description: '맞춤 견적' }
      : {
          '@type': 'Offer',
          price: plan.price,
          priceCurrency: 'KRW',
          availability: 'https://schema.org/InStock',
          url: `${SITE_URL}/pricing`,
          priceValidUntil: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
        },
    additionalProperty: plan.features.map((f) => ({
      '@type': 'PropertyValue',
      name: f,
    })),
  };
}

// ─── BreadcrumbList Schema ────────────────────────────────────────

export function buildBreadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${SITE_URL}${item.url}`,
    })),
  };
}

// ─── FAQ Schema ──────────────────────────────────────────────────

export function buildFaqSchema(faqs: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

// ─── BlogPosting Schema ──────────────────────────────────────────

export function buildBlogPostSchema(props: BlogPostSchemaProps) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${SITE_URL}/blog/${props.slug}`,
    headline: props.title,
    description: props.description,
    url: `${SITE_URL}/blog/${props.slug}`,
    datePublished: props.publishedAt,
    dateModified: props.modifiedAt ?? props.publishedAt,
    author: {
      '@type': 'Person',
      name: props.author ?? '탄소이음 편집팀',
      url: `${SITE_URL}/about`,
    },
    publisher: {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: SITE_NAME,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/icon.png`,
      },
    },
    ...(props.image ? {
      image: {
        '@type': 'ImageObject',
        url: props.image.startsWith('http') ? props.image : `${SITE_URL}${props.image}`,
        width: 1200,
        height: 630,
      },
    } : {}),
    keywords: props.keywords?.join(', '),
    articleSection: props.category,
    inLanguage: 'ko',
    isPartOf: {
      '@type': 'Blog',
      '@id': `${SITE_URL}/blog`,
      name: '탄소이음 에너지 인사이트',
      url: `${SITE_URL}/blog`,
    },
  };
}

// ─── WebPage Schema (제너릭) ─────────────────────────────────────

export function buildWebPageSchema(props: {
  title: string;
  description: string;
  url: string;
  breadcrumbs?: BreadcrumbItem[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: props.title,
    description: props.description,
    url: props.url.startsWith('http') ? props.url : `${SITE_URL}${props.url}`,
    isPartOf: { '@id': `${SITE_URL}/#website` },
    about: { '@id': `${SITE_URL}/#software` },
    inLanguage: 'ko',
  };
}

// ─── HowTo Schema (사용 가이드용) ────────────────────────────────

export function buildHowToSchema(props: {
  title: string;
  description: string;
  steps: { name: string; text: string }[];
  totalTime?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: props.title,
    description: props.description,
    totalTime: props.totalTime ?? 'PT10M',
    step: props.steps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  };
}

// ─── LocalBusiness Schema (지역 SEO) ────────────────────────────

export function buildLocalBusinessSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${SITE_URL}/#localbusiness`,
    name: SITE_NAME,
    image: `${SITE_URL}/icon.png`,
    url: SITE_URL,
    telephone: '',
    email: 'support@carboneum.kr',
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'KR',
      addressLocality: '서울',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 37.5665,
      longitude: 126.9780,
    },
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '09:00',
      closes: '18:00',
    },
    priceRange: '₩₩',
    servesCuisine: undefined,
    sameAs: [`${SITE_URL}`],
  };
}

// ─── JSON-LD 직렬화 헬퍼 ────────────────────────────────────────

/** <script type="application/ld+json"> 태그용 안전한 직렬화 */
export function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

/** 여러 스키마를 한 번에 주입할 때 */
export function buildJsonLdScripts(schemas: Record<string, unknown>[]): string {
  return schemas.map((s) => serializeJsonLd(s)).join('\n');
}
