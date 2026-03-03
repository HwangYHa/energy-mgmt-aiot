// app/(tenant)/control/dr/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AlertCircle, Zap, TrendingDown, Calendar, Loader2,
  RefreshCw, Plus, X, Play, Square, Ban, BarChart2,
  DollarSign, CheckCircle2,
} from 'lucide-react';
import { apiGet, apiPost, apiPatch, ApiError } from '@/lib/api/client';
import { toast } from '@/lib/toast';

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

const STATUS_CONFIG = {
  in_progress: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30', label: '실행 중' },
  scheduled:   { bg: 'bg-blue-500/20',    text: 'text-blue-300',    border: 'border-blue-500/30',    label: '예정됨' },
  completed:   { bg: 'bg-slate-700/50',   text: 'text-slate-300',   border: 'border-slate-600/30',   label: '완료됨' },
  cancelled:   { bg: 'bg-red-500/20',     text: 'text-red-300',     border: 'border-red-500/30',     label: '취소됨' },
} as const;

type StatusKey = keyof typeof STATUS_CONFIG;
const DEFAULT_STATUS = STATUS_CONFIG.completed;

type Tab = 'events' | 'performance' | 'compensation';

export default function DRDashboardPage() {
  const [events, setEvents] = useState<DREvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('events');

  const fetchEvents = useCallback(async () => {
    try {
      setError(null);
      const json = await apiGet<DREvent[]>('/api/control/dr-events');
      setEvents(json.data ?? []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'DR 이벤트 목록을 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const handleAction = async (eventId: string, action: 'execute' | 'stop' | 'cancel') => {
    setActionLoading(eventId);
    try {
      await apiPatch('/api/control/dr-events', { eventId, action });
      toast.success(
        action === 'execute' ? 'DR 이벤트가 실행되었습니다.' :
        action === 'stop'    ? 'DR 이벤트가 완료 처리되었습니다.' :
                               'DR 이벤트가 취소되었습니다.'
      );
      await fetchEvents();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '작업에 실패했습니다.');
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
      await apiPost('/api/control/dr-events', data);
      toast.success('DR 이벤트가 생성되었습니다.');
      setShowCreateModal(false);
      await fetchEvents();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '이벤트 생성에 실패했습니다.');
    }
  };

  // Derived stats
  const runningCount    = events.filter((e) => e.status === 'in_progress').length;
  const scheduledCount  = events.filter((e) => e.status === 'scheduled').length;
  const completedEvents = events.filter((e) => e.status === 'completed' && e.targetReduction > 0);
  const totalReduction  = events.reduce((s, e) => s + e.actualReduction, 0);
  const totalCompensation = events.reduce((s, e) => s + e.compensation, 0);
  const avgAchievement  = completedEvents.length > 0
    ? completedEvents.reduce((s, e) => s + (e.actualReduction / e.targetReduction) * 100, 0) / completedEvents.length
    : 0;

  const tabs: { id: Tab; label: string; Icon: React.ElementType }[] = [
    { id: 'events',       label: '이벤트 목록', Icon: Zap },
    { id: 'performance',  label: '성과 분석',   Icon: BarChart2 },
    { id: 'compensation', label: '보상 관리',   Icon: DollarSign },
  ];

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
            <p className="text-slate-400 text-sm mt-1">DR 이벤트 실행, 성과 분석 및 보상 관리</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setIsLoading(true); fetchEvents(); }}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition"
              title="새로고침"
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

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">실행 중</p>
                <p className="text-3xl font-bold text-emerald-400 mt-2">{runningCount}</p>
                <p className="text-xs text-slate-500 mt-1">예정 {scheduledCount}건 대기 중</p>
              </div>
              <Zap className="w-8 h-8 text-emerald-500 opacity-40" />
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">누적 감축량</p>
                <p className="text-3xl font-bold text-amber-400 mt-2">
                  {totalReduction.toFixed(1)}<span className="text-base ml-1">kW</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">완료 이벤트 합산</p>
              </div>
              <TrendingDown className="w-8 h-8 text-amber-500 opacity-40" />
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">누적 보상</p>
                <p className="text-3xl font-bold text-blue-400 mt-2">
                  {totalCompensation >= 1000000
                    ? `₩${(totalCompensation / 1000000).toFixed(2)}M`
                    : `₩${totalCompensation.toLocaleString()}`}
                </p>
                <p className="text-xs text-slate-500 mt-1">확정 + 예상 합산</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-500 opacity-40" />
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">평균 달성률</p>
                <p className={`text-3xl font-bold mt-2 ${
                  avgAchievement >= 90 ? 'text-green-400' :
                  avgAchievement >= 80 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {completedEvents.length > 0 ? `${avgAchievement.toFixed(1)}%` : '-'}
                </p>
                <p className="text-xs text-slate-500 mt-1">완료 {completedEvents.length}건 기준</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500 opacity-40" />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700/50 gap-1">
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === id
                  ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'events' && (
          <EventsTab
            events={events}
            actionLoading={actionLoading}
            onAction={handleAction}
            onCreateClick={() => setShowCreateModal(true)}
          />
        )}
        {activeTab === 'performance' && <PerformanceTab events={events} />}
        {activeTab === 'compensation' && <CompensationTab events={events} />}
      </div>

      {showCreateModal && (
        <CreateDREventModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}

// ── 이벤트 목록 탭 ────────────────────────────────────────────────────────────

function fmtDuration(minutes: number) {
  if (minutes < 60) return `${minutes}분`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
}

function EventsTab({
  events,
  actionLoading,
  onAction,
  onCreateClick,
}: {
  events: DREvent[];
  actionLoading: string | null;
  onAction: (id: string, action: 'execute' | 'stop' | 'cancel') => void;
  onCreateClick: () => void;
}) {
  if (events.length === 0) {
    return (
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-12 text-center">
        <Zap className="w-10 h-10 mx-auto mb-3 text-slate-600" />
        <p className="text-slate-500 mb-4">등록된 DR 이벤트가 없습니다.</p>
        <button
          onClick={onCreateClick}
          className="px-4 py-2 bg-cyan-500/10 text-cyan-400 rounded-lg hover:bg-cyan-500/20 transition"
        >
          첫 이벤트 생성하기
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event) => {
        const cfg = STATUS_CONFIG[event.status as StatusKey] ?? DEFAULT_STATUS;
        const rate = event.targetReduction > 0
          ? (event.actualReduction / event.targetReduction) * 100 : 0;
        const isActive = actionLoading === event.id;

        return (
          <div
            key={event.id}
            className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 hover:border-slate-600/50 transition"
          >
            <div className="flex items-start justify-between mb-4 gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <h3 className="text-lg font-bold text-white truncate">{event.name}</h3>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border flex-shrink-0 ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                    {cfg.label}
                  </span>
                </div>
                <p className="text-sm text-slate-400">
                  {new Date(event.scheduledAt).toLocaleString('ko-KR')}
                  {' · '}
                  {fmtDuration(event.duration)}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {event.status === 'scheduled' && (
                  <button
                    onClick={() => onAction(event.id, 'execute')}
                    disabled={isActive}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 rounded-lg font-semibold transition text-sm"
                  >
                    <Play className="w-3.5 h-3.5" />
                    {isActive ? '처리중...' : '실행'}
                  </button>
                )}
                {event.status === 'in_progress' && (
                  <button
                    onClick={() => onAction(event.id, 'stop')}
                    disabled={isActive}
                    className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-600 rounded-lg font-semibold transition text-sm"
                  >
                    <Square className="w-3.5 h-3.5" />
                    {isActive ? '처리중...' : '중지'}
                  </button>
                )}
                {(event.status === 'scheduled' || event.status === 'in_progress') && (
                  <button
                    onClick={() => onAction(event.id, 'cancel')}
                    disabled={isActive}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 rounded-lg text-slate-300 transition text-sm"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    취소
                  </button>
                )}
              </div>
            </div>

            {/* Metrics row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-700/50">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">목표 감축</p>
                <p className="text-lg font-bold text-amber-400">{event.targetReduction} kW</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">실제 감축</p>
                <p className="text-lg font-bold text-emerald-400">
                  {event.actualReduction > 0 ? `${event.actualReduction} kW` : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">달성률</p>
                <p className={`text-lg font-bold ${
                  rate >= 100 ? 'text-green-400' :
                  rate >= 80  ? 'text-amber-400' :
                  rate > 0    ? 'text-red-400'   : 'text-slate-500'
                }`}>
                  {event.actualReduction > 0 ? `${rate.toFixed(0)}%` : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">보상</p>
                <p className="text-lg font-bold text-blue-400">
                  {event.compensation > 0 ? `₩${event.compensation.toLocaleString()}` : '-'}
                </p>
              </div>
            </div>

            {/* Achievement bar (completed only) */}
            {event.status === 'completed' && event.targetReduction > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-slate-500 w-10">달성</span>
                <div className="flex-1 h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${rate >= 100 ? 'bg-green-500' : rate >= 80 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(rate, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-slate-400 w-12 text-right">{rate.toFixed(0)}%</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── 성과 분석 탭 ────────────────────────────────────────────────────────────

function PerformanceTab({ events }: { events: DREvent[] }) {
  const completed = events.filter((e) => e.status === 'completed' && e.targetReduction > 0);

  if (completed.length === 0) {
    return (
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-12 text-center">
        <BarChart2 className="w-10 h-10 mx-auto mb-3 text-slate-600" />
        <p className="text-slate-500">완료된 DR 이벤트가 없습니다.</p>
      </div>
    );
  }

  const over100 = completed.filter((e) => (e.actualReduction / e.targetReduction) * 100 >= 100).length;
  const over80  = completed.filter((e) => {
    const r = (e.actualReduction / e.targetReduction) * 100;
    return r >= 80 && r < 100;
  }).length;
  const under80 = completed.filter((e) => (e.actualReduction / e.targetReduction) * 100 < 80).length;
  const maxTarget = Math.max(...completed.map((e) => e.targetReduction));

  return (
    <div className="space-y-6">
      {/* Achievement distribution */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-5 text-center">
          <CheckCircle2 className="w-6 h-6 text-green-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-green-400">{over100}</p>
          <p className="text-sm text-slate-400 mt-1">100% 초과 달성</p>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5 text-center">
          <CheckCircle2 className="w-6 h-6 text-amber-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-amber-400">{over80}</p>
          <p className="text-sm text-slate-400 mt-1">80~100% 달성</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5 text-center">
          <AlertCircle className="w-6 h-6 text-red-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-red-400">{under80}</p>
          <p className="text-sm text-slate-400 mt-1">80% 미만</p>
        </div>
      </div>

      {/* Target vs Actual bar chart */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-slate-300 mb-6">이벤트별 목표 vs 실제 감축량 (kW)</h3>
        <div className="space-y-5">
          {completed.map((event) => {
            const targetPct = (event.targetReduction / maxTarget) * 100;
            const actualPct = (event.actualReduction / maxTarget) * 100;
            const rate = (event.actualReduction / event.targetReduction) * 100;
            return (
              <div key={event.id}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-300 truncate mr-4 max-w-[200px]">{event.name}</span>
                  <span className={`text-xs font-bold ${rate >= 100 ? 'text-green-400' : rate >= 80 ? 'text-amber-400' : 'text-red-400'}`}>
                    {rate.toFixed(0)}%
                  </span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 w-10 text-right flex-shrink-0">목표</span>
                    <div className="flex-1 h-3 bg-slate-900 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500/60 rounded-full" style={{ width: `${targetPct}%` }} />
                    </div>
                    <span className="text-xs text-amber-400 w-14 text-right flex-shrink-0">{event.targetReduction} kW</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 w-10 text-right flex-shrink-0">실제</span>
                    <div className="flex-1 h-3 bg-slate-900 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${rate >= 100 ? 'bg-green-500' : rate >= 80 ? 'bg-emerald-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(actualPct, targetPct)}%` }}
                      />
                    </div>
                    <span className="text-xs text-emerald-400 w-14 text-right flex-shrink-0">{event.actualReduction} kW</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-6 flex items-center gap-6 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full bg-amber-500/60" />목표
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full bg-emerald-500" />실제
          </span>
        </div>
      </div>

      {/* Achievement table */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">이벤트별 성과 상세</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 uppercase tracking-wide border-b border-slate-700/50">
                <th className="text-left py-2 pr-4">이벤트</th>
                <th className="text-right py-2 px-4">목표 (kW)</th>
                <th className="text-right py-2 px-4">실제 (kW)</th>
                <th className="text-right py-2 px-4">달성률</th>
                <th className="text-right py-2 pl-4">지속시간</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {completed.map((event) => {
                const rate = (event.actualReduction / event.targetReduction) * 100;
                return (
                  <tr key={event.id} className="hover:bg-slate-700/20 transition">
                    <td className="py-3 pr-4 text-slate-200 max-w-[180px] truncate">{event.name}</td>
                    <td className="py-3 px-4 text-right text-amber-400 font-medium">{event.targetReduction}</td>
                    <td className="py-3 px-4 text-right text-emerald-400 font-medium">{event.actualReduction}</td>
                    <td className={`py-3 px-4 text-right font-bold ${rate >= 100 ? 'text-green-400' : rate >= 80 ? 'text-amber-400' : 'text-red-400'}`}>
                      {rate.toFixed(1)}%
                    </td>
                    <td className="py-3 pl-4 text-right text-slate-400">{fmtDuration(event.duration)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── 보상 관리 탭 ────────────────────────────────────────────────────────────

function CompensationTab({ events }: { events: DREvent[] }) {
  const confirmed = events.filter((e) => e.status === 'completed' && e.compensation > 0);
  const pending   = events.filter((e) => (e.status === 'in_progress' || e.status === 'scheduled') && e.compensation > 0);
  const totalConfirmed = confirmed.reduce((s, e) => s + e.compensation, 0);
  const totalPending   = pending.reduce((s, e) => s + e.compensation, 0);
  const withComp = events.filter((e) => e.compensation > 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-5">
          <p className="text-slate-400 text-sm mb-2">확정 보상</p>
          <p className="text-2xl font-bold text-green-400">₩{totalConfirmed.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-1">완료 이벤트 {confirmed.length}건</p>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5">
          <p className="text-slate-400 text-sm mb-2">예상 보상</p>
          <p className="text-2xl font-bold text-amber-400">₩{totalPending.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-1">진행 중 + 예정 {pending.length}건</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-5">
          <p className="text-slate-400 text-sm mb-2">기준 단가</p>
          <p className="text-2xl font-bold text-blue-400">₩1,000</p>
          <p className="text-xs text-slate-500 mt-1">kWh당 (K-PX 기준)</p>
        </div>
      </div>

      {/* Compensation table */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">보상 내역</h3>
        {withComp.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-8">보상 내역이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wide border-b border-slate-700/50">
                  <th className="text-left py-2 pr-4">이벤트</th>
                  <th className="text-center py-2 px-4">상태</th>
                  <th className="text-right py-2 px-4">실제 감축 (kW)</th>
                  <th className="text-right py-2 px-4">지속시간</th>
                  <th className="text-right py-2 pl-4">보상액</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {withComp.map((event) => {
                  const cfg = STATUS_CONFIG[event.status as StatusKey] ?? DEFAULT_STATUS;
                  return (
                    <tr key={event.id} className="hover:bg-slate-700/20 transition">
                      <td className="py-3 pr-4 text-slate-200 max-w-[180px] truncate">{event.name}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-400 font-medium">
                        {event.actualReduction > 0 ? event.actualReduction : '-'}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-400">
                        {fmtDuration(event.duration)}
                      </td>
                      <td className={`py-3 pl-4 text-right font-bold ${event.status === 'completed' ? 'text-green-400' : 'text-amber-400'}`}>
                        ₩{event.compensation.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-600/50">
                  <td colSpan={4} className="pt-3 text-slate-400 font-medium">합계</td>
                  <td className="pt-3 text-right font-bold text-white">
                    ₩{(totalConfirmed + totalPending).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 새 이벤트 생성 모달 ────────────────────────────────────────────────────

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
  }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [duration, setDuration] = useState(60);
  const [targetReduction, setTargetReduction] = useState(50);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-calculate: targetReduction kW × (duration / 60) h × 1,000 원/kWh
  const estimatedComp = Math.round(targetReduction * (duration / 60) * 1000);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !scheduledAt) return;
    setIsSubmitting(true);
    await onCreate({ name, scheduledAt, duration, targetReduction, compensation: estimatedComp });
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold">새 DR 이벤트</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded transition">
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
              placeholder="3월 동계 피크 DR"
              required
              className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
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
              <label className="block text-sm font-medium text-slate-300 mb-1">지속시간 (분)</label>
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
                min={1}
                className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>
          </div>

          {/* Auto-calculated compensation */}
          <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-lg p-4">
            <p className="text-xs text-slate-400 mb-1">예상 보상 (자동 계산)</p>
            <p className="text-xl font-bold text-cyan-400">₩{estimatedComp.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-1">
              {targetReduction} kW × {(duration / 60).toFixed(1)}h × ₩1,000/kWh
            </p>
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
