'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Zap, BarChart3, AlertCircle, Leaf, Smartphone, Lock } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-slate-900/80 backdrop-blur border-b border-slate-700 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <Zap className="w-8 h-8 text-emerald-400" />
              <span className="font-bold text-xl text-white">Energy Management</span>
            </div>
            <div className="flex gap-4">
              <Link href="/login">
                <Button variant="outline" size="sm">로그인</Button>
              </Link>
              <Link href="/register">
                <Button size="sm">시작하기</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl sm:text-6xl font-bold text-white mb-6">
            스마트 에너지 관리 플랫폼
          </h1>
          <p className="text-xl text-slate-300 mb-8 leading-relaxed">
            AI 기반 부하 예측, 이상 탐지, 최적화 추천 및 수요반응 시스템을 통해
            <br />
            에너지 효율을 극대화하고 운영 비용을 절감하세요.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/register">
              <Button size="lg" className="bg-emerald-500 hover:bg-emerald-600">
                무료 시작하기
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">
                로그인
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-slate-800/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-white mb-16">
            주요 기능
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1: Forecasting */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 hover:border-emerald-500/50 transition">
              <div className="flex items-center gap-3 mb-4">
                <BarChart3 className="w-8 h-8 text-emerald-400" />
                <h3 className="text-xl font-semibold text-white">부하 예측</h3>
              </div>
              <p className="text-slate-300">
                LSTM 신경망을 이용한 정확한 전력 수요 예측 (24시간/7일/30일)
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-400">
                <li>✓ 정확도 92% (MAPE &lt; 10%)</li>
                <li>✓ 95% 신뢰도 신뢰 구간</li>
                <li>✓ 실시간 업데이트</li>
              </ul>
            </div>

            {/* Feature 2: Anomaly Detection */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 hover:border-emerald-500/50 transition">
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="w-8 h-8 text-orange-400" />
                <h3 className="text-xl font-semibold text-white">이상 탐지</h3>
              </div>
              <p className="text-slate-300">
                Isolation Forest 알고리즘으로 비정상 패턴 자동 감지
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-400">
                <li>✓ F1 점수 0.92</li>
                <li>✓ 4단계 심각도 분류</li>
                <li>✓ 원인 분석 자동화</li>
              </ul>
            </div>

            {/* Feature 3: Optimization */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 hover:border-emerald-500/50 transition">
              <div className="flex items-center gap-3 mb-4">
                <Zap className="w-8 h-8 text-yellow-400" />
                <h3 className="text-xl font-semibold text-white">최적화 추천</h3>
              </div>
              <p className="text-slate-300">
                Peak Shaving, ESS 스케줄, HVAC 최적화로 에너지 절감
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-400">
                <li>✓ 일일 절감 1,200 kWh</li>
                <li>✓ 월간 절감액 ₩7.2M</li>
                <li>✓ ROI 20개월</li>
              </ul>
            </div>

            {/* Feature 4: Demand Response */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 hover:border-emerald-500/50 transition">
              <div className="flex items-center gap-3 mb-4">
                <Smartphone className="w-8 h-8 text-blue-400" />
                <h3 className="text-xl font-semibold text-white">수요반응</h3>
              </div>
              <p className="text-slate-300">
                자동화된 DR 이벤트 관리 및 응답률 모니터링
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-400">
                <li>✓ 자동 제어 명령</li>
                <li>✓ 월간 수익 ₩9M</li>
                <li>✓ 실시간 대시보드</li>
              </ul>
            </div>

            {/* Feature 5: Carbon Tracking */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 hover:border-emerald-500/50 transition">
              <div className="flex items-center gap-3 mb-4">
                <Leaf className="w-8 h-8 text-green-400" />
                <h3 className="text-xl font-semibold text-white">탄소 추적</h3>
              </div>
              <p className="text-slate-300">
                Scope 1/2/3 배출량 자동 계산 및 규제 보고서 생성
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-400">
                <li>✓ 자동 계산</li>
                <li>✓ 규제 준수</li>
                <li>✓ ESG 리포팅</li>
              </ul>
            </div>

            {/* Feature 6: Security */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 hover:border-emerald-500/50 transition">
              <div className="flex items-center gap-3 mb-4">
                <Lock className="w-8 h-8 text-red-400" />
                <h3 className="text-xl font-semibold text-white">보안</h3>
              </div>
              <p className="text-slate-300">
                엔터프라이즈급 보안 및 규정 준수
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-400">
                <li>✓ 감사 로그</li>
                <li>✓ 역할 기반 접근</li>
                <li>✓ 데이터 암호화</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Metrics Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-white mb-16">
            검증된 성과
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-emerald-400 mb-2">92%</div>
              <p className="text-slate-300">예측 정확도</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-orange-400 mb-2">0.92</div>
              <p className="text-slate-300">이상탐지 F1</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-yellow-400 mb-2">1.2K</div>
              <p className="text-slate-300">일일 절감 kWh</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-400 mb-2">₩7.2M</div>
              <p className="text-slate-300">월간 절감액</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-emerald-600/20 to-blue-600/20 border-y border-slate-700">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            지금 바로 시작하세요
          </h2>
          <p className="text-xl text-slate-300 mb-8">
            무료 평가판으로 에너지 효율을 높이고 비용을 절감하세요.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/register">
              <Button size="lg" className="bg-emerald-500 hover:bg-emerald-600">
                무료 가입
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">
                로그인
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-semibold text-white mb-4">제품</h3>
              <ul className="space-y-2 text-slate-400 text-sm">
                <li><Link href="#" className="hover:text-emerald-400">기능</Link></li>
                <li><Link href="#" className="hover:text-emerald-400">가격</Link></li>
                <li><Link href="#" className="hover:text-emerald-400">평가판</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">솔루션</h3>
              <ul className="space-y-2 text-slate-400 text-sm">
                <li><Link href="#" className="hover:text-emerald-400">제조업</Link></li>
                <li><Link href="#" className="hover:text-emerald-400">빌딩</Link></li>
                <li><Link href="#" className="hover:text-emerald-400">데이터센터</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">회사</h3>
              <ul className="space-y-2 text-slate-400 text-sm">
                <li><Link href="#" className="hover:text-emerald-400">소개</Link></li>
                <li><Link href="#" className="hover:text-emerald-400">블로그</Link></li>
                <li><Link href="#" className="hover:text-emerald-400">문서</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">지원</h3>
              <ul className="space-y-2 text-slate-400 text-sm">
                <li><Link href="#" className="hover:text-emerald-400">도움말</Link></li>
                <li><Link href="#" className="hover:text-emerald-400">문의</Link></li>
                <li><Link href="#" className="hover:text-emerald-400">상태</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8">
            <p className="text-slate-400 text-sm text-center">
              © 2026 Energy Management Platform. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
