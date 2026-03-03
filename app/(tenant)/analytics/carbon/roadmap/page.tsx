'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Target,
  TrendingDown,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  Trash2,
  Loader2,
  Leaf,
  Zap,
  Sun,
  ShoppingBag,
  Pencil,
  Check,
  X,
  RefreshCw,
} from 'lucide-react';
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Line,
  ComposedChart,
} from 'recharts';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api/client';

// ──────────────────────────────────────────────
// 타입 정의
// ──────────────────────────────────────────────

interface Milestone {
  id: string;
  year: number;
  title: string;
  status: 'achieved' | 'in_progress' | 'pending';
  displayOrder: number;
}

interface EmissionsPoint {
  year: number;
  actual: number | null;
  target: number;
  label: string;
}

// ──────────────────────────────────────────────
// 상수
// ──────────────────────────────────────────────

const GOAL_STORAGE_KEY = 'ems:carbon-roadmap-goal';
const DEFAULT_GOAL = 1200;
const BASE_YEAR = 2023;
const BASE_EMISSION = 1850;
const TARGET_YEAR = 2030;

const REDUCTION_MEASURES = [
  { id: 'efficiency', label: '에너지 효율 개선', icon: Zap, progress: 65, reduction: -85, color: 'text-cyan-400', barColor: 'bg-cyan-400' },
  { id: 'renewable', label: '재생에너지 전환', icon: Sun, progress: 30, reduction: -42, color: 'text-yellow-400', barColor: 'bg-yellow-400' },
  { id: 'credits', label: '배출권 구매', icon: ShoppingBag, progress: 15, reduction: -25, color: 'text-emerald-400', barColor: 'bg-emerald-400' },
];

