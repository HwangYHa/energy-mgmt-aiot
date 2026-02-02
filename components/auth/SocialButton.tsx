'use client';

import { ButtonHTMLAttributes, ReactNode } from 'react';

interface SocialButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  children: ReactNode;
  loading?: boolean;
}

export function SocialButton({ 
  icon, 
  children, 
  loading = false,
  disabled = false,
  className = '', 
  ...props 
}: SocialButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`
        w-full px-4 py-3
        bg-white/5 backdrop-blur-md
        border border-white/10 rounded-xl
        text-white
        flex items-center justify-between
        hover:bg-white/10 hover:border-white/20
        active:scale-[0.98]
        transition-all duration-300
        focus:outline-none focus:ring-2 focus:ring-neon-blue/50
        disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
        group
        ${className}
      `}
      {...props}
    >
      <div className="flex items-center gap-3">
        {loading ? (
          <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        ) : (
          <span className="text-white/80 group-hover:text-white transition-colors">
            {icon}
          </span>
        )}
        <span className="font-medium">{children}</span>
      </div>
      <svg
        className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5l7 7-7 7"
        />
      </svg>
    </button>
  );
}