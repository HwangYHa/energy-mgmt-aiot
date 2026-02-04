'use client';

import { Equipment } from './DigitalTwinDashboard';
import { Activity, AlertTriangle, XCircle, Zap, Thermometer } from 'lucide-react';

interface EquipmentStatusCardProps {
  equipment: Equipment;
}

/**
 * 개별 설비 상태 카드
 */
export function EquipmentStatusCard({ equipment }: EquipmentStatusCardProps) {
  const statusConfig = {
    online: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-200 dark:border-green-700',
      icon: Activity,
      iconColor: 'text-green-600 dark:text-green-400',
      label: '정상',
      labelBg: 'bg-green-100 dark:bg-green-900',
      labelText: 'text-green-700 dark:text-green-300',
    },
    warning: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      border: 'border-yellow-200 dark:border-yellow-700',
      icon: AlertTriangle,
      iconColor: 'text-yellow-600 dark:text-yellow-400',
      label: '주의',
      labelBg: 'bg-yellow-100 dark:bg-yellow-900',
      labelText: 'text-yellow-700 dark:text-yellow-300',
    },
    offline: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-700',
      icon: XCircle,
      iconColor: 'text-red-600 dark:text-red-400',
      label: '오류',
      labelBg: 'bg-red-100 dark:bg-red-900',
      labelText: 'text-red-700 dark:text-red-300',
    },
  };

  const config = statusConfig[equipment.status];
  const Icon = config.icon;

  return (
    <div
      className={`${config.bg} border-2 ${config.border} rounded-xl p-6 transition-all hover:shadow-lg`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 ${config.labelBg} rounded-lg`}>
            <Icon className={`w-5 h-5 ${config.iconColor}`} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">
              {equipment.name}
            </h3>
            <span className="text-xs text-slate-600 dark:text-slate-400">
              {equipment.type}
            </span>
          </div>
        </div>
        <span
          className={`px-2 py-1 ${config.labelBg} ${config.labelText} text-xs font-medium rounded-full`}
        >
          {config.label}
        </span>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <Zap className="w-4 h-4" />
            <span>전력</span>
          </div>
          <span className="font-bold text-slate-900 dark:text-white">
            {equipment.power.toFixed(1)} kW
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600 dark:text-slate-400">효율</span>
          <div className="flex items-center gap-2">
            <div className="w-20 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
              <div
                className={`${
                  equipment.efficiency >= 90
                    ? 'bg-green-500'
                    : equipment.efficiency >= 75
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                } h-full rounded-full transition-all duration-500`}
                style={{ width: `${equipment.efficiency}%` }}
              />
            </div>
            <span className="font-bold text-slate-900 dark:text-white text-sm">
              {equipment.efficiency.toFixed(0)}%
            </span>
          </div>
        </div>

        {equipment.temperature !== undefined && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Thermometer className="w-4 h-4" />
              <span>온도</span>
            </div>
            <span className="font-bold text-slate-900 dark:text-white">
              {equipment.temperature.toFixed(1)}°C
            </span>
          </div>
        )}

        <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
          <span className="text-xs text-slate-500 dark:text-slate-500">
            업데이트: {new Date(equipment.lastUpdate).toLocaleTimeString('ko-KR')}
          </span>
        </div>
      </div>
    </div>
  );
}
