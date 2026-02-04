'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

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
      <div className={cn('relative', className)}>
        {/* Background image - frame style */}
        <div className="absolute inset-0 pointer-events-none">
          <Image
            src="/images/ah_image3.png"
            alt=""
            fill
            className="object-fill"
            priority
          />
        </div>
        {/* Content */}
        <div className="relative z-10">
          {title && (
            <div className="flex items-center justify-between px-6 pt-4 pb-2">
              <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider">
                {title}
              </h3>
              {headerRight}
            </div>
          )}
          <div className={cn(!noPadding && 'p-4 pt-2')}>{children}</div>
        </div>
      </div>
    );
  }

  if (variant === 'glow') {
    return (
      <div className={cn('relative', className)}>
        {/* Background image - glow style */}
        <div className="absolute inset-0 pointer-events-none">
          <Image
            src="/images/ah_image2.png"
            alt=""
            fill
            className="object-fill"
            priority
          />
        </div>
        {/* Content */}
        <div className="relative z-10">
          {title && (
            <div className="flex items-center justify-between px-4 py-3">
              <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider">
                {title}
              </h3>
              {headerRight}
            </div>
          )}
          <div className={cn(!noPadding && 'p-4')}>{children}</div>
        </div>
      </div>
    );
  }

  // Default variant - CSS based
  return (
    <div
      className={cn(
        'relative bg-[#0a1929]/90 border border-cyan-500/30 rounded-lg overflow-hidden',
        'shadow-[0_0_15px_rgba(6,182,212,0.2)]',
        className
      )}
    >
      {title && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-500/20">
          <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider">
            {title}
          </h3>
          {headerRight}
        </div>
      )}
      <div className={cn(!noPadding && 'p-4')}>{children}</div>
    </div>
  );
}
