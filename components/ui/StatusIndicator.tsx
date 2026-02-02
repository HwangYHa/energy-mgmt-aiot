import { cn } from '@/lib/utils';

export interface StatusIndicatorProps {
  status: 'online' | 'offline' | 'error' | 'warning' | 'maintenance';
  label: string;
  size?: 'sm' | 'md' | 'lg';
}

export function StatusIndicator({ status, label, size = 'md' }: StatusIndicatorProps) {
  const statusColors = {
    online: 'bg-emerald-500',
    offline: 'bg-slate-500',
    error: 'bg-red-600',
    warning: 'bg-amber-500',
    maintenance: 'bg-blue-500',
  };

  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  return (
    <div className="flex items-center gap-2">
      <div className={cn('rounded-full animate-pulse', statusColors[status], sizeClasses[size])} />
      <span className="text-xs font-medium text-slate-300">{label}</span>
    </div>
  );
}
