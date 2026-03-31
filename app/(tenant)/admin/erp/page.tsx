'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  TrendingUp, DollarSign, FileText, Users, Cpu, Building2,
  Activity, RefreshCw, ChevronUp, ChevronDown, CheckCircle,
  Clock, BarChart3, Wifi, Shield,
  Package, CreditCard, UserCheck, Globe, Server,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';
import { apiGet, apiPost, apiPatch } from '@/lib/api/client';

// ── 타입 ─────────────────────────────────────────────────────
interface FinanceData {
  mrr: number; arr: number; arpu: number;
  activeSubscriptions: number; newSubscriptions: number;
  churnedSubscriptions: number; churnRate: string;
  planDistribution: Record<string, number>;
  revenueTrend: { period: string; revenue: number }[];
  plans: { id: string; name: string; tier: string; monthlyPrice: number }[];
}
interface AccountingData {
  invoices: Invoice[];
  summary: { total: number; draft: number; sent: number; paid: number; overdue: number; totalAmount: number; paidAmount: number };
}
interface Invoice {
  id: string; invoiceNo: string; tenantId: string;
  periodStart: string; status: string;
  subtotal: number; taxAmount: number; total: number;
  dueDate: string; paidAt: string | null;
  lineItems: { id: string; description: string; quantity: number; unitPrice: number; amount: number }[];
}
interface OperationsData {
  devices:  { total: number; online: number; offline: number };
  gateways: { total: number; online: number; offline: number };
  sites:    { total: number };
  mqtt:     { today: number; trend: { date: string; messages: number }[] };
  security: { openAlerts: number; periodEvents: number };
}
interface HRData {
  totalUsers: number; activeUsers: number; inactiveUsers: number;
  newUsers: number; adminUsers: number; recentLogins: number;
  roleDistribution: Record<string, number>;
  signupTrend: { date: string; count: number }[];
}
interface TenantItem {
  id: string; name: string; status: string; industryType: string;
  createdAt: string; sites: number; devices: number; users: number;
  plan: string; planTier: string | null; mrr: number;
}
interface TenantsData {
  total: number; active: number; suspended: number; terminated: number;
  newTenants: number; industryDistribution: Record<string, number>;
  tenantList: TenantItem[];
}

type Module = 'overview' | 'finance' | 'accounting' | 'operations' | 'hr' | 'tenants';

