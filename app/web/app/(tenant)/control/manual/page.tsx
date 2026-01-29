// app/web/app/(tenant)/control/manual/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { 
  Power, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  User,
  Settings,
} from 'lucide-react';

interface Device {
  id: string;
  name: string;
  type: string;
  status: string;
  gateway: {
    id: string;
    name: string;
  };
}

interface ControlCommand {
  deviceId: string;
  command: string;
  value?: any;
  reason?: string;
  requiresApproval: boolean;
}

export default function ManualControlPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [command, setCommand] = useState('');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(false);

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://localhost:4000/api/devices?status=online', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDevices(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    }
  };

  const handleSubmit = async () => {
    if (!selectedDevice || !command) {
      alert('디바이스와 명령을 선택하세요.');
      return;
    }

    setConfirmDialog(false);
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('accessToken');
      const payload: ControlCommand = {
        deviceId: selectedDevice.id,
        command,
        value: value ? JSON.parse(value) : undefined,
        reason: reason || undefined,
        requiresApproval,
      };

      const response = await fetch('http://localhost:4000/api/control', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        alert(requiresApproval ? '승인 요청이 전송되었습니다.' : '제어 명령이 실행되었습니다.');
        
        // 폼 초기화
        setSelectedDevice(null);
        setCommand('');
        setValue('');
        setReason('');
      } else {
        const error = await response.json();
        alert(`오류: ${error.message}`);
      }
    } catch (error) {
      console.error('Failed to execute control:', error);
      alert('제어 실행에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDeviceStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'text-green-400';
      case 'offline':
        return 'text-gray-500';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getCommandOptions = (deviceType: string) => {
    const commands = {
      power_meter: [
        { value: 'reset', label: '계측기 리셋' },
        { value: 'calibrate', label: '캘리브레이션' },
      ],
      hvac: [
        { value: 'power_on', label: '전원 ON' },
        { value: 'power_off', label: '전원 OFF' },
        { value: 'set_temperature', label: '온도 설정' },
        { value: 'set_fan_speed', label: '팬 속도 설정' },
      ],
      lighting: [
        { value: 'turn_on', label: '조명 ON' },
        { value: 'turn_off', label: '조명 OFF' },
        { value: 'dim', label: '밝기 조절' },
      ],
      pump: [
        { value: 'start', label: '펌프 시작' },
        { value: 'stop', label: '펌프 정지' },
        { value: 'set_speed', label: '속도 설정' },
      ],
    };

    return commands[deviceType] || [];
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">🎛️ 수동 제어</h1>
        <p className="text-gray-400 mt-1">실시간 설비 제어</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* 왼쪽: 디바이스 선택 */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            디바이스 선택
          </h2>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {devices.map((device) => (
              <button
                key={device.id}
                onClick={() => {
                  setSelectedDevice(device);
                  setCommand('');
                  setValue('');
                }}
                className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                  selectedDevice?.id === device.id
                    ? 'border-blue-500 bg-blue-900/30'
                    : 'border-gray-700 bg-gray-700/30 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-lg">{device.name}</span>
                  <Power className={`w-5 h-5 ${getDeviceStatusColor(device.status)}`} />
                </div>
                <div className="text-sm text-gray-400">
                  <div>타입: {device.type}</div>
                  <div>게이트웨이: {device.gateway.name}</div>
                  <div className={getDeviceStatusColor(device.status)}>
                    상태: {device.status}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 오른쪽: 제어 명령 */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-bold mb-4">제어 명령</h2>

          {selectedDevice ? (
            <div className="space-y-4">
              {/* 선택된 디바이스 정보 */}
              <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-blue-400" />
                  <span className="font-semibold">선택된 디바이스</span>
                </div>
                <div className="text-2xl font-bold text-blue-400">
                  {selectedDevice.name}
                </div>
                <div className="text-sm text-gray-400 mt-1">
                  {selectedDevice.type} | {selectedDevice.status}
                </div>
              </div>

              {/* 명령 선택 */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  제어 명령 *
                </label>
                <select
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 text-lg"
                >
                  <option value="">명령 선택</option>
                  {getCommandOptions(selectedDevice.type).map((cmd) => (
                    <option key={cmd.value} value={cmd.value}>
                      {cmd.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 값 (선택사항) */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  제어 값 (JSON)
                </label>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder='{"temperature": 24}'
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              {/* 사유 */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  제어 사유
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="제어 사유를 입력하세요"
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                  rows={3}
                />
              </div>

              {/* 승인 필요 */}
              <div className="flex items-center gap-3 bg-yellow-900/30 border border-yellow-700 rounded-lg p-4">
                <input
                  type="checkbox"
                  id="approval"
                  checked={requiresApproval}
                  onChange={(e) => setRequiresApproval(e.target.checked)}
                  className="w-5 h-5"
                />
                <label htmlFor="approval" className="flex-1 cursor-pointer">
                  <div className="font-semibold">관리자 승인 필요</div>
                  <div className="text-sm text-gray-400">
                    체크 시 관리자 승인 후 실행됩니다
                  </div>
                </label>
              </div>

              {/* 실행 버튼 */}
              <button
                onClick={() => setConfirmDialog(true)}
                disabled={!command || isSubmitting}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-bold text-lg transition-colors"
              >
                {isSubmitting ? '실행 중...' : '제어 실행'}
              </button>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              디바이스를 선택하세요
            </div>
          )}
        </div>
      </div>

      {/* 확인 대화상자 */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-8 max-w-md border-2 border-yellow-500">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-8 h-8 text-yellow-400" />
              <h3 className="text-2xl font-bold">제어 확인</h3>
            </div>
            <div className="space-y-2 mb-6 text-gray-300">
              <div><strong>디바이스:</strong> {selectedDevice?.name}</div>
              <div><strong>명령:</strong> {command}</div>
              {value && <div><strong>값:</strong> {value}</div>}
              {reason && <div><strong>사유:</strong> {reason}</div>}
              <div><strong>승인:</strong> {requiresApproval ? '필요' : '불필요'}</div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDialog(false)}
                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold"
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 py-3 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-bold"
              >
                실행
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}