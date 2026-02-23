'use client';

import { useState, useEffect } from 'react';
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

interface Milestone {
  id: string;
  year: number;
  title: string;
  status: 'achieved' | 'in_progress' | 'pending';
}

interface EmissionsPoint {
  year: number;
  actual: number | null;
  target: number;
  label: string;
}

const STORAGE_KEY = 'ems:carbon-roadmap';

const DEFAULT_GOAL = 1200; // tCO₂/year
const BASE_YEAR = 2023;
const BASE_EMISSION = 1850; // tCO₂
const TARGET_YEAR = 2030;

const DEFAULT_MILESTONES: Milestone[] = [
  { id: '1', year: 2024, title: 'ISO 14064 인증 취득', status: 'achieved' },
  { id: '2', year: 2025, title: 'RE100 10% 달성', status: 'achieved' },
  { id: '3', year: 2026, title: '에너지 효율화 15% 개선', status: 'in_progress' },
  { id: '4', year: 2027, title: 'RE100 50% 달성', status: 'pending' },
  { id: '5', year: 2028, title: '탄소중립 선언', status: 'pending' },
  { id: '6', year: 2030, title: 'Net-Zero 달성', status: 'pending' },
];

const REDUCTION_MEASURES = [
  { id: 'efficiency', label: '에너지 효율 개선', icon: Zap, progress: 65, reduction: -85, color: 'text-cyan-400', barColor: 'bg-cyan-400' },
  { id: 'renewable', label: '재생에너지 전환', icon: Sun, progress: 30, reduction: -42, color: 'text-yellow-400', barColor: 'bg-yellow-400' },
  { id: 'credits', label: '배출권 구매', icon: ShoppingBag, progress: 15, reduction: -25, color: 'text-emerald-400', barColor: 'bg-emerald-400' },
];

