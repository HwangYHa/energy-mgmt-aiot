/**
 * HMI 긴급 알람 배너
 * 위험 수준의 알람을 화면 상단에 표시
 */

'use client';

import { AlertTriangle, X } from 'lucide-react';
import type { Alert } from '@/lib/types/hmi';
import { useState } from 'react';

interface AlertBannerProps {
  alerts: Alert[];
  onDismiss?: (alertId: string) => void;
}

export function AlertBanner({ alerts, onDismiss }: AlertBannerProps) {
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  // 위험 수준 알람만 필터링
  const dangerAlerts = alerts.filter(
    (alert) => alert.severity === 'danger' && !dismissedAlerts.has(alert.id)
  );

  if (dangerAlerts.length === 0) {
    return null;
  }

  const handleDismiss = (alertId: string) => {
    setDismissedAlerts((prev) => new Set(prev).add(alertId));
    onDismiss?.(alertId);
  };

  return (
    <div className="space-y-2 mb-4">
      {dangerAlerts.map((alert) => (
        <div
          key={alert.id}
          className="bg-red-900/30 border-2 border-red-500 rounded-lg p-4 animate-pulse"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h4 className="text-lg font-bold text-red-400 mb-1">{alert.title}</h4>
                  <p className="text-sm text-slate-300 mb-2">{alert.message}</p>
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    {alert.siteName && (
                      <span className="flex items-center gap-1">
                        <span className="font-semibold">사이트:</span>
                        {alert.siteName}
                      </span>
                    )}
                    {alert.deviceName && (
                      <span className="flex items-center gap-1">
                        <span className="font-semibold">설비:</span>
                        {alert.deviceName}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <span className="font-semibold">시간:</span>
                      {new Date(alert.timestamp).toLocaleTimeString('ko-KR')}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleDismiss(alert.id)}
                  className="text-slate-400 hover:text-white transition-colors p-1"
                  aria-label="알람 닫기"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {alert.actionRequired && (
                <div className="mt-2 inline-block bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
                  조치 필요
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
