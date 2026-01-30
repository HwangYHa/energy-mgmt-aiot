import { cn } from '@/lib/utils';
import React from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  subValue?: string;
  subLabel?: string;
  trend?: {
    direction: 'up' | 'down' | 'stable';
    percentage: number;
  };
  icon?: React.ReactNode;
  variant?: 'default' | 'savings' | 'alert' | 'warning';
  size?: 'sm' | 'md' | 'lg';
}

export function MetricCard({
  label,
  value,
  unit,
  subValue,
  subLabel,
  trend,
  icon,
  variant = 'default',
  size = 'md',
}: MetricCardProps) {
  const variantClasses = {
    default: 'bg-slate-800 border-slate-700',
    savings: 'bg-emerald-900 border-emerald-700',
    alert: 'bg-red-900 border-red-700',
    warning: 'bg-amber-900 border-amber-700',
  };

  const variantTextClasses = {
    default: 'text-slate-300',
    savings: 'text-emerald-300',
    alert: 'text-red-300',
    warning: 'text-amber-300',
  };

  const sizeClasses = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  const valueSizeClasses = {
    sm: 'text-2xl',
    md: 'text-3xl',
    lg: 'text-4xl',
  };

  return (
    <div
      className={cn(
        'border rounded-lg',
        variantClasses[variant],
        sizeClasses[size]
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            {label}
          </p>

          <div className="flex items-baseline gap-2">
            <span className={cn(valueSizeClasses[size], 'font-bold text-white')}>
              {value}
            </span>
            {unit && <span className={cn('text-sm font-medium', variantTextClasses[variant])}>{unit}</span>}
          </div>

          {trend && (
            <div className="mt-2 flex items-center gap-1">
              <span
                className={cn(
                  'text-sm font-semibold',
                  trend.direction === 'up' && 'text-red-400',
                  trend.direction === 'down' && 'text-emerald-400',
                  trend.direction === 'stable' && 'text-slate-400'
                )}
              >
                {trend.direction === 'up' && '↑'}
                {trend.direction === 'down' && '↓'}
                {trend.direction === 'stable' && '→'}
                {trend.percentage}%
              </span>
            </div>
          )}

          {subValue && (
            <div className="mt-3 text-xs text-slate-400">
              <span>{subLabel}: </span>
              <span className="font-semibold text-slate-200">{subValue}</span>
            </div>
          )}
        </div>

        {icon && <div className="text-2xl opacity-50">{icon}</div>}
      </div>
    </div>
  );
}
