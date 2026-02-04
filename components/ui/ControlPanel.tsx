import { cn } from '@/lib/utils';
import React from 'react';

interface Device {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'error';
  lastUpdate: Date;
  controls?: Array<{
    id: string;
    label: string;
    icon: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'danger';
  }>;
}

export interface ControlPanelProps {
  title: string;
  devices: Device[];
  onDeviceClick?: (deviceId: string) => void;
  compact?: boolean;
}

export function ControlPanel({
  title,
  devices,
  onDeviceClick,
  compact = false,
}: ControlPanelProps) {
  const statusColors = {
    online: 'border-emerald-500 bg-emerald-950',
    offline: 'border-slate-600 bg-slate-800',
    error: 'border-red-500 bg-red-950',
  };

  const statusDots = {
    online: 'bg-emerald-500',
    offline: 'bg-slate-500',
    error: 'bg-red-600',
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-slate-100 uppercase tracking-wider">{title}</h3>

      <div className={cn('grid gap-3', compact ? 'grid-cols-2' : 'grid-cols-1')}>
        {devices.map((device) => (
          <div
            key={device.id}
            className={cn(
              'border-2 rounded-lg p-4 transition-all cursor-pointer hover:shadow-lg hover:shadow-slate-700',
              statusColors[device.status]
            )}
            onClick={() => onDeviceClick?.(device.id)}
          >
            {/* Device Header */}
            <div className="flex items-center gap-3 mb-3">
              <div className={cn('w-3 h-3 rounded-full animate-pulse', statusDots[device.status])} />
              <div className="flex-1">
                <h4 className="font-bold text-slate-100">{device.name}</h4>
                <p className="text-xs text-slate-400">
                  {device.status === 'online' && '정상 작동'}
                  {device.status === 'offline' && '연결 해제'}
                  {device.status === 'error' && '오류 발생'}
                </p>
              </div>
            </div>

            {/* Controls */}
            {device.controls && device.controls.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {device.controls.map((control) => (
                  <button
                    key={control.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      control.onClick();
                    }}
                    className={cn(
                      'px-3 py-2 rounded text-xs font-semibold transition-colors',
                      control.variant === 'danger' &&
                        'bg-red-600 text-white hover:bg-red-700',
                      control.variant === 'secondary' &&
                        'bg-slate-700 text-slate-200 hover:bg-slate-600',
                      !control.variant &&
                        'bg-emerald-600 text-white hover:bg-emerald-700'
                    )}
                  >
                    {control.icon} {control.label}
                  </button>
                ))}
              </div>
            )}

            {/* Last Update Info */}
            <p className="text-xs text-slate-500 mt-3" suppressHydrationWarning>
              업데이트: {device.lastUpdate.toLocaleTimeString('ko-KR')}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
