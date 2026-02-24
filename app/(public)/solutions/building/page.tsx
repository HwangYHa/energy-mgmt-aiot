import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import {
  Building2,
  Thermometer,
  Wind,
  Lightbulb,
  TrendingDown,
  Users,
  CheckCircle,
  ArrowRight,
  Leaf,
} from 'lucide-react';

/**
 * 빌딩 솔루션 페이지
 * 상업용 빌딩의 에너지 효율 최적화 솔루션
 */
export const metadata = {
  title: '빌딩 에너지 관리 솔루션 - 탄소이음',
  description:
    '상업용 빌딩의 냉난방, 조명, 환기 시스템을 AI로 최적화하여 에너지 비용을 최대 40% 절감. BEMS 스마트 빌딩 솔루션.',
  openGraph: {
    title: '빌딩 에너지 관리 (BEMS) - 탄소이음',
    description: 'AI로 상업용 빌딩 에너지 비용 최대 40% 절감',
  },
};

export default function BuildingSolutionPage() {
  const features = [
    {
      icon: Thermometer,
      title: '스마트 냉난방 제어',
      description:
        '외부 날씨, 실내 온도, 재실 인원을 분석하여 HVAC 시스템을 자동으로 최적화합니다.',
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
    },
    {
      icon: Lightbulb,
      title: '지능형 조명 관리',
      description:
        '자연광, 시간대, 공간 사용률에 따라 조명을 자동 제어하여 전력 낭비를 방지합니다.',
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
    },
    {
      icon: Wind,
      title: '실내 공기질 모니터링',
      description:
        'CO2, 미세먼지 등을 실시간으로 측정하고 환기 시스템을 자동 조절하여 쾌적한 환경을 유지합니다.',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      icon: Users,
      title: '재실자 기반 최적화',
      description:
        '건물 내 인원 분포를 파악하여 사용하지 않는 공간의 에너지 소비를 자동으로 줄입니다.',
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
    },
  ];

  const benefits = [
    { label: '에너지 비용 절감', value: '평균 40%', icon: TrendingDown },
    { label: '탄소 배출 감소', value: '최대 50%', icon: Leaf },
    { label: '재실자 만족도', value: '95% 이상', icon: Users },
    { label: '건물 자산 가치', value: '15% 상승', icon: Building2 },
  ];

  const buildingTypes = [
    {
      type: '오피스 빌딩',
      icon: Building2,
      challenges: ['높은 냉난방 비용', '사무실별 온도 편차', '퇴근 후 낭비 전력'],
      solutions: [
        '층별/구역별 독립 온도 제어',
        '스케줄 기반 자동 운전',
        '재실 센서 연동 제어',
      ],
      savings: '연간 3억원 절감 (30층 기준)',
    },
    {
      type: '쇼핑몰',
      icon: Users,
      challenges: ['넓은 공간의 에너지 관리', '고객 쾌적도 유지', '피크 타임 전력 부하'],
      solutions: [
        '실시간 유동인구 분석',
        '구역별 공조 최적화',
        '자연광 연동 조명 제어',
      ],
      savings: '월 5,000만원 절감 (대형몰 기준)',
    },
    {
      type: '호텔',
      icon: Building2,
      challenges: ['24시간 운영', '객실별 개별 제어', '공용 공간 관리'],
      solutions: [
        '체크인/아웃 연동 제어',
        '객실 카드키 연동',
        '공용 공간 스케줄 관리',
      ],
      savings: '연간 2.5억원 절감 (300실 기준)',
    },
  ];

  const certifications = [
    { name: 'LEED 인증', description: '친환경 건물 인증 지원' },
    { name: 'BEMS 인증', description: '건물 에너지 관리 시스템' },
    { name: 'ISO 50001', description: '에너지 경영 시스템' },
    { name: '제로 에너지 빌딩', description: 'ZEB 등급 획득 지원' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section */}
      <section className="relative py-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-green-500/10" />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 rounded-full mb-6">
              <Building2 className="w-5 h-5 text-blue-400" />
              <span className="text-blue-400 font-semibold">
                Building Solutions
              </span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              스마트 빌딩 에너지 관리
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-green-400">
                쾌적함과 효율의 완벽한 조화
              </span>
            </h1>
            <p className="text-xl text-slate-300 max-w-3xl mx-auto mb-8">
              AI 기반 통합 제어 시스템으로 빌딩의 냉난방, 조명, 환기를
              최적화하고
              <br />
              에너지 비용 절감과 재실자 만족도를 동시에 달성하세요
            </p>
            <div className="flex gap-4 justify-center">
              <Link href="/register">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white"
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
            스마트 빌딩의 가치
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-center hover:border-blue-500/50 transition-all"
              >
                <benefit.icon className="w-12 h-12 text-blue-400 mx-auto mb-4" />
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
            핵심 기능
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-8 hover:border-blue-500/50 hover:shadow-xl transition-all"
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

      {/* Building Types Section */}
      <section className="py-20 px-4 bg-slate-800/30">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-white text-center mb-12">
            건물 유형별 솔루션
          </h2>
          <div className="space-y-8">
            {buildingTypes.map((building, index) => (
              <div
                key={index}
                className="bg-slate-800 border border-slate-700 rounded-xl p-8 hover:border-blue-500/50 transition-all"
              >
                <div className="flex items-start gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 bg-blue-500/10 rounded-lg flex items-center justify-center">
                      <building.icon className="w-8 h-8 text-blue-400" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-semibold text-white mb-6">
                      {building.type}
                    </h3>
                    <div className="grid md:grid-cols-3 gap-6 mb-6">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-400 mb-3">
                          주요 과제
                        </h4>
                        <ul className="space-y-2">
                          {building.challenges.map((challenge, idx) => (
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
                        <h4 className="text-sm font-semibold text-slate-400 mb-3">
                          적용 솔루션
                        </h4>
                        <ul className="space-y-2">
                          {building.solutions.map((solution, idx) => (
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
                        <h4 className="text-sm font-semibold text-slate-400 mb-3">
                          예상 절감액
                        </h4>
                        <div className="text-2xl font-bold text-blue-400">
                          {building.savings}
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

      {/* Certifications Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-white text-center mb-12">
            녹색 건물 인증 지원
          </h2>
          <div className="grid md:grid-cols-4 gap-6">
            {certifications.map((cert, index) => (
              <div
                key={index}
                className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-center hover:border-green-500/50 transition-all"
              >
                <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {cert.name}
                </h3>
                <p className="text-sm text-slate-400">{cert.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-slate-800/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            당신의 빌딩을 스마트하게
            <br />
            변화시킬 준비가 되셨나요?
          </h2>
          <p className="text-xl text-slate-300 mb-8">
            무료 에너지 진단으로 절감 가능한 비용을 먼저 확인해보세요
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/register">
              <Button
                size="lg"
                className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white"
              >
                무료 진단 신청
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
