'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Power,
  AlertTriangle,
  CheckCircle,
  Settings,
  Cpu,
  Thermometer,
  Lightbulb,
  Gauge,
  Zap,
  RefreshCw,
  Loader2,
  Play,
  Square,
} from 'lucide-react';
import { apiGet, apiPost, ApiError } from '@/lib/api/client';

interface Device {
  id: string;
  name: string;
  deviceType: string;
  status: 'online' | 'offline' | 'error' | 'maintenance';
  site: {
    id: string;
    name: string;
  };
  controlCapable: boolean;
  controlMode: string;
}

interface ControlCommand {
  deviceId: string;
  action: string;
  reason?: string;
  parameters?: Record<string, unknown>;
  targetValue?: number;
  executionMode: 'manual';
  requiresApproval: boolean;
}

// 설비 유형별 아이콘
const deviceTypeIcons: Record<string, React.ReactNode> = {
  HVAC: <Thermometer className="w-5 h-5" />,
  LIGHTING: <Lightbulb className="w-5 h-5" />,
  METER: <Gauge className="w-5 h-5" />,
  POWER_FACTOR: <Zap className="w-5 h-5" />,
  TEMPERATURE_SENSOR: <Thermometer className="w-5 h-5" />,
  PRODUCTION_EQUIPMENT: <Cpu className="w-5 h-5" />,
  OTHER: <Settings className="w-5 h-5" />,
};

// 명령 옵션 타입
type CommandOption = { value: string; label: string; icon: React.ReactNode };

// 설비 유형별 명령 옵션
const commandOptions: Record<string, CommandOption[]> = {
  HVAC: [
    { value: 'start', label: '가동', icon: <Play className="w-4 h-4" /> },
    { value: 'stop', label: '정지', icon: <Square className="w-4 h-4" /> },
    { value: 'setpoint', label: '온도 설정', icon: <Thermometer className="w-4 h-4" /> },
  ],
  LIGHTING: [
    { value: 'start', label: '점등', icon: <Lightbulb className="w-4 h-4" /> },
    { value: 'stop', label: '소등', icon: <Square className="w-4 h-4" /> },
    { value: 'setpoint', label: '밝기 조절', icon: <Gauge className="w-4 h-4" /> },
  ],
  METER: [
    { value: 'start', label: '계측 시작', icon: <Play className="w-4 h-4" /> },
    { value: 'stop', label: '계측 중지', icon: <Square className="w-4 h-4" /> },
  ],
  PRODUCTION_EQUIPMENT: [
    { value: 'start', label: '가동 시작', icon: <Play className="w-4 h-4" /> },
    { value: 'stop', label: '가동 정지', icon: <Square className="w-4 h-4" /> },
    { value: 'setpoint', label: '속도 설정', icon: <Gauge className="w-4 h-4" /> },
  ],
  DEFAULT: [
    { value: 'start', label: '시작', icon: <Play className="w-4 h-4" /> },
    { value: 'stop', label: '정지', icon: <Square className="w-4 h-4" /> },
  ],
};

