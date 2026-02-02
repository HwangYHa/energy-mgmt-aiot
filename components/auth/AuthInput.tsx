'use client';

import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  showPasswordToggle?: boolean;
}

export const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(
  ({ label, error, showPasswordToggle, type, className, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';

    return (
      <div className="space-y-2">
        <label
          htmlFor={props.id}
          className="block text-sm font-medium text-gray-300"
        >
          {label}
        </label>
        <div className="relative">
          <input
            ref={ref}
            type={isPassword && showPassword ? 'text' : type}
            id={props.id}
            className={`
              w-full px-4 py-3
              bg-white/5 backdrop-blur-md
              border border-white/10 rounded-xl
              text-white placeholder-gray-400
              focus:outline-none focus:ring-2 focus:ring-neon-blue/50
              focus:border-neon-blue/50
              transition-all duration-300
              ${error ? 'border-red-500/50 focus:ring-red-500/50' : ''}
              ${className || ''}
            `}
            {...props}
          />
          {isPassword && showPasswordToggle && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2
                         text-gray-400 hover:text-white
                         transition-colors duration-200"
              aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          )}
        </div>
        {error && (
          <p className="text-sm text-red-400 animate-in fade-in slide-in-from-top-1">
            {error}
          </p>
        )}
      </div>
    );
  }
);

AuthInput.displayName = 'AuthInput';
