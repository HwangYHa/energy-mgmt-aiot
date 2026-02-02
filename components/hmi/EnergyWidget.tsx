/**
 * HMI 에너지 모니터링 위젯
 * 실시간 전력 사용량, 목표 대비 상태, 피크 관리
 */

'use client';

import { Zap, TrendingUp, TrendingDown } from 'lucide-react';
import type { EnergyData } from '@/lib/types/hmi';
import { HMI_STATUS_COLORS } from '@/lib/types/hmi';
import { StatusIndicator } from './StatusIndicator';

interface EnergyWidgetProps {
  data: EnergyData;
}

export function EnergyWidget({ data }: EnergyWidgetProps) {
  const colors = HMI_STATUS_COLORS[data.status];
  const isSaving = data.savings > 0;

  return (
    <div
      className={`bg-slate-900 border-2 ${colors.border} rounded-lg p-6 ${colors.glow} shadow-lg transition-all`}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 ${colors.bg} rounded`}>
            <Zap className={`w-6 h-6 ${colors.text}`} />
          </div>
          <h3 className="text-lg font-bold text-white">에너지</h3>
        </div>
        <StatusIndicator status={data.status} size="lg" pulse={data.status === 'danger'} />
      </div>

      {/* 현재 사용량 */}
      <div className="mb-6">
        <div className="text-4xl font-bold text-white mb-1">
          {data.currentUsage.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
          <span className="text-2xl text-slate-400 ml-2">kW</span>
        </div>
        <div className="text-sm text-slate-400">현재 전력 사용량</div>
      </div>

      {/* 목표 대비 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className={`${colors.bg} rounded p-3`}>
          <div className="text-xs text-slate-400 mb-1">목표 사용량</div>
          <div className="text-lg font-bold text-white">
            {data.targetUsage.toLocaleString('ko-KR')} kW
          </div>
          <div className={`text-sm font-semibold ${colors.text} mt-1`}>
            {data.usageRate.toFixed(1)}%
          </div>
        </div>

        <div className={`${colors.bg} rounded p-3`}>
          <div className="text-xs text-slate-400 mb-1">피크 제한</div>
          <div className="text-lg font-bold text-white">
            {data.peakLimit.toLocaleString('ko-KR')} kW
          </div>
          <div className={`text-sm font-semibold ${colors.text} mt-1`}>
            {data.peakRate.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* 절감/초과량 */}
      <div
        className={`${
          isSaving ? 'bg-green-900/20 border-green-500' : 'bg-red-900/20 border-red-500'
        } border rounded p-3`}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400 mb-1">
              {isSaving ? '절감량' : '초과량'}
            </div>
            <div className={`text-xl font-bold ${isSaving ? 'text-green-400' : 'text-red-400'}`}>
              {isSaving ? '+' : '-'}
              {Math.abs(data.savings).toLocaleString('ko-KR', { maximumFractionDigits: 0 })} kW
            </div>
            <div className="text-sm text-slate-400">
              ₩{Math.abs(data.savingsCost).toLocaleString('ko-KR')}
            </div>
          </div>
          {isSaving ? (
            <TrendingDown className="w-8 h-8 text-green-400" />
          ) : (
            <TrendingUp className="w-8 h-8 text-red-400" />
          )}
        </div>
      </div>

      {/* 마지막 업데이트 */}
      <div className="mt-4 text-xs text-slate-500 text-right">
        업데이트: {new Date(data.lastUpdate).toLocaleTimeString('ko-KR')}
      </div>
    </div>
  );
}
