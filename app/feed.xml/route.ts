/**
 * RSS 2.0 피드
 * GET /feed.xml
 *
 * 검색 엔진(특히 네이버)의 블로그 콘텐츠 수집에 활용
 * 구독 서비스(Feedly 등)에서도 사용
 */

import { getAllPosts } from '@/lib/blog/posts';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://carboneum.kr';
const SITE_NAME = '탄소이음';

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const posts = getAllPosts();
  const now   = new Date().toUTCString();

  const items = posts.map((post) => {
    const url = `${SITE_URL}/blog/${post.slug}`;
    const pubDate = new Date(post.publishedAt).toUTCString();
    const tags = post.tags.map((t) => `<category>${escapeXml(t)}</category>`).join('\n    ');

    return `
  <item>
    <title>${escapeXml(post.title)}</title>
    <link>${url}</link>
    <guid isPermaLink="true">${url}</guid>
    <description>${escapeXml(post.description)}</description>
    <pubDate>${pubDate}</pubDate>
    <author>contact@carboneum.kr (${escapeXml(post.author)})</author>
    ${tags}
    <content:encoded><![CDATA[${post.description}]]></content:encoded>
  </item>`.trim();
  }).join('\n\n  ');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(SITE_NAME)} 에너지 인사이트</title>
    <link>${SITE_URL}/blog</link>
    <description>에너지 관리, 탄소중립, ESG 규제 대응에 관한 전문 인사이트</description>
    <language>ko</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${SITE_URL}/icon.png</url>
      <title>${escapeXml(SITE_NAME)}</title>
      <link>${SITE_URL}/blog</link>
    </image>
    <copyright>Copyright ${new Date().getFullYear()} ${escapeXml(SITE_NAME)}</copyright>
    <managingEditor>blog@carboneum.kr (${escapeXml(SITE_NAME)} 편집팀)</managingEditor>
    <webMaster>tech@carboneum.kr</webMaster>
    <ttl>60</ttl>

  ${items}
  </channel>
</rss>`.trim();

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
