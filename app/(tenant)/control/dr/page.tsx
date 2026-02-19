// app/(tenant)/control/dr/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AlertCircle,
  Zap,
  TrendingDown,
  Calendar,
  Loader2,
  RefreshCw,
  Plus,
  X,
} from 'lucide-react';
import { fetchWithCsrf } from '@/hooks/use-csrf';

interface DREvent {
  id: string;
  name: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  scheduledAt: string;
  endTime: string;
  duration: number;
  targetReduction: number;
  actualReduction: number;
  compensation: number;
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  in_progress: { color: 'bg-emerald-900 text-emerald-200 border-emerald-700', label: '실행 중' },
  scheduled: { color: 'bg-blue-900 text-blue-200 border-blue-700', label: '예정됨' },
  completed: { color: 'bg-slate-800 text-slate-300 border-slate-700', label: '완료됨' },
  cancelled: { color: 'bg-red-900 text-red-200 border-red-700', label: '취소됨' },
};

export default function DRDashboardPage() {
  const [events, setEvents] = useState<DREvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/control/dr-events');
      if (res.ok) {
        const json = await res.json();
        setEvents(json.data || []);
      } else {
        setError('DR 이벤트 목록을 불러오지 못했습니다.');
      }
    } catch {
      setError('서버에 연결할 수 없습니다. 네트워크를 확인해주세요.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleAction = async (eventId: string, action: 'execute' | 'stop' | 'cancel') => {
    setActionLoading(eventId);
    try {
      const res = await fetchWithCsrf('/api/control/dr-events', {
        method: 'PATCH',
        body: JSON.stringify({ eventId, action }),
      });

      if (res.ok) {
        await fetchEvents();
      } else {
        const err = await res.json().catch(() => null);
        alert(err?.error?.message || '작업에 실패했습니다.');
      }
    } catch {
      alert('네트워크 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreate = async (data: {
    name: string;
    scheduledAt: string;
    duration: number;
    targetReduction: number;
    compensation: number;
  }) => {
    try {
      const res = await fetchWithCsrf('/api/control/dr-events', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setShowCreateModal(false);
        await fetchEvents();
      } else {
        const err = await res.json().catch(() => null);
        alert(err?.error?.message || '이벤트 생성에 실패했습니다.');
      }
    } catch {
      alert('네트워크 오류가 발생했습니다. 다시 시도해주세요.');
    }
  };

  const runningCount = events.filter((e) => e.status === 'in_progress').length;
  const totalReduction = events.reduce((sum, e) => sum + e.actualReduction, 0);
  const totalCompensation = events.reduce((sum, e) => sum + e.compensation, 0);
  const avgResponse = events.length > 0
    ? events.filter((e) => e.targetReduction > 0).reduce((sum, e) => {
        return sum + (e.targetReduction > 0 ? (e.actualReduction / e.targetReduction) * 100 : 0);
      }, 0) / Math.max(events.filter((e) => e.targetReduction > 0).length, 1)
    : 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#051225] text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-cyan-400" />
          <p className="text-slate-400">DR 이벤트 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#051225] text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Zap className="w-6 h-6 text-emerald-400" />
              </div>
              수요반응 관리
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              DR 이벤트 실행, 성과 분석 및 보상 관리
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setIsLoading(true); fetchEvents(); }}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              새 이벤트
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
            <button
              onClick={() => { setError(null); setIsLoading(true); fetchEvents(); }}
              className="px-3 py-1.5 bg-red-500/20 text-red-300 rounded-lg text-sm hover:bg-red-500/30 transition"
            >
              재시도
            </button>
          </div>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">실행 중인 이벤트</p>
                <p className="text-3xl font-bold text-emerald-400 mt-2">{runningCount}</p>
              </div>
              <Zap className="w-8 h-8 text-emerald-500 opacity-50" />
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">총 절감량</p>
                <p className="text-3xl font-bold text-amber-400 mt-2">
                  {totalReduction.toFixed(1)}kW
                </p>
              </div>
              <TrendingDown className="w-8 h-8 text-amber-500 opacity-50" />
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">총 보상</p>
                <p className="text-3xl font-bold text-blue-400 mt-2">
                  {totalCompensation >= 1000000
                    ? `₩${(totalCompensation / 1000000).toFixed(1)}M`
                    : `₩${totalCompensation.toLocaleString()}`}
                </p>
              </div>
              <Calendar className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">평균 달성률</p>
                <p className="text-3xl font-bold text-green-400 mt-2">
                  {avgResponse.toFixed(1)}%
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-green-500 opacity-50" />
            </div>
          </div>
        </div>

        {/* Events List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">DR 이벤트 목록</h2>

          {events.length === 0 ? (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-12 text-center">
              <Zap className="w-10 h-10 mx-auto mb-3 text-slate-600" />
              <p className="text-slate-500">등록된 DR 이벤트가 없습니다.</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 px-4 py-2 bg-cyan-500/10 text-cyan-400 rounded-lg hover:bg-cyan-500/20 transition"
              >
                첫 이벤트 생성하기
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => {
                const cfg = (STATUS_CONFIG[event.status] || STATUS_CONFIG.completed) as { color: string; label: string };
                return (
                  <div
                    key={event.id}
                    className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 hover:border-slate-600/50 transition"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-white">{event.name}</h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${cfg.color}`}>
                            {cfg.label}
                          </span>
                        </div>
                        <p className="text-sm text-slate-400">
                          {new Date(event.scheduledAt).toLocaleString('ko-KR')} &bull; {event.duration}분
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {event.status === 'scheduled' && (
                          <button
                            onClick={() => handleAction(event.id, 'execute')}
                            disabled={actionLoading === event.id}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 rounded-lg font-semibold transition text-sm"
                          >
                            {actionLoading === event.id ? '처리중...' : '실행'}
                          </button>
                        )}
                        {event.status === 'in_progress' && (
                          <button
                            onClick={() => handleAction(event.id, 'stop')}
                            disabled={actionLoading === event.id}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-600 rounded-lg font-semibold transition text-sm"
                          >
                            {actionLoading === event.id ? '처리중...' : '중지'}
                          </button>
                        )}
                        {(event.status === 'scheduled' || event.status === 'in_progress') && (
                          <button
                            onClick={() => handleAction(event.id, 'cancel')}
                            disabled={actionLoading === event.id}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 rounded-lg text-slate-300 transition text-sm"
                          >
                            취소
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Event Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-700/50">
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide">목표 감축</p>
                        <p className="text-lg font-bold text-amber-400">{event.targetReduction}kW</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide">실제 감축</p>
                        <p className="text-lg font-bold text-emerald-400">{event.actualReduction}kW</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide">달성률</p>
                        <p className="text-lg font-bold text-blue-400">
                          {event.targetReduction > 0
                            ? `${((event.actualReduction / event.targetReduction) * 100).toFixed(0)}%`
                            : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide">보상</p>
                        <p className="text-lg font-bold text-green-400">
                          {event.compensation >= 1000000
                            ? `₩${Math.round(event.compensation / 1000000)}M`
                            : `₩${event.compensation.toLocaleString()}`}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Performance Summary */}
        {events.filter((e) => e.status === 'completed').length > 0 && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">성과 요약</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-slate-400 mb-3">완료된 이벤트 달성률</h3>
                <div className="space-y-3">
                  {events
                    .filter((e) => e.status === 'completed' && e.targetReduction > 0)
                    .map((event) => {
                      const rate = (event.actualReduction / event.targetReduction) * 100;
                      return (
                        <div key={event.id} className="flex items-center justify-between">
                          <span className="text-sm text-slate-300 truncate mr-4">{event.name}</span>
                          <div className="flex-1 mx-4 h-2 bg-slate-900 rounded max-w-[200px]">
                            <div
                              className={`h-full rounded ${rate >= 100 ? 'bg-emerald-500' : rate >= 80 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${Math.min(rate, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold text-slate-300 w-14 text-right">
                            {rate.toFixed(0)}%
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-400 mb-3">보상 내역</h3>
                <div className="space-y-2">
                  {events
                    .filter((e) => e.compensation > 0)
                    .map((event) => (
                      <div key={event.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                        <span className="text-sm text-slate-300">{event.name}</span>
                        <span className="font-semibold text-emerald-400">
                          ₩{event.compensation.toLocaleString()}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateDREventModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}

function CreateDREventModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (data: {
    name: string;
    scheduledAt: string;
    duration: number;
    targetReduction: number;
    compensation: number;
  }) => void;
}) {
  const [name, setName] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [duration, setDuration] = useState(60);
  const [targetReduction, setTargetReduction] = useState(50);
  const [compensation, setCompensation] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !scheduledAt) return;
    setIsSubmitting(true);
    await onCreate({ name, scheduledAt, duration, targetReduction, compensation });
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold">새 DR 이벤트</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">이벤트 이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="여름철 피크 대응"
              required
              className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">예약 시간</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
              className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">지속 시간 (분)</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                min={10}
                max={480}
                className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">목표 감축 (kW)</label>
              <input
                type="number"
                value={targetReduction}
                onChange={(e) => setTargetReduction(Number(e.target.value))}
                min={0}
                className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">예상 보상 (원)</label>
            <input
              type="number"
              value={compensation}
              onChange={(e) => setCompensation(Number(e.target.value))}
              min={0}
              step={10000}
              className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name || !scheduledAt}
              className="flex-1 py-2.5 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg font-semibold transition"
            >
              {isSubmitting ? '생성 중...' : '생성'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