// ── 유틸 ─────────────────────────────────────────────────────
function krw(n: number | undefined | null): string {
  const v = Number(n ?? 0);
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억`;
  if (v >= 10_000)      return `${(v / 10_000).toFixed(0)}만`;
  return v.toLocaleString();
}

function fmt(n: number | undefined | null): string {
  return Number(n ?? 0).toLocaleString();
}

const TIER_COLORS: Record<string, string> = {
  trial: '#64748b', basic: '#3b82f6', pro: '#8b5cf6', enterprise: '#10b981',
};
const TIER_KO: Record<string, string> = {
  trial: '체험판', basic: '기본', pro: '프로', enterprise: '엔터프라이즈',
};
const STATUS_KO: Record<string, string> = {
  draft: '초안', sent: '발송됨', paid: '결제완료', cancelled: '취소', overdue: '연체',
};
const STATUS_STYLE: Record<string, string> = {
  draft: 'text-gray-400', sent: 'text-blue-400', paid: 'text-green-400',
  cancelled: 'text-red-400', overdue: 'text-orange-400',
};
const INDUSTRY_KO: Record<string, string> = {
  manufacturing: '제조', building: '건물', industrial_complex: '산업단지',
  datacenter: '데이터센터', other: '기타',
};

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export default function ERPDashboardPage() {
  const [activeModule, setActiveModule] = useState<Module>('overview');
  const [period, setPeriod]     = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading]   = useState(true);
  const [data, setData]         = useState<any>(null);
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null);
  const fetchIdRef = useRef(0);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchData = useCallback(async () => {
    const fetchId = ++fetchIdRef.current;
    setLoading(true);
    setData(null);
    try {
      const res = await apiGet<any>(`/api/admin/erp?period=${period}&module=${activeModule}`);
      if (fetchId !== fetchIdRef.current) return; // stale response 무시
      setData(res.data ?? null);
    } catch {
      if (fetchId !== fetchIdRef.current) return;
      showToast('데이터 로드 실패', false);
    } finally {
      if (fetchId === fetchIdRef.current) setLoading(false);
    }
  }, [period, activeModule]);

  // 탭 전환: 클릭 즉시 data 초기화 → 직전 모듈 데이터로 렌더하는 타이밍 버그 방지
  const handleModuleChange = (mod: Module) => {
    setData(null);
    setActiveModule(mod);
  };

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── 렌더 ──────────────────────────────────────────────────
  const MODULES: { id: Module; label: string; icon: React.ReactNode }[] = [
    { id: 'overview',    label: '대시보드',   icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'finance',     label: '재무',       icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'accounting',  label: '회계',       icon: <FileText className="w-4 h-4" /> },
    { id: 'operations',  label: '운영',       icon: <Server className="w-4 h-4" /> },
    { id: 'hr',          label: '인사',       icon: <Users className="w-4 h-4" /> },
    { id: 'tenants',     label: '테넌트',     icon: <Building2 className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* 상단 헤더 */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-900/40 rounded-lg">
              <Package className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold">ERP 대시보드</h1>
              <p className="text-xs text-gray-400">전사적 자원 관리 — 재무 · 회계 · 운영 · 인사 · 테넌트</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input type="month" value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500" />
            <button onClick={fetchData} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* 모듈 탭 */}
        <div className="flex gap-1 mt-4 overflow-x-auto pb-1">
          {MODULES.map(m => (
            <button key={m.id} onClick={() => handleModuleChange(m.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeModule === m.id
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}>
              {m.icon}{m.label}
            </button>
          ))}
        </div>
      </div>

      {/* 토스트 */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm shadow-lg ${toast.ok ? 'bg-emerald-700' : 'bg-red-700'}`}>
          {toast.msg}
        </div>
      )}

      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-500">
            <RefreshCw className="w-6 h-6 animate-spin mr-3" />로딩 중...
          </div>
        ) : !data ? (
          <div className="flex items-center justify-center h-64 text-gray-500">데이터 없음</div>
        ) : (
          <>
            {activeModule === 'overview'   && <OverviewModule data={data} />}
            {activeModule === 'finance'    && <FinanceModule data={data} />}
            {activeModule === 'accounting' && <AccountingModule data={data} onRefresh={fetchData} showToast={showToast} />}
            {activeModule === 'operations' && <OperationsModule data={data} />}
            {activeModule === 'hr'         && <HRModule data={data} />}
            {activeModule === 'tenants'    && <TenantsModule data={data} />}
          </>
        )}
      </div>
    </div>
  );
}

