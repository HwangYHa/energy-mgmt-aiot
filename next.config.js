/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // X-Powered-By 헤더 제거 (보안)
  pageExtensions: ['ts', 'tsx', 'js', 'jsx'],

  // pdfkit은 내부에서 __dirname 기반 상대경로로 폰트(.afm) 파일을 참조하므로
  // webpack 번들링 시 경로가 깨짐 → Next.js가 번들링하지 않고 네이티브 Node.js로 실행
  serverExternalPackages: ['pdfkit'],

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
