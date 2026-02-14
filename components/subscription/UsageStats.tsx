'use client';

import { cn } from '@/lib/utils';
import { Building2, Cpu, Users } from 'lucide-react';

interface UsageItem {
  current: number;
  limit: number | null;
}

interface UsageStatsProps {
  usage: {
    sites: UsageItem;
    devices: UsageItem;
    users: UsageItem;
  };
}

function UsageBar({ label, icon: Icon, current, limit }: {
  label: string;
  icon: typeof Building2;
  current: number;
  limit: number | null;
}) {
  const percentage = limit ? Math.min((current / limit) * 100, 100) : 0;
  const isUnlimited = !limit;

  const barColor = percentage >= 90
    ? 'bg-red-500'
    : percentage >= 70
    ? 'bg-amber-500'
    : 'bg-emerald-500';

  const textColor = percentage >= 90
    ? 'text-red-400'
    : percentage >= 70
    ? 'text-amber-400'
    : 'text-emerald-400';

  return (
    <div className="bg-slate-900/50 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-slate-400" />
        <span className="text-sm text-slate-300">{label}</span>
      </div>

      <div className="flex items-end justify-between mb-2">
        <span className={cn('text-2xl font-bold', textColor)}>{current}</span>
        <span className="text-sm text-slate-500">
          / {isUnlimited ? '무제한' : limit}
        </span>
      </div>

      {!isUnlimited && (
        <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', barColor)}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}

      {!isUnlimited && (
        <p className="text-xs text-slate-500 mt-1">{percentage.toFixed(0)}% 사용</p>
      )}
    </div>
  );
}

export function UsageStats({ usage }: UsageStatsProps) {
  return (
    <div className="mt-6">
      <h3 className="text-sm font-medium text-slate-400 mb-3">리소스 사용량</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <UsageBar label="사이트" icon={Building2} current={usage.sites.current} limit={usage.sites.limit} />
        <UsageBar label="디바이스" icon={Cpu} current={usage.devices.current} limit={usage.devices.limit} />
        <UsageBar label="사용자" icon={Users} current={usage.users.current} limit={usage.users.limit} />
      </div>
    </div>
  );
}
