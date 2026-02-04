import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import {
  Server,
  Wind,
  Thermometer,
  TrendingDown,
  Shield,
  Zap,
  ArrowRight,
  Activity,
} from 'lucide-react';

/**
 * 데이터센터 솔루션 페이지
 * 데이터센터의 냉각 및 전력 효율 최적화 솔루션
 */
export const metadata = {
  title: '데이터센터 에너지 관리 솔루션 - EnergyAI',
  description:
    '데이터센터의 PUE를 1.2 이하로 낮추고 냉각 효율을 극대화하는 AI 기반 솔루션',
};

export default function DatacenterSolutionPage() {
  const features = [
    {
      icon: Thermometer,
      title: '정밀 냉각 제어',
      description:
        '서버 랙별 열 분포를 실시간 분석하고 냉각 시스템을 동적으로 조절하여 핫스팟을 제거합니다.',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      icon: Zap,
      title: 'PUE 최적화',
      description:
        'Power Usage Effectiveness를 실시간 모니터링하고 IT 부하와 인프라 전력을 최적 비율로 유지합니다.',
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
    },
    {
      icon: Wind,
      title: '냉각 효율 극대화',
      description:
        '외부 온도, 서버 부하, 공기 흐름을 분석하여 Free Cooling과 기계식 냉각을 최적으로 조합합니다.',
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
    },
    {
      icon: Activity,
      title: 'AI 기반 부하 예측',
      description:
        '서버 워크로드 패턴을 학습하여 전력 수요를 예측하고 예비 전력을 효율적으로 관리합니다.',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
    },
  ];

  const metrics = [
    {
      label: 'PUE 개선',
      value: '1.2 이하',
      description: '업계 최고 수준',
      icon: Zap,
    },
    {
      label: '냉각 비용 절감',
      value: '최대 45%',
      description: '연간 수억원 절감',
      icon: TrendingDown,
    },
    {
      label: '가동 시간',
      value: '99.99%',
      description: 'Tier III 수준',
      icon: Shield,
    },
    {
      label: 'DCIM 통합',
      value: '완벽 지원',
      description: '기존 시스템 연동',
      icon: Server,
    },
  ];

  const challenges = [
    {
      title: '높은 전력 밀도',
      problem:
        '랙당 15-20kW 이상의 고밀도 서버 증가로 냉각 부하 급증 및 핫스팟 발생',
      solution:
        'AI 기반 랙별 온도 예측 및 콜드 아일/핫 아일 최적 배치, 동적 냉각 제어',
      result: '핫스팟 제거, 냉각 에너지 35% 절감',
    },
    {
      title: '냉각 비효율',
      problem:
        '전체 전력의 40%가 냉각에 사용되며 과냉각으로 인한 에너지 낭비 심각',
      solution:
        '실시간 온습도 센서 데이터 기반 정밀 제어 및 Free Cooling 최대 활용',
      result: 'PUE 1.8 → 1.15 개선, 연간 12억원 절감',
    },
    {
      title: '가용성 vs 효율',
      problem:
        '안정성을 위한 과도한 예비 전력 및 냉각 용량으로 효율 저하',
      solution:
        'N+1 리던던시 기반 AI 부하 예측 및 동적 리소스 할당',
      result: '가용성 99.99% 유지하며 전력 효율 30% 개선',
    },
  ];

  const dcimFeatures = [
    {
      category: '전력 관리',
      items: [
        'UPS/PDU 실시간 모니터링',
        '전력 용량 계획 및 예측',
        '부하 분산 자동화',
        '전력 품질 분석',
      ],
    },
    {
      category: '냉각 관리',
      items: [
        'CRAC/CRAH 최적 제어',
        'CFD 기반 공기 흐름 분석',
        '냉각수 온도 최적화',
        'Free Cooling 자동 전환',
      ],
    },
    {
      category: '자산 관리',
      items: [
        '서버/네트워크 자산 추적',
        '랙 공간 활용 최적화',
        '케이블링 관리',
        '수명 주기 예측',
      ],
    },
    {
      category: '환경 관리',
      items: [
        '온습도 실시간 모니터링',
        '누수 감지 시스템',
        '연기 감지 및 화재 예방',
        'DCIM 대시보드 통합',
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section */}
      <section className="relative py-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10" />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/10 rounded-full mb-6">
              <Server className="w-5 h-5 text-cyan-400" />
              <span className="text-cyan-400 font-semibold">
                Datacenter Solutions
              </span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              데이터센터 에너지 최적화
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
                PUE 1.2 이하 달성
              </span>
            </h1>
            <p className="text-xl text-slate-300 max-w-3xl mx-auto mb-8">
              AI 기반 정밀 냉각 제어와 전력 관리로 데이터센터의 운영 효율을
              극대화하고
              <br />
              99.99% 가용성을 유지하면서 에너지 비용을 최대 45% 절감하세요
            </p>
            <div className="flex gap-4 justify-center">
              <Link href="/register">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white"
                >
                  무료 PUE 진단
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link href="/demo">
                <Button size="lg" variant="outline">
                  데모 신청
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Metrics Section */}
      <section className="py-16 px-4 bg-slate-800/30">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            데이터센터 성능 지표
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {metrics.map((metric, index) => (
              <div
                key={index}
                className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-center hover:border-cyan-500/50 transition-all"
              >
                <metric.icon className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
                <div className="text-3xl font-bold text-white mb-2">
                  {metric.value}
                </div>
                <div className="text-slate-400 mb-1">{metric.label}</div>
                <div className="text-xs text-slate-500">{metric.description}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-white text-center mb-12">
            핵심 기술
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-8 hover:border-cyan-500/50 hover:shadow-xl transition-all"
              >
                <div
                  className={`w-16 h-16 ${feature.bgColor} rounded-lg flex items-center justify-center mb-6`}
                >
                  <feature.icon className={`w-8 h-8 ${feature.color}`} />
                </div>
                <h3 className="text-2xl font-semibold text-white mb-4">
                  {feature.title}
                </h3>
                <p className="text-slate-300 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Challenges Section */}
      <section className="py-20 px-4 bg-slate-800/30">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-white text-center mb-12">
            데이터센터 과제 해결
          </h2>
          <div className="space-y-6">
            {challenges.map((challenge, index) => (
              <div
                key={index}
                className="bg-slate-800 border border-slate-700 rounded-xl p-8 hover:border-cyan-500/50 transition-all"
              >
                <h3 className="text-2xl font-semibold text-white mb-6">
                  {challenge.title}
                </h3>
                <div className="grid md:grid-cols-3 gap-6">
                  <div>
                    <div className="text-sm font-semibold text-red-400 mb-3">
                      문제점
                    </div>
                    <div className="text-slate-300 text-sm">
                      {challenge.problem}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-blue-400 mb-3">
                      솔루션
                    </div>
                    <div className="text-slate-300 text-sm">
                      {challenge.solution}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-emerald-400 mb-3">
                      성과
                    </div>
                    <div className="text-emerald-400 font-semibold text-sm">
                      {challenge.result}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DCIM Features Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-white text-center mb-4">
            통합 DCIM 기능
          </h2>
          <p className="text-xl text-slate-400 text-center mb-12">
            Data Center Infrastructure Management
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {dcimFeatures.map((feature, index) => (
              <div
                key={index}
                className="bg-slate-800 border border-slate-700 rounded-xl p-6 hover:border-cyan-500/50 transition-all"
              >
                <h3 className="text-lg font-semibold text-white mb-4">
                  {feature.category}
                </h3>
                <ul className="space-y-2">
                  {feature.items.map((item, idx) => (
                    <li
                      key={idx}
                      className="text-sm text-slate-300 flex items-start gap-2"
                    >
                      <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full mt-1.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-slate-800/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            데이터센터 효율을
            <br />
            다음 단계로 끌어올리세요
          </h2>
          <p className="text-xl text-slate-300 mb-8">
            무료 PUE 진단으로 개선 가능한 영역을 파악하세요
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/register">
              <Button
                size="lg"
                className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white"
              >
                무료 진단 시작
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline">
                요금제 보기
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
