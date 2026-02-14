/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // X-Powered-By 헤더 제거 (보안)
  pageExtensions: ['ts', 'tsx', 'js', 'jsx'],
  webpack: (config, { isServer }) => {
    // 서버 사이드에서만 bcryptjs를 외부 패키지로 처리
    if (isServer) {
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push('bcryptjs');
      } else {
        config.externals = [config.externals, 'bcryptjs'];
      }
    }
    return config;
  },
};

module.exports = nextConfig;