// ── Overview Module ────────────────────────────────────────────
function OverviewModule({ data }: { data: any }) {
  const f: FinanceData     = data.finance;
  const o: OperationsData  = data.operations;
  const h: HRData          = data.hr;
  const t: TenantsData     = data.tenants;

  const kpis = [
    { label: 'MRR',          value: `₩${krw(f.mrr)}`,            icon: <DollarSign className="w-5 h-5 text-emerald-400" />, sub: '월간 반복 수익' },
    { label: 'ARR',          value: `₩${krw(f.arr)}`,            icon: <TrendingUp className="w-5 h-5 text-blue-400" />,    sub: 'MRR × 12' },
    { label: '활성 테넌트',  value: fmt(t.active),                icon: <Building2 className="w-5 h-5 text-purple-400" />,   sub: `전체 ${t.total}개` },
    { label: '활성 구독',    value: fmt(f.activeSubscriptions),   icon: <CreditCard className="w-5 h-5 text-yellow-400" />,  sub: `이탈 ${f.churnedSubscriptions}개` },
    { label: '전체 디바이스',value: fmt(o.devices.total),         icon: <Cpu className="w-5 h-5 text-cyan-400" />,           sub: `온라인 ${o.devices.online}` },
    { label: '전체 사용자',  value: fmt(h.totalUsers),            icon: <Users className="w-5 h-5 text-orange-400" />,       sub: `신규 ${h.newUsers}명` },
    { label: 'MQTT 수신(오늘)',value: fmt(o.mqtt.today),          icon: <Activity className="w-5 h-5 text-teal-400" />,      sub: '건' },
    { label: '미해결 보안',  value: fmt(o.security.openAlerts),   icon: <Shield className="w-5 h-5 text-red-400" />,         sub: '알림' },
  ];

  return (
    <div className="space-y-6">
      {/* KPI 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">{k.label}</span>
              {k.icon}
            </div>
            <div className="text-2xl font-bold">{k.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 수익 트렌드 */}
        <ChartCard title="월별 수익 트렌드" icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={f.revenueTrend} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="period" tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={(v) => `${krw(v)}`} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                formatter={(v: number) => [`₩${v.toLocaleString()}`, '수익']} />
              <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 플랜 분포 */}
        <ChartCard title="구독 플랜 분포" icon={<CreditCard className="w-4 h-4 text-blue-400" />}>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width={180} height={180}>
              <PieChart>
                <Pie data={Object.entries(f.planDistribution).map(([k, v]) => ({ name: TIER_KO[k] ?? k, value: v }))}
                  cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${name}(${value})`}
                  labelLine={false} fontSize={10}>
                  {Object.keys(f.planDistribution).map((k, i) => (
                    <Cell key={k} fill={Object.values(TIER_COLORS)[i] ?? '#64748b'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {Object.entries(f.planDistribution).map(([tier, cnt]) => (
              <div key={tier} className="flex items-center gap-1.5 text-xs text-gray-400">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TIER_COLORS[tier] }}></span>
                {TIER_KO[tier] ?? tier}: {cnt}
              </div>
            ))}
          </div>
        </ChartCard>

        {/* MQTT 트렌드 */}
        <ChartCard title="MQTT 수신 (7일)" icon={<Wifi className="w-4 h-4 text-cyan-400" />}>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={o.mqtt.trend} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={(v) => fmt(v)} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                formatter={(v: number) => [fmt(v), '메시지']} />
              <Line type="monotone" dataKey="messages" stroke="#06b6d4" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 인사 요약 */}
        <ChartCard title="사용자 현황" icon={<UserCheck className="w-4 h-4 text-orange-400" />}>
          <div className="grid grid-cols-2 gap-3 mt-2">
            {[
              { label: '전체 사용자', value: h.totalUsers, color: 'text-white' },
              { label: '활성 사용자', value: h.activeUsers, color: 'text-green-400' },
              { label: '이번달 신규', value: h.newUsers, color: 'text-blue-400' },
              { label: '최근 로그인', value: h.recentLogins, color: 'text-yellow-400' },
            ].map((item) => (
              <div key={item.label} className="bg-gray-800/50 rounded-lg p-3 text-center">
                <div className={`text-xl font-bold ${item.color}`}>{fmt(item.value)}</div>
                <div className="text-xs text-gray-500 mt-0.5">{item.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1.5">
            {Object.entries(h.roleDistribution).map(([role, cnt]) => (
              <div key={role} className="flex items-center justify-between text-xs">
                <span className="text-gray-400">{role}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-gray-800 rounded-full h-1.5">
                    <div className="bg-orange-500 h-1.5 rounded-full"
                      style={{ width: `${Math.min(100, (cnt / h.totalUsers) * 100)}%` }} />
                  </div>
                  <span className="text-gray-300 w-6 text-right">{cnt}</span>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

// ── Finance Module ─────────────────────────────────────────────
function FinanceModule({ data }: { data: FinanceData }) {
  if (!data) return <EmptyState />;

  const metrics = [
    { label: 'MRR', value: `₩${krw(data.mrr)}`, sub: '월간 반복 수익', icon: <DollarSign className="w-5 h-5 text-emerald-400" />, color: 'border-emerald-900/50' },
    { label: 'ARR', value: `₩${krw(data.arr)}`, sub: 'MRR × 12',     icon: <TrendingUp className="w-5 h-5 text-blue-400" />,    color: 'border-blue-900/50' },
    { label: 'ARPU', value: `₩${krw(data.arpu)}`, sub: '사용자당 평균',icon: <Users className="w-5 h-5 text-purple-400" />,       color: 'border-purple-900/50' },
    { label: '해지율', value: `${data.churnRate}%`, sub: '이번달',   icon: <ChevronDown className="w-5 h-5 text-red-400" />,    color: 'border-red-900/50' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className={`bg-gray-900 border ${m.color} rounded-xl p-5`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">{m.label}</span>
              {m.icon}
            </div>
            <div className="text-2xl font-bold mt-1">{m.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{m.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="월별 수익 트렌드" icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.revenueTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="period" tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => `${krw(v)}`} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                formatter={(v: number) => [`₩${v.toLocaleString()}`, '수익']} />
              <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} name="수익" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="플랜별 구독 현황" icon={<CreditCard className="w-4 h-4 text-blue-400" />}>
          <div className="space-y-3 mt-2">
            {data.plans.map((p) => {
              const cnt = data.planDistribution[p.tier] ?? 0;
              const maxCnt = Math.max(...Object.values(data.planDistribution));
              return (
                <div key={p.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TIER_COLORS[p.tier] }}></span>
                      <span className="text-gray-300">{p.name}</span>
                      <span className="text-xs text-gray-500">({TIER_KO[p.tier]})</span>
                    </span>
                    <span className="text-gray-300 font-medium">{cnt}개 · ₩{krw(Number(p.monthlyPrice ?? 0))}/월</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div className="h-2 rounded-full transition-all"
                      style={{ width: `${maxCnt > 0 ? (cnt / maxCnt) * 100 : 0}%`, backgroundColor: TIER_COLORS[p.tier] ?? '#64748b' }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-800 grid grid-cols-2 gap-3 text-xs">
            <div className="text-center">
              <div className="text-lg font-bold text-blue-400">{data.newSubscriptions}</div>
              <div className="text-gray-500">신규 구독</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-red-400">{data.churnedSubscriptions}</div>
              <div className="text-gray-500">이탈 구독</div>
            </div>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

// ── Accounting Module ──────────────────────────────────────────
function AccountingModule({ data, onRefresh, showToast }: { data: AccountingData; onRefresh: () => void; showToast: (m: string, ok?: boolean) => void }) {
  const [genTenantId, setGenTenantId] = useState('');
  const [genPeriod, setGenPeriod]     = useState(new Date().toISOString().slice(0, 7));
  const [generating, setGenerating]   = useState(false);
  const [updatingId, setUpdatingId]   = useState<string | null>(null);

  if (!data) return <EmptyState />;

  const handleGenerate = async () => {
    if (!genTenantId.trim()) return;
    setGenerating(true);
    try {
      await apiPost('/api/admin/erp/invoices', { tenantId: genTenantId.trim(), period: genPeriod });
      showToast('인보이스 생성 완료');
      setGenTenantId('');
      onRefresh();
    } catch {
      showToast('인보이스 생성 실패', false);
    } finally {
      setGenerating(false);
    }
  };

  const handleStatus = async (id: string, status: string) => {
    setUpdatingId(id);
    try {
      await apiPatch(`/api/admin/erp/invoices/${id}`, { status });
      showToast(`상태 변경: ${STATUS_KO[status]}`);
      onRefresh();
    } catch {
      showToast('상태 변경 실패', false);
    } finally {
      setUpdatingId(null);
    }
  };

  const s = data.summary;
  const summaryCards = [
    { label: '전체 인보이스', value: s.total,  color: 'text-white' },
    { label: '초안',          value: s.draft,  color: 'text-gray-400' },
    { label: '발송됨',        value: s.sent,   color: 'text-blue-400' },
    { label: '결제완료',      value: s.paid,   color: 'text-green-400' },
    { label: '연체',          value: s.overdue,color: 'text-orange-400' },
    { label: '총 청구액',     value: `₩${krw(s.totalAmount)}`, color: 'text-yellow-400' },
    { label: '수금 완료',     value: `₩${krw(s.paidAmount)}`,  color: 'text-emerald-400' },
    { label: '미수금',        value: `₩${krw(s.totalAmount - s.paidAmount)}`, color: 'text-red-400' },
  ];

  return (
    <div className="space-y-6">
      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {summaryCards.map((c) => (
          <div key={c.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
            <div className="text-xs text-gray-500 mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      {/* 인보이스 생성 */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-400" />인보이스 생성
        </h3>
        <div className="flex gap-3 flex-wrap">
          <input value={genTenantId} onChange={(e) => setGenTenantId(e.target.value)}
            placeholder="테넌트 ID"
            className="flex-1 min-w-40 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
          <input type="month" value={genPeriod} onChange={(e) => setGenPeriod(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
          <button onClick={handleGenerate} disabled={generating || !genTenantId.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors">
            {generating ? '생성 중...' : '인보이스 생성'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">INV-YYYYMM-NNNN 형식 자동 채번 · 부가세 10% 자동 계산</p>
      </div>

      {/* 인보이스 목록 */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400" />
          <h3 className="font-semibold">인보이스 목록</h3>
          <span className="ml-auto text-xs text-gray-500">{data.invoices.length}건</span>
        </div>
        {data.invoices.length === 0 ? (
          <div className="p-8 text-center text-gray-500">인보이스 없음</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 bg-gray-900/50 border-b border-gray-800">
                  {['인보이스 번호', '테넌트', '기간', '금액', '상태', '만기일', '액션'].map(h => (
                    <th key={h} className="px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((inv) => {
                  const isOverdue = inv.status === 'sent' && new Date(inv.dueDate) < new Date();
                  const dispStatus = isOverdue ? 'overdue' : inv.status;
                  return (
                    <tr key={inv.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                      <td className="px-4 py-3 font-mono text-xs text-gray-300">{inv.invoiceNo}</td>
                      <td className="px-4 py-3 text-xs text-gray-400 max-w-[120px] truncate">{inv.tenantId.slice(0, 8)}…</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{inv.periodStart?.slice(0, 7)}</td>
                      <td className="px-4 py-3 text-sm font-medium">₩{krw(Number(inv.total))}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${STATUS_STYLE[dispStatus] ?? 'text-gray-400'}`}>
                          {STATUS_KO[dispStatus] ?? dispStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {inv.paidAt ? new Date(inv.paidAt).toLocaleDateString('ko-KR') : new Date(inv.dueDate).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {inv.status === 'draft' && (
                            <ActionBtn label="발송" color="blue" disabled={updatingId === inv.id}
                              onClick={() => handleStatus(inv.id, 'sent')} />
                          )}
                          {inv.status === 'sent' && (
                            <ActionBtn label="결제완료" color="green" disabled={updatingId === inv.id}
                              onClick={() => handleStatus(inv.id, 'paid')} />
                          )}
                          {['draft', 'sent'].includes(inv.status) && (
                            <ActionBtn label="취소" color="gray" disabled={updatingId === inv.id}
                              onClick={() => handleStatus(inv.id, 'cancelled')} />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Operations Module ──────────────────────────────────────────
function OperationsModule({ data }: { data: OperationsData }) {
  if (!data) return <EmptyState />;

  const deviceRate  = data.devices.total  > 0 ? ((data.devices.online  / data.devices.total)  * 100).toFixed(0) : '0';
  const gatewayRate = data.gateways.total > 0 ? ((data.gateways.online / data.gateways.total) * 100).toFixed(0) : '0';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatusCard label="디바이스 가동률" value={`${deviceRate}%`} sub={`온라인 ${data.devices.online}/${data.devices.total}`}
          icon={<Cpu className="w-5 h-5 text-blue-400" />} ok={Number(deviceRate) >= 80} />
        <StatusCard label="게이트웨이 가동률" value={`${gatewayRate}%`} sub={`온라인 ${data.gateways.online}/${data.gateways.total}`}
          icon={<Wifi className="w-5 h-5 text-cyan-400" />} ok={Number(gatewayRate) >= 80} />
        <StatusCard label="전체 사이트" value={fmt(data.sites.total)} sub="운영 중"
          icon={<Globe className="w-5 h-5 text-purple-400" />} ok />
        <StatusCard label="MQTT 오늘" value={fmt(data.mqtt.today)} sub="건 수신"
          icon={<Activity className="w-5 h-5 text-emerald-400" />} ok />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="MQTT 수신 트렌드 (7일)" icon={<Activity className="w-4 h-4 text-emerald-400" />}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.mqtt.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={(v) => fmt(v)} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                formatter={(v: number) => [fmt(v), '메시지']} />
              <Line type="monotone" dataKey="messages" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981' }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="디바이스 / 게이트웨이 상태" icon={<Server className="w-4 h-4 text-blue-400" />}>
          <div className="space-y-4 mt-4">
            {[
              { label: '디바이스', online: data.devices.online, total: data.devices.total, color: '#3b82f6' },
              { label: '게이트웨이', online: data.gateways.online, total: data.gateways.total, color: '#06b6d4' },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-gray-300">{item.label}</span>
                  <span className="text-gray-400">{item.online} / {item.total}</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-3">
                  <div className="h-3 rounded-full transition-all" style={{
                    width: `${item.total > 0 ? (item.online / item.total) * 100 : 0}%`,
                    backgroundColor: item.color,
                  }} />
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>온라인 {item.total > 0 ? ((item.online / item.total) * 100).toFixed(0) : 0}%</span>
                  <span>오프라인 {item.total - item.online}개</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-800 grid grid-cols-2 gap-3 text-center text-xs">
            <div>
              <div className="text-lg font-bold text-orange-400">{data.security.openAlerts}</div>
              <div className="text-gray-500">미해결 보안 알림</div>
            </div>
            <div>
              <div className="text-lg font-bold text-yellow-400">{fmt(data.security.periodEvents)}</div>
              <div className="text-gray-500">이번달 보안 이벤트</div>
            </div>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

// ── HR Module ──────────────────────────────────────────────────
function HRModule({ data }: { data: HRData }) {
  if (!data) return <EmptyState />;

  const roleColors: Record<string, string> = {
    super_admin: '#10b981', tenant_admin: '#3b82f6', analyst: '#8b5cf6',
    operator: '#f59e0b', viewer: '#64748b',
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: '전체 사용자', value: fmt(data.totalUsers),    icon: <Users className="w-5 h-5 text-blue-400" />,    color: 'border-blue-900/50' },
          { label: '활성 사용자', value: fmt(data.activeUsers),   icon: <UserCheck className="w-5 h-5 text-green-400" />, color: 'border-green-900/50' },
          { label: '비활성 사용자', value: fmt(data.inactiveUsers), icon: <Users className="w-5 h-5 text-gray-400" />,   color: 'border-gray-700' },
          { label: '이번달 신규', value: fmt(data.newUsers),      icon: <ChevronUp className="w-5 h-5 text-cyan-400" />, color: 'border-cyan-900/50' },
          { label: '관리자 수',  value: fmt(data.adminUsers),     icon: <Shield className="w-5 h-5 text-purple-400" />,  color: 'border-purple-900/50' },
          { label: '최근 로그인',value: fmt(data.recentLogins),   icon: <Activity className="w-5 h-5 text-yellow-400" />,color: 'border-yellow-900/50' },
        ].map((c) => (
          <div key={c.label} className={`bg-gray-900 border ${c.color} rounded-xl p-4`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">{c.label}</span>
              {c.icon}
            </div>
            <div className="text-2xl font-bold">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="가입자 추세 (14일)" icon={<ChevronUp className="w-4 h-4 text-cyan-400" />}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.signupTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                formatter={(v: number) => [v, '신규']} />
              <Bar dataKey="count" fill="#06b6d4" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="역할 분포" icon={<Shield className="w-4 h-4 text-purple-400" />}>
          <div className="space-y-3 mt-3">
            {Object.entries(data.roleDistribution).map(([role, cnt]) => (
              <div key={role} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">{role}</span>
                  <span className="text-gray-400">{cnt}명 ({data.totalUsers > 0 ? ((cnt / data.totalUsers) * 100).toFixed(0) : 0}%)</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2.5">
                  <div className="h-2.5 rounded-full" style={{
                    width: `${data.totalUsers > 0 ? (cnt / data.totalUsers) * 100 : 0}%`,
                    backgroundColor: roleColors[role] ?? '#64748b',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

// ── Tenants Module ─────────────────────────────────────────────
function TenantsModule({ data }: { data: TenantsData }) {
  if (!data) return <EmptyState />;

  const STATUS_BADGE: Record<string, string> = {
    active:    'bg-green-900/40 text-green-300 border border-green-700',
    suspended: 'bg-yellow-900/40 text-yellow-300 border border-yellow-700',
    terminated:'bg-red-900/40 text-red-300 border border-red-700',
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '전체 테넌트', value: data.total,      color: 'text-white',       icon: <Building2 className="w-5 h-5 text-blue-400" /> },
          { label: '활성',        value: data.active,     color: 'text-green-400',   icon: <CheckCircle className="w-5 h-5 text-green-400" /> },
          { label: '정지',        value: data.suspended,  color: 'text-yellow-400',  icon: <Clock className="w-5 h-5 text-yellow-400" /> },
          { label: '이번달 신규', value: data.newTenants, color: 'text-cyan-400',    icon: <ChevronUp className="w-5 h-5 text-cyan-400" /> },
        ].map((c) => (
          <div key={c.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">{c.label}</span>
              {c.icon}
            </div>
            <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* 산업 분포 */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Globe className="w-4 h-4 text-purple-400" />산업 분포
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Object.entries(data.industryDistribution).map(([k, v]) => (
            <div key={k} className="bg-gray-800 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-purple-400">{v}</div>
              <div className="text-xs text-gray-400 mt-0.5">{INDUSTRY_KO[k] ?? k}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 테넌트 목록 */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-gray-400" />
          <h3 className="font-semibold">테넌트 목록</h3>
          <span className="ml-auto text-xs text-gray-500">{data.tenantList.length}개</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 bg-gray-900/50 border-b border-gray-800">
                {['테넌트명', '상태', '산업', '플랜', '사이트', '디바이스', '사용자', 'MRR', '가입일'].map(h => (
                  <th key={h} className="px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.tenantList.map((t) => (
                <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-200">{t.name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_BADGE[t.status] ?? ''}`}>
                      {t.status === 'active' ? '활성' : t.status === 'suspended' ? '정지' : '종료'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{INDUSTRY_KO[t.industryType] ?? t.industryType}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ color: TIER_COLORS[t.planTier ?? ''] ?? '#9ca3af' }}>
                      {t.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{t.sites}</td>
                  <td className="px-4 py-3 text-gray-400">{t.devices}</td>
                  <td className="px-4 py-3 text-gray-400">{t.users}</td>
                  <td className="px-4 py-3 font-medium text-emerald-400">₩{krw(t.mrr)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(t.createdAt).toLocaleDateString('ko-KR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── 공용 서브컴포넌트 ──────────────────────────────────────────
function ChartCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="font-semibold mb-4 flex items-center gap-2">{icon}{title}</h3>
      {children}
    </div>
  );
}

function StatusCard({ label, value, sub, icon, ok }: { label: string; value: string; sub: string; icon: React.ReactNode; ok: boolean }) {
  return (
    <div className={`bg-gray-900 border rounded-xl p-4 ${ok ? 'border-green-900/50' : 'border-red-900/50'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400">{label}</span>
        {icon}
      </div>
      <div className={`text-2xl font-bold ${ok ? 'text-green-400' : 'text-red-400'}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{sub}</div>
    </div>
  );
}

function ActionBtn({ label, color, onClick, disabled }: { label: string; color: string; onClick: () => void; disabled: boolean }) {
  const s: Record<string, string> = {
    blue: 'bg-blue-900/50 hover:bg-blue-900 text-blue-300',
    green: 'bg-green-900/50 hover:bg-green-900 text-green-300',
    gray: 'bg-gray-700 hover:bg-gray-600 text-gray-300',
  };
  return (
    <button onClick={onClick} disabled={disabled}
      className={`px-2 py-1 text-xs rounded ${s[color] ?? s.gray} transition-colors disabled:opacity-40`}>
      {label}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-48 text-gray-500">
      <Package className="w-10 h-10 mb-3 opacity-30" />
      <p>데이터를 불러오는 중입니다...</p>
    </div>
  );
}
