'use client';

import { ReactNode } from 'react';

interface AuthBackgroundProps {
  children: ReactNode;
}

export function AuthBackground({ children }: AuthBackgroundProps) {
  return (
    <div className="min-h-screen relative overflow-hidden bg-dark-bg">
      {/* 배경 그라데이션 */}
      <div className="absolute inset-0 bg-auth-bg" />
      
      {/* 애니메이션 원형 요소들 */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-neon-blue/20 rounded-full blur-3xl animate-float" />
      <div className="absolute top-1/4 right-0 w-96 h-96 bg-neon-purple/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-neon-green/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '4s' }} />
      
      {/* 별 효과 */}
      <div className="absolute inset-0">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      {/* 메인 컨텐츠 */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        {children}
      </div>
    </div>
  );
}
