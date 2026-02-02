/**
 * HMI 상태 표시 컴포넌트
 * 색상 코드로 즉시 인지 가능
 */

'use client';

import type { HMIStatus } from '@/lib/types/hmi';
import { HMI_STATUS_COLORS } from '@/lib/types/hmi';

interface StatusIndicatorProps {
  status: HMIStatus;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
}

export function StatusIndicator({ status, size = 'md', pulse = false }: StatusIndicatorProps) {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  const colors = HMI_STATUS_COLORS[status];

  return (
    <div className="inline-flex items-center gap-1.5">
      <div
        className={`rounded-full ${sizeClasses[size]} ${colors.bg} border ${colors.border} ${
          pulse && status === 'danger' ? 'animate-pulse' : ''
        }`}
        aria-label={`상태: ${status === 'normal' ? '정상' : status === 'warning' ? '경고' : '위험'}`}
      />
    </div>
  );
}

interface StatusBadgeProps {
  status: HMIStatus;
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const colors = HMI_STATUS_COLORS[status];

  const defaultLabel =
    status === 'normal' ? '정상' : status === 'warning' ? '경고' : '위험';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded ${colors.bg} border ${colors.border} ${colors.text} text-xs font-semibold`}
    >
      <StatusIndicator status={status} size="sm" />
      {label || defaultLabel}
    </span>
  );
}
