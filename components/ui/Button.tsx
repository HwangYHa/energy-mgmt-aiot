'use client';

import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        // Primary: Main actions (high contrast for quick recognition)
        primary: 'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500',
        
        // Danger: Critical actions (red for immediate visibility)
        danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
        
        // Secondary: Secondary actions
        secondary: 'bg-slate-600 text-white hover:bg-slate-700 focus-visible:ring-slate-500',
        
        // Outline: Tertiary actions (HMI: minimal visual weight)
        outline: 'border-2 border-slate-400 text-slate-300 hover:bg-slate-700 hover:border-slate-300 focus-visible:ring-slate-500',
        
        // Ghost: Minimal actions
        ghost: 'text-slate-300 hover:bg-slate-700 focus-visible:ring-slate-500',
        
        // Warning: Attention-needed actions (amber for caution)
        warning: 'bg-amber-600 text-white hover:bg-amber-700 focus-visible:ring-amber-500',
      },
      size: {
        xs: 'h-7 px-2 text-xs',
        sm: 'h-9 px-3 text-sm',
        md: 'h-11 px-4 text-base',
        lg: 'h-14 px-6 text-lg font-semibold',
        icon: 'h-10 w-10',
        'icon-sm': 'h-8 w-8',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
);

Button.displayName = 'Button';

export { Button, buttonVariants };
