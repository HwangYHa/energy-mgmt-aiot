'use client';

/**
 * /admin/retention — Super Admin 리텐션 & 이탈 예측 대시보드
 *
 * 탭 구성:
 *   1. 개요         — 플랫폼 KPI + 이탈 분포 + 30일 트렌드
 *   2. 이탈 위험    — Churn Score TOP 목록 + 리텐션 액션
 *   3. 온보딩       — TTFV 현황 + 마일스톤 달성률
 *   4. 수익 / ROI   — MRR, ARR, 테넌트별 ROI
 *   5. 리텐션 이력  — 발송된 알림톡/이메일 이력
 *
 * 접근 권한: super_admin 전용
 */

import { useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Shield, AlertTriangle, TrendingUp,
  Users, Building2, Activity, RefreshCw, Loader2,
  CheckCircle2, Clock, Zap, MessageSquare, DollarSign,
  Target, Send, BarChart3, Radio,
} from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api/client';
import { toast } from '@/lib/toast';

// ── 타입 ──────────────────────────────────────────────────────
interface DashboardData {
  platform: {
    totalTenants:     number;
    activeTenants:    number;
    totalUsers:       number;
    totalDevices:     number;
    measurementsToday:number;
    newTenants30d:    number;
    expiringSoon:     number;
    mrr:              number;
    arr:              number;
  };
  churn: {
    distribution: { normal: number; warning: number; critical: number };
    avgScore:      number;
    riskCount:     number;
  };
  onboarding: {
    totalTenants:     number;
    withIoT:          number;
    withFirstData:    number;
    withAiRun:        number;
    withReport:       number;
    avgCompletionPct: number;
    avgTtfvSeconds:   number;
  };
  topRisk: Array<{
    tenantId:     string;
    tenantName:   string;
    churnScore:   number;
    riskLevel:    'critical' | 'warning';
    reasons:      string[];
    onboardingPct:number;
  }>;
  recentActions: Array<{
    id:         string;
    tenantId:   string;
    tenantName: string;
    trigger:    string;
    channel:    string;
    status:     string;
    churnScore: number;
    sentAt:     string;
  }>;
  activityTrend: Array<{ date: string; logins: number; events: number }>;
}

// ── 상수 ──────────────────────────────────────────────────────
const TABS = [
  { id: 'overview',   label: '개요',       icon: BarChart3 },
  { id: 'churn',      label: '이탈 위험',  icon: AlertTriangle },
  { id: 'onboarding', label: '온보딩',     icon: Target },
  { id: 'revenue',    label: '수익 / ROI', icon: DollarSign },
  { id: 'actions',    label: '리텐션 이력',icon: Send },
] as const;
type Tab = typeof TABS[number]['id'];

const RISK_COLOR = {
  critical: { bg: 'bg-red-900/30',    border: 'border-red-500/50',  text: 'text-red-400',    label: '긴급' },
  warning:  { bg: 'bg-amber-900/30',  border: 'border-amber-500/50',text: 'text-amber-400',  label: '주의' },
  normal:   { bg: 'bg-green-900/20',  border: 'border-green-500/30',text: 'text-green-400',  label: '정상' },
};

const CHART_COLORS = ['#22d3ee', '#f59e0b', '#ef4444', '#10b981', '#a78bfa'];

// ── 포맷 헬퍼 ─────────────────────────────────────────────────
const krw = (n: number) => {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000)      return `${(n / 10_000).toFixed(0)}만`;
  return n.toLocaleString();
};
const pct = (part: number, total: number) =>
  total > 0 ? Math.round((part / total) * 100) : 0;
const secToMin = (s: number) => s < 60 ? `${s}초` : `${Math.round(s / 60)}분`;

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export default function RetentionDashboardPage() {
  const [tab, setTab]       = useState<Tab>('overview');
  const [data, setData]     = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalcId, setRecalcId] = useState('');
  const [recalcing, setRecalcing] = useState(false);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<DashboardData>('/api/super-admin/dashboard');
      setData(res.data ?? null);
    } catch {
      toast.error('대시보드 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const recalcChurn = async (tenantId: string) => {
    setRecalcId(tenantId);
    setRecalcing(true);
    try {
      await apiPost('/api/super-admin/churn', { tenantId, triggerRetention: true });
      toast.success('이탈 점수가 재계산되었습니다. 리텐션 액션을 확인하세요.');
      fetchDashboard();
    } catch {
      toast.error('재계산 실패');
    } finally {
      setRecalcId('');
      setRecalcing(false);
    }
  };

  if (loading) return (
    <div className="h-full bg-slate-900 text-white flex items-center justify-center">
      <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
    </div>
  );

  return (
    <div className="h-full bg-slate-900 text-white overflow-y-auto">
      <div className="p-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Shield className="w-7 h-7 text-red-400" />
              리텐션 &amp; 이탈 예측 대시보드
            </h1>
            <p className="text-gray-400 mt-1 text-sm">
              Retention = 가치 경험 × 조직 확산 × 신뢰도 × ROI 체감
            </p>
          </div>
          <button
            onClick={fetchDashboard}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 mb-6 bg-slate-800/50 p-1 rounded-xl w-fit">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                tab === t.id
                  ? 'bg-slate-700 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* 탭 콘텐츠 */}
        {data && (
          <>
            {tab === 'overview'   && <OverviewTab   data={data} />}
            {tab === 'churn'      && <ChurnTab      data={data} onRecalc={recalcChurn} recalcId={recalcId} recalcing={recalcing} />}
            {tab === 'onboarding' && <OnboardingTab data={data} />}
            {tab === 'revenue'    && <RevenueTab    data={data} />}
            {tab === 'actions'    && <ActionsTab    data={data} />}
          </>
        )}
      </div>
    </div>
  );
}

