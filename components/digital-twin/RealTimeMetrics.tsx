'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Activity, Zap, DollarSign, Leaf } from 'lucide-react';

/**
 * 실시간 메트릭 표시
 */
export function RealTimeMetrics() {
  const [metrics, setMetrics] = useState({
    currentPower: 573.8,
    powerTrend: 'down' as 'up' | 'down',
    cost: 125.4,
    costTrend: 'down' as 'up' | 'down',
    pue: 1.35,
    pueTrend: 'down' as 'up' | 'down',
    carbonSaved: 42.3,
    carbonTrend: 'up' as 'up' | 'down',
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics((prev) => ({
        currentPower: prev.currentPower + (Math.random() - 0.5) * 10,
        powerTrend: Math.random() > 0.5 ? 'up' : 'down',
        cost: prev.cost + (Math.random() - 0.5) * 2,
        costTrend: Math.random() > 0.5 ? 'up' : 'down',
        pue: Math.max(1.1, Math.min(2.0, prev.pue + (Math.random() - 0.5) * 0.05)),
        pueTrend: Math.random() > 0.5 ? 'up' : 'down',
        carbonSaved: prev.carbonSaved + Math.random() * 0.5,
        carbonTrend: 'up',
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const metricCards = [
    {
      title: '현재 전력',
      value: `${metrics.currentPower.toFixed(1)} kW`,
      trend: metrics.powerTrend,
      icon: Zap,
      color: 'text-yellow-600 dark:text-yellow-400',
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      change: '12.3%',
    },
    {
      title: '실시간 비용',
      value: `₩${metrics.cost.toFixed(1)}K`,
      trend: metrics.costTrend,
      icon: DollarSign,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      change: '8.7%',
    },
    {
      title: 'PUE',
      value: metrics.pue.toFixed(2),
      trend: metrics.pueTrend,
      icon: Activity,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-900/20',
      change: '0.15',
      subtitle: '목표: 1.20',
    },
    {
      title: '탄소 절감',
      value: `${metrics.carbonSaved.toFixed(1)} kg`,
      trend: metrics.carbonTrend,
      icon: Leaf,
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-900/20',
      change: '오늘',
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
          <span>실시간 업데이트</span>
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

              <div className={`flex items-center gap-1 text-sm ${trendColor}`}>
                <TrendIcon className="w-4 h-4" />
                <span>{metric.change}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
