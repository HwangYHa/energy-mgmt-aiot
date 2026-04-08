/**
 * 탄소이음 에너지 인사이트 블로그
 * /blog
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { Clock, Tag, ArrowRight, BookOpen, TrendingUp, Leaf, Cpu, Building2, BarChart3 } from 'lucide-react';
import { getAllPosts, getFeaturedPosts, getPostsByCategory, BLOG_CATEGORIES } from '@/lib/blog/posts';
import { buildBreadcrumbSchema, serializeJsonLd } from '@/lib/seo/jsonld';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://carboneum.kr';

export const metadata: Metadata = {
  title: '에너지 인사이트 블로그 — 탄소중립·에너지 절감 가이드',
  description:
    '에너지 관리, 탄소중립, ESG 규제 대응, AI 전력 예측에 관한 전문 인사이트. 제조업·빌딩·데이터센터 에너지 절감 실전 가이드를 무료로 제공합니다.',
  keywords: [
    '에너지 절감 가이드', '탄소중립 전략', 'ESG 블로그', '에너지 관리 인사이트',
    '전기요금 절감 방법', 'K-ETS 가이드', 'RE100 이행', '스마트팩토리 에너지',
  ],
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    title: '탄소이음 에너지 인사이트 — 탄소중립·에너지 절감 가이드',
    description: '에너지 관리·탄소중립·ESG 전문 블로그. 실무 적용 가능한 인사이트를 무료로.',
    url: `${SITE_URL}/blog`,
    type: 'website',
  },
};

const CATEGORY_ICONS: Record<string, typeof BookOpen> = {
  '에너지 절감 가이드': TrendingUp,
  '탄소중립 전략': Leaf,
  'ESG 규제 대응': BarChart3,
  '기술 인사이트': Cpu,
  '산업별 사례': Building2,
  '제품 업데이트': BookOpen,
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function BlogPage() {
  const allPosts    = getAllPosts();
  const featured    = getFeaturedPosts().slice(0, 3);
  const recent      = allPosts.slice(0, 6);

  const breadcrumb = buildBreadcrumbSchema([
    { name: '홈', url: '/' },
    { name: '블로그', url: '/blog' },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumb) }}
      />

      <div className="min-h-screen bg-slate-900">
        {/* ── 헤더 ── */}
        <section className="border-b border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 py-16 px-4">
          <div className="max-w-6xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-xs text-cyan-400 mb-4">
              <BookOpen className="w-3.5 h-3.5" />
              에너지 인사이트
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              탄소이음 에너지 블로그
            </h1>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              에너지 관리, 탄소중립, ESG 규제 대응 관련 전문 인사이트를
              <br className="hidden md:block" /> 실무 적용 가능한 형태로 제공합니다.
            </p>
          </div>
        </section>

        <div className="max-w-6xl mx-auto px-4 py-12">
          {/* ── 주요 포스트 ── */}
          {featured.length > 0 && (
            <section className="mb-14">
              <h2 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider mb-6">
                주요 아티클
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {featured.map((post) => (
                  <Link key={post.slug} href={`/blog/${post.slug}`} className="group">
                    <article className="h-full bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 hover:border-cyan-500/30 transition-colors">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[10px] px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded-full">
                          {post.category}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-white mb-2 group-hover:text-cyan-400 transition-colors line-clamp-2">
                        {post.title}
                      </h3>
                      <p className="text-xs text-slate-400 line-clamp-2 mb-4">{post.description}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-auto">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {post.readingTime}분 읽기
                        </span>
                        <span>{formatDate(post.publishedAt)}</span>
                      </div>
                    </article>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* ── 최근 포스트 ── */}
            <section className="lg:col-span-3">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-6">
                최신 아티클
              </h2>
              <div className="space-y-4">
                {recent.map((post) => {
                  const CategoryIcon = CATEGORY_ICONS[post.category] ?? BookOpen;
                  return (
                    <Link key={post.slug} href={`/blog/${post.slug}`} className="group block">
                      <article className="flex gap-4 p-4 bg-slate-800/30 border border-slate-700/30 rounded-xl hover:border-slate-600/50 transition-colors">
                        <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-slate-700/50 rounded-lg">
                          <CategoryIcon className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] text-slate-500">{post.category}</span>
                          </div>
                          <h3 className="text-sm font-medium text-white group-hover:text-cyan-400 transition-colors line-clamp-1">
                            {post.title}
                          </h3>
                          <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{post.description}</p>
                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-2">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {post.readingTime}분
                            </span>
                            <span>{formatDate(post.publishedAt)}</span>
                            <span>{post.author}</span>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-cyan-400 transition-colors flex-shrink-0 self-center" />
                      </article>
                    </Link>
                  );
                })}
              </div>
            </section>

            {/* ── 사이드바: 카테고리 + 태그 ── */}
            <aside className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                  카테고리
                </h3>
                <ul className="space-y-2">
                  {BLOG_CATEGORIES.map((cat) => {
                    const count = getPostsByCategory(cat).length;
                    const Icon = CATEGORY_ICONS[cat] ?? BookOpen;
                    return (
                      <li key={cat}>
                        <Link
                          href={`/blog?category=${encodeURIComponent(cat)}`}
                          className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-800/50 text-slate-400 hover:text-white transition-colors"
                        >
                          <span className="flex items-center gap-2 text-sm">
                            <Icon className="w-3.5 h-3.5 text-cyan-400" />
                            {cat}
                          </span>
                          <span className="text-xs text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded">
                            {count}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* CTA */}
              <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-xl">
                <p className="text-sm font-medium text-cyan-400 mb-2">무료 에너지 진단</p>
                <p className="text-xs text-slate-400 mb-3">
                  전력 사용량을 입력하면 AI가 절감 기회를 즉시 분석합니다.
                </p>
                <Link
                  href="/calculator"
                  className="block w-full text-center py-2 bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  무료 계산기 →
                </Link>
              </div>

              {/* 태그 클라우드 */}
              <div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  인기 태그
                </h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    '전기요금 절감', '탄소중립', 'ESG', 'K-ETS', '스마트팩토리',
                    'AI 예측', 'BEMS', '수요반응', 'RE100', 'CBAM',
                  ].map((tag) => (
                    <Link
                      key={tag}
                      href={`/blog?tag=${encodeURIComponent(tag)}`}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[10px] bg-slate-800 text-slate-400 hover:text-cyan-400 rounded border border-slate-700/50 hover:border-cyan-500/30 transition-colors"
                    >
                      <Tag className="w-2.5 h-2.5" />
                      {tag}
                    </Link>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
