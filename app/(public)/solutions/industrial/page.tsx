import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import {
  Hammer,
  Gauge,
  TrendingDown,
  Recycle,
  AlertTriangle,
  LineChart,
  CheckCircle,
  ArrowRight,
  Wrench,
} from 'lucide-react';

/**
 * 산업 솔루션 페이지
 * 중공업, 화학, 제철 등 에너지 집약 산업 최적화
 */
export const metadata = {
  title: '산업 에너지 관리 솔루션 - EnergyAI',
  description:
    '중공업, 화학, 제철 등 에너지 집약 산업의 에너지 효율을 극대화하고 탄소 배출을 저감',
};

export default function IndustrialSolutionPage() {
  const features = [
    {
      icon: Gauge,
      title: '공정 에너지 최적화',
      description:
        '생산 공정별 에너지 소비 패턴을 분석하고 최적 운전 조건을 실시간으로 제시합니다.',
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/10',
    },
    {
      icon: Recycle,
      title: '폐열 회수 극대화',
      description:
        '공정에서 발생하는 폐열을 감지하고 회수 시스템을 자동으로 제어하여 에너지를 재활용합니다.',
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
    },
    {
      icon: AlertTriangle,
      title: '에너지 이상 탐지',
      description:
        '설비의 비정상적인 에너지 소비를 실시간으로 감지하여 고장을 사전에 예방합니다.',
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
    },
    {
      icon: LineChart,
      title: '수요 관리 자동화',
      description:
        '전력 시장 가격과 생산 계획을 고려하여 최적의 에너지 사용 시점을 자동으로 계획합니다.',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
  ];

  const industries = [
    {
      name: '제철/제강',
      icon: Hammer,
      description: '용광로, 전기로 등 고온 공정의 에너지 효율 최적화',
      challenges: [
        '막대한 에너지 소비 (전체 제조업의 30%)',
        '공정 특성상 24시간 연속 가동',
        '높은 탄소 배출량',
      ],
      solutions: [
        '용광로 온도 AI 제어',
        '폐가스 열 회수 시스템',
        '전력 피크 시프팅',
      ],
      savings: '연간 50억원 이상 절감',
    },
    {
      name: '화학/정유',
      icon: Wrench,
      description: '반응기, 증류탑 등 화학 공정의 에너지 관리',
      challenges: [
        '복잡한 공정 변수와 에너지 상관관계',
        '엄격한 품질 기준 유지 필요',
        '안전성과 효율성의 균형',
      ],
      solutions: [
        '반응 조건 실시간 최적화',
        '증기 네트워크 밸런싱',
        '공정 통합 에너지 관리',
      ],
      savings: '생산 단위당 에너지 20% 절감',
    },
    {
      name: '시멘트/요업',
      icon: Gauge,
      description: '소성로, 건조로 등 고온 건조 공정 최적화',
      challenges: [
        '소성로의 높은 에너지 집약도',
        '원료 특성 변화에 따른 불안정성',
        '대기오염물질 관리',
      ],
      solutions: [
        '소성 온도 프로파일 최적화',
        '배기가스 폐열 활용',
        '원료 배합 자동 조절',
      ],
      savings: '톤당 에너지 비용 25% 감소',
    },
  ];

  const benefits = [
    {
      label: '에너지 비용',
      value: '30-40% 절감',
      description: '공정 최적화',
      icon: TrendingDown,
    },
    {
      label: '탄소 배출',
      value: '50% 감축',
      description: 'RE100 대응',
      icon: Recycle,
    },
    {
      label: '설비 가동률',
      value: '98% 이상',
      description: '예지 보전',
      icon: Gauge,
    },
    {
      label: '생산 품질',
      value: '편차 최소화',
      description: '일정한 품질',
      icon: CheckCircle,
    },
  ];

  const compliance = [
    {
      title: '탄소중립 대응',
      items: [
        'Scope 1, 2, 3 탄소 배출량 자동 계산',
        'RE100 목표 달성 로드맵 제시',
        'CBAM (탄소국경조정제도) 대응',
        'CDP 보고서 자동 생성',
      ],
    },
    {
      title: '에너지 규제 준수',
      items: [
        '에너지이용합리화법 대응',
        '온실가스 배출권거래제 지원',
        '목표관리제 자동 보고',
        'ISO 50001 인증 지원',
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section */}
      <section className="relative py-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-red-500/10" />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500/10 rounded-full mb-6">
              <Hammer className="w-5 h-5 text-orange-400" />
              <span className="text-orange-400 font-semibold">
                Industrial Solutions
              </span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              산업 에너지 최적화
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400">
                탄소중립 시대를 선도하다
              </span>
            </h1>
            <p className="text-xl text-slate-300 max-w-3xl mx-auto mb-8">
              중공업, 화학, 제철 등 에너지 집약 산업의 공정을 AI로 최적화하고
              <br />
              에너지 비용 절감과 탄소 배출 저감을 동시에 달성하세요
            </p>
            <div className="flex gap-4 justify-center">
              <Link href="/register">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
                >
                  무료 진단 신청
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
            산업 혁신 성과
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-center hover:border-orange-500/50 transition-all"
              >
                <benefit.icon className="w-12 h-12 text-orange-400 mx-auto mb-4" />
                <div className="text-2xl font-bold text-white mb-2">
                  {benefit.value}
                </div>
                <div className="text-slate-400 mb-1">{benefit.label}</div>
                <div className="text-xs text-slate-500">{benefit.description}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-white text-center mb-12">
            핵심 솔루션
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-8 hover:border-orange-500/50 hover:shadow-xl transition-all"
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

      {/* Industries Section */}
      <section className="py-20 px-4 bg-slate-800/30">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-white text-center mb-12">
            산업별 맞춤 솔루션
          </h2>
          <div className="space-y-8">
            {industries.map((industry, index) => (
              <div
                key={index}
                className="bg-slate-800 border border-slate-700 rounded-xl p-8 hover:border-orange-500/50 transition-all"
              >
                <div className="flex items-start gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 bg-orange-500/10 rounded-lg flex items-center justify-center">
                      <industry.icon className="w-8 h-8 text-orange-400" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-semibold text-white mb-2">
                      {industry.name}
                    </h3>
                    <p className="text-slate-400 mb-6">{industry.description}</p>
                    <div className="grid md:grid-cols-3 gap-6 mb-4">
                      <div>
                        <h4 className="text-sm font-semibold text-red-400 mb-3">
                          주요 과제
                        </h4>
                        <ul className="space-y-2">
                          {industry.challenges.map((challenge, idx) => (
                            <li
                              key={idx}
                              className="text-slate-300 text-sm flex items-start gap-2"
                            >
                              <span className="text-red-400 mt-1">•</span>
                              {challenge}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-blue-400 mb-3">
                          적용 솔루션
                        </h4>
                        <ul className="space-y-2">
                          {industry.solutions.map((solution, idx) => (
                            <li
                              key={idx}
                              className="text-slate-300 text-sm flex items-start gap-2"
                            >
                              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                              {solution}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-emerald-400 mb-3">
                          예상 절감
                        </h4>
                        <div className="text-xl font-bold text-orange-400">
                          {industry.savings}
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

      {/* Compliance Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-white text-center mb-12">
            환경 규제 대응
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            {compliance.map((section, index) => (
              <div
                key={index}
                className="bg-slate-800 border border-slate-700 rounded-xl p-8 hover:border-green-500/50 transition-all"
              >
                <h3 className="text-2xl font-semibold text-white mb-6">
                  {section.title}
                </h3>
                <ul className="space-y-3">
                  {section.items.map((item, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-3 text-slate-300"
                    >
                      <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
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
            탄소중립 시대,
            <br />
            당신의 산업을 미래로 이끌어갑니다
          </h2>
          <p className="text-xl text-slate-300 mb-8">
            무료 에너지 진단으로 절감 가능한 비용과 탄소 배출량을 확인하세요
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/register">
              <Button
                size="lg"
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
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
