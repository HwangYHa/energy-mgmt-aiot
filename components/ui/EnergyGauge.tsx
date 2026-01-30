import { cn } from '@/lib/utils';

interface EnergyGaugeProps {
  current: number;
  max: number;
  unit?: string;
  size?: 'sm' | 'md' | 'lg';
  showTrend?: boolean;
  trend?: 'up' | 'down' | 'stable';
}

export function EnergyGauge({
  current,
  max,
  unit = 'kW',
  size = 'md',
  showTrend = true,
  trend = 'stable',
}: EnergyGaugeProps) {
  const percentage = Math.min((current / max) * 100, 100);

  const sizeClasses = {
    sm: 'h-8',
    md: 'h-12',
    lg: 'h-16',
  };

  const getColor = () => {
    if (percentage >= 80) return 'bg-red-600';
    if (percentage >= 60) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  const trendIndicators = {
    up: '↑',
    down: '↓',
    stable: '→',
  };

  const trendColors = {
    up: 'text-red-500',
    down: 'text-emerald-500',
    stable: 'text-slate-400',
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end">
        <div className="text-2xl font-bold text-slate-100">
          {current.toFixed(1)}<span className="text-sm text-slate-400 ml-1">{unit}</span>
        </div>
        {showTrend && (
          <span className={cn('text-xl font-bold', trendColors[trend])}>
            {trendIndicators[trend]}
          </span>
        )}
      </div>

      {/* Linear gauge bar */}
      <div className={cn('w-full bg-slate-700 rounded-lg overflow-hidden', sizeClasses[size])}>
        <div
          className={cn('h-full transition-all duration-500 rounded-lg', getColor())}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex justify-between text-xs text-slate-400">
        <span>0 {unit}</span>
        <span>{max} {unit}</span>
      </div>
    </div>
  );
}
