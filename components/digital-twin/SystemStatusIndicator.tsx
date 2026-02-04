'use client';

import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

interface SystemStatusIndicatorProps {
  status: 'normal' | 'warning' | 'critical';
  message: string;
  score: number;
}

/**
 * 시스템 전체 상태 인디케이터
 * "지금 괜찮은가?" 즉시 판단 표시
 */
export function SystemStatusIndicator({
  status,
  message,
  score,
}: SystemStatusIndicatorProps) {
  const statusConfig = {
    normal: {
      icon: CheckCircle,
      bg: 'bg-gradient-to-br from-green-500 to-emerald-600',
      text: '정상',
      textColor: 'text-white',
      ringColor: 'ring-green-500',
    },
    warning: {
      icon: AlertTriangle,
      bg: 'bg-gradient-to-br from-yellow-500 to-orange-600',
      text: '주의',
      textColor: 'text-white',
      ringColor: 'ring-yellow-500',
    },
    critical: {
      icon: XCircle,
      bg: 'bg-gradient-to-br from-red-500 to-rose-600',
      text: '위험',
      textColor: 'text-white',
      ringColor: 'ring-red-500',
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className={`${config.bg} rounded-xl p-8 text-white shadow-lg ring-4 ${config.ringColor} ring-opacity-20`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-4">
            <Icon className="w-12 h-12" />
            <div>
              <div className="text-sm font-medium opacity-90">시스템 상태</div>
              <div className="text-3xl font-bold">{config.text}</div>
            </div>
          </div>

          <p className="text-lg mb-6 opacity-95">{message}</p>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="opacity-90">시스템 점수</span>
              <span className="font-bold text-lg">{score}/100</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
              <div
                className="bg-white h-full rounded-full transition-all duration-500"
                style={{ width: `${score}%` }}
              />
            </div>
          </div>
        </div>

        <div className="ml-6">
          <div className="text-center bg-white/10 rounded-xl p-6 backdrop-blur-sm">
            <div className="text-5xl font-bold mb-2">{score}</div>
            <div className="text-sm opacity-90">건강 점수</div>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-white/20">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="opacity-75">가동률</div>
            <div className="text-2xl font-bold mt-1">98.5%</div>
          </div>
          <div>
            <div className="opacity-75">효율</div>
            <div className="text-2xl font-bold mt-1">92.3%</div>
          </div>
          <div>
            <div className="opacity-75">응답시간</div>
            <div className="text-2xl font-bold mt-1">45ms</div>
          </div>
        </div>
      </div>
    </div>
  );
}
