'use client';

import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
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
    isPositive?: boolean; // true if the direction is good (e.g., consumption down = positive)
  };
  className?: string;
}

const sizeConfig = {
  md: 'text-2xl md:text-3xl',
  lg: 'text-3xl md:text-4xl lg:text-5xl',
  xl: 'text-4xl md:text-5xl lg:text-6xl',
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

  // Determine if trend is positive (good)
  // If isPositive is explicitly set, use that; otherwise "down" is considered positive for metrics like consumption
  const isTrendPositive = trend?.isPositive ?? trend?.direction === 'down';

  return (
    <div className={cn('text-center', className)}>
      <p className="text-cyan-400 text-xs md:text-sm font-medium uppercase tracking-wider mb-1 md:mb-2">
        {label}
      </p>
      <div className="flex items-center justify-center gap-2 md:gap-3">
        {prefix && (
          <span className="text-slate-400 text-lg md:text-xl">{prefix}</span>
        )}
        <span
          className={cn(
            'font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-white tabular-nums',
            sizeConfig[size]
          )}
          style={{
            textShadow: '0 0 30px rgba(6, 182, 212, 0.4)',
          }}
        >
          {formattedValue}
        </span>
        {suffix && (
          <span className="text-slate-400 text-lg md:text-xl">{suffix}</span>
        )}
        {trend && (
          <div
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-full text-xs md:text-sm font-semibold',
              isTrendPositive
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-red-500/20 text-red-400 border border-red-500/30'
            )}
          >
            {trend.direction === 'up' ? (
              <TrendingUp className="w-3 h-3 md:w-4 md:h-4" />
            ) : (
              <TrendingDown className="w-3 h-3 md:w-4 md:h-4" />
            )}
            <span>{trend.value}%</span>
          </div>
        )}
      </div>
      {sublabel && (
        <p className="text-slate-500 text-[10px] md:text-xs mt-1 md:mt-2">{sublabel}</p>
      )}
    </div>
  );
}
