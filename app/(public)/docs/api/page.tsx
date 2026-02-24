import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import {
  Code,
  Key,
  Lock,
  Zap,
  Database,
  Radio,
  Webhook,
  ArrowRight,
  Copy,
  CheckCircle,
} from 'lucide-react';

/**
 * API 문서 페이지
 */
export const metadata = {
  title: 'API 문서 - 탄소이음',
  description: '탄소이음 REST API, WebSocket, Webhook 통합 가이드',
};

export default function APIDocsPage() {
  const endpoints = [
    {
      category: '인증 (Authentication)',
      icon: Lock,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      apis: [
        {
          method: 'POST',
          endpoint: '/api/auth/login',
          description: '로그인 및 세션 토큰 발급',
        },
        {
          method: 'POST',
          endpoint: '/api/auth/register',
          description: '신규 사용자 등록',
        },
        {
          method: 'GET',
          endpoint: '/api/auth/token',
          description: 'Bearer JWT 토큰 발급',
        },
        {
          method: 'POST',
          endpoint: '/api/api-keys',
          description: 'API 키 생성 (설정 > API 키 관리)',
        },
      ],
    },
    {
      category: '사이트 & 디바이스',
      icon: Database,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      apis: [
        {
          method: 'GET',
          endpoint: '/api/sites',
          description: '사이트 목록 조회',
        },
        {
          method: 'POST',
          endpoint: '/api/sites',
          description: '신규 사이트 등록',
        },
        {
          method: 'GET',
          endpoint: '/api/devices',
          description: '디바이스 목록 조회',
        },
        {
          method: 'POST',
          endpoint: '/api/devices',
          description: '디바이스 등록',
        },
      ],
    },
    {
      category: '실시간 데이터',
      icon: Radio,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      apis: [
        {
          method: 'GET',
          endpoint: '/api/realtime',
          description: '실시간 전력 데이터 조회',
        },
        {
          method: 'WS',
          endpoint: 'wss://api.탄소이음.io/ws',
          description: 'WebSocket 실시간 스트리밍',
        },
      ],
    },
    {
      category: 'AI 분석',
      icon: Zap,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
      apis: [
        {
          method: 'POST',
          endpoint: '/api/ai/forecast',
          description: 'AI 부하 예측 실행',
        },
        {
          method: 'POST',
          endpoint: '/api/ai/anomaly',
          description: '이상 탐지 분석',
        },
        {
          method: 'POST',
          endpoint: '/api/ai/optimize',
          description: '에너지 최적화 제안',
        },
      ],
    },
    {
      category: 'Webhooks',
      icon: Webhook,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      apis: [
        {
          method: 'POST',
          endpoint: '/api/webhooks',
          description: 'Webhook 등록',
        },
        {
          method: 'GET',
          endpoint: '/api/webhooks',
          description: 'Webhook 목록 조회',
        },
      ],
    },
  ];

  const authExample = `# 사이트 목록 조회
curl https://api.탄소이음.io/api/sites \\
  -H "Authorization: Bearer ea_live_YOUR_API_KEY"

# 디바이스 목록 조회
curl https://api.탄소이음.io/api/devices \\
  -H "Authorization: Bearer ea_live_YOUR_API_KEY"`;

  const responseExample = `{
  "success": true,
  "data": {
    "apiKey": "ea_live_1234567890abcdef",
    "name": "My API Key",
    "scopes": ["read:sites", "write:devices"],
    "createdAt": "2026-02-03T10:30:00Z",
    "expiresAt": null
  }
}`;

  const quickStart = [
    {
      step: '1',
      title: 'API 키 발급',
      description: '설정 페이지에서 API 키를 생성합니다',
      action: 'API 키 발급',
      href: '/settings/api',
    },
    {
      step: '2',
      title: '인증 헤더 설정',
      description: '모든 요청에 Authorization 헤더를 포함합니다',
      code: 'Authorization: Bearer ea_live_YOUR_API_KEY',
    },
    {
      step: '3',
      title: 'API 호출',
      description: 'REST API를 호출하여 데이터를 조회하거나 제어합니다',
      code: 'curl https://api.탄소이음.io/api/sites',
    },
    {
      step: '4',
      title: '응답 처리',
      description: 'JSON 형식의 응답을 파싱하여 애플리케이션에 통합합니다',
    },
  ];

  const sdks = [
    {
      name: 'Node.js',
      description: 'JavaScript/TypeScript SDK',
      install: 'npm install @탄소이음/sdk',
      example: `import { 탄소이음 } from '@탄소이음/sdk';

const client = new 탄소이음({
  apiKey: process.env.탄소이음_API_KEY
});

const sites = await client.sites.list();`,
    },
    {
      name: 'Python',
      description: 'Python SDK',
      install: 'pip install 탄소이음',
      example: `from 탄소이음 import 탄소이음

client = 탄소이음(api_key="ea_live_...")

sites = client.sites.list()`,
    },
    {
      name: 'cURL',
      description: '직접 HTTP 호출',
      install: '별도 설치 불필요',
      example: `curl https://api.탄소이음.io/api/sites \\
  -H "Authorization: Bearer ea_live_..."`,
    },
  ];

  const rateLimits = [
    { tier: 'Free', requests: '1,000 / 일', rateLimit: '10 / 분' },
    { tier: 'Pro', requests: '100,000 / 일', rateLimit: '100 / 분' },
    { tier: 'Enterprise', requests: '무제한', rateLimit: '1,000 / 분' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 rounded-full mb-6">
              <Code className="w-5 h-5 text-blue-400" />
              <span className="text-blue-400 font-semibold">API Documentation</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              탄소이음 API
            </h1>
            <p className="text-xl text-slate-300 max-w-3xl mx-auto mb-8">
              REST API, WebSocket, Webhook을 통해 탄소이음 플랫폼을 통합하세요
            </p>
            <div className="flex gap-4 justify-center">
              <Link href="/settings/api">
                <Button size="lg" className="bg-blue-500 hover:bg-blue-600">
                  <Key className="mr-2 w-5 h-5" />
                  API 키 발급
                </Button>
              </Link>
              <Link href="/docs/api/quickstart">
                <Button size="lg" variant="outline">
                  빠른 시작 →
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Start Section */}
      <section className="py-12 px-4 bg-slate-800/30">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">
            빠른 시작
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {quickStart.map((item, index) => (
              <div
                key={index}
                className="bg-slate-800 border border-slate-700 rounded-xl p-6"
              >
                <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mb-4">
                  <span className="text-2xl font-bold text-blue-400">
                    {item.step}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {item.title}
                </h3>
                <p className="text-slate-400 text-sm mb-4">{item.description}</p>
                {item.code && (
                  <div className="bg-slate-900 rounded p-3 text-xs font-mono text-green-400 overflow-x-auto">
                    {item.code}
                  </div>
                )}
                {item.action && (
                  <Link href={item.href || '#'}>
                    <Button size="sm" className="mt-4" variant="outline">
                      {item.action}
                    </Button>
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* API Endpoints Section */}
      <section className="py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-8">API 엔드포인트</h2>
          <div className="space-y-6">
            {endpoints.map((category, index) => (
              <div
                key={index}
                className="bg-slate-800 border border-slate-700 rounded-xl p-6"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div
                    className={`w-12 h-12 ${category.bgColor} rounded-lg flex items-center justify-center`}
                  >
                    <category.icon className={`w-6 h-6 ${category.color}`} />
                  </div>
                  <h3 className="text-2xl font-semibold text-white">
                    {category.category}
                  </h3>
                </div>
                <div className="space-y-3">
                  {category.apis.map((api, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-4 p-4 bg-slate-900 rounded-lg hover:bg-slate-850 transition-colors"
                    >
                      <span
                        className={`px-3 py-1 ${
                          api.method === 'GET'
                            ? 'bg-blue-500/20 text-blue-400'
                            : api.method === 'POST'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : api.method === 'WS'
                            ? 'bg-purple-500/20 text-purple-400'
                            : 'bg-slate-600 text-slate-300'
                        } rounded font-mono text-sm font-semibold`}
                      >
                        {api.method}
                      </span>
                      <code className="text-slate-300 font-mono text-sm flex-1">
                        {api.endpoint}
                      </code>
                      <span className="text-slate-400 text-sm">
                        {api.description}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Code Example Section */}
      <section className="py-12 px-4 bg-slate-800/30">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-8">예제 코드</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">요청</h3>
              <div className="bg-slate-900 rounded-xl p-6 relative">
                <button className="absolute top-4 right-4 p-2 hover:bg-slate-800 rounded transition-colors">
                  <Copy className="w-4 h-4 text-slate-400" />
                </button>
                <pre className="text-sm text-green-400 overflow-x-auto">
                  {authExample}
                </pre>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">응답</h3>
              <div className="bg-slate-900 rounded-xl p-6 relative">
                <button className="absolute top-4 right-4 p-2 hover:bg-slate-800 rounded transition-colors">
                  <Copy className="w-4 h-4 text-slate-400" />
                </button>
                <pre className="text-sm text-blue-400 overflow-x-auto">
                  {responseExample}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SDKs Section */}
      <section className="py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-8">SDK 라이브러리</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {sdks.map((sdk, index) => (
              <div
                key={index}
                className="bg-slate-800 border border-slate-700 rounded-xl p-6"
              >
                <h3 className="text-xl font-semibold text-white mb-2">
                  {sdk.name}
                </h3>
                <p className="text-slate-400 text-sm mb-4">{sdk.description}</p>
                <div className="bg-slate-900 rounded p-3 text-xs font-mono text-emerald-400 mb-4">
                  {sdk.install}
                </div>
                <div className="bg-slate-900 rounded p-3 text-xs font-mono text-slate-300 overflow-x-auto">
                  <pre>{sdk.example}</pre>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Rate Limits Section */}
      <section className="py-12 px-4 bg-slate-800/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">
            API 사용 한도
          </h2>
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-900">
                <tr>
                  <th className="px-6 py-4 text-left text-white font-semibold">
                    요금제
                  </th>
                  <th className="px-6 py-4 text-left text-white font-semibold">
                    일일 요청 수
                  </th>
                  <th className="px-6 py-4 text-left text-white font-semibold">
                    분당 요청 수
                  </th>
                </tr>
              </thead>
              <tbody>
                {rateLimits.map((limit, index) => (
                  <tr
                    key={index}
                    className="border-t border-slate-700 hover:bg-slate-700/50 transition-colors"
                  >
                    <td className="px-6 py-4 text-white font-semibold">
                      {limit.tier}
                    </td>
                    <td className="px-6 py-4 text-slate-300">{limit.requests}</td>
                    <td className="px-6 py-4 text-slate-300">{limit.rateLimit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-white mb-4">
            API 통합을 시작할 준비가 되셨나요?
          </h2>
          <p className="text-xl text-slate-300 mb-8">
            지금 바로 API 키를 발급받고 통합을 시작하세요
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/settings/api">
              <Button size="lg" className="bg-blue-500 hover:bg-blue-600">
                API 키 발급
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="/support">
              <Button size="lg" variant="outline">
                기술 지원 문의
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
