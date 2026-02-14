/**
 * Robots.txt for SEO
 *
 * Next.js App Router 자동 생성: /robots.txt
 */

import { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://energyai.io';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard/',
          '/monitoring/',
          '/analytics/',
          '/control/',
          '/devices/',
          '/sensors/',
          '/sites/',
          '/reports/',
          '/settings/',
          '/admin/',
          '/compliance/',
          '/alerts/',
          '/digital-twin/',
          '/payment/',
          '/unauthorized',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
