'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface ImageGaugeProps {
  value: number;
  maxValue?: number;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  sublabel?: string;
  showPercentage?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: { width: 80, strokeWidth: 8, fontSize: 'text-lg', labelSize: 'text-[10px]' },
  md: { width: 120, strokeWidth: 10, fontSize: 'text-2xl', labelSize: 'text-xs' },
  lg: { width: 140, strokeWidth: 12, fontSize: 'text-3xl', labelSize: 'text-sm' },
};

// Color stops for gradient based on percentage
function getGaugeColor(percentage: number): string {
  if (percentage >= 90) return '#22c55e'; // green
  if (percentage >= 70) return '#84cc16'; // lime
  if (percentage >= 50) return '#eab308'; // yellow
  if (percentage >= 30) return '#f97316'; // orange
  return '#ef4444'; // red
}

export function ImageGauge({
  value,
  maxValue = 100,
  size = 'md',
  label,
  sublabel,
  showPercentage = true,
  className,
}: ImageGaugeProps) {
  const { width, strokeWidth, fontSize, labelSize } = sizeConfig[size];
  const percentage = Math.min((value / maxValue) * 100, 100);

  const radius = (width - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Start from top (-90deg), fill clockwise
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  const gaugeColor = getGaugeColor(percentage);

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className="relative" style={{ width, height: width }}>
        {/* Background gauge image (optional decorative) */}
        <div className="absolute inset-0 opacity-20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/gauge_loading.png"
            alt=""
            className="w-full h-full object-contain"
            style={{ filter: 'grayscale(100%) brightness(0.5)' }}
          />
        </div>

        {/* SVG Gauge */}
        <svg
          width={width}
          height={width}
          className="absolute inset-0 transform -rotate-90"
          style={{ filter: `drop-shadow(0 0 8px ${gaugeColor}50)` }}
        >
          {/* Background circle */}
          <circle
            cx={width / 2}
            cy={width / 2}
            r={radius}
            fill="none"
            stroke="#1e3a5f"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Progress circle with gradient */}
          <circle
            cx={width / 2}
            cy={width / 2}
            r={radius}
            fill="none"
            stroke={gaugeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-700 ease-out"
          />
          {/* Tick marks */}
          {[0, 25, 50, 75, 100].map((tick) => {
            const angle = (tick / 100) * 360 - 90;
            const radians = (angle * Math.PI) / 180;
            const innerR = radius - strokeWidth / 2 - 4;
            const outerR = radius + strokeWidth / 2 + 4;
            const x1 = width / 2 + innerR * Math.cos(radians);
            const y1 = width / 2 + innerR * Math.sin(radians);
            const x2 = width / 2 + outerR * Math.cos(radians);
            const y2 = width / 2 + outerR * Math.sin(radians);
            return (
              <line
                key={tick}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#334155"
                strokeWidth={1.5}
              />
            );
          })}
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn('font-bold text-white', fontSize)}
            style={{
              textShadow: `0 0 20px ${gaugeColor}80`,
              color: gaugeColor,
            }}
          >
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
