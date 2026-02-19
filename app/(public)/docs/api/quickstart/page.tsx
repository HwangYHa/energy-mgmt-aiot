import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import {
  ArrowRight,
  ArrowLeft,
  Key,
  Code,
  Zap,
  CheckCircle,
  Copy,
  Terminal,
  Shield,
} from 'lucide-react';

export const metadata = {
  title: 'API 빠른 시작 - EnergyAI',
  description:
    'EnergyAI REST API를 5분 만에 시작하세요. API 키 발급부터 첫 번째 API 호출까지 단계별 가이드.',
  openGraph: {
    title: 'API 빠른 시작 가이드 - EnergyAI',
    description: '5분 만에 EnergyAI API를 시작하는 단계별 가이드',
  },
};

export default function APIQuickstartPage() {
  const steps = [
    {
      number: 1,
      title: '회원가입 및 로그인',
      description: 'EnergyAI 계정을 만들고 대시보드에 접속합니다.',
      icon: Shield,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      code: null,
      note: '이미 계정이 있다면 이 단계를 건너뛰세요.',
      action: { label: '회원가입', href: '/register' },
    },
    {
      number: 2,
      title: 'API 키 발급',
      description:
        '로그인 후 설정 > API 키 관리 페이지에서 API 키를 생성합니다.',
      icon: Key,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      code: `// 1. 로그인 후 설정 > API 키 관리 이동
//    https://your-domain.com/settings/api
//
// 2. "새 API 키" 버튼 클릭 → 이름, 권한 범위 설정
//
// 3. 생성된 API 키를 안전한 곳에 저장
//    예: ea_live_aBcDeFgHiJkLmNoPqRsT...`,
      note: 'API 키는 생성 시 한 번만 표시됩니다. 안전한 곳에 저장하세요.',
      action: { label: 'API 키 관리', href: '/settings/api' },
    },
    {
      number: 3,
      title: '첫 번째 API 호출',
      description: '사이트 목록을 조회하여 API 연동이 정상 동작하는지 확인합니다.',
      icon: Terminal,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
      code: `# 사이트 목록 조회
curl https://api.energyai.io/api/sites \\
  -H "Authorization: Bearer ea_live_YOUR_API_KEY"

# 응답 예시
{
  "success": true,
  "data": [
    {
      "id": "site_abc123",
      "name": "서울 본사",
      "industry": "building",
      "devices": 15,
      "status": "active"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 20
  }
}`,
    },
    {
      number: 4,
      title: '데이터 조회 및 활용',
      description:
        '실시간 에너지 데이터를 조회하고, AI 분석 기능을 활용합니다.',
      icon: Zap,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      code: `# 실시간 전력 데이터 조회
curl https://api.energyai.io/api/realtime?siteId=site_abc123 \\
  -H "Authorization: Bearer ea_live_YOUR_API_KEY"

# AI 부하 예측 실행
curl -X POST https://api.energyai.io/api/ai/forecast \\
  -H "Authorization: Bearer ea_live_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "siteId": "site_abc123",
    "horizon": "24h",
    "granularity": "1h"
  }'`,
    },
  ];

  const sdkExamples = [
    {
      lang: 'Node.js / TypeScript',
      install: 'npm install @energyai/sdk',
      code: `import { EnergyAI } from '@energyai/sdk';

const client = new EnergyAI({
  apiKey: process.env.ENERGYAI_API_KEY!
});

// 사이트 목록 조회
const sites = await client.sites.list();
console.log(sites);

// AI 부하 예측
const forecast = await client.ai.forecast({
  siteId: 'site_abc123',
  horizon: '24h'
});
console.log(forecast.predictions);`,
    },
    {
      lang: 'Python',
      install: 'pip install energyai',
      code: `from energyai import EnergyAI

client = EnergyAI(api_key="ea_live_YOUR_API_KEY")

# 사이트 목록 조회
sites = client.sites.list()
print(sites)

# AI 부하 예측
forecast = client.ai.forecast(
    site_id="site_abc123",
    horizon="24h"
)
print(forecast.predictions)`,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/docs/api"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-emerald-400 transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            API 문서로 돌아가기
          </Link>

          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-full mb-6">
            <Zap className="w-5 h-5 text-emerald-400" />
            <span className="text-emerald-400 font-semibold">Quick Start</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            API 빠른 시작 가이드
          </h1>
          <p className="text-xl text-slate-300 mb-2">
            5분 만에 EnergyAI API를 시작하세요
          </p>
          <p className="text-slate-400">
            이 가이드를 따라 API 키를 발급받고 첫 번째 API 호출을 해보세요.
          </p>
        </div>
      </section>

      {/* Steps */}
      <section className="py-8 px-4">
        <div className="max-w-4xl mx-auto space-y-8">
          {steps.map((step) => (
            <div
              key={step.number}
              className="bg-slate-800 border border-slate-700 rounded-xl p-8"
            >
              <div className="flex items-start gap-5">
                <div
                  className={`w-14 h-14 ${step.bgColor} rounded-xl flex items-center justify-center flex-shrink-0`}
                >
                  <span className={`text-2xl font-bold ${step.color}`}>
                    {step.number}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <step.icon className={`w-5 h-5 ${step.color}`} />
                    <h2 className="text-xl font-bold text-white">
                      {step.title}
                    </h2>
                  </div>
                  <p className="text-slate-300 mb-4">{step.description}</p>

                  {step.code && (
                    <div className="bg-slate-900 rounded-xl p-5 mb-4 relative group">
                      <button
                        className="absolute top-3 right-3 p-2 hover:bg-slate-800 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="복사"
                      >
                        <Copy className="w-4 h-4 text-slate-400" />
                      </button>
                      <pre className="text-sm text-green-400 overflow-x-auto whitespace-pre-wrap">
                        {step.code}
                      </pre>
                    </div>
                  )}

                  {step.note && (
                    <div className="flex items-start gap-2 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
                      <CheckCircle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-yellow-300/80">
                        {step.note}
                      </span>
                    </div>
                  )}

                  {step.action && (
                    <Link href={step.action.href} className="inline-block mt-4">
                      <Button variant="outline" size="sm">
                        {step.action.label}
                        <ArrowRight className="ml-2 w-4 h-4" />
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SDK Examples */}
      <section className="py-12 px-4 bg-slate-800/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-8">
            <Code className="inline w-7 h-7 text-emerald-400 mr-2" />
            SDK 사용 예시
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {sdkExamples.map((sdk, index) => (
              <div
                key={index}
                className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden"
              >
                <div className="flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-slate-700">
                  <span className="text-white font-semibold text-sm">
                    {sdk.lang}
                  </span>
                  <code className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">
                    {sdk.install}
                  </code>
                </div>
                <div className="p-5">
                  <pre className="text-sm text-slate-300 overflow-x-auto whitespace-pre-wrap">
                    {sdk.code}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Next Steps */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-8">다음 단계</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                title: 'API 엔드포인트',
                desc: '전체 API 레퍼런스 확인',
                href: '/docs/api',
              },
              {
                title: 'AI 기능 활용',
                desc: '부하 예측, 이상 탐지 가이드',
                href: '/docs/getting-started',
              },
              {
                title: '기술 지원',
                desc: '질문이 있으시면 문의하세요',
                href: '/support',
              },
            ].map((item, index) => (
              <Link key={index} href={item.href}>
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-emerald-500/50 transition-all group">
                  <h3 className="text-white font-semibold mb-1 group-hover:text-emerald-400 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-slate-400 text-sm">{item.desc}</p>
                  <ArrowRight className="w-4 h-4 text-emerald-400 mt-3 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