const STATUS_CONFIG = {
  achieved: { label: '달성', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30', icon: CheckCircle2 },
  in_progress: { label: '진행중', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30', icon: Loader2 },
  pending: { label: '미달성', color: 'text-slate-400 bg-slate-500/10 border-slate-500/30', icon: Clock },
};

function buildChartData(goal: number): EmissionsPoint[] {
  const currentYear = new Date().getFullYear();
  // 연도별 실적 (가상 데이터 — 실제는 DB에서)
  const actuals: Record<number, number> = {
    2023: 1850,
    2024: 1720,
    2025: 1643,
  };

  const years = Array.from({ length: TARGET_YEAR - BASE_YEAR + 1 }, (_, i) => BASE_YEAR + i);
  return years.map((year) => {
    const progress = (year - BASE_YEAR) / (TARGET_YEAR - BASE_YEAR);
    const target = Math.round(BASE_EMISSION - (BASE_EMISSION - goal) * progress);
    return {
      year,
      actual: year <= currentYear ? (actuals[year] ?? null) : null,
      target,
      label: String(year),
    };
  });
}

export default function CarbonRoadmapPage() {
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [goalInput, setGoalInput] = useState(String(DEFAULT_GOAL));
  const [milestones, setMilestones] = useState<Milestone[]>(DEFAULT_MILESTONES);
  const [chartData, setChartData] = useState<EmissionsPoint[]>([]);
  const [newMilestone, setNewMilestone] = useState({ year: new Date().getFullYear() + 1, title: '' });
  const [isAddingMilestone, setIsAddingMilestone] = useState(false);

  // localStorage 복원
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { goal?: number; milestones?: Milestone[] };
        if (parsed.goal) {
          setGoal(parsed.goal);
          setGoalInput(String(parsed.goal));
        }
        if (parsed.milestones) setMilestones(parsed.milestones);
      }
    } catch {}
  }, []);

  // localStorage 저장
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ goal, milestones }));
  }, [goal, milestones]);

  // 차트 데이터 재계산
  useEffect(() => {
    setChartData(buildChartData(goal));
  }, [goal]);

  const handleGoalApply = () => {
    const val = Number(goalInput);
    if (!isNaN(val) && val > 0) setGoal(val);
  };

  const handleAddMilestone = () => {
    if (!newMilestone.title.trim()) return;
    setMilestones((prev) => [
      ...prev,
      { id: Date.now().toString(), ...newMilestone, status: 'pending' as Milestone['status'] },
    ].sort((a, b) => a.year - b.year));
    setNewMilestone({ year: new Date().getFullYear() + 1, title: '' });
    setIsAddingMilestone(false);
  };

  const handleDeleteMilestone = (id: string) => {
    setMilestones((prev) => prev.filter((m) => m.id !== id));
  };

  const handleStatusChange = (id: string, status: Milestone['status']) => {
    setMilestones((prev) => prev.map((m) => m.id === id ? { ...m, status } : m));
  };

  const currentEmission = 1643; // tCO₂ (2025 실적)
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
              <Line
                type="monotone"
                dataKey="target"
                name="target"
                stroke="#10b981"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: '#10b981', r: 3 }}
              />
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
        {/* 마일스톤 타임라인 */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700/50 flex items-center justify-between">
            <h2 className="text-base font-semibold">마일스톤 타임라인</h2>
            <button
              onClick={() => setIsAddingMilestone(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              마일스톤 추가
            </button>
          </div>

          {isAddingMilestone && (
            <div className="p-4 bg-slate-900/50 border-b border-slate-700/50 space-y-3">
              <div className="flex gap-3">
                <input
                  type="number"
                  value={newMilestone.year}
                  onChange={(e) => setNewMilestone((f) => ({ ...f, year: Number(e.target.value) }))}
                  className="w-20 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-emerald-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={newMilestone.title}
                  onChange={(e) => setNewMilestone((f) => ({ ...f, title: e.target.value }))}
                  placeholder="마일스톤 내용"
                  className="flex-1 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={handleAddMilestone} className="px-3 py-1.5 bg-emerald-500 text-white text-xs rounded-lg hover:bg-emerald-600 transition">
                  추가
                </button>
                <button onClick={() => setIsAddingMilestone(false)} className="px-3 py-1.5 bg-slate-700/50 text-slate-300 text-xs rounded-lg hover:bg-slate-700 transition">
                  취소
                </button>
              </div>
            </div>
          )}

          <div className="divide-y divide-slate-700/30">
            {milestones.map((m) => {
              const config = STATUS_CONFIG[m.status];
              const StatusIcon = config.icon;
              return (
                <div key={m.id} className="p-4 flex items-start gap-3">
                  <div className={`mt-0.5 flex-shrink-0 w-7 h-7 rounded-full border flex items-center justify-center ${config.color}`}>
                    <StatusIcon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs text-slate-500 font-mono">{m.year}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${config.color}`}>
                        {config.label}
                      </span>
                    </div>
                    <p className="text-sm text-white">{m.title}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <select
                      value={m.status}
                      onChange={(e) => handleStatusChange(m.id, e.target.value as Milestone['status'])}
                      className="text-xs bg-slate-900 border border-slate-700/50 rounded px-1.5 py-1 text-slate-300 focus:outline-none"
                    >
                      <option value="achieved">달성</option>
                      <option value="in_progress">진행중</option>
                      <option value="pending">미달성</option>
                    </select>
                    <button
                      onClick={() => handleDeleteMilestone(m.id)}
                      className="p-1 text-slate-600 hover:text-red-400 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
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
                      <span className={`text-sm font-medium ${m.color}`}>
                        {m.reduction} tCO₂
                      </span>
                      <span className="text-xs text-slate-500">{m.progress}%</span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-slate-700/50 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${m.barColor} rounded-full transition-all duration-500`}
                      style={{ width: `${m.progress}%` }}
                    />
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

          {/* 진행도 경고 */}
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
        마일스톤 및 목표값은 브라우저에 저장됩니다 (로컬 스토리지)
      </div>
    </div>
  );
}