const STATUS_CONFIG = {
  achieved:    { label: '달성',   color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30', icon: CheckCircle2 },
  in_progress: { label: '진행중', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',         icon: Loader2 },
  pending:     { label: '미달성', color: 'text-slate-400 bg-slate-500/10 border-slate-500/30',      icon: Clock },
};

// ──────────────────────────────────────────────
// 유틸리티
// ──────────────────────────────────────────────

function buildChartData(goal: number): EmissionsPoint[] {
  const currentYear = new Date().getFullYear();
  const actuals: Record<number, number> = { 2023: 1850, 2024: 1720, 2025: 1643 };
  return Array.from({ length: TARGET_YEAR - BASE_YEAR + 1 }, (_, i) => BASE_YEAR + i).map((year) => {
    const progress = (year - BASE_YEAR) / (TARGET_YEAR - BASE_YEAR);
    const target = Math.round(BASE_EMISSION - (BASE_EMISSION - goal) * progress);
    return { year, actual: year <= currentYear ? (actuals[year] ?? null) : null, target, label: String(year) };
  });
}

// ──────────────────────────────────────────────
// 페이지 컴포넌트
// ──────────────────────────────────────────────

export default function CarbonRoadmapPage() {
  // 목표 (localStorage 유지)
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [goalInput, setGoalInput] = useState(String(DEFAULT_GOAL));

  // 마일스톤 (DB 연동)
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 차트
  const [chartData, setChartData] = useState<EmissionsPoint[]>(() => buildChartData(DEFAULT_GOAL));

  // 추가 폼
  const [isAddingMilestone, setIsAddingMilestone] = useState(false);
  const [newMilestone, setNewMilestone] = useState({ year: new Date().getFullYear() + 1, title: '' });
  const [isSaving, setIsSaving] = useState(false);

  // 인라인 편집
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ year: 0, title: '' });
  const editTitleRef = useRef<HTMLInputElement>(null);

  // localStorage에서 goal 복원 (Hydration 방지: useEffect 내에서만)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(GOAL_STORAGE_KEY);
      if (saved) {
        const val = Number(saved);
        if (!isNaN(val) && val > 0) { setGoal(val); setGoalInput(String(val)); }
      }
    } catch {}
  }, []);

  // goal 변경 시 localStorage 저장 + 차트 갱신
  useEffect(() => {
    localStorage.setItem(GOAL_STORAGE_KEY, String(goal));
    setChartData(buildChartData(goal));
  }, [goal]);

  // 마일스톤 DB 로드
  const loadMilestones = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiGet('/api/analytics/carbon/roadmap/milestones') as { data: Milestone[] };
      console.log('로드된 마일스톤:', res.data);
      setMilestones((res.data ?? []).sort((a, b) => a.displayOrder - b.displayOrder || a.year - b.year));
    } catch (err) {
      setError(err instanceof Error ? err.message : '마일스톤 조회 실패');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadMilestones(); }, [loadMilestones]);

  // 인라인 편집 시작 시 포커스
  useEffect(() => {
    if (editingId) editTitleRef.current?.focus();
  }, [editingId]);

  // ── 목표 적용 ──
  const handleGoalApply = () => {
    const val = Number(goalInput);
    if (!isNaN(val) && val > 0) setGoal(val);
  };

  // ── 마일스톤 추가 ──
  const handleAddMilestone = async () => {
    const year = newMilestone.year;
    const title = newMilestone.title.trim();
    if (!title) return;

    setIsSaving(true);
    // 낙관적 UI (폼 리셋 전에 값을 지역변수로 캡처)
    const tempId = `temp-${Date.now()}`;
    const optimistic: Milestone = {
      id: tempId,
      year,
      title,
      status: 'pending',
      displayOrder: milestones.length,
    };
    setMilestones((prev) => [...prev, optimistic].sort((a, b) => a.displayOrder - b.displayOrder || a.year - b.year));
    setNewMilestone({ year: new Date().getFullYear() + 1, title: '' });
    setIsAddingMilestone(false);

    try {
      const saved = await apiPost('/api/analytics/carbon/roadmap/milestones', {
        year,
        title,
        status: 'pending',
      }) as unknown as { id: string; displayOrder: number };
      // tempId → 실제 id 교체 (낙관적 UI)
      setMilestones((prev) =>
        prev.map((m) => m.id === tempId ? { ...m, id: saved.id, displayOrder: Number(saved.displayOrder) } : m)
      );
      // DB 상태 확인: 실제 저장된 데이터로 UI 동기화
      await loadMilestones();
    } catch (err) {
      setError(err instanceof Error ? err.message : '마일스톤 추가 실패');
      setMilestones((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setIsSaving(false);
    }
  };

  // ── 상태 변경 ──
  const handleStatusChange = async (id: string, status: Milestone['status']) => {
    setMilestones((prev) => prev.map((m) => m.id === id ? { ...m, status } : m));
    try {
      await apiPatch('/api/analytics/carbon/roadmap/milestones', { id, status });
    } catch (err) {
      setError(err instanceof Error ? err.message : '상태 변경 실패');
      await loadMilestones(); // 롤백
    }
  };

  // ── 인라인 편집 시작 ──
  const handleEditStart = (m: Milestone) => {
    setEditingId(m.id);
    setEditForm({ year: m.year, title: m.title });
  };

  // ── 인라인 편집 저장 ──
  const handleEditSave = async (id: string) => {
    if (!editForm.title.trim()) return;
    const prev = milestones.find((m) => m.id === id);
    // 낙관적 업데이트
    setMilestones((list) =>
      list.map((m) => m.id === id ? { ...m, year: editForm.year, title: editForm.title.trim() } : m)
        .sort((a, b) => a.displayOrder - b.displayOrder || a.year - b.year)
    );
    setEditingId(null);
    try {
      await apiPatch('/api/analytics/carbon/roadmap/milestones', {
        id,
        year: editForm.year,
        title: editForm.title.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '수정 실패');
      if (prev) setMilestones((list) => list.map((m) => m.id === id ? prev : m));
    }
  };

  // ── 삭제 ──
  const handleDeleteMilestone = async (id: string) => {
    const target = milestones.find((m) => m.id === id);
    if (!confirm(`마일스톤 "${target?.title ?? ''}"을(를) 삭제하시겠습니까?`)) return;

    const backup = [...milestones];
    setMilestones((prev) => prev.filter((m) => m.id !== id));
    try {
      await apiDelete(`/api/analytics/carbon/roadmap/milestones?id=${encodeURIComponent(id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제 실패');
      setMilestones(backup);
    }
  };

  const currentEmission = 1643;
  const requiredReduction = currentEmission - goal;
  const reductionPct = Math.round((requiredReduction / currentEmission) * 100);

  return (
    <div className="min-h-screen bg-[#051225] text-white p-4 md:p-6 space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <Target className="w-6 h-6 text-emerald-400" />
          </div>
          탄소중립 로드맵
        </h1>
        <p className="text-slate-400 text-sm mt-1">장기 탄소 감축 목표 설정 및 마일스톤 관리</p>
      </div>

      {/* 오류 배너 */}
      {error && (
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-300">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-400/60 hover:text-red-400 transition">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 목표 설정 카드 */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-emerald-400" />
          {TARGET_YEAR} 탄소중립 목표
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-1">
            <label className="text-xs text-slate-500 mb-1 block">목표 배출량 (tCO₂/년)</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                onBlur={handleGoalApply}
                onKeyDown={(e) => e.key === 'Enter' && handleGoalApply()}
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
              <button
                onClick={handleGoalApply}
                className="px-3 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs hover:bg-emerald-500/30 transition"
              >
                적용
              </button>
            </div>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1">기준연도 ({BASE_YEAR})</p>
            <p className="text-lg font-bold text-white">{BASE_EMISSION.toLocaleString()} tCO₂</p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1">현재 배출량 (2025)</p>
            <p className="text-lg font-bold text-white">{currentEmission.toLocaleString()} tCO₂</p>
          </div>
          <div className={`rounded-lg p-3 ${requiredReduction > 0 ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-red-500/5 border border-red-500/20'}`}>
            <p className="text-xs text-slate-500 mb-1">추가 감축 필요</p>
            <p className={`text-lg font-bold ${requiredReduction > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {requiredReduction > 0 ? `-${requiredReduction.toLocaleString()}` : `+${Math.abs(requiredReduction).toLocaleString()}`} tCO₂
            </p>
            <p className="text-xs text-slate-500">{reductionPct}% 추가 감축</p>
          </div>
        </div>
      </div>

      {/* 감축 경로 차트 */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-cyan-400" />
          연도별 감축 경로
        </h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} unit=" t" />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
                labelStyle={{ color: '#e2e8f0' }}
                formatter={(value: number, name: string) => [
                  `${value?.toLocaleString()} tCO₂`,
                  name === 'actual' ? '실제 배출량' : '목표 배출량',
                ]}
              />
              <Bar dataKey="actual" name="actual" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={40} />
              <Line type="monotone" dataKey="target" name="target" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: '#10b981', r: 3 }} />
              <ReferenceLine y={goal} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: `목표 ${goal.toLocaleString()}t`, fill: '#f59e0b', fontSize: 11 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-6 mt-3 text-xs text-slate-500">
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-blue-500 rounded-sm inline-block" /> 실제 배출량</div>
          <div className="flex items-center gap-1.5"><span className="w-6 border-t-2 border-dashed border-emerald-400 inline-block" /> 목표 감축선</div>
          <div className="flex items-center gap-1.5"><span className="w-6 border-t-2 border-dashed border-amber-400 inline-block" /> {TARGET_YEAR} 목표치</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 마일스톤 타임라인 (DB 연동) */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700/50 flex items-center justify-between">
            <h2 className="text-base font-semibold">마일스톤 타임라인</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={loadMilestones}
                disabled={isLoading}
                className="p-1.5 text-slate-500 hover:text-slate-300 transition"
                title="새로고침"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setIsAddingMilestone(true)}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                마일스톤 추가
              </button>
            </div>
          </div>

          {/* 추가 폼 */}
          {isAddingMilestone && (
            <div className="p-4 bg-slate-900/50 border-b border-slate-700/50 space-y-3">
              <div className="flex gap-3">
                <input
                  type="number"
                  value={newMilestone.year}
                  min={2024}
                  max={2050}
                  onChange={(e) => setNewMilestone((f) => ({ ...f, year: Number(e.target.value) }))}
                  className="w-20 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-emerald-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={newMilestone.title}
                  onChange={(e) => setNewMilestone((f) => ({ ...f, title: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddMilestone()}
                  placeholder="마일스톤 내용"
                  autoFocus
                  className="flex-1 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddMilestone}
                  disabled={!newMilestone.title.trim() || isSaving}
                  className="px-3 py-1.5 bg-emerald-500 text-white text-xs rounded-lg hover:bg-emerald-600 transition disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '추가'}
                </button>
                <button
                  onClick={() => setIsAddingMilestone(false)}
                  className="px-3 py-1.5 bg-slate-700/50 text-slate-300 text-xs rounded-lg hover:bg-slate-700 transition"
                >
                  취소
                </button>
              </div>
            </div>
          )}

          {/* 마일스톤 목록 */}
          <div className="divide-y divide-slate-700/30">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
              </div>
            ) : milestones.length === 0 ? (
              <div className="py-10 text-center text-slate-500 text-sm">
                마일스톤이 없습니다.
              </div>
            ) : (
              milestones.map((m) => {
                const config = STATUS_CONFIG[m.status];
                const StatusIcon = config.icon;
                const isEditing = editingId === m.id;

                return (
                  <div key={m.id} className="p-4 flex items-start gap-3 group">
                    {/* 상태 아이콘 */}
                    <div className={`mt-0.5 flex-shrink-0 w-7 h-7 rounded-full border flex items-center justify-center ${config.color}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                    </div>

                    {/* 내용 — 편집 모드 */}
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="flex gap-2 items-center">
                          <input
                            type="number"
                            value={editForm.year}
                            min={2020}
                            max={2050}
                            onChange={(e) => setEditForm((f) => ({ ...f, year: Number(e.target.value) }))}
                            className="w-16 px-1.5 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-white focus:border-emerald-500 focus:outline-none"
                          />
                          <input
                            ref={editTitleRef}
                            type="text"
                            value={editForm.title}
                            onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleEditSave(m.id);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            className="flex-1 px-1.5 py-1 bg-slate-900 border border-slate-600 rounded text-sm text-white focus:border-emerald-500 focus:outline-none"
                          />
                          <button onClick={() => handleEditSave(m.id)} className="p-1 text-emerald-400 hover:text-emerald-300 transition" title="저장 (Enter)">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditingId(null)} className="p-1 text-slate-500 hover:text-slate-300 transition" title="취소 (Esc)">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs text-slate-500 font-mono">{m.year}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded border ${config.color}`}>
                              {config.label}
                            </span>
                          </div>
                          <p className="text-sm text-white">{m.title}</p>
                        </>
                      )}
                    </div>

                    {/* 액션 */}
                    {!isEditing && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {/* 상태 변경 */}
                        <select
                          value={m.status}
                          onChange={(e) => handleStatusChange(m.id, e.target.value as Milestone['status'])}
                          className="text-xs bg-slate-900 border border-slate-700/50 rounded px-1.5 py-1 text-slate-300 focus:outline-none"
                        >
                          <option value="achieved">달성</option>
                          <option value="in_progress">진행중</option>
                          <option value="pending">미달성</option>
                        </select>
                        {/* 편집 */}
                        <button
                          onClick={() => handleEditStart(m)}
                          className="p-1 text-slate-600 hover:text-cyan-400 transition opacity-0 group-hover:opacity-100"
                          title="편집"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {/* 삭제 */}
                        <button
                          onClick={() => handleDeleteMilestone(m.id)}
                          className="p-1 text-slate-600 hover:text-red-400 transition opacity-0 group-hover:opacity-100"
                          title="삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 감축 수단 현황 */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700/50">
            <h2 className="text-base font-semibold">감축 수단 현황</h2>
            <p className="text-xs text-slate-500 mt-0.5">주요 탄소 감축 활동 진행률</p>
          </div>
          <div className="p-5 space-y-5">
            {REDUCTION_MEASURES.map((m) => {
              const Icon = m.icon;
              return (
                <div key={m.id}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${m.color}`} />
                      <span className="text-sm text-white">{m.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-medium ${m.color}`}>{m.reduction} tCO₂</span>
                      <span className="text-xs text-slate-500">{m.progress}%</span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-slate-700/50 rounded-full overflow-hidden">
                    <div className={`h-full ${m.barColor} rounded-full transition-all duration-500`} style={{ width: `${m.progress}%` }} />
                  </div>
                </div>
              );
            })}

            <div className="pt-3 border-t border-slate-700/50">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">총 감축 기여</span>
                <span className="text-emerald-400 font-semibold">
                  -{REDUCTION_MEASURES.reduce((sum, m) => sum + Math.abs(m.reduction), 0)} tCO₂/년
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
                <span>목표 달성까지 추가 필요</span>
                <span className="text-amber-400">
                  -{Math.max(0, requiredReduction - REDUCTION_MEASURES.reduce((sum, m) => sum + Math.abs(m.reduction), 0)).toLocaleString()} tCO₂
                </span>
              </div>
            </div>
          </div>

          {requiredReduction > REDUCTION_MEASURES.reduce((sum, m) => sum + Math.abs(m.reduction), 0) && (
            <div className="mx-5 mb-5 flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">
                현재 감축 수단으로는 {TARGET_YEAR} 목표 달성이 어렵습니다.
                추가적인 배출권 구매 또는 감축 활동이 필요합니다.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 안내 */}
      <div className="text-center text-xs text-slate-600 pb-2">
        <Leaf className="w-3.5 h-3.5 inline mr-1" />
        마일스톤은 데이터베이스에 저장됩니다 · 목표값은 브라우저에 저장됩니다
      </div>
    </div>
  );
}
