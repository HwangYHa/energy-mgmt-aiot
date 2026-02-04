import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import {
  Factory,
  TrendingDown,
  Zap,
  BarChart3,
  Shield,
  Clock,
  ArrowRight,
} from 'lucide-react';

/**
 * 제조업 솔루션 페이지
 * 제조 현장의 에너지 효율 최적화 솔루션
 */
export const metadata = {
  title: '제조업 에너지 관리 솔루션 - EnergyAI',
  description:
    '제조 현장의 에너지 비용을 최대 30% 절감하는 AI 기반 에너지 관리 솔루션',
};

export default function ManufacturingSolutionPage() {
  const features = [
    {
      icon: Zap,
      title: '실시간 설비 모니터링',
      description:
        '생산 라인별 전력 사용량을 실시간으로 모니터링하고 이상 패턴을 즉시 감지합니다.',
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
    },
    {
      icon: TrendingDown,
      title: '피크 부하 관리',
      description:
        'AI 예측을 통해 피크 타임을 분석하고 설비 가동 시간을 최적화하여 전력 요금을 절감합니다.',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
    },
    {
      icon: BarChart3,
      title: '생산 효율 분석',
      description:
        '에너지 사용량과 생산량의 상관관계를 분석하여 최적의 에너지 효율 포인트를 제시합니다.',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      icon: Shield,
      title: '설비 예지 보전',
      description:
        '에너지 소비 패턴 변화를 통해 설비 고장을 사전에 예측하고 예방 보전을 실시합니다.',
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
    },
  ];

  const benefits = [
    { label: '전력 비용 절감', value: '평균 30%', icon: TrendingDown },
    { label: '생산 효율 향상', value: '최대 25%', icon: BarChart3 },
    { label: '설비 가동률', value: '95% 이상', icon: Zap },
    { label: 'ROI 달성', value: '12개월 이내', icon: Clock },
  ];

  const useCases = [
    {
      company: 'A 자동차 부품 제조사',
      industry: '자동차 부품',
      challenge: '24시간 가동 중 피크 시간대 높은 전력 요금',
      solution: 'AI 기반 부하 예측 및 생산 스케줄 최적화',
      result: '월 전력 비용 3,200만원 절감 (연간 3.8억원)',
    },
    {
      company: 'B 식품 제조 공장',
      industry: '식품 제조',
      challenge: '냉동/냉장 설비의 높은 에너지 소비',
      solution: '실시간 온도 관리 및 압축기 효율 최적화',
      result: '에너지 효율 28% 개선, 품질 클레임 45% 감소',
    },
    {
      company: 'C 전자부품 제조사',
      industry: '전자 부품',
      challenge: '클린룸 공조 시스템의 과도한 에너지 소비',
      solution: '외부 날씨 연동 공조 자동 제어 시스템',
      result: '공조 에너지 35% 절감, 클린룸 등급 유지',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section */}
      <section className="relative py-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 to-emerald-500/10" />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/10 rounded-full mb-6">
              <Factory className="w-5 h-5 text-yellow-400" />
              <span className="text-yellow-400 font-semibold">
                Manufacturing Solutions
              </span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              제조업 에너지 관리
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-emerald-400">
                스마트 팩토리 실현
              </span>
            </h1>
            <p className="text-xl text-slate-300 max-w-3xl mx-auto mb-8">
              AI 기반 실시간 모니터링과 예측 분석으로 제조 현장의 에너지
              효율을 극대화하고
              <br />
              생산성을 향상시키는 통합 에너지 관리 솔루션
            </p>
            <div className="flex gap-4 justify-center">
              <Link href="/register">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-yellow-500 to-emerald-500 hover:from-yellow-600 hover:to-emerald-600 text-white"
                >
                  무료 체험 시작
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

      {/* Benefits Section */}
      <section className="py-16 px-4 bg-slate-800/30">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            제조업 특화 성과
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-center hover:border-emerald-500/50 transition-all"
              >
                <benefit.icon className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
                <div className="text-3xl font-bold text-white mb-2">
                  {benefit.value}
                </div>
                <div className="text-slate-400">{benefit.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-white text-center mb-12">
            주요 기능
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-8 hover:border-emerald-500/50 hover:shadow-xl transition-all"
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

      {/* Use Cases Section */}
      <section className="py-20 px-4 bg-slate-800/30">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-white text-center mb-12">
            실제 적용 사례
          </h2>
          <div className="space-y-6">
            {useCases.map((useCase, index) => (
              <div
                key={index}
                className="bg-slate-800 border border-slate-700 rounded-xl p-8 hover:border-emerald-500/50 transition-all"
              >
                <div className="flex items-start gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                      <Factory className="w-8 h-8 text-emerald-400" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-xl font-semibold text-white">
                        {useCase.company}
                      </h3>
                      <span className="px-3 py-1 bg-blue-500/10 text-blue-400 text-sm rounded-full">
                        {useCase.industry}
                      </span>
                    </div>
                    <div className="grid md:grid-cols-3 gap-6 text-sm">
                      <div>
                        <div className="text-slate-400 mb-2">도전 과제</div>
                        <div className="text-slate-200">{useCase.challenge}</div>
                      </div>
                      <div>
                        <div className="text-slate-400 mb-2">적용 솔루션</div>
                        <div className="text-slate-200">{useCase.solution}</div>
                      </div>
                      <div>
                        <div className="text-slate-400 mb-2">성과</div>
                        <div className="text-emerald-400 font-semibold">
                          {useCase.result}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            제조 현장의 에너지 효율을
            <br />
            지금 바로 개선하세요
          </h2>
          <p className="text-xl text-slate-300 mb-8">
            30일 무료 체험으로 실제 절감 효과를 직접 확인해보세요
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/register">
              <Button
                size="lg"
                className="bg-gradient-to-r from-yellow-500 to-emerald-500 hover:from-yellow-600 hover:to-emerald-600 text-white"
              >
                무료 체험 시작
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
