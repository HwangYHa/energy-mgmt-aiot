/**
 * 블로그 포스트 상세 페이지
 * /blog/[slug]
 *
 * - generateStaticParams: 빌드 타임 정적 생성 (SSG)
 * - generateMetadata: 포스트별 동적 메타데이터
 * - JSON-LD: BlogPosting + BreadcrumbList
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Clock, Calendar, User, ArrowLeft, Tag, ArrowRight, Share2 } from 'lucide-react';
import { getPostBySlug, getAllSlugs, getRelatedPosts } from '@/lib/blog/posts';
import { buildBlogPostSchema, buildBreadcrumbSchema, serializeJsonLd } from '@/lib/seo/jsonld';
import { buildBlogPostMetadata } from '@/lib/seo/metadata';

// ─── 정적 경로 생성 ──────────────────────────────────────────────

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

// ─── 동적 메타데이터 ─────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug: postSlug } = await params;
  const post = getPostBySlug(postSlug);
  if (!post) return { title: '포스트를 찾을 수 없습니다 | 탄소이음' };

  return buildBlogPostMetadata({
    title: post.title,
    description: post.description,
    slug: post.slug,
    publishedAt: post.publishedAt,
    modifiedAt: post.modifiedAt,
    author: post.author,
    image: post.image,
    keywords: post.tags,
  });
}

// ─── 블로그 콘텐츠 (정적 예시) ───────────────────────────────────

function getPostContent(_slug: string): string {
  // 실제 서비스에서는 MDX 파일이나 CMS에서 불러옴
  // 현재는 placeholder
  return `
<p class="lead">
  에너지 관리는 현대 기업 경영에서 빠질 수 없는 핵심 과제가 되었습니다.
  탄소중립 의무화와 전기요금 상승이 맞물리면서, 체계적인 에너지 관리 시스템 도입이 선택이 아닌 필수가 되었습니다.
</p>

<h2>핵심 내용 요약</h2>
<ul>
  <li>AI 기반 부하 예측으로 피크 요금 최소화</li>
  <li>실시간 이상 탐지로 에너지 낭비 즉시 감지</li>
  <li>자동화된 탄소 배출량 추적 및 ESG 보고</li>
  <li>수요반응(DR) 자동 참여로 추가 절감</li>
</ul>

<blockquote>
  "탄소이음 도입 후 6개월 만에 전기요금 32% 절감을 달성했습니다. AI가 자동으로 피크를 관리해주니 현장 직원들의 업무 부담도 크게 줄었어요." — A제조사 에너지팀장
</blockquote>

<h2>자세한 내용은 데모에서</h2>
<p>
  실제 데이터를 가지고 전문가와 1:1로 분석해보고 싶으시다면, 무료 데모를 신청해보세요.
</p>
  `.trim();
}

// ─── 포스트 페이지 ────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const relatedPosts = getRelatedPosts(post.slug, post.tags);
  const content      = post.content ?? getPostContent(slug);

  const blogPostSchema = buildBlogPostSchema({
    title:       post.title,
    description: post.description,
    slug:        post.slug,
    publishedAt: post.publishedAt,
    modifiedAt:  post.modifiedAt,
    author:      post.author,
    image:       post.image,
    category:    post.category,
    keywords:    post.tags,
  });

  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: '홈', url: '/' },
    { name: '블로그', url: '/blog' },
    { name: post.category, url: `/blog?category=${encodeURIComponent(post.category)}` },
    { name: post.title, url: `/blog/${post.slug}` },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(blogPostSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbSchema) }}
      />

      <div className="min-h-screen bg-slate-900">
        <div className="max-w-4xl mx-auto px-4 py-12">

          {/* ── 브레드크럼 ── */}
          <nav aria-label="breadcrumb" className="flex items-center gap-2 text-xs text-slate-500 mb-8">
            <Link href="/" className="hover:text-slate-300 transition-colors">홈</Link>
            <span>/</span>
            <Link href="/blog" className="hover:text-slate-300 transition-colors">블로그</Link>
            <span>/</span>
            <Link
              href={`/blog?category=${encodeURIComponent(post.category)}`}
              className="hover:text-slate-300 transition-colors"
            >
              {post.category}
            </Link>
            <span>/</span>
            <span className="text-slate-400 truncate max-w-[200px]">{post.title}</span>
          </nav>

          {/* ── 포스트 헤더 ── */}
          <header className="mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-xs text-cyan-400 mb-4">
              {post.category}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
              {post.title}
            </h1>
            <p className="text-lg text-slate-400 mb-6">{post.description}</p>

            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 pb-6 border-b border-slate-800">
              <span className="flex items-center gap-1.5">
                <User className="w-4 h-4" /> {post.author}
                {post.authorRole && <span className="text-slate-600">({post.authorRole})</span>}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> {post.readingTime}분 읽기
              </span>
            </div>
          </header>

          {/* ── 태그 ── */}
          <div className="flex flex-wrap gap-2 mb-8">
            {post.tags.map((tag) => (
              <Link
                key={tag}
                href={`/blog?tag=${encodeURIComponent(tag)}`}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-slate-800 text-slate-400 hover:text-cyan-400 rounded border border-slate-700/50 transition-colors"
              >
                <Tag className="w-3 h-3" /> {tag}
              </Link>
            ))}
          </div>

          {/* ── 본문 ── */}
          <article
            className="prose prose-invert prose-slate max-w-none
              prose-headings:text-white prose-h2:text-2xl prose-h2:font-bold prose-h2:mt-10 prose-h2:mb-4
              prose-p:text-slate-300 prose-p:leading-relaxed
              prose-li:text-slate-300 prose-strong:text-white
              prose-blockquote:border-l-cyan-500 prose-blockquote:text-slate-400
              prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:underline
              mb-12"
            dangerouslySetInnerHTML={{ __html: content }}
          />

          {/* ── CTA 박스 ── */}
          <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-xl p-6 mb-12">
            <h3 className="text-lg font-bold text-white mb-2">
              우리 회사 에너지 절감 가능성은 얼마나 될까요?
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              전력 사용량을 입력하면 AI가 즉시 절감 가능 금액을 계산해드립니다.
            </p>
            <div className="flex gap-3">
              <Link
                href="/calculator"
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                무료 절감 계산기
              </Link>
              <Link
                href="/demo"
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                전문가 데모 신청
              </Link>
            </div>
          </div>

          {/* ── 공유 ── */}
          <div className="flex items-center gap-3 pb-8 border-b border-slate-800 mb-10">
            <Share2 className="w-4 h-4 text-slate-500" />
            <span className="text-sm text-slate-500">이 글이 도움이 되셨다면 공유해주세요</span>
          </div>

          {/* ── 관련 포스트 ── */}
          {relatedPosts.length > 0 && (
            <section>
              <h2 className="text-lg font-bold text-white mb-4">관련 아티클</h2>
              <div className="space-y-3">
                {relatedPosts.map((related) => (
                  <Link key={related.slug} href={`/blog/${related.slug}`} className="group block">
                    <div className="flex items-center justify-between p-4 bg-slate-800/30 border border-slate-700/30 rounded-xl hover:border-slate-600/50 transition-colors">
                      <div>
                        <p className="text-xs text-slate-500 mb-0.5">{related.category}</p>
                        <p className="text-sm font-medium text-white group-hover:text-cyan-400 transition-colors">
                          {related.title}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-cyan-400 transition-colors flex-shrink-0 ml-4" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* ── 뒤로 가기 ── */}
          <div className="mt-10 pt-6 border-t border-slate-800">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-cyan-400 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> 블로그 목록으로
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
