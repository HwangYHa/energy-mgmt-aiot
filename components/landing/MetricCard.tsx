'use client';

import { useEffect, useState } from 'react';

/**
 * 카운트업 애니메이션 훅
 */
function useCountUp(end: number, duration: number = 2000) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);

      setCount(Math.floor(progress * end));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [end, duration]);

  return count;
}

interface MetricCardProps {
  value: number;
  suffix: string;
  label: string;
  color: string;
}

/**
 * 지표 카드 (Client Component)
 *
 * 카운트업 애니메이션 → Client Component 필수
 */
export function MetricCard({ value, suffix, label, color }: MetricCardProps) {
  const displayValue = useCountUp(value);

  const colorClasses = {
    emerald: 'text-emerald-400',
    orange: 'text-orange-400',
    yellow: 'text-yellow-400',
    blue: 'text-blue-400',
    green: 'text-green-400',
    purple: 'text-purple-400',
    cyan: 'text-cyan-400',
  } as const;

  return (
    <div className="text-center p-6 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-slate-600 transition-all">
      <div className={`text-5xl font-bold mb-2 ${colorClasses[color as keyof typeof colorClasses]}`}>
        {displayValue}
        {suffix}
      </div>
      <p className="text-slate-300 text-sm">{label}</p>
    </div>
  );
}
