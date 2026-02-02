/**
 * HMI 대시보드 메인 페이지
 * 산업용 에너지 관리 24/7 운영 화면
 *
 * 특징:
 * - 실시간 데이터 (5초 자동 갱신)
 * - 한눈에 상태 파악 (에너지/설비/탄소)
 * - 긴급 알람 배너
 * - 최소 클릭으로 정보 접근
 * - 야간 운영 최적화 (어두운 배경, 높은 대비)
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useDashboardData } from '@/lib/hooks/use-dashboard-data';
import { EnergyWidget } from '@/components/hmi/EnergyWidget';
import { EquipmentWidget } from '@/components/hmi/EquipmentWidget';
import { CarbonWidget } from '@/components/hmi/CarbonWidget';
import { AlertBanner } from '@/components/hmi/AlertBanner';
import { SiteStatusTable } from '@/components/hmi/SiteStatusTable';
import {
  Zap,
  Bell,
  RefreshCw,
  Menu,
  Clock,
  TrendingUp,
  Lightbulb,
} from 'lucide-react';

export default function HMIDashboard() {
  const { data, isLoading, error, lastUpdate, refresh } = useDashboardData(5000); // 5초 자동 갱신
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 현재 시간 업데이트 (1초마다)
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // 수동 갱신
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-emerald-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-lg">대시보드 로딩 중...</p>
        </div>
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-400 text-xl mb-4">⚠️ 데이터 로드 실패</div>
          <p className="text-slate-400 mb-6">{error}</p>
          <button
            onClick={handleRefresh}
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  // 데이터가 없는 경우
  if (!data) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 text-lg">데이터가 없습니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* 헤더 */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-[1920px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* 로고 & 타이틀 */}
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2 group">
                <Zap className="w-8 h-8 text-emerald-400 group-hover:text-emerald-300 transition-colors" />
                <span className="font-bold text-xl text-white">
                  Energy<span className="text-emerald-400">AI</span>
                </span>
              </Link>
              <div className="hidden md:block h-6 w-px bg-slate-700" />
              <h1 className="hidden md:block text-lg font-semibold text-white">
                HMI 운영 대시보드
              </h1>
            </div>

            {/* 중앙: 현재 시간 */}
            <div className="flex items-center gap-2 text-slate-300">
              <Clock className="w-5 h-5" />
              <div className="font-mono text-lg">
                {currentTime.toLocaleTimeString('ko-KR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </div>
              <div className="text-sm text-slate-500 ml-2">
                {currentTime.toLocaleDateString('ko-KR', {
                  month: 'long',
                  day: 'numeric',
                  weekday: 'short',
                })}
              </div>
            </div>

            {/* 우측: 액션 버튼 */}
            <div className="flex items-center gap-3">
              {/* 갱신 버튼 */}
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                aria-label="새로고침"
              >
                <RefreshCw
                  className={`w-5 h-5 text-slate-400 ${isRefreshing ? 'animate-spin' : ''}`}
                />
              </button>

              {/* 알람 버튼 */}
              <button
                className="relative p-2 hover:bg-slate-800 rounded-lg transition-colors"
                aria-label="알람"
              >
                <Bell className="w-5 h-5 text-slate-400" />
                {data.alerts.filter((a) => !a.acknowledged).length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                )}
              </button>

              {/* 사용자 메뉴 */}
              <div className="flex items-center gap-2">
                <Link
                  href="/dashboard"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors text-sm font-semibold"
                >
                  대시보드
                </Link>
              </div>
            </div>
          </div>

          {/* 마지막 업데이트 시간 */}
          {lastUpdate && (
            <div className="mt-2 text-xs text-slate-500 text-center">
              마지막 업데이트: {lastUpdate.toLocaleTimeString('ko-KR')} (5초마다 자동 갱신)
            </div>
          )}
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="max-w-[1920px] mx-auto px-6 py-6 space-y-6">
        {/* 긴급 알람 배너 */}
        <AlertBanner alerts={data.alerts} />

        {/* 핵심 위젯 3개 (에너지/설비/탄소) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <EnergyWidget data={data.energy} />
          <EquipmentWidget data={data.equipment} />
          <CarbonWidget data={data.carbon} />
        </div>

        {/* 사이트별 상세 현황 */}
        <section>
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Menu className="w-5 h-5 text-emerald-400" />
            사이트별 현황
          </h2>
          <SiteStatusTable sites={data.sites} />
        </section>

        {/* AI 예측 & 최적화 추천 */}
        {data.recommendations.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-400" />
              AI 예측 & 최적화 추천
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {data.recommendations.map((rec) => {
                const priorityColors = {
                  high: 'border-red-500 bg-red-900/20',
                  medium: 'border-yellow-500 bg-yellow-900/20',
                  low: 'border-green-500 bg-green-900/20',
                };

                return (
                  <div
                    key={rec.id}
                    className={`border-2 ${priorityColors[rec.priority]} rounded-lg p-4`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <TrendingUp
                            className={`w-4 h-4 ${
                              rec.priority === 'high'
                                ? 'text-red-400'
                                : rec.priority === 'medium'
                                  ? 'text-yellow-400'
                                  : 'text-green-400'
                            }`}
                          />
                          <h3 className="font-semibold text-white">{rec.title}</h3>
                        </div>
                        <p className="text-sm text-slate-300 mb-3">{rec.description}</p>
                        <div className="flex items-center gap-4 text-xs text-slate-400">
                          {rec.siteName && <span>사이트: {rec.siteName}</span>}
                          <span>
                            절감 예상:{' '}
                            <span className="font-bold text-emerald-400">
                              {rec.expectedSavings.toFixed(0)} kW
                            </span>
                          </span>
                          <span>
                            비용:{' '}
                            <span className="font-bold text-emerald-400">
                              ₩{rec.expectedCost.toLocaleString('ko-KR')}
                            </span>
                          </span>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold ${
                          rec.priority === 'high'
                            ? 'bg-red-500 text-white'
                            : rec.priority === 'medium'
                              ? 'bg-yellow-500 text-white'
                              : 'bg-green-500 text-white'
                        }`}
                      >
                        {rec.priority === 'high'
                          ? '높음'
                          : rec.priority === 'medium'
                            ? '중간'
                            : '낮음'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 푸터 정보 */}
        <footer className="mt-8 pt-6 border-t border-slate-800 text-center text-sm text-slate-500">
          <p>© 2026 EnergyAI Platform. 24/7 실시간 에너지 관리 시스템</p>
          <p className="mt-1">
            문의:{' '}
            <a href="mailto:support@energyai.com" className="text-emerald-400 hover:underline">
              support@energyai.com
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}
