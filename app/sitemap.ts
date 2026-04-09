/**
 * Dynamic Sitemap
 * Next.js App Router 자동 생성: /sitemap.xml
 *
 * 포함 범위:
 * - 공개 랜딩 페이지 (19개)
 * - 솔루션 페이지 (4개)
 * - 블로그 포스트 (동적)
 * - 계산기 (전환 페이지)
 */

import { MetadataRoute } from 'next';
import { getAllPosts } from '@/lib/blog/posts';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://carboneum.kr';

export default function sitemap(): MetadataRoute.Sitemap {
  const now   = new Date();
  const posts = getAllPosts();

  // ── 공개 정적 페이지 ────────────────────────────────────────────
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    // 핵심 전환 페이지
    {
      url: `${SITE_URL}/demo`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.95,
    },
    {
      url: `${SITE_URL}/trial`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.95,
    },
    {
      url: `${SITE_URL}/calculator`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.90,
    },
    // 기능/가격
    {
      url: `${SITE_URL}/features`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.90,
    },
    {
      url: `${SITE_URL}/pricing`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.90,
    },
    // 블로그 허브
    {
      url: `${SITE_URL}/blog`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.85,
    },
    // 솔루션 (산업별)
    {
      url: `${SITE_URL}/solutions/manufacturing`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.85,
    },
    {
      url: `${SITE_URL}/solutions/building`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.85,
    },
    {
      url: `${SITE_URL}/solutions/datacenter`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.85,
    },
    {
      url: `${SITE_URL}/solutions/industrial`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.85,
    },
    // FAQ
    {
      url: `${SITE_URL}/faq`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.75,
    },
    // 문서
    {
      url: `${SITE_URL}/docs`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.70,
    },
    {
      url: `${SITE_URL}/docs/api`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.70,
    },
    {
      url: `${SITE_URL}/docs/getting-started`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.70,
    },
    // 지원
    {
      url: `${SITE_URL}/support`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.65,
    },
    {
      url: `${SITE_URL}/community`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.60,
    },
    // 법적 (낮은 우선순위)
    {
      url: `${SITE_URL}/legal/privacy`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.30,
    },
    {
      url: `${SITE_URL}/legal/terms`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.30,
    },
    {
      url: `${SITE_URL}/legal/security`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.30,
    },
  ];

  // ── 블로그 포스트 (동적) ─────────────────────────────────────────
  const blogPages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.modifiedAt ?? post.publishedAt),
    changeFrequency: 'monthly' as const,
    priority: post.featured ? 0.80 : 0.70,
  }));

  return [...staticPages, ...blogPages];
}
