/**
 * HMI 설비 상태 위젯
 * 설비 정상/경고/위험 개수 및 이상 설비 목록
 */

'use client';

import { Activity, AlertTriangle, XCircle, CheckCircle, Clock } from 'lucide-react';
import type { EquipmentData } from '@/lib/types/hmi';
import { HMI_STATUS_COLORS } from '@/lib/types/hmi';
import { StatusIndicator } from './StatusIndicator';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

interface EquipmentWidgetProps {
  data: EquipmentData;
}

export function EquipmentWidget({ data }: EquipmentWidgetProps) {
  const colors = HMI_STATUS_COLORS[data.status];

  return (
    <div
      className={`bg-slate-900 border-2 ${colors.border} rounded-lg p-6 ${colors.glow} shadow-lg transition-all`}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 ${colors.bg} rounded`}>
            <Activity className={`w-6 h-6 ${colors.text}`} />
          </div>
          <h3 className="text-lg font-bold text-white">설비</h3>
        </div>
        <StatusIndicator status={data.status} size="lg" pulse={data.status === 'danger'} />
      </div>

      {/* 설비 상태 요약 */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {/* 정상 */}
        <div className="bg-green-900/20 border border-green-500 rounded p-3 text-center">
          <CheckCircle className="w-5 h-5 text-green-400 mx-auto mb-2" />
          <div className="text-2xl font-bold text-green-400">{data.normalCount}</div>
          <div className="text-xs text-slate-400 mt-1">정상</div>
        </div>

        {/* 경고 */}
        <div className="bg-yellow-900/20 border border-yellow-500 rounded p-3 text-center">
          <AlertTriangle className="w-5 h-5 text-yellow-400 mx-auto mb-2" />
          <div className="text-2xl font-bold text-yellow-400">{data.warningCount}</div>
          <div className="text-xs text-slate-400 mt-1">경고</div>
        </div>

        {/* 위험 */}
        <div className="bg-red-900/20 border border-red-500 rounded p-3 text-center">
          <XCircle className="w-5 h-5 text-red-400 mx-auto mb-2" />
          <div className="text-2xl font-bold text-red-400">{data.dangerCount}</div>
          <div className="text-xs text-slate-400 mt-1">위험</div>
        </div>
      </div>

      {/* 전체 설비 개수 */}
      <div className="bg-slate-800 rounded p-3 mb-4">
        <div className="text-center">
          <div className="text-sm text-slate-400 mb-1">전체 설비</div>
          <div className="text-xl font-bold text-white">{data.totalCount}</div>
        </div>
      </div>

      {/* 이상 설비 목록 */}
      <div>
        <div className="text-xs font-semibold text-slate-400 mb-2">최근 이상 설비</div>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {data.abnormalDevices.length === 0 ? (
            <div className="text-center py-6 text-sm text-slate-500">
              모든 설비가 정상입니다
            </div>
          ) : (
            data.abnormalDevices.map((device) => {
              const deviceColors = HMI_STATUS_COLORS[device.status];
              return (
                <div
                  key={device.id}
                  className={`${deviceColors.bg} border ${deviceColors.border} rounded p-2`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusIndicator
                          status={device.status}
                          size="sm"
                          pulse={device.status === 'danger'}
                        />
                        <span className={`text-sm font-semibold ${deviceColors.text}`}>
                          {device.deviceName}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mb-1">{device.deviceType}</div>
                      <div className="text-xs text-slate-300">{device.message}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(device.timestamp), {
                      addSuffix: true,
                      locale: ko,
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 마지막 업데이트 */}
      <div className="mt-4 text-xs text-slate-500 text-right">
        업데이트: {new Date(data.lastUpdate).toLocaleTimeString('ko-KR')}
      </div>
    </div>
  );
}
