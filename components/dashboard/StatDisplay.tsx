'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface StatDisplayProps {
  value: number | string;
  label: string;
  sublabel?: string;
  suffix?: string;
  prefix?: string;
  size?: 'md' | 'lg' | 'xl';
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
  className?: string;
}

const sizeConfig = {
  md: 'text-3xl',
  lg: 'text-4xl md:text-5xl',
  xl: 'text-5xl md:text-6xl lg:text-7xl',
};

export function StatDisplay({
  value,
  label,
  sublabel,
  suffix,
  prefix,
  size = 'lg',
  trend,
  className,
}: StatDisplayProps) {
  const formattedValue =
    typeof value === 'number'
      ? value.toLocaleString('ko-KR')
      : value;

  return (
    <div className={cn('text-center', className)}>
      <p className="text-cyan-400 text-sm font-medium uppercase tracking-wider mb-2">
        {label}
      </p>
      <div className="flex items-center justify-center gap-2">
        {prefix && (
          <span className="text-slate-400 text-xl">{prefix}</span>
        )}
        <span
          className={cn(
            'font-bold text-white tracking-wider',
            sizeConfig[size]
          )}
          style={{
            textShadow: '0 0 20px rgba(6, 182, 212, 0.5)',
          }}
        >
          {formattedValue}
        </span>
        {suffix && (
          <span className="text-slate-400 text-xl">{suffix}</span>
        )}
        {trend && (
          <div
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium',
              trend.direction === 'up'
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-red-500/20 text-red-400'
            )}
          >
            <span>{trend.direction === 'up' ? '↑' : '↓'}</span>
            <span>{trend.value}%</span>
          </div>
        )}
      </div>
      {sublabel && (
        <p className="text-slate-500 text-xs mt-2">{sublabel}</p>
      )}
    </div>
  );
}