// ── 탭 1: 개요 ───────────────────────────────────────────────
function OverviewTab({ data }: { data: DashboardData }) {
  const { platform, churn } = data;

  const churnPieData = [
    { name: '정상',    value: churn.distribution.normal,   color: '#10b981' },
    { name: '주의',    value: churn.distribution.warning,  color: '#f59e0b' },
    { name: '긴급',    value: churn.distribution.critical, color: '#ef4444' },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      {/* KPI 카드 9개 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard icon={Building2}    label="전체 테넌트"   value={platform.totalTenants}      color="text-cyan-400"   sub={`활성 ${platform.activeTenants}`} />
        <KpiCard icon={Users}        label="전체 사용자"   value={platform.totalUsers}         color="text-blue-400"   />
        <KpiCard icon={Radio}        label="연결 디바이스" value={platform.totalDevices}       color="text-violet-400" />
        <KpiCard icon={Activity}     label="오늘 측정"     value={platform.measurementsToday}  color="text-emerald-400" />
        <KpiCard icon={TrendingUp}   label="신규 (30일)"  value={platform.newTenants30d}      color="text-green-400"  />
        <KpiCard icon={DollarSign}   label="MRR"          value={`₩${krw(platform.mrr)}`}    color="text-yellow-400" isText />
        <KpiCard icon={BarChart3}    label="ARR"          value={`₩${krw(platform.arr)}`}    color="text-orange-400" isText />
        <KpiCard icon={AlertTriangle}label="이탈 위험"    value={churn.riskCount}             color="text-red-400"    sub={`평균 ${churn.avgScore}점`} />
        <KpiCard icon={Clock}        label="만료 임박"    value={platform.expiringSoon}       color="text-amber-400"  sub="14일 내" />
      </div>

      {/* 이탈 분포 + 30일 트렌드 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 이탈 분포 파이 */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">이탈 위험 분포</h3>
          {churnPieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={churnPieData} dataKey="value" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name} ${value}`}>
                    {churnPieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-2">
                {churnPieData.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                    <span className="text-gray-400">{d.name}: {d.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-44 flex items-center justify-center text-gray-500 text-sm">
              점수 데이터 없음 (크론 미실행)
            </div>
          )}
        </div>

        {/* 30일 활동 트렌드 */}
        <div className="lg:col-span-2 bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">30일 사용자 활동 트렌드</h3>
          {data.activityTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={data.activityTrend}>
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }}
                  tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                <Legend />
                <Line type="monotone" dataKey="logins" name="로그인" stroke="#22d3ee" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="events" name="전체 이벤트" stroke="#a78bfa" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex items-center justify-center text-gray-500 text-sm">
              이벤트 데이터 없음 — /api/monitoring/events 연동 필요
            </div>
          )}
        </div>
      </div>

      {/* 이탈 위험 TOP 5 프리뷰 */}
      {data.topRisk.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">이탈 위험 TOP 테넌트</h3>
          <div className="space-y-2">
            {data.topRisk.slice(0, 5).map((t) => {
              const cfg = RISK_COLOR[t.riskLevel];
              return (
                <div key={t.tenantId} className={`flex items-center justify-between rounded-lg p-3 border ${cfg.bg} ${cfg.border}`}>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${cfg.bg} ${cfg.text}`}>
                      {t.churnScore}점
                    </span>
                    <div>
                      <div className="font-medium text-sm">{t.tenantName}</div>
                      <div className="text-xs text-gray-400">{t.reasons[0] ?? ''}</div>
                    </div>
                  </div>
                  <span className={`text-xs font-medium ${cfg.text}`}>{cfg.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 탭 2: 이탈 위험 ──────────────────────────────────────────
function ChurnTab({
  data,
  onRecalc,
  recalcId,
  recalcing,
}: {
  data: DashboardData;
  onRecalc: (id: string) => void;
  recalcId: string;
  recalcing: boolean;
}) {
  const { topRisk } = data;

  if (topRisk.length === 0) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-10 text-center text-gray-400">
        <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
        <p className="font-medium">이탈 위험 테넌트 없음</p>
        <p className="text-sm mt-1">오늘 기준 critical / warning 등급 테넌트가 없습니다.</p>
        <p className="text-xs text-gray-500 mt-2">크론이 실행되지 않은 경우 /api/cron/churn-score 수동 호출 필요</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        이탈 위험 테넌트 {topRisk.length}개 — <span className="text-red-400">긴급(≥70점)</span>은 즉시 컨택 필요
      </p>
      {topRisk.map((t) => {
        const cfg = RISK_COLOR[t.riskLevel];
        const isRecalcing = recalcing && recalcId === t.tenantId;
        return (
          <div key={t.tenantId} className={`rounded-xl border p-5 ${cfg.bg} ${cfg.border}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-3">
                  <span className={`text-2xl font-bold ${cfg.text}`}>{t.churnScore}</span>
                  <span className={`text-xs px-2 py-0.5 rounded font-bold ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
                    {cfg.label}
                  </span>
                  <span className="font-semibold">{t.tenantName}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">온보딩 완료율 {t.onboardingPct}%</p>
              </div>
              <button
                onClick={() => onRecalc(t.tenantId)}
                disabled={recalcing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 rounded-lg transition disabled:opacity-50"
              >
                {isRecalcing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                재계산 + 알림
              </button>
            </div>

            {/* 점수 바 */}
            <div className="mb-3">
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    t.riskLevel === 'critical' ? 'bg-red-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${t.churnScore}%` }}
                />
              </div>
            </div>

            {/* 위험 원인 */}
            {t.reasons.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {t.reasons.slice(0, 5).map((r, i) => (
                  <span key={i} className="text-xs bg-slate-700/60 text-gray-300 px-2 py-0.5 rounded">
                    {r}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── 탭 3: 온보딩 ─────────────────────────────────────────────
function OnboardingTab({ data }: { data: DashboardData }) {
  const { onboarding: ob } = data;
  const total = ob.totalTenants || 1;

  const milestones = [
    { label: 'IoT 게이트웨이 연결',  value: ob.withIoT,       icon: Radio,     color: 'text-cyan-400' },
    { label: '첫 데이터 수집',        value: ob.withFirstData, icon: Activity,  color: 'text-blue-400' },
    { label: 'AI 분석 첫 실행',       value: ob.withAiRun,     icon: Zap,       color: 'text-violet-400' },
    { label: '첫 리포트 생성',        value: ob.withReport,    icon: BarChart3, color: 'text-emerald-400' },
  ];

  return (
    <div className="space-y-6">
      {/* 요약 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard icon={Target}   label="평균 온보딩 완료율" value={`${ob.avgCompletionPct}%`}  color="text-cyan-400"   isText />
        <KpiCard icon={Clock}    label="평균 TTFV"          value={secToMin(ob.avgTtfvSeconds)} color="text-blue-400"   isText />
        <KpiCard icon={Building2}label="총 테넌트"          value={ob.totalTenants}             color="text-gray-400"   />
      </div>

      {/* 마일스톤 달성 현황 */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-5">온보딩 마일스톤 달성률</h3>
        <div className="space-y-5">
          {milestones.map((m, i) => {
            const rate = pct(m.value, total);
            return (
              <div key={i}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <m.icon className={`w-4 h-4 ${m.color}`} />
                    <span className="text-sm">{m.label}</span>
                  </div>
                  <span className={`text-sm font-bold ${m.color}`}>
                    {m.value}/{total} ({rate}%)
                  </span>
                </div>
                <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${rate}%`,
                      background: i === 0 ? '#22d3ee' : i === 1 ? '#60a5fa' : i === 2 ? '#a78bfa' : '#34d399',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 퍼널 차트 */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">온보딩 퍼널</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={milestones.map((m) => ({ name: m.label.replace('첫 ', ''), value: m.value }))}
            layout="vertical"
          >
            <XAxis type="number" domain={[0, total]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} width={110} />
            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
            <Bar dataKey="value" name="달성 테넌트" radius={[0, 4, 4, 0]}>
              {milestones.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── 탭 4: 수익 / ROI ─────────────────────────────────────────
function RevenueTab({ data }: { data: DashboardData }) {
  const { platform } = data;

  return (
    <div className="space-y-6">
      {/* 수익 KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={DollarSign}   label="MRR"          value={`₩${krw(platform.mrr)}`}  color="text-yellow-400" isText sub="월 반복 수익" />
        <KpiCard icon={TrendingUp}   label="ARR"          value={`₩${krw(platform.arr)}`}  color="text-orange-400" isText sub="연 반복 수익" />
        <KpiCard icon={Building2}    label="신규 테넌트"  value={platform.newTenants30d}    color="text-green-400"  sub="30일 내" />
        <KpiCard icon={AlertTriangle}label="만료 임박"    value={platform.expiringSoon}     color="text-amber-400"  sub="14일 내" />
      </div>

      {/* 안내 */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">테넌트별 ROI 상세 조회</h3>
        <p className="text-sm text-gray-400 mb-4">
          특정 테넌트의 에너지 절감액, 탄소 크레딧, ROI(%)를 조회하려면
          <code className="mx-1 px-1.5 py-0.5 bg-slate-700 rounded text-cyan-400 text-xs">
            GET /api/super-admin/roi?tenantId=&lt;id&gt;&amp;months=6
          </code>
          를 호출하세요.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-400">
          <div className="bg-slate-700/50 rounded-lg p-4">
            <p className="font-semibold text-white mb-2">ROI 계산 공식</p>
            <p>에너지 절감액 = 절감 kWh × 전기요금 단가</p>
            <p>탄소 크레딧  = 절감 CO₂ kg × 크레딧 단가</p>
            <p>DR 수익      = 수요반응 참여 수익 합산</p>
            <p className="mt-2 text-cyan-400">ROI(%) = (총 절감 - 구독료) / 구독료 × 100</p>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-4">
            <p className="font-semibold text-white mb-2">KPI 스냅샷 갱신</p>
            <p>매월 말 크론이 자동으로 kpi_snapshot 테이블을 갱신합니다.</p>
            <p className="mt-2">수동 갱신:</p>
            <code className="block mt-1 text-cyan-400">
              GET /api/cron/churn-score?updateKpi=true
            </code>
          </div>
        </div>
      </div>

      {/* MRR */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-1">MRR 추이</h3>
        <p className="text-xs text-gray-500 mb-4">ERP 대시보드 → 재무 탭에서 월별 MRR 차트를 확인하세요.</p>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-400">현재 MRR</span>
          <span className="text-2xl font-bold text-yellow-400">₩{krw(platform.mrr)}</span>
          <TrendingUp className="w-5 h-5 text-green-400" />
        </div>
      </div>
    </div>
  );
}

// ── 탭 5: 리텐션 이력 ────────────────────────────────────────
function ActionsTab({ data }: { data: DashboardData }) {
  const { recentActions } = data;

  const TRIGGER_LABEL: Record<string, string> = {
    churn_critical:    '이탈 긴급',
    churn_warning:     '이탈 주의',
    no_login_7d:       '7일 미접속',
    onboarding_stuck:  '온보딩 막힘',
    payment_failed_3:  '결제 실패',
    roi_negative:      'ROI 마이너스',
  };
  const CHANNEL_ICON: Record<string, string> = {
    kakao: '🍫', email: '📧', sms: '📱', slack: '💬',
  };

  if (recentActions.length === 0) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-10 text-center text-gray-400">
        <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p>최근 30일간 발송된 리텐션 액션이 없습니다.</p>
        <p className="text-xs mt-2 text-gray-600">이탈 위험 탭에서 수동으로 재계산 + 알림 발송 가능</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-400">최근 30일 리텐션 액션 {recentActions.length}건</p>
      {recentActions.map((a) => (
        <div key={a.id} className="bg-slate-800 rounded-lg border border-slate-700 p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-2xl">{CHANNEL_ICON[a.channel] ?? '📨'}</span>
            <div>
              <div className="font-medium text-sm">{a.tenantName}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs bg-slate-700 px-1.5 py-0.5 rounded text-gray-300">
                  {TRIGGER_LABEL[a.trigger] ?? a.trigger}
                </span>
                <span className="text-xs text-gray-500">점수 {a.churnScore}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-xs font-medium ${
              a.status === 'sent' ? 'text-green-400' :
              a.status === 'failed' ? 'text-red-400' : 'text-gray-400'
            }`}>
              {a.status === 'sent' ? '발송됨' : a.status === 'failed' ? '실패' : a.status}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {new Date(a.sentAt).toLocaleDateString('ko-KR')}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 공통 컴포넌트 ─────────────────────────────────────────────
function KpiCard({
  icon: Icon,
  label,
  value,
  color,
  sub,
  isText = false,
}: {
  icon:    typeof Building2;
  label:   string;
  value:   number | string;
  color:   string;
  sub?:    string;
  isText?: boolean;
}) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${color}`}>
        {isText ? value : (typeof value === 'number' ? value.toLocaleString() : value)}
      </div>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}
