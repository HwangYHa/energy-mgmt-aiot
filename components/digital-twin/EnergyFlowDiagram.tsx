'use client';

import { Equipment } from './DigitalTwinDashboard';
import { Zap, Wind, Droplets, Server } from 'lucide-react';

interface EnergyFlowDiagramProps {
  equipment: Equipment[];
  totalPower: number;
}

/**
 * 에너지 흐름 다이어그램
 * 실시간 에너지 흐름 시각화
 */
export function EnergyFlowDiagram({ equipment, totalPower }: EnergyFlowDiagramProps) {
  const hvacPower = equipment
    .filter((e) => e.type === 'HVAC')
    .reduce((sum, e) => sum + e.power, 0);
  const chillerPower = equipment
    .filter((e) => e.type === 'Chiller')
    .reduce((sum, e) => sum + e.power, 0);
  const otherPower = totalPower - hvacPower - chillerPower;

  const getPercentage = (power: number) =>
    totalPower > 0 ? ((power / totalPower) * 100).toFixed(1) : '0';

  return (
    <div className="relative">
      {/* Grid 공급 */}
      <div className="flex items-center gap-4 mb-8">
        <div className="bg-blue-500/10 border-2 border-blue-500 rounded-xl p-6 min-w-[200px]">
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-6 h-6 text-blue-500" />
            <span className="font-semibold text-slate-900 dark:text-white">
              전력 공급
            </span>
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">
            {totalPower.toFixed(1)} kW
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Grid + Solar
          </div>
        </div>

        <div className="flex-1 relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t-4 border-blue-500 border-dashed" />
          </div>
          <div className="relative flex justify-center">
            <div className="bg-white dark:bg-slate-800 px-3 py-1 rounded-full text-sm font-medium text-blue-500 border-2 border-blue-500">
              전송 중
            </div>
          </div>
        </div>
      </div>

      {/* 소비처 */}
      <div className="grid grid-cols-3 gap-6">
        {/* HVAC */}
        <div className="bg-emerald-500/10 border-2 border-emerald-500 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <Wind className="w-6 h-6 text-emerald-500" />
            <span className="font-semibold text-slate-900 dark:text-white">
              HVAC
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
            {hvacPower.toFixed(1)} kW
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {getPercentage(hvacPower)}% of total
          </div>
          <div className="mt-4 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${getPercentage(hvacPower)}%` }}
            />
          </div>
        </div>

        {/* Chiller */}
        <div className="bg-cyan-500/10 border-2 border-cyan-500 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <Droplets className="w-6 h-6 text-cyan-500" />
            <span className="font-semibold text-slate-900 dark:text-white">
              냉동기
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
            {chillerPower.toFixed(1)} kW
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {getPercentage(chillerPower)}% of total
          </div>
          <div className="mt-4 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
            <div
              className="bg-cyan-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${getPercentage(chillerPower)}%` }}
            />
          </div>
        </div>

        {/* Others */}
        <div className="bg-purple-500/10 border-2 border-purple-500 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <Server className="w-6 h-6 text-purple-500" />
            <span className="font-semibold text-slate-900 dark:text-white">
              기타
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
            {otherPower.toFixed(1)} kW
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {getPercentage(otherPower)}% of total
          </div>
          <div className="mt-4 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
            <div
              className="bg-purple-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${getPercentage(otherPower)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 흐름 애니메이션 표시 */}
      <div className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-600 dark:text-slate-400">
        <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
        <span>실시간 데이터 업데이트 중</span>
      </div>
    </div>
  );
}
