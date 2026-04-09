/**
 * lib/blog/posts.ts
 *
 * 탄소이음 블로그 포스트 데이터
 *
 * 실제 서비스에서는 CMS(Notion, Contentful, Sanity 등)에서 fetch하거나
 * MDX 파일로 관리. 현재는 정적 데이터로 시작 후 점진적 마이그레이션.
 */

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  category: BlogCategory;
  tags: string[];
  publishedAt: string;       // ISO 8601
  modifiedAt?: string;
  author: string;
  authorRole?: string;
  readingTime: number;       // 분
  featured?: boolean;
  image?: string;
  content?: string;          // MDX 또는 HTML (간단 포스트)
}

export type BlogCategory =
  | '에너지 절감 가이드'
  | '탄소중립 전략'
  | 'ESG 규제 대응'
  | '기술 인사이트'
  | '산업별 사례'
  | '제품 업데이트';

export const BLOG_CATEGORIES: BlogCategory[] = [
  '에너지 절감 가이드',
  '탄소중립 전략',
  'ESG 규제 대응',
  '기술 인사이트',
  '산업별 사례',
  '제품 업데이트',
];

// ─── 블로그 포스트 데이터 ─────────────────────────────────────────

export const BLOG_POSTS: BlogPost[] = [
  // ── 에너지 절감 가이드 ──
  {
    slug: 'electricity-cost-reduction-guide',
    title: '전기요금 30% 절감하는 7가지 실전 방법 (2025년 최신)',
    description:
      '제조업·빌딩·데이터센터에서 전기요금을 실제로 30% 이상 절감한 방법을 단계별로 설명합니다. AI 피크 관리부터 수요반응(DR) 자동 참여까지.',
    category: '에너지 절감 가이드',
    tags: ['전기요금 절감', '피크 관리', '수요반응', 'DR', '에너지 최적화'],
    publishedAt: '2025-01-15T09:00:00+09:00',
    author: '탄소이음 에너지 연구팀',
    authorRole: 'Senior Energy Analyst',
    readingTime: 12,
    featured: true,
    image: '/images/blog/electricity-cost-guide.png',
  },
  {
    slug: 'peak-load-management',
    title: '최대수요전력 요금 절감 완전 가이드 — 피크 부하 관리란?',
    description:
      '최대수요전력 요금이 왜 비싼지, AI로 어떻게 자동으로 줄일 수 있는지 설명합니다. 실제 제조업 사례로 연간 3,200만 원 절감 과정 공개.',
    category: '에너지 절감 가이드',
    tags: ['최대수요전력', '피크 부하', '전기요금', '에너지 관리'],
    publishedAt: '2025-02-03T09:00:00+09:00',
    author: '탄소이음 에너지 연구팀',
    readingTime: 9,
  },
  {
    slug: 'smart-factory-energy',
    title: '스마트팩토리 에너지 관리 — 공장 전력 비용 절감 완전 가이드',
    description:
      '스마트팩토리 도입 기업의 에너지 관리 방법. IoT 센서, AI 예측, 자동화 제어로 공장 전력 비용을 어떻게 30% 줄이는지 단계별로 설명.',
    category: '산업별 사례',
    tags: ['스마트팩토리', '공장 에너지', '제조업', 'IoT', 'FEMS'],
    publishedAt: '2025-02-20T09:00:00+09:00',
    author: '탄소이음 솔루션팀',
    readingTime: 11,
    featured: true,
  },

  // ── 탄소중립 전략 ──
  {
    slug: 'scope1-2-3-guide',
    title: 'Scope 1·2·3 탄소 배출량 완전 가이드 — 측정부터 감축까지',
    description:
      'GHG Protocol 기준 Scope 1(직접), Scope 2(간접), Scope 3(공급망) 탄소 배출량 측정·계산·보고 방법을 실무 사례와 함께 설명합니다.',
    category: '탄소중립 전략',
    tags: ['Scope 1', 'Scope 2', 'Scope 3', 'GHG Protocol', '탄소 배출량', 'ESG'],
    publishedAt: '2025-01-28T09:00:00+09:00',
    author: '탄소이음 탄소 전문팀',
    authorRole: 'Carbon Accounting Expert',
    readingTime: 15,
    featured: true,
  },
  {
    slug: 'k-ets-guide',
    title: 'K-ETS 배출권 거래제 기업 대응 가이드 2025',
    description:
      '한국 탄소배출권 거래제(K-ETS) 할당량 관리, 배출권 매매, 명세서 제출 자동화 방법을 단계별로 설명합니다.',
    category: '탄소중립 전략',
    tags: ['K-ETS', '배출권 거래제', '탄소 크레딧', '온실가스 명세서'],
    publishedAt: '2025-03-01T09:00:00+09:00',
    author: '탄소이음 탄소 전문팀',
    readingTime: 13,
  },
  {
    slug: 're100-guide',
    title: 'RE100 이행 방법 — 한국 기업의 재생에너지 전환 로드맵',
    description:
      'RE100 가입 기업의 재생에너지 100% 전환 방법. PPA 계약, REC 구매, 자가발전 최적화로 RE100 목표 달성하는 현실적인 로드맵.',
    category: '탄소중립 전략',
    tags: ['RE100', '재생에너지', 'PPA', 'REC', '탄소중립'],
    publishedAt: '2025-03-10T09:00:00+09:00',
    author: '탄소이음 탄소 전문팀',
    readingTime: 10,
  },
  {
    slug: 'cbam-guide',
    title: 'EU CBAM 탄소국경조정제도 — 수출 기업 대응 가이드',
    description:
      '2026년 본격 시행되는 EU CBAM에 대비한 탄소 배출량 인증, 보고 의무화 대응 전략. 수출 기업이 지금 당장 해야 할 일.',
    category: 'ESG 규제 대응',
    tags: ['CBAM', 'EU 탄소국경조정', '수출 기업', '탄소 인증'],
    publishedAt: '2025-03-15T09:00:00+09:00',
    author: '탄소이음 탄소 전문팀',
    readingTime: 11,
    featured: true,
  },

  // ── ESG 규제 대응 ──
  {
    slug: 'esg-guide',
    title: 'ESG 경영 완전 가이드 — 중견기업 ESG 도입 로드맵',
    description:
      'ESG(환경·사회·지배구조) 경영이란 무엇인지, 중견·중소기업이 어떻게 시작해야 하는지 단계별로 설명. 탄소 배출 공시 의무화 일정과 준비 방법.',
    category: 'ESG 규제 대응',
    tags: ['ESG', 'ESG 경영', '탄소 공시', 'GRI', 'TCFD'],
    publishedAt: '2025-01-10T09:00:00+09:00',
    author: '탄소이음 ESG 연구팀',
    readingTime: 14,
  },
  {
    slug: 'ghg-protocol',
    title: 'GHG Protocol 온실가스 회계 기준 완전 가이드',
    description:
      '국제표준 GHG Protocol로 온실가스 배출량을 측정하는 방법. 기업 보고 기준, 배출 인자 적용, 검증 절차까지 실무 가이드.',
    category: 'ESG 규제 대응',
    tags: ['GHG Protocol', '온실가스', '탄소 배출량', 'CDP', 'SBTi'],
    publishedAt: '2025-02-10T09:00:00+09:00',
    author: '탄소이음 ESG 연구팀',
    readingTime: 12,
  },

  // ── 기술 인사이트 ──
  {
    slug: 'ai-energy-prediction',
    title: 'AI 에너지 예측 기술 — LSTM·Transformer 모델로 MAPE 8% 달성하는 방법',
    description:
      '에너지 부하 예측에 사용되는 AI 기술을 실무 관점에서 설명. LSTM·Transformer·XGBoost 모델 비교와 MAPE 8% 이하 달성 방법.',
    category: '기술 인사이트',
    tags: ['AI 에너지 예측', 'LSTM', '딥러닝', '부하 예측', 'MAPE'],
    publishedAt: '2025-02-25T09:00:00+09:00',
    author: '탄소이음 AI 연구팀',
    authorRole: 'ML Engineer',
    readingTime: 16,
  },
  {
    slug: 'energy-bigdata',
    title: '에너지 빅데이터로 절감 기회 찾는 방법 — 데이터 분석 실전 가이드',
    description:
      '수십만 건의 에너지 데이터에서 절감 기회를 어떻게 발굴하는지 데이터 분석 관점에서 설명. 실제 공장·빌딩 데이터 분석 사례 포함.',
    category: '기술 인사이트',
    tags: ['에너지 빅데이터', '데이터 분석', '에너지 절감', 'IoT'],
    publishedAt: '2025-03-05T09:00:00+09:00',
    author: '탄소이음 AI 연구팀',
    readingTime: 10,
  },

  // ── 산업별 사례 ──
  {
    slug: 'success-cases',
    title: '에너지 관리 시스템 도입 성공 사례 — 실제 절감 수치 공개',
    description:
      '탄소이음을 도입한 기업의 실제 에너지 절감 사례. 제조업 32% 절감, 빌딩 41% 절감, 데이터센터 PUE 1.18 달성 스토리.',
    category: '산업별 사례',
    tags: ['성공 사례', '에너지 절감', '제조업', '빌딩', '데이터센터'],
    publishedAt: '2025-01-20T09:00:00+09:00',
    author: '탄소이음 마케팅팀',
    readingTime: 8,
    featured: true,
  },
  {
    slug: 'building-energy-case',
    title: '상업 빌딩 에너지 비용 41% 절감 — 서울 오피스 빌딩 사례 연구',
    description:
      '서울 강남 오피스 빌딩에서 탄소이음 BEMS 도입 후 전기요금 41% 절감, 탄소 배출 48% 감축한 6개월 프로젝트 전 과정 공개.',
    category: '산업별 사례',
    tags: ['빌딩 에너지', 'BEMS', '오피스 빌딩', '전기요금 절감'],
    publishedAt: '2025-03-20T09:00:00+09:00',
    author: '탄소이음 솔루션팀',
    readingTime: 9,
  },
];

// ─── 유틸 함수 ────────────────────────────────────────────────────

export function getAllPosts(): BlogPost[] {
  return BLOG_POSTS.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

export function getPostsByCategory(category: BlogCategory): BlogPost[] {
  return BLOG_POSTS.filter((p) => p.category === category)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

export function getFeaturedPosts(): BlogPost[] {
  return BLOG_POSTS.filter((p) => p.featured);
}

export function getRelatedPosts(currentSlug: string, tags: string[], limit = 3): BlogPost[] {
  return BLOG_POSTS
    .filter((p) => p.slug !== currentSlug && p.tags.some((t) => tags.includes(t)))
    .slice(0, limit);
}

export function getAllSlugs(): string[] {
  return BLOG_POSTS.map((p) => p.slug);
}
