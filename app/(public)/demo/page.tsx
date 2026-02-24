import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import {
  Zap,
  BarChart3,
  Activity,
  ArrowRight,
  CheckCircle,
  PlayCircle,
  Monitor,
  Smartphone,
  TrendingUp,
} from 'lucide-react';

export const metadata = {
  title: '데모 보기 - 탄소이음',
  description:
    '탄소이음 에너지 관리 플랫폼의 실시간 데모를 체험하세요. AI 부하 예측, 이상 탐지, 에너지 최적화 대시보드를 직접 확인할 수 있습니다.',
  openGraph: {
    title: '데모 보기 - 탄소이음',
    description: 'AI 기반 에너지 관리 플랫폼 실시간 데모 체험',
  },
};

export default function DemoPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-slate-900/95 backdrop-blur-lg shadow-lg border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group">
              <div className="relative">
                <Zap className="w-8 h-8 text-emerald-400 group-hover:text-emerald-300 transition-colors" />
                <div className="absolute inset-0 bg-emerald-400 blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
              </div>
              <span className="font-bold text-xl text-white">
                Energy<span className="text-emerald-400">AI</span>
              </span>
            </Link>

            {/* CTA Buttons */}
            <div className="flex gap-3">
              <Link href="/login">
                <Button variant="outline" size="sm">
                  로그인
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600">
                  무료 시작
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-sm mb-8">
              <PlayCircle className="w-4 h-4" />
              라이브 데모
            </div>

            <h1 className="text-5xl sm:text-6xl font-bold text-white mb-6 leading-tight">
              탄소이음 플랫폼
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">
                실시간 데모
              </span>
            </h1>

            <p className="text-xl text-slate-300 mb-8 max-w-3xl mx-auto leading-relaxed">
              AI 기반 에너지 관리 시스템의 모든 기능을 직접 체험해보세요.
              <br />
              실제 데이터와 동일한 환경에서 테스트할 수 있습니다.
            </p>
          </div>
        </div>
      </section>

      {/* Demo Access Section */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-8 md:p-12">
            <div className="flex flex-col md:flex-row gap-8 items-center">
              <div className="flex-1">
                <h2 className="text-3xl font-bold text-white mb-4">
                  데모 계정으로 시작하기
                </h2>
                <p className="text-slate-300 mb-6 leading-relaxed">
                  완전히 기능하는 데모 환경에서 탄소이음의 모든 기능을 탐색하세요.
                  샘플 데이터가 미리 로드되어 있어 즉시 시작할 수 있습니다.
                </p>

                <div className="bg-slate-900/50 border border-emerald-500/30 rounded-lg p-6 mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Monitor className="w-5 h-5 text-emerald-400" />
                    <h3 className="font-semibold text-white">데모 계정 정보</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">이메일:</span>
                      <code className="text-emerald-400 bg-slate-800 px-2 py-1 rounded">
                        demo@탄소이음.com
                      </code>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">비밀번호:</span>
                      <code className="text-emerald-400 bg-slate-800 px-2 py-1 rounded">
                        demo1234
                      </code>
                    </div>
                    <p className="text-slate-400 text-xs mt-3">
                      * 데모 계정은 읽기 전용 권한을 가지고 있으며, 모든 기능을 안전하게 체험할 수 있습니다.
                    </p>
                  </div>
                </div>

                <Link href="/login">
                  <Button
                    size="lg"
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-6 text-lg w-full md:w-auto"
                  >
                    데모 계정으로 로그인
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
              </div>

              <div className="flex-shrink-0">
                <div className="relative w-48 h-48 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 rounded-full flex items-center justify-center">
                  <Zap className="w-24 h-24 text-emerald-400" />
                  <div className="absolute inset-0 bg-emerald-400 blur-3xl opacity-20" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Preview */}
      <section className="py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-8">
            데모에서 체험할 수 있는 기능
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">실시간 대시보드</h3>
              </div>
              <p className="text-slate-300 text-sm">
                에너지 소비, 비용, 효율을 실시간으로 모니터링하세요.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">AI 예측</h3>
              </div>
              <p className="text-slate-300 text-sm">
                머신러닝 기반 부하 예측 및 비용 절감 추천을 확인하세요.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <Activity className="w-6 h-6 text-orange-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">이상 탐지</h3>
              </div>
              <p className="text-slate-300 text-sm">
                실시간 이상 패턴 감지 및 알림 시스템을 경험하세요.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Monitor className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">사이트 관리</h3>
              </div>
              <p className="text-slate-300 text-sm">
                여러 사이트의 에너지 데이터를 통합 관리하세요.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-yellow-500/10 rounded-lg">
                  <Smartphone className="w-6 h-6 text-yellow-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">모바일 최적화</h3>
              </div>
              <p className="text-slate-300 text-sm">
                모바일 디바이스에서도 완벽하게 작동하는 반응형 UI를 체험하세요.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">리포트 생성</h3>
              </div>
              <p className="text-slate-300 text-sm">
                자동화된 에너지 리포트 및 ESG 보고서를 생성하세요.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            준비되셨나요?
          </h2>
          <p className="text-xl text-slate-300 mb-8">
            데모를 체험하거나 직접 계정을 생성하여 시작하세요.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/login">
              <Button
                size="lg"
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-6 text-lg"
              >
                데모 로그인
                <PlayCircle className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="/register">
              <Button
                size="lg"
                variant="outline"
                className="px-8 py-6 text-lg"
              >
                무료 계정 생성
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-8 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-slate-400 text-sm">
            © 2026 탄소이음 Platform. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
