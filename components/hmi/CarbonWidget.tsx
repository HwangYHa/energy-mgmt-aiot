/**
 * HMI 탄소 배출 위젯
 * 실시간 배출량, 기준선 대비, 감축률
 */

'use client';

import { Leaf, TrendingDown, TrendingUp, Target } from 'lucide-react';
import type { CarbonData } from '@/lib/types/hmi';
import { HMI_STATUS_COLORS } from '@/lib/types/hmi';
import { StatusIndicator } from './StatusIndicator';

interface CarbonWidgetProps {
  data: CarbonData;
}

export function CarbonWidget({ data }: CarbonWidgetProps) {
  const colors = HMI_STATUS_COLORS[data.status];
  const isReducing = data.savingsEmissions > 0;
  const isOnTarget = data.actualReductionRate >= data.targetReductionRate;

  return (
    <div
      className={`bg-slate-900 border-2 ${colors.border} rounded-lg p-6 ${colors.glow} shadow-lg transition-all`}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 ${colors.bg} rounded`}>
            <Leaf className={`w-6 h-6 ${colors.text}`} />
          </div>
          <h3 className="text-lg font-bold text-white">탄소</h3>
        </div>
        <StatusIndicator status={data.status} size="lg" pulse={data.status === 'danger'} />
      </div>

      {/* 현재 배출량 */}
      <div className="mb-6">
        <div className="text-4xl font-bold text-white mb-1">
          {data.currentEmissions.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
          <span className="text-2xl text-slate-400 ml-2">kg</span>
        </div>
        <div className="text-sm text-slate-400">오늘 배출량 (CO₂)</div>
      </div>

      {/* 기준선 대비 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-800 rounded p-3">
          <div className="text-xs text-slate-400 mb-1">기준선</div>
          <div className="text-lg font-bold text-white">
            {data.baselineEmissions.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
          </div>
          <div className="text-xs text-slate-500 mt-1">kg CO₂</div>
        </div>

        <div className={`${colors.bg} rounded p-3`}>
          <div className="text-xs text-slate-400 mb-1">실제 감축률</div>
          <div className={`text-lg font-bold ${colors.text}`}>
            {data.actualReductionRate.toFixed(1)}%
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
            <Target className="w-3 h-3" />
            목표: {data.targetReductionRate}%
          </div>
        </div>
      </div>

      {/* 절감/초과량 */}
      <div
        className={`${
          isReducing ? 'bg-green-900/20 border-green-500' : 'bg-red-900/20 border-red-500'
        } border rounded p-3 mb-4`}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400 mb-1">
              {isReducing ? '감축량' : '초과량'}
            </div>
            <div
              className={`text-xl font-bold ${isReducing ? 'text-green-400' : 'text-red-400'}`}
            >
              {isReducing ? '-' : '+'}
              {Math.abs(data.savingsEmissions).toLocaleString('ko-KR', {
                maximumFractionDigits: 0,
              })}{' '}
              kg
            </div>
          </div>
          {isReducing ? (
            <TrendingDown className="w-8 h-8 text-green-400" />
          ) : (
            <TrendingUp className="w-8 h-8 text-red-400" />
          )}
        </div>
      </div>

      {/* 목표 달성 상태 */}
      <div
        className={`${
          isOnTarget ? 'bg-green-900/20 border-green-500' : 'bg-yellow-900/20 border-yellow-500'
        } border rounded p-3`}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400 mb-1">목표 대비</div>
            <div className={`text-sm font-semibold ${isOnTarget ? 'text-green-400' : 'text-yellow-400'}`}>
              {isOnTarget ? '목표 달성' : '목표 미달성'}
            </div>
          </div>
          <Target
            className={`w-6 h-6 ${isOnTarget ? 'text-green-400' : 'text-yellow-400'}`}
          />
        </div>
      </div>

      {/* 마지막 업데이트 */}
      <div className="mt-4 text-xs text-slate-500 text-right">
        업데이트: {new Date(data.lastUpdate).toLocaleTimeString('ko-KR')}
      </div>
    </div>
  );
}
