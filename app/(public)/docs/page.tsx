import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import {
  Book,
  Code,
  Rocket,
  Settings,
  Users,
  Zap,
  ArrowRight,
  FileText,
  Globe,
  Shield,
} from 'lucide-react';

/**
 * 문서화 메인 페이지
 */
export const metadata = {
  title: '문서 - EnergyAI',
  description: 'EnergyAI 플랫폼 사용 가이드 및 API 문서',
};

export default function DocsPage() {
  const categories = [
    {
      icon: Rocket,
      title: '시작하기',
      description: 'EnergyAI를 처음 사용하시나요? 빠른 시작 가이드를 확인하세요',
      href: '/docs/getting-started',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      topics: ['초기 설정', '첫 사이트 등록', '디바이스 연결', '대시보드 설정'],
    },
    {
      icon: Code,
      title: 'API 문서',
      description: 'REST API를 사용하여 EnergyAI를 통합하세요',
      href: '/docs/api',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      topics: ['인증', 'REST API', 'WebSocket', 'Webhooks'],
    },
    {
      icon: Settings,
      title: '시스템 설정',
      description: '사이트, 디바이스, 사용자 관리 방법을 알아보세요',
      href: '/docs/system',
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      topics: ['사이트 관리', '디바이스 설정', '알림 규칙', 'DR 설정'],
    },
    {
      icon: Zap,
      title: 'AI 기능',
      description: 'AI 부하 예측, 이상 탐지, 최적화 기능 활용법',
      href: '/docs/ai',
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
      topics: ['부하 예측', '이상 탐지', '에너지 최적화', '리포트 생성'],
    },
    {
      icon: Users,
      title: '사용자 관리',
      description: '권한 관리 및 팀 협업 기능 사용법',
      href: '/docs/users',
      color: 'text-pink-400',
      bgColor: 'bg-pink-500/10',
      topics: ['역할 관리', '권한 설정', '팀 초대', 'SSO 설정'],
    },
    {
      icon: Shield,
      title: '보안 & 규정',
      description: '보안 설정 및 규정 준수 가이드',
      href: '/docs/security',
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      topics: ['보안 설정', '감사 로그', 'ISO 50001', 'GDPR'],
    },
  ];

  const quickLinks = [
    { title: 'API 키 발급', href: '/settings/api', icon: Code },
    { title: '요금제 업그레이드', href: '/pricing', icon: Zap },
    { title: '고객 지원', href: '/support', icon: Users },
    { title: '커뮤니티', href: '/community', icon: Globe },
  ];

  const popularDocs = [
    {
      title: '5분 만에 시작하기',
      description: '계정 생성부터 첫 번째 모니터링까지',
      href: '/docs/getting-started',
      readTime: '5분',
    },
    {
      title: 'REST API 인증',
      description: 'API 키 발급 및 인증 방법',
      href: '/docs/api/auth',
      readTime: '3분',
    },
    {
      title: 'AI 부하 예측 활용',
      description: 'LSTM 모델로 전력 수요 예측하기',
      href: '/docs/ai/forecast',
      readTime: '8분',
    },
    {
      title: '디바이스 연동 가이드',
      description: 'Modbus, MQTT, REST API로 디바이스 연결',
      href: '/docs/device-integration',
      readTime: '10분',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-full mb-6">
              <Book className="w-5 h-5 text-emerald-400" />
              <span className="text-emerald-400 font-semibold">Documentation</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              EnergyAI 문서
            </h1>
            <p className="text-xl text-slate-300 max-w-3xl mx-auto mb-8">
              플랫폼 사용 가이드, API 문서, 튜토리얼 등 필요한 모든 정보를
              제공합니다
            </p>

            {/* Search Bar */}
            <div className="max-w-2xl mx-auto">
              <div className="relative">
                <input
                  type="text"
                  placeholder="문서 검색... (예: AI 예측, API 인증, 사이트 등록)"
                  className="w-full px-6 py-4 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                />
                <button className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors">
                  검색
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-8">문서 카테고리</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((category, index) => (
              <Link key={index} href={category.href}>
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 hover:border-emerald-500/50 hover:shadow-xl transition-all group">
                  <div
                    className={`w-12 h-12 ${category.bgColor} rounded-lg flex items-center justify-center mb-4`}
                  >
                    <category.icon className={`w-6 h-6 ${category.color}`} />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-emerald-400 transition-colors">
                    {category.title}
                  </h3>
                  <p className="text-slate-400 text-sm mb-4">
                    {category.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {category.topics.map((topic, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Docs Section */}
      <section className="py-12 px-4 bg-slate-800/30">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-8">인기 문서</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {popularDocs.map((doc, index) => (
              <Link key={index} href={doc.href}>
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 hover:border-emerald-500/50 transition-all group">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-semibold text-white group-hover:text-emerald-400 transition-colors">
                      {doc.title}
                    </h3>
                    <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-xs rounded flex-shrink-0">
                      {doc.readTime}
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm">{doc.description}</p>
                  <div className="flex items-center gap-2 mt-4 text-emerald-400 text-sm group-hover:gap-3 transition-all">
                    <span>읽어보기</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Links Section */}
      <section className="py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-8">빠른 링크</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {quickLinks.map((link, index) => (
              <Link key={index} href={link.href}>
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 hover:border-emerald-500/50 transition-all text-center group">
                  <link.icon className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
                  <div className="text-white font-semibold group-hover:text-emerald-400 transition-colors">
                    {link.title}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Help Section */}
      <section className="py-12 px-4 bg-slate-800/30">
        <div className="max-w-4xl mx-auto text-center">
          <FileText className="w-16 h-16 text-emerald-400 mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-white mb-4">
            원하는 정보를 찾지 못하셨나요?
          </h2>
          <p className="text-xl text-slate-300 mb-8">
            고객 지원팀이 도와드리겠습니다
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/support">
              <Button size="lg" className="bg-emerald-500 hover:bg-emerald-600">
                고객 지원 문의
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="/community">
              <Button size="lg" variant="outline">
                커뮤니티 방문
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
