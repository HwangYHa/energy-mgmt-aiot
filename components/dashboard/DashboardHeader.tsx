'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface DashboardHeaderProps {
  title?: string;
  subtitle?: string;
  className?: string;
}

export function DashboardHeader({
  title = 'Energy Operation and Management',
  subtitle,
  className,
}: DashboardHeaderProps) {
  return (
    <div className={cn('relative w-full h-16 md:h-20 mb-3', className)}>
      {/* Background banner image */}
      <div className="absolute inset-0 flex justify-center overflow-hidden">
        <div className="relative w-full max-w-3xl h-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/ah_image5.png"
            alt=""
            className="w-full h-full object-contain opacity-90"
          />
        </div>
      </div>

      {/* Gradient overlay for better text readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#051225]/80 via-transparent to-[#051225]/80" />

      {/* Overlay title */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <h1
          className="text-lg md:text-xl lg:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-cyan-400 to-cyan-300 tracking-wider uppercase"
          style={{
            textShadow: '0 0 30px rgba(6, 182, 212, 0.6)',
            filter: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.4))',
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className="text-[10px] md:text-xs text-cyan-200/60 mt-0.5 font-mono tracking-wide"
            suppressHydrationWarning
          >
            {subtitle}
          </p>
        )}
      </div>

      {/* Bottom border glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2/3 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
    </div>
  );
}
