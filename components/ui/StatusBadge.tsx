import { cn } from '@/lib/utils';

export interface StatusBadgeProps {
  status:
    | 'active'
    | 'peak-hours'
    | 'normal'
    | 'maintenance'
    | 'offline'
    | 'critical'
    | 'warning';
  label: string;
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
}

export function StatusBadge({ status, label, size = 'md', showDot = true }: StatusBadgeProps) {
  const statusClasses = {
    active: 'bg-emerald-900 text-emerald-200 border-emerald-700',
    'peak-hours': 'bg-amber-900 text-amber-200 border-amber-700',
    normal: 'bg-slate-700 text-slate-200 border-slate-600',
    maintenance: 'bg-blue-900 text-blue-200 border-blue-700',
    offline: 'bg-slate-800 text-slate-400 border-slate-700',
    critical: 'bg-red-900 text-red-200 border-red-700',
    warning: 'bg-amber-900 text-amber-200 border-amber-700',
  };

  const dotClasses = {
    active: 'bg-emerald-500',
    'peak-hours': 'bg-amber-500',
    normal: 'bg-slate-500',
    maintenance: 'bg-blue-500',
    offline: 'bg-slate-600',
    critical: 'bg-red-600',
    warning: 'bg-amber-500',
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full font-semibold border',
        statusClasses[status],
        sizeClasses[size]
      )}
    >
      {showDot && <div className={cn('w-2 h-2 rounded-full', dotClasses[status])} />}
      {label}
    </span>
  );
}
