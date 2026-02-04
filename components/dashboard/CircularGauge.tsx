'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface CircularGaugeProps {
  value: number;
  maxValue?: number;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  sublabel?: string;
  color?: 'cyan' | 'green' | 'yellow' | 'red' | 'purple';
  showPercentage?: boolean;
}

const sizeConfig = {
  sm: { width: 80, strokeWidth: 6, fontSize: 'text-lg', labelSize: 'text-[10px]' },
  md: { width: 100, strokeWidth: 8, fontSize: 'text-2xl', labelSize: 'text-xs' },
  lg: { width: 140, strokeWidth: 10, fontSize: 'text-3xl', labelSize: 'text-sm' },
};

const colorConfig = {
  cyan: { stroke: '#06b6d4', glow: 'drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]' },
  green: { stroke: '#10b981', glow: 'drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]' },
  yellow: { stroke: '#eab308', glow: 'drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]' },
  red: { stroke: '#ef4444', glow: 'drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]' },
  purple: { stroke: '#a855f7', glow: 'drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]' },
};

export function CircularGauge({
  value,
  maxValue = 100,
  size = 'md',
  label,
  sublabel,
  color = 'cyan',
  showPercentage = true,
}: CircularGaugeProps) {
  const { width, strokeWidth, fontSize, labelSize } = sizeConfig[size];
  const { stroke, glow } = colorConfig[color];

  const percentage = Math.min((value / maxValue) * 100, 100);
  const radius = (width - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width, height: width }}>
        <svg
          className={cn('transform -rotate-90', glow)}
          width={width}
          height={width}
        >
          {/* Background circle */}
          <circle
            cx={width / 2}
            cy={width / 2}
            r={radius}
            fill="none"
            stroke="#1e3a5f"
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx={width / 2}
            cy={width / 2}
            r={radius}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-500 ease-out"
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('font-bold text-white', fontSize)}>
            {showPercentage ? `${Math.round(percentage)}%` : value.toLocaleString()}
          </span>
        </div>
      </div>
      {label && (
        <span className={cn('mt-2 text-cyan-400 font-medium text-center', labelSize)}>
          {label}
        </span>
      )}
      {sublabel && (
        <span className="text-[10px] text-slate-500 text-center">{sublabel}</span>
      )}
    </div>
  );
}
