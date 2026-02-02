'use client';

import { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface AuthButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'outline';
  glow?: 'blue' | 'purple' | 'green';
}

export function AuthButton({
  children,
  loading = false,
  variant = 'primary',
  glow = 'blue',
  disabled,
  className = '',
  ...props
}: AuthButtonProps) {
  const baseStyles = `
    w-full px-6 py-3
    font-semibold rounded-xl
    transition-all duration-300
    disabled:opacity-50 disabled:cursor-not-allowed
    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-bg
  `;

  const variantStyles = {
    primary: `
      bg-gradient-to-r from-neon-blue to-neon-cyan
      text-white
      hover:shadow-glow-blue
      active:scale-[0.98]
      focus:ring-neon-blue
    `,
    secondary: `
      bg-gradient-to-r from-neon-purple to-neon-blue
      text-white
      hover:shadow-glow-purple
      active:scale-[0.98]
      focus:ring-neon-purple
    `,
    outline: `
      bg-white/5 backdrop-blur-md
      border border-white/20
      text-white
      hover:bg-white/10
      hover:border-white/30
      active:scale-[0.98]
      focus:ring-white/50
    `,
  };

  const glowStyles = {
    blue: 'hover:shadow-glow-blue',
    purple: 'hover:shadow-glow-purple',
    green: 'hover:shadow-glow-green',
  };

  return (
    <button
      disabled={disabled || loading}
      className={`
        ${baseStyles}
        ${variantStyles[variant]}
        ${variant === 'primary' || variant === 'secondary' ? glowStyles[glow] : ''}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          처리 중...
        </span>
      ) : (
        children
      )}
    </button>
  );
}
