'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Radio,
  Plus,
  Search,
  RefreshCw,
  Trash2,
  Eye,
  Loader2,
  X,
  Database,
  AlertCircle,
} from 'lucide-react';
import { fetchWithCsrf } from '@/hooks/use-csrf';

interface Sensor {
  id: string;
  name: string;
  code: string | null;
  serialNumber: string | null;
  sensorType: string;
  manufacturer: string | null;
  model: string | null;
  unit: string | null;
  status: string;
  lastValue: string | null;
  lastSeenAt: string | null;
  installLocation: string | null;
  device: {
    id: string;
    name: string;
    code: string | null;
    status: string;
    siteId?: string;
  };
  createdAt: string;
}

interface DeviceOption {
  id: string;
  name: string;
  code: string | null;
}

const SENSOR_TYPES = [
  { value: 'power_meter', label: '전력계' },
  { value: 'energy_meter', label: '전력량계' },
  { value: 'temperature', label: '온도 센서' },
  { value: 'humidity', label: '습도 센서' },
  { value: 'pressure', label: '압력 센서' },
  { value: 'flow_meter', label: '유량계' },
  { value: 'vibration', label: '진동 센서' },
  { value: 'gas', label: '가스 센서' },
  { value: 'co2', label: 'CO2 센서' },
  { value: 'light', label: '조도 센서' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  online: { label: '온라인', color: 'bg-green-500' },
  offline: { label: '오프라인', color: 'bg-gray-500' },
  error: { label: '오류', color: 'bg-red-500' },
  maintenance: { label: '유지보수', color: 'bg-amber-500' },
};

export default function SensorsPage() {
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState<string | null>(null);
  const [detailSensor, setDetailSensor] = useState<Sensor | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchSensors = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType) params.set('sensorType', filterType);
      if (filterStatus) params.set('status', filterStatus);
      params.set('take', '50');

      const res = await fetch(`/api/sensors?${params}`);
      const json = await res.json();
      if (json.success) {
        setSensors(json.data);
        setTotal(json.pagination?.total || json.data.length);
      }
    } catch {
      console.error('센서 목록 조회 실패');
    } finally {
      setIsLoading(false);
    }
  }, [filterType, filterStatus]);

  const fetchDevices = async () => {
    try {
      const res = await fetch('/api/devices?take=100');
      const json = await res.json();
      const list = json.data || [];
      setDevices(list.map((d: DeviceOption) => ({ id: d.id, name: d.name, code: d.code })));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchSensors();
    fetchDevices();
  }, [fetchSensors]);

  const handleDelete = async (id: string) => {
    if (!confirm('센서를 삭제하시겠습니까?')) return;
    try {
      const res = await fetchWithCsrf(`/api/sensors/${id}`, { method: 'DELETE' });
      if (res.ok) fetchSensors();
    } catch {
      alert('삭제 실패');
    }
  };

  const handleGenerateData = async () => {
    setIsGenerating(true);
    try {
      const res = await fetchWithCsrf('/api/data-collection/generate', {
        method: 'POST',
        body: JSON.stringify({ hours: 24, intervalMinutes: 15 }),
      });
      const json = await res.json();
      if (json.success) {
        alert(`데이터 생성 완료: ${json.data.totalMeasurements}건`);
        fetchSensors();
      } else {
        alert('데이터 생성 실패: ' + (json.error?.message || '오류'));
      }
    } catch {
      alert('데이터 생성 중 오류');
    } finally {
      setIsGenerating(false);
    }
  };

  const viewDetail = async (id: string) => {
    setShowDetailModal(id);
    try {
      const res = await fetch(`/api/sensors/${id}`);
      const json = await res.json();
      if (json.success) setDetailSensor(json.data);
    } catch {
      // ignore
    }
  };

  const filteredSensors = sensors.filter((s) =>
    search ? s.name.toLowerCase().includes(search.toLowerCase()) || s.code?.toLowerCase().includes(search.toLowerCase()) : true
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Radio className="w-7 h-7 text-cyan-400" />
            센서 관리
          </h1>
          <p className="text-gray-400 mt-1">센서 등록/관리 및 데이터 수집 현황</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerateData}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            시뮬레이션 데이터 생성
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg text-sm font-medium transition"
          >
            <Plus className="w-4 h-4" />
            센서 등록
          </button>
        </div>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="전체 센서" value={total} color="text-white" />
        <StatCard label="온라인" value={sensors.filter((s) => s.status === 'online').length} color="text-green-400" />
        <StatCard label="오프라인" value={sensors.filter((s) => s.status === 'offline').length} color="text-gray-400" />
        <StatCard label="오류" value={sensors.filter((s) => s.status === 'error').length} color="text-red-400" />
      </div>

      {/* 필터 바 */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="센서명 또는 코드 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">모든 유형</option>
          {SENSOR_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">모든 상태</option>
          <option value="online">온라인</option>
          <option value="offline">오프라인</option>
          <option value="error">오류</option>
          <option value="maintenance">유지보수</option>
        </select>
        <button onClick={fetchSensors} className="p-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* 센서 테이블 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
      ) : filteredSensors.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Radio className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>등록된 센서가 없습니다.</p>
          <p className="text-sm mt-1">센서 등록 버튼을 눌러 센서를 추가하세요.</p>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/50">
                <th className="text-left py-3 px-4 font-medium text-gray-400">상태</th>
                <th className="text-left py-3 px-4 font-medium text-gray-400">센서명</th>
                <th className="text-left py-3 px-4 font-medium text-gray-400">유형</th>
                <th className="text-left py-3 px-4 font-medium text-gray-400">디바이스</th>
                <th className="text-right py-3 px-4 font-medium text-gray-400">최근값</th>
                <th className="text-left py-3 px-4 font-medium text-gray-400">최근 수신</th>
                <th className="text-center py-3 px-4 font-medium text-gray-400">동작</th>
              </tr>
            </thead>
            <tbody>
              {filteredSensors.map((sensor) => {
                const fallbackStatus = { label: '오프라인', color: 'bg-gray-500' };
                const { label: statusLabel, color: statusDotColor } = STATUS_CONFIG[sensor.status] || fallbackStatus;
                const typeLabel = SENSOR_TYPES.find((t) => t.value === sensor.sensorType)?.label || sensor.sensorType;
                return (
                  <tr key={sensor.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${statusDotColor}`} />
                        <span className="text-xs text-gray-400">{statusLabel}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium">{sensor.name}</div>
                      {sensor.code && <div className="text-xs text-gray-500">{sensor.code}</div>}
                    </td>
                    <td className="py-3 px-4 text-gray-300">{typeLabel}</td>
                    <td className="py-3 px-4 text-gray-300">{sensor.device?.name || '-'}</td>
                    <td className="py-3 px-4 text-right font-mono text-cyan-400">
                      {sensor.lastValue ? `${Number(sensor.lastValue).toFixed(1)} ${sensor.unit || ''}` : '-'}
                    </td>
                    <td className="py-3 px-4 text-gray-400 text-xs">
                      {sensor.lastSeenAt ? new Date(sensor.lastSeenAt).toLocaleString('ko-KR') : '-'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => viewDetail(sensor.id)}
                          className="p-1.5 hover:bg-slate-600 rounded transition"
                          title="상세 보기"
                        >
                          <Eye className="w-4 h-4 text-gray-400" />
                        </button>
                        <button
                          onClick={() => handleDelete(sensor.id)}
                          className="p-1.5 hover:bg-red-900/50 rounded transition"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 센서 등록 모달 */}
      {showCreateModal && (
        <CreateSensorModal
          devices={devices}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchSensors();
          }}
        />
      )}

      {/* 센서 상세 모달 */}
      {showDetailModal && detailSensor && (
        <SensorDetailModal
          sensor={detailSensor}
          onClose={() => { setShowDetailModal(null); setDetailSensor(null); }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function CreateSensorModal({
  devices,
  onClose,
  onCreated,
}: {
  devices: DeviceOption[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    deviceId: '',
    name: '',
    code: '',
    sensorType: 'power_meter',
    manufacturer: '',
    model: '',
    unit: 'kW',
    minRange: 0,
    maxRange: 1000,
    installLocation: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.deviceId || !form.name) {
      setError('디바이스와 센서명은 필수입니다.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      const res = await fetchWithCsrf('/api/sensors', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          code: form.code || undefined,
          manufacturer: form.manufacturer || undefined,
          model: form.model || undefined,
          installLocation: form.installLocation || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        onCreated();
      } else {
        setError(json.error?.message || '등록 실패');
      }
    } catch {
      setError('등록 중 오류 발생');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-lg font-bold">센서 등록</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-900/50 border border-red-700 rounded text-sm text-red-300">{error}</div>
          )}
          <div>
            <label className="block text-sm text-gray-300 mb-1">디바이스 *</label>
            {devices.length === 0 ? (
              <div className="flex items-center gap-2 p-3 bg-amber-900/30 border border-amber-700/50 rounded text-sm text-amber-300">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>등록된 디바이스가 없습니다. <a href="/devices" className="underline hover:text-amber-200">설비 관리</a>에서 먼저 디바이스를 등록하세요.</span>
              </div>
            ) : (
              <select
                value={form.deviceId}
                onChange={(e) => setForm({ ...form, deviceId: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm"
                required
              >
                <option value="">디바이스 선택...</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} {d.code ? `(${d.code})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">센서명 *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm"
              placeholder="예: 1층 전력계"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">센서 코드</label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm"
                placeholder="예: PM-001"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">센서 유형 *</label>
              <select
                value={form.sensorType}
                onChange={(e) => setForm({ ...form, sensorType: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm"
              >
                {SENSOR_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">제조사</label>
              <input
                type="text"
                value={form.manufacturer}
                onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">모델</label>
              <input
                type="text"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">단위</label>
              <input
                type="text"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">최소 범위</label>
              <input
                type="number"
                value={form.minRange}
                onChange={(e) => setForm({ ...form, minRange: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">최대 범위</label>
              <input
                type="number"
                value={form.maxRange}
                onChange={(e) => setForm({ ...form, maxRange: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">설치 위치</label>
            <input
              type="text"
              value={form.installLocation}
              onChange={(e) => setForm({ ...form, installLocation: e.target.value })}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm"
              placeholder="예: 1층 전기실"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition">
              취소
            </button>
            <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg text-sm font-medium transition disabled:opacity-50">
              {isSubmitting ? '등록 중...' : '등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SensorDetailModal({ sensor, onClose }: { sensor: Sensor; onClose: () => void }) {
  const detailFallback = { label: '오프라인', color: 'bg-gray-500' };
  const { label: detailStatusLabel, color: detailDotColor } = STATUS_CONFIG[sensor.status] || detailFallback;
  const typeLabel = SENSOR_TYPES.find((t) => t.value === sensor.sensorType)?.label || sensor.sensorType;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-lg font-bold">센서 상세</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-3 h-3 rounded-full ${detailDotColor}`} />
            <span className="text-lg font-bold">{sensor.name}</span>
            <span className="text-xs text-gray-400 bg-slate-700 px-2 py-1 rounded">{detailStatusLabel}</span>
          </div>

          <InfoRow label="센서 코드" value={sensor.code} />
          <InfoRow label="시리얼 번호" value={sensor.serialNumber} />
          <InfoRow label="유형" value={typeLabel} />
          <InfoRow label="제조사" value={sensor.manufacturer} />
          <InfoRow label="모델" value={sensor.model} />
          <InfoRow label="단위" value={sensor.unit} />
          <InfoRow label="설치 위치" value={sensor.installLocation} />
          <InfoRow label="디바이스" value={sensor.device?.name} />
          <InfoRow
            label="최근 측정값"
            value={sensor.lastValue ? `${Number(sensor.lastValue).toFixed(2)} ${sensor.unit || ''}` : null}
          />
          <InfoRow
            label="최근 수신"
            value={sensor.lastSeenAt ? new Date(sensor.lastSeenAt).toLocaleString('ko-KR') : null}
          />
          <InfoRow
            label="등록일"
            value={new Date(sensor.createdAt).toLocaleDateString('ko-KR')}
          />
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-700/50">
      <span className="text-sm text-gray-400">{label}</span>
      <span className="text-sm font-medium">{value || '-'}</span>
    </div>
  );
}
