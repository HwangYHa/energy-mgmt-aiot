'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface DashboardPanelProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  headerRight?: React.ReactNode;
  noPadding?: boolean;
  variant?: 'default' | 'frame' | 'glow';
}

export function DashboardPanel({
  title,
  children,
  className,
  headerRight,
  noPadding = false,
  variant = 'default',
}: DashboardPanelProps) {
  if (variant === 'frame') {
    return (
      <div className={cn('relative group', className)}>
        {/* Background image - frame style */}
        <div className="absolute inset-0 pointer-events-none transition-opacity">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/ah_image3.png"
            alt=""
            className="w-full h-full object-fill"
          />
        </div>
        {/* Subtle border glow on hover */}
        <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg border border-cyan-500/20" />
        {/* Content */}
        <div className="relative z-10">
          {title && (
            <div className="flex items-center justify-between px-4 md:px-5 pt-3 pb-1">
              <h3 className="text-xs md:text-sm font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                <span className="w-1 h-3 bg-cyan-500 rounded-full" />
                {title}
              </h3>
              {headerRight}
            </div>
          )}
          <div className={cn(!noPadding && 'px-3 md:px-4 pb-3 pt-1')}>{children}</div>
        </div>
      </div>
    );
  }

  if (variant === 'glow') {
    return (
      <div className={cn('relative group', className)}>
        {/* Background image - glow style */}
        <div className="absolute inset-0 pointer-events-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/ah_image2.png"
            alt=""
            className="w-full h-full object-fill"
          />
        </div>
        {/* Content */}
        <div className="relative z-10">
          {title && (
            <div className="flex items-center justify-between px-3 py-2">
              <h3 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                {title}
              </h3>
              {headerRight}
            </div>
          )}
          <div className={cn(!noPadding && 'p-3')}>{children}</div>
        </div>
      </div>
    );
  }

  // Default variant - CSS based (HMI style)
  return (
    <div
      className={cn(
        'relative bg-slate-900/95 border border-slate-700/50 rounded-lg overflow-hidden',
        'shadow-lg hover:border-slate-600/50 transition-colors duration-200',
        className
      )}
    >
      {title && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800/50 border-b border-slate-700/50">
          <h3 className="text-xs md:text-sm font-semibold text-slate-200 uppercase tracking-wide">
            {title}
          </h3>
          {headerRight}
        </div>
      )}
      <div className={cn(!noPadding && 'p-3 md:p-4')}>{children}</div>
    </div>
  );
}
