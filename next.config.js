/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // X-Powered-By 헤더 제거 (보안)
  pageExtensions: ['ts', 'tsx', 'js', 'jsx'],

  // ─── Standalone 출력 (Docker 배포 필수) ──────────────────────────
  // Dockerfile에서 .next/standalone + .next/static을 복사하므로 반드시 필요
  output: 'standalone',

  // pdfkit은 내부에서 __dirname 기반 상대경로로 폰트(.afm) 파일을 참조하므로
  // webpack 번들링 시 경로가 깨짐 → Next.js가 번들링하지 않고 네이티브 Node.js로 실행
  serverExternalPackages: ['pdfkit'],

  // ─── 이미지 최적화 (Core Web Vitals LCP) ───────────────────────
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7일
  },

  // ─── HTTP 보안·SEO 헤더 ──────────────────────────────────────────
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // ─ 보안 헤더
          { key: 'X-Content-Type-Options',   value: 'nosniff' },
          { key: 'X-Frame-Options',           value: 'SAMEORIGIN' },
          { key: 'X-XSS-Protection',          value: '1; mode=block' },
          { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=()' },
          // ─ SEO/성능
          { key: 'Vary',                      value: 'Accept-Encoding' },
        ],
      },
      // 정적 자산 장기 캐싱 (Next.js 빌드 해시 포함)
      {
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // 공개 이미지/폰트 캐싱
      {
        source: '/images/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' },
        ],
      },
      // 사이트맵·로봇 캐싱
      {
        source: '/(sitemap.xml|robots.txt|feed.xml)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600, s-maxage=3600' },
        ],
      },
    ];
  },

  // ─── URL 리다이렉트 ──────────────────────────────────────────────
  async redirects() {
    return [
      // 트레일링 슬래시 정규화
      { source: '/blog/', destination: '/blog', permanent: true },
      { source: '/features/', destination: '/features', permanent: true },
      { source: '/calculator/', destination: '/calculator', permanent: true },
    ];
  },

  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        // bcryptjs, pdfkit 모두 네이티브 경로 의존성 있음 → 번들링 제외
        config.externals.push('bcryptjs', 'pdfkit');
      } else {
        config.externals = [config.externals, 'bcryptjs', 'pdfkit'];
      }
    }
    return config;
  },
};

module.exports = nextConfig;