export default function ManualControlPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [action, setAction] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [reason, setReason] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [resultMessage, setResultMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 제어 가능한 설비 목록 조회
  const fetchDevices = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiGet<Device[]>('/api/devices?controlCapable=true&take=100');

      if (response.success && response.data) {
        setDevices(response.data);
      } else {
        throw new Error(response.error || '데이터 조회 실패');
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : '알 수 없는 오류');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  // 상태 색상
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'text-emerald-400';
      case 'offline':
        return 'text-slate-500';
      case 'error':
        return 'text-red-400';
      case 'maintenance':
        return 'text-amber-400';
      default:
        return 'text-slate-400';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-emerald-500/20 border-emerald-500/30';
      case 'offline':
        return 'bg-slate-500/20 border-slate-500/30';
      case 'error':
        return 'bg-red-500/20 border-red-500/30';
      case 'maintenance':
        return 'bg-amber-500/20 border-amber-500/30';
      default:
        return 'bg-slate-500/20 border-slate-500/30';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'online':
        return '온라인';
      case 'offline':
        return '오프라인';
      case 'error':
        return '오류';
      case 'maintenance':
        return '점검중';
      default:
        return status;
    }
  };

  // 명령 옵션 가져오기
  const getCommandOptions = (deviceType: string): CommandOption[] => {
    return commandOptions[deviceType] ?? commandOptions.DEFAULT ?? [];
  };

  // 제어 명령 실행
  const handleSubmit = async () => {
    if (!selectedDevice || !action) {
      return;
    }

    setConfirmDialog(false);
    setIsSubmitting(true);
    setResultMessage(null);

    try {
      const payload: ControlCommand = {
        deviceId: selectedDevice.id,
        action,
        executionMode: 'manual',
        requiresApproval,
        ...(targetValue && { targetValue: parseFloat(targetValue) }),
        ...(reason && { reason }),
      };

      const response = await apiPost('/api/control', payload);

      if (response.success) {
        const apiMsg = (response.data as { message?: string } | undefined)?.message;
        setResultMessage({
          type: 'success',
          text: apiMsg ?? (requiresApproval ? '승인 요청이 전송되었습니다' : '제어 명령이 실행되었습니다'),
        });

        // 폼 초기화
        setSelectedDevice(null);
        setAction('');
        setTargetValue('');
        setReason('');
        setRequiresApproval(false);
      } else {
        throw new Error(response.error || '제어 실행 실패');
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setResultMessage({
          type: 'error',
          text: err.message,
        });
      } else {
        setResultMessage({
          type: 'error',
          text: err instanceof Error ? err.message : '제어 실행에 실패했습니다',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#051225] p-4 md:p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-cyan-500/20 rounded-lg">
              <Settings className="w-6 h-6 text-cyan-400" />
            </div>
            수동 제어
          </h1>
          <p className="text-slate-400 text-sm mt-1">실시간 설비 제어 및 명령 전송</p>
        </div>
        <button
          onClick={fetchDevices}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </div>

      {/* 결과 메시지 */}
      {resultMessage && (
        <div
          className={`mb-4 p-4 rounded-lg border flex items-center gap-3 ${
            resultMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}
        >
          {resultMessage.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertTriangle className="w-5 h-5" />
          )}
          {resultMessage.text}
        </div>
      )}

      {/* 로딩 상태 */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto" />
            <p className="mt-4 text-slate-400">설비 목록 로딩 중...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto" />
            <p className="mt-4 text-red-400">{error}</p>
            <button
              onClick={fetchDevices}
              className="mt-4 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg"
            >
              다시 시도
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 왼쪽: 설비 선택 */}
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-cyan-400" />
              제어 가능 설비
              <span className="ml-auto text-sm text-slate-400 font-normal">
                {devices.length}대
              </span>
            </h2>

            {devices.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-slate-500">
                <div className="text-center">
                  <Cpu className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>제어 가능한 설비가 없습니다</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                {devices.map((device) => {
                  const isOffline = device.status === 'offline';
                  return (
                  <button
                    key={device.id}
                    onClick={() => {
                      if (isOffline) return;
                      setSelectedDevice(device);
                      setAction('');
                      setTargetValue('');
                    }}
                    disabled={isOffline}
                    title={isOffline ? '오프라인 상태의 설비는 제어할 수 없습니다' : undefined}
                    className={`w-full p-4 rounded-lg border transition-all text-left ${
                      isOffline
                        ? 'border-slate-700/30 bg-slate-900/20 opacity-50 cursor-not-allowed'
                        : selectedDevice?.id === device.id
                        ? 'border-cyan-500 bg-cyan-500/10'
                        : 'border-slate-700/50 bg-slate-900/30 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${getStatusBg(device.status)}`}>
                          {deviceTypeIcons[device.deviceType] || deviceTypeIcons.OTHER}
                        </div>
                        <span className="font-semibold text-white">{device.name}</span>
                      </div>
                      <Power className={`w-5 h-5 ${getStatusColor(device.status)}`} />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">{device.site.name}</span>
                      <span className={getStatusColor(device.status)}>
                        {getStatusLabel(device.status)}
                      </span>
                    </div>
                  </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 오른쪽: 제어 명령 */}
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-cyan-400" />
              제어 명령
            </h2>

            {selectedDevice ? (
              <div className="space-y-4">
                {/* 선택된 설비 정보 */}
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-cyan-400" />
                    <span className="text-cyan-400 font-medium">선택된 설비</span>
                  </div>
                  <div className="text-xl font-bold text-white">{selectedDevice.name}</div>
                  <div className="text-sm text-slate-400 mt-1">
                    {selectedDevice.deviceType} | {selectedDevice.site.name}
                  </div>
                </div>

                {/* 명령 선택 */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    제어 명령 <span className="text-red-400">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {getCommandOptions(selectedDevice.deviceType).map((cmd) => {
                      if (!cmd) return null;
                      return (
                        <button
                          key={cmd.value}
                          onClick={() => setAction(cmd.value)}
                          className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${
                            action === cmd.value
                              ? 'border-cyan-500 bg-cyan-500/20 text-cyan-400'
                              : 'border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600 hover:text-white'
                          }`}
                        >
                          {cmd.icon}
                          <span className="text-sm">{cmd.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 설정값 (조건부) */}
                {action === 'setpoint' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      설정값
                    </label>
                    <input
                      type="number"
                      value={targetValue}
                      onChange={(e) => setTargetValue(e.target.value)}
                      placeholder="예: 24"
                      className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>
                )}

                {/* 사유 */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    제어 사유
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="제어 사유를 입력하세요 (선택)"
                    rows={3}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 resize-none"
                  />
                </div>

                {/* 승인 필요 */}
                <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                  <input
                    type="checkbox"
                    id="approval"
                    checked={requiresApproval}
                    onChange={(e) => setRequiresApproval(e.target.checked)}
                    className="w-5 h-5 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                  />
                  <label htmlFor="approval" className="flex-1 cursor-pointer">
                    <div className="font-medium text-amber-400">관리자 승인 필요</div>
                    <div className="text-sm text-slate-400">
                      체크 시 관리자 승인 후 실행됩니다
                    </div>
                  </label>
                </div>

                {/* 실행 버튼 */}
                <button
                  onClick={() => setConfirmDialog(true)}
                  disabled={!action || isSubmitting}
                  className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg font-bold text-white text-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      실행 중...
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      제어 실행
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-500">
                <div className="text-center">
                  <Settings className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>제어할 설비를 선택하세요</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 확인 대화상자 */}
      {confirmDialog && selectedDevice && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-amber-500/50 rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-xl font-bold text-white">제어 확인</h3>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between py-2 border-b border-slate-700">
                <span className="text-slate-400">설비</span>
                <span className="text-white font-medium">{selectedDevice.name}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-700">
                <span className="text-slate-400">명령</span>
                <span className="text-cyan-400 font-medium">
                  {getCommandOptions(selectedDevice.deviceType).find((c) => c?.value === action)?.label || action}
                </span>
              </div>
              {targetValue && (
                <div className="flex justify-between py-2 border-b border-slate-700">
                  <span className="text-slate-400">설정값</span>
                  <span className="text-white">{targetValue}</span>
                </div>
              )}
              {reason && (
                <div className="flex justify-between py-2 border-b border-slate-700">
                  <span className="text-slate-400">사유</span>
                  <span className="text-white">{reason}</span>
                </div>
              )}
              <div className="flex justify-between py-2">
                <span className="text-slate-400">승인</span>
                <span className={requiresApproval ? 'text-amber-400' : 'text-emerald-400'}>
                  {requiresApproval ? '필요' : '즉시 실행'}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDialog(false)}
                className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium text-white transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-500 rounded-lg font-medium text-white transition-colors flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" />
                실행
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
