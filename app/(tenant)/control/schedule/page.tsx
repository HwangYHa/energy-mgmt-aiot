'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Calendar,
  Plus,
  Loader2,
  RefreshCw,
  Pause,
  Play,
  Trash2,
  Clock,
  X,
  AlertTriangle,
  CheckCircle2,
  MonitorSmartphone,
} from 'lucide-react';
import { apiGet, apiPost, apiPatch, ApiError } from '@/lib/api/client';
import { toast } from '@/lib/toast';

interface Schedule {
  id: string;
  name: string;
  description: string | null;
  deviceId: string;
  action: string;
  targetValue: number | null;
  scheduleType: string;
  cronExpr: string | null;
  startAt: string;
  endAt: string | null;
  repeatDays: number[] | null;
  priority: number;
  allowOverlap: boolean;
  enabled: boolean;
  status: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
  device: { id: string; name: string; deviceType: string } | null;
}

interface DeviceOption {
  id: string;
  name: string;
  code: string | null;
  deviceType: string;
}

type ScheduleStatusCfg = { label: string; color: string; bg: string };
const STATUS_CONFIG: Record<string, ScheduleStatusCfg> = {
  active: { label: '활성', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  paused: { label: '일시정지', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  completed: { label: '완료', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  expired: { label: '만료', color: 'text-slate-400', bg: 'bg-slate-500/10' },
};

const SCHEDULE_TYPES = [
  { value: 'once', label: '1회 실행' },
  { value: 'daily', label: '매일 반복' },
  { value: 'weekly', label: '주간 반복' },
  { value: 'cron', label: 'Cron 표현식' },
];

const ACTION_OPTIONS = [
  { value: 'start', label: '시작' },
  { value: 'stop', label: '정지' },
  { value: 'setpoint', label: '설정값 변경' },
];

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export default function ScheduleControlPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');

  const fetchSchedules = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ take: '100' });
      if (filterStatus) params.set('status', filterStatus);
      const json = await apiGet<Schedule[]>(`/api/control/schedules?${params}`);
      if (json.success) setSchedules(json.data ?? []);
      else setError('스케줄 목록을 불러오지 못했습니다.');
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus]);

  const fetchDevices = useCallback(async () => {
    try {
      const json = await apiGet<DeviceOption[]>('/api/devices?take=200');
      setDevices(json.data ?? []);
    } catch {
      // 디바이스 목록 로드 실패 시 기본값 유지
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
    fetchDevices();
  }, [fetchSchedules, fetchDevices]);

  const handleAction = async (id: string, action: string) => {
    const labels: Record<string, string> = { pause: '일시정지', resume: '재개', delete: '삭제' };
    if (!confirm(`스케줄을 ${labels[action] || action}하시겠습니까?`)) return;

    try {
      const res = await apiPatch('/api/control/schedules', { id, action });
      if (res.success) {
        toast.success(`스케줄을 ${labels[action] || action}했습니다.`);
        void fetchSchedules();
      } else {
        toast.error(res.message || '작업에 실패했습니다.');
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '작업 실패');
    }
  };

  const filteredSchedules = filterStatus
    ? schedules.filter((s) => s.status === filterStatus)
    : schedules;

  return (
    <div className="min-h-screen bg-[#051225] text-white p-4 md:p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-cyan-500/20 rounded-lg">
              <Calendar className="w-6 h-6 text-cyan-400" />
            </div>
            스케줄 제어
          </h1>
          <p className="text-slate-400 text-sm mt-1">설비/장치 제어 스케줄 관리 - 예약 실행 및 반복 설정</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="">모든 상태</option>
            <option value="active">활성</option>
            <option value="paused">일시정지</option>
            <option value="completed">완료</option>
          </select>
          <button onClick={fetchSchedules} className="p-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 text-slate-400">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> 새 스케줄
          </button>
        </div>
      </div>

      {/* 에러 배너 */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
          <button onClick={fetchSchedules} className="px-3 py-1.5 bg-red-500/20 text-red-300 rounded-lg text-sm hover:bg-red-500/30 transition">
            재시도
          </button>
        </div>
      )}

      {/* 통계 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="전체" value={schedules.length} color="text-cyan-400" />
        <StatCard label="활성" value={schedules.filter((s) => s.status === 'active').length} color="text-emerald-400" />
        <StatCard label="일시정지" value={schedules.filter((s) => s.status === 'paused').length} color="text-amber-400" />
        <StatCard label="완료/만료" value={schedules.filter((s) => s.status === 'completed' || s.status === 'expired').length} color="text-slate-400" />
      </div>

      {/* 스케줄 목록 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
      ) : filteredSchedules.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>등록된 스케줄이 없습니다.</p>
          <button onClick={() => setShowCreate(true)} className="mt-4 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white text-sm">
            첫 스케줄 생성하기
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSchedules.map((schedule) => {
            const cfg = (STATUS_CONFIG[schedule.status] || STATUS_CONFIG.expired) as ScheduleStatusCfg;
            return (
              <div key={schedule.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                    <span className="font-semibold text-white">{schedule.name}</span>
                    {schedule.description && <span className="text-xs text-slate-500">- {schedule.description}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {schedule.status === 'active' && (
                      <button onClick={() => handleAction(schedule.id, 'pause')} className="p-1.5 text-amber-400 hover:bg-amber-500/10 rounded-lg" title="일시정지">
                        <Pause className="w-4 h-4" />
                      </button>
                    )}
                    {schedule.status === 'paused' && (
                      <button onClick={() => handleAction(schedule.id, 'resume')} className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded-lg" title="재개">
                        <Play className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => handleAction(schedule.id, 'delete')} className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg" title="삭제">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div>
                    <span className="text-xs text-slate-500 block">디바이스</span>
                    <span className="text-slate-200 flex items-center gap-1">
                      <MonitorSmartphone className="w-3.5 h-3.5 text-cyan-400" />
                      {schedule.device?.name || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">명령</span>
                    <span className="text-slate-200">{schedule.action}{schedule.targetValue !== null ? ` → ${schedule.targetValue}` : ''}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">유형</span>
                    <span className="text-slate-200">{SCHEDULE_TYPES.find((t) => t.value === schedule.scheduleType)?.label || schedule.scheduleType}</span>
                    {schedule.repeatDays && schedule.repeatDays.length > 0 && (
                      <span className="text-[10px] text-slate-500 ml-1">
                        ({schedule.repeatDays.map((d) => WEEKDAYS[d]).join(',')})
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">시작</span>
                    <span className="text-slate-200 text-xs">{new Date(schedule.startAt).toLocaleString('ko-KR')}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">다음 실행</span>
                    <span className="text-slate-200 text-xs flex items-center gap-1">
                      <Clock className="w-3 h-3 text-cyan-400" />
                      {schedule.nextRunAt ? new Date(schedule.nextRunAt).toLocaleString('ko-KR') : '-'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 생성 모달 */}
      {showCreate && (
        <CreateScheduleModal
          devices={devices}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchSchedules(); }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function CreateScheduleModal({ devices, onClose, onCreated }: { devices: DeviceOption[]; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    deviceId: '',
    name: '',
    description: '',
    action: 'start',
    targetValue: '',
    scheduleType: 'once' as 'once' | 'daily' | 'weekly' | 'cron',
    cronExpr: '',
    startAt: '',
    endAt: '',
    repeatDays: [] as number[],
    priority: 5,
    allowOverlap: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.deviceId || !form.name || !form.startAt) {
      setError('필수 항목을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const payload = {
        ...form,
        targetValue: form.targetValue ? parseFloat(form.targetValue) : undefined,
        startAt: new Date(form.startAt).toISOString(),
        endAt: form.endAt ? new Date(form.endAt).toISOString() : undefined,
        repeatDays: form.repeatDays.length > 0 ? form.repeatDays : undefined,
        cronExpr: form.cronExpr || undefined,
        description: form.description || undefined,
      };

      await apiPost('/api/control/schedules', payload);
      toast.success('스케줄이 생성되었습니다.');
      onCreated();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('스케줄 생성에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleDay = (day: number) => {
    setForm((prev) => ({
      ...prev,
      repeatDays: prev.repeatDays.includes(day)
        ? prev.repeatDays.filter((d) => d !== day)
        : [...prev.repeatDays, day].sort(),
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-cyan-400" /> 새 스케줄 생성
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4" /> {error}
            </div>
          )}

          {/* 디바이스 선택 */}
          <div>
            <label className="text-sm text-slate-300 block mb-1">대상 디바이스 *</label>
            <select
              value={form.deviceId}
              onChange={(e) => setForm({ ...form, deviceId: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
              required
            >
              <option value="">선택하세요</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({d.deviceType})</option>
              ))}
            </select>
          </div>

          {/* 이름 */}
          <div>
            <label className="text-sm text-slate-300 block mb-1">스케줄 이름 *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
              placeholder="예: 업무시간 HVAC 가동"
              required
            />
          </div>

          {/* 명령 */}
          <div>
            <label className="text-sm text-slate-300 block mb-1">제어 명령</label>
            <div className="flex gap-2">
              {ACTION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm({ ...form, action: opt.value })}
                  className={`flex-1 py-2 rounded-lg text-sm border transition ${
                    form.action === opt.value
                      ? 'border-cyan-500 bg-cyan-500/20 text-cyan-400'
                      : 'border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {form.action === 'setpoint' && (
            <div>
              <label className="text-sm text-slate-300 block mb-1">설정값</label>
              <input
                type="number"
                value={form.targetValue}
                onChange={(e) => setForm({ ...form, targetValue: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                placeholder="예: 24"
              />
            </div>
          )}

          {/* 스케줄 유형 */}
          <div>
            <label className="text-sm text-slate-300 block mb-1">스케줄 유형</label>
            <div className="grid grid-cols-4 gap-2">
              {SCHEDULE_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setForm({ ...form, scheduleType: t.value as typeof form.scheduleType })}
                  className={`py-2 rounded-lg text-xs border transition ${
                    form.scheduleType === t.value
                      ? 'border-cyan-500 bg-cyan-500/20 text-cyan-400'
                      : 'border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* 시작/종료 시간 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-300 block mb-1">시작 시간 *</label>
              <input
                type="datetime-local"
                value={form.startAt}
                onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                required
              />
            </div>
            <div>
              <label className="text-sm text-slate-300 block mb-1">종료 시간</label>
              <input
                type="datetime-local"
                value={form.endAt}
                onChange={(e) => setForm({ ...form, endAt: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
          </div>

          {/* 주간 반복 요일 선택 */}
          {form.scheduleType === 'weekly' && (
            <div>
              <label className="text-sm text-slate-300 block mb-1">반복 요일</label>
              <div className="flex gap-2">
                {WEEKDAYS.map((day, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleDay(idx)}
                    className={`w-10 h-10 rounded-lg text-sm font-medium transition ${
                      form.repeatDays.includes(idx)
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-900 border border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Cron 표현식 */}
          {form.scheduleType === 'cron' && (
            <div>
              <label className="text-sm text-slate-300 block mb-1">Cron 표현식</label>
              <input
                type="text"
                value={form.cronExpr}
                onChange={(e) => setForm({ ...form, cronExpr: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono"
                placeholder="0 9 * * 1-5 (평일 9시)"
              />
            </div>
          )}

          {/* 우선순위 / 충돌 허용 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-300 block mb-1">우선순위 (1=최고)</label>
              <input
                type="number"
                min={1}
                max={10}
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 5 })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.allowOverlap}
                  onChange={(e) => setForm({ ...form, allowOverlap: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-cyan-500"
                />
                <span className="text-sm text-slate-300">충돌 허용</span>
              </label>
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm">
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-600 rounded-lg text-white text-sm font-medium flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              생성
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
