'use client';

import { useState, useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown, Activity, Zap, DollarSign, Leaf } from 'lucide-react';

interface OverviewMetrics {
  currentPower: number | null;
  savingsCost: number | null;
  usageRate: number | null;
  carbonSaved: number | null;
}

/**
 * 실시간 메트릭 표시
 * /api/dashboard/overview 30초 폴링으로 실제 DB 데이터 표시
 */
export function RealTimeMetrics() {
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const prevRef = useRef<OverviewMetrics | null>(null);
  const [trends, setTrends] = useState({
    power: 'down' as 'up' | 'down',
    cost: 'down' as 'up' | 'down',
    usageRate: 'down' as 'up' | 'down',
    carbon: 'up' as 'up' | 'down',
  });

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch('/api/dashboard/overview');
        if (!res.ok) return;
        const data = await res.json();

        const next: OverviewMetrics = {
          currentPower: data.energy?.currentUsage ?? null,
          savingsCost: data.energy?.savingsCost ?? null,
          usageRate: data.energy?.usageRate ?? null,
          carbonSaved: data.carbon?.savingsEmissions ?? null,
        };

        // 이전 값과 비교해 트렌드 결정
        if (prevRef.current) {
          const prev = prevRef.current;
          setTrends({
            power: next.currentPower !== null && prev.currentPower !== null
              ? next.currentPower > prev.currentPower ? 'up' : 'down'
              : 'down',
            cost: next.savingsCost !== null && prev.savingsCost !== null
              ? next.savingsCost > prev.savingsCost ? 'up' : 'down'
              : 'down',
            usageRate: next.usageRate !== null && prev.usageRate !== null
              ? next.usageRate > prev.usageRate ? 'up' : 'down'
              : 'down',
            carbon: next.carbonSaved !== null && prev.carbonSaved !== null
              ? next.carbonSaved >= prev.carbonSaved ? 'up' : 'down'
              : 'up',
          });
        }

        prevRef.current = next;
        setMetrics(next);
      } catch {
        // 네트워크 오류 시 기존 값 유지
      }
    };

    fetchMetrics();
    // 15초 오프셋: DigitalTwinDashboard(0s)와 동시 폴링 충돌 방지
    const id = setInterval(fetchMetrics, 30000);
    return () => clearInterval(id);
  }, []);

  const fmt = (v: number | null, decimals = 1) =>
    v !== null ? v.toFixed(decimals) : '-';

  const metricCards = [
    {
      title: '현재 전력',
      value: metrics?.currentPower !== null && metrics?.currentPower !== undefined
        ? `${fmt(metrics.currentPower)} kW`
        : '-',
      trend: trends.power,
      icon: Zap,
      color: 'text-yellow-600 dark:text-yellow-400',
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      subtitle: '최근 5분 평균',
    },
    {
      title: '일일 절감 비용',
      value: metrics?.savingsCost !== null && metrics?.savingsCost !== undefined
        ? `₩${metrics.savingsCost.toLocaleString('ko-KR')}`
        : '-',
      trend: trends.cost,
      icon: DollarSign,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      subtitle: '목표 대비 절감',
      isPositive: true,
    },
    {
      title: '목표 대비 사용률',
      value: metrics?.usageRate !== null && metrics?.usageRate !== undefined
        ? `${fmt(metrics.usageRate)}%`
        : '-',
      trend: trends.usageRate,
      icon: Activity,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-900/20',
      subtitle: '낮을수록 효율적',
    },
    {
      title: '탄소 절감',
      value: metrics?.carbonSaved !== null && metrics?.carbonSaved !== undefined
        ? `${fmt(metrics.carbonSaved)} kg`
        : '-',
      trend: trends.carbon,
      icon: Leaf,
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-900/20',
      subtitle: '오늘 기준',
      isPositive: true,
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          실시간 메트릭
        </h2>
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span>30초 갱신</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((metric, index) => {
          const Icon = metric.icon;
          const TrendIcon = metric.trend === 'up' ? TrendingUp : TrendingDown;
          const trendColor =
            metric.isPositive
              ? metric.trend === 'up'
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
              : metric.trend === 'down'
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400';

          return (
            <div
              key={index}
              className={`${metric.bg} border border-slate-200 dark:border-slate-700 rounded-xl p-6`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  {metric.title}
                </span>
                <Icon className={`w-5 h-5 ${metric.color}`} />
              </div>

              <div className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                {metric.value}
              </div>

              {metric.subtitle && (
                <div className="text-xs text-slate-500 dark:text-slate-500 mb-2">
                  {metric.subtitle}
                </div>
              )}

              {metrics !== null && (
                <div className={`flex items-center gap-1 text-sm ${trendColor}`}>
                  <TrendIcon className="w-4 h-4" />
                  <span>{metric.trend === 'up' ? '상승' : '하락'}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
