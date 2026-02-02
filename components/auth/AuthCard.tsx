'use client';

import { ReactNode } from 'react';

interface AuthCardProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  className?: string;
}

export function AuthCard({ children, title, subtitle, className = '' }: AuthCardProps) {
  return (
    <div
      className={`
        w-full max-w-md
        bg-white/5 backdrop-blur-xl
        border border-white/10 rounded-2xl
        shadow-glass
        p-8 md:p-10
        ${className}
      `}
    >
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
          {title}
        </h1>
        {subtitle && (
          <p className="text-gray-400 text-sm md:text-base">
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}
