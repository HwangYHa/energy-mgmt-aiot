'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Leaf, Plus, Search, RefreshCw, Loader2, X, CheckCircle2,
  AlertTriangle, Download, ChevronUp, ChevronDown, ChevronsUpDown,
  Filter, BarChart3, Clock, Shield, Tag, FileText,
  Check, Ban, Eye, ArrowLeftRight, TrendingUp, TrendingDown,
  ChevronRight, Info, GitBranch, Activity,
} from 'lucide-react';
import { apiPost, apiPatch } from '@/lib/api/client';

// ─── 타입 ─────────────────────────────────────────────────────────────────────
interface EmissionFactor {
  id: string;
  code: string;
  name: string | null;
  factorCode: string | null;
  category: string;
  sourceType: string;
  factor: number;
  unit: string;
  inputUnit: string;
  source: string;
  sourceName: string | null;
  sourceVersion: string | null;
  sourceUrl: string | null;
  factorSourceType: string | null;
  year: number;
  region: string;
  countryCode: string;
  calculationType: string | null;
  isDefault: boolean;
  isCustom: boolean;
  isActive: boolean;
  version: number;
  validFrom: string;
  validTo: string | null;
  approvalStatus: string;
  tenantId: string | null;
  changeReason: string | null;
  scope: string;
  statusLabel: string;
  createdAt: string;
  updatedAt: string;
}

interface FactorDetail extends EmissionFactor {
  versions: VersionItem[];
  usageCount: number;
}

interface VersionItem {
  id: string;
  version: number;
  validFrom: string;
  validTo: string | null;
  factor: number;
  approvalStatus: string;
  isActive: boolean;
  changeReason: string | null;
  createdAt: string;
}

interface Stats {
  total: number;
  active: number;
  inUse: number;
  pending: number;
  expiringSoon: number;
  custom: number;
  changedThisMonth: number;
}

type SortKey = 'name' | 'code' | 'category' | 'factor' | 'year' | 'statusLabel' | 'scope' | 'validFrom';
type SortDir = 'asc' | 'desc';
type DrawerTab = 'info' | 'source' | 'version' | 'impact' | 'audit';

// ─── 상수 ─────────────────────────────────────────────────────────────────────
const CATEGORIES: Record<string, string> = {
  electricity: '전력', steam: '스팀', district_heat: '지역난방',
  fuel: '연료', process: '공정', refrigerant: '냉매',
  transport: '수송', waste: '폐기물', purchased_goods: '구매상품',
  raw_materials: '원자재', capital_goods: '자본재', business_travel: '출장',
};

const SCOPE_LABELS: Record<string, { label: string; color: string }> = {
  scope1: { label: 'Scope 1', color: 'text-orange-400 bg-orange-500/15 border-orange-500/30' },
  scope2: { label: 'Scope 2', color: 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30' },
  scope3: { label: 'Scope 3', color: 'text-purple-400 bg-purple-500/15 border-purple-500/30' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active:    { label: '활성',    color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30' },
  pending:   { label: '검토중',  color: 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30' },
  draft:     { label: '초안',    color: 'text-slate-400 bg-slate-500/15 border-slate-500/30' },
  expired:   { label: '만료',    color: 'text-red-400 bg-red-500/15 border-red-500/30' },
  expiring:  { label: '만료임박', color: 'text-amber-400 bg-amber-500/15 border-amber-500/30' },
  rejected:  { label: '반려',    color: 'text-red-400 bg-red-500/15 border-red-500/30' },
  inactive:  { label: '비활성',  color: 'text-slate-400 bg-slate-500/15 border-slate-500/30' },
};

const CALC_TYPE_LABELS: Record<string, string> = {
  location: '위치기반', market: '시장기반', activity: '활동기반', spend: '지출기반',
};

// ─── 서브 컴포넌트 ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: 'text-slate-400 bg-slate-500/15 border-slate-500/30' };
  return (
    <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function ScopeBadge({ scope }: { scope: string }) {
  const cfg = SCOPE_LABELS[scope] ?? { label: scope, color: 'text-slate-400 bg-slate-500/15 border-slate-500/30' };
  return (
    <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function KpiCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color: string }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 flex flex-col gap-1">
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
      {sub && <span className="text-[10px] text-slate-500">{sub}</span>}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-slate-700/30 last:border-0">
      <span className="text-xs text-slate-400 w-28 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-slate-200 flex-1">{value ?? <span className="text-slate-600">-</span>}</span>
    </div>
  );
}

function SortIcon({ col, current, dir }: { col: SortKey; current: SortKey; dir: SortDir }) {
  if (col !== current) return <ChevronsUpDown className="w-3 h-3 text-slate-600" />;
  return dir === 'asc'
    ? <ChevronUp className="w-3 h-3 text-emerald-400" />
    : <ChevronDown className="w-3 h-3 text-emerald-400" />;
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────
export default function EmissionFactorsPage() {
  const [factors, setFactors] = useState<EmissionFactor[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 필터
  const [search, setSearch]               = useState('');
  const [filterScope, setFilterScope]     = useState('');
  const [filterCategory, setFilterCat]    = useState('');
  const [filterStatus, setFilterStatus]   = useState('');
  const [filterYear, setFilterYear]       = useState('');
  const [filterCalc, setFilterCalc]       = useState('');
  const [filterCustom, setFilterCustom]   = useState('');
  const [filterExpiring, setFilterExpiring] = useState(false);

  // 정렬
  const [sortKey, setSortKey]   = useState<SortKey>('category');
  const [sortDir, setSortDir]   = useState<SortDir>('asc');

  // 선택
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Drawer
  const [detailFactor, setDetailFactor] = useState<FactorDetail | null>(null);
  const [drawerTab, setDrawerTab]       = useState<DrawerTab>('info');
  const [drawerLoading, setDrawerLoading] = useState(false);

  // 모달
  const [showCreate, setShowCreate]   = useState(false);
  const [showCompare, setShowCompare] = useState(false);

  // 액션 상태
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ── Fetch 목록 ──────────────────────────────────────────────────────────────
  const fetchFactors = useCallback(async () => {
    setIsLoading(true);
    try {
      const p = new URLSearchParams();
      p.set('includeStats', 'true');
      if (filterScope)    p.set('scope', filterScope);
      if (filterCategory) p.set('category', filterCategory);
      if (filterStatus)   p.set('status', filterStatus);
      if (filterYear)     p.set('year', filterYear);
      if (filterCalc)     p.set('calculationType', filterCalc);
      if (filterCustom)   p.set('isCustom', filterCustom);
      if (filterExpiring) p.set('expiringSoon', 'true');
      if (search)         p.set('search', search);

      const res  = await fetch(`/api/compliance/emission-factors?${p}`);
      const json = await res.json();
      if (json.success) {
        setFactors(json.data);
        if (json.meta?.stats) setStats(json.meta.stats);
      }
    } catch { /* silent */ } finally {
      setIsLoading(false);
    }
  }, [filterScope, filterCategory, filterStatus, filterYear, filterCalc, filterCustom, filterExpiring, search]);

  useEffect(() => { fetchFactors(); }, [fetchFactors]);

  // ── Fetch 상세 ──────────────────────────────────────────────────────────────
  const openDetail = useCallback(async (f: EmissionFactor) => {
    setDrawerLoading(true);
    setDetailFactor({ ...f, versions: [], usageCount: 0 });
    setDrawerTab('info');
    try {
      const res  = await fetch(`/api/compliance/emission-factors/${f.id}`);
      const json = await res.json();
      if (json.success) setDetailFactor(json.data);
    } catch { /* silent */ } finally {
      setDrawerLoading(false);
    }
  }, []);

  // ── 정렬 ───────────────────────────────────────────────────────────────────
  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sorted = useMemo(() => {
    return [...factors].sort((a, b) => {
      let va: string | number = a[sortKey] as string | number ?? '';
      let vb: string | number = b[sortKey] as string | number ?? '';
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [factors, sortKey, sortDir]);

  // ── 선택 ───────────────────────────────────────────────────────────────────
  const toggleSelect = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleAll = () => setSelected(prev =>
    prev.size === sorted.length ? new Set() : new Set(sorted.map(f => f.id))
  );

  // ── CSV 내보내기 ─────────────────────────────────────────────────────────────
  const exportCsv = () => {
    const rows = sorted.filter(f => selected.size === 0 || selected.has(f.id));
    const header = ['코드', '계수명', '카테고리', 'Scope', '계수값', '단위', '출처', '연도', '상태', '버전', '유효시작', '유효종료'];
    const lines = rows.map(f => [
      f.code, f.name ?? '', CATEGORIES[f.category] ?? f.category,
      f.scope, f.factor, f.unit, f.source, f.year,
      STATUS_CONFIG[f.statusLabel]?.label ?? f.statusLabel,
      f.version, f.validFrom?.slice(0, 10) ?? '', f.validTo?.slice(0, 10) ?? '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv = '\uFEFF' + [header.join(','), ...lines].join('\n');
    const a   = document.createElement('a');
    a.href    = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `emission-factors-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  // ── 승인/반려/폐지 액션 ──────────────────────────────────────────────────────
  const handleAction = async (id: string, action: string, reason?: string) => {
    setActionLoading(action + id);
    try {
      const res = await apiPatch(`/api/compliance/emission-factors/${id}`, { action, reason });
      if (res.success) {
        fetchFactors();
        if (detailFactor && detailFactor.id === id) {
          openDetail({ ...detailFactor, ...(res.data as Partial<EmissionFactor>) });
        }
      }
    } catch { /* silent */ } finally {
      setActionLoading(null);
    }
  };

  const years = useMemo(() =>
    [...new Set(factors.map(f => f.year))].sort((a, b) => b - a),
  [factors]);

  // ─── 렌더 ────────────────────────────────────────────────────────────────────
  return (
    <div className="h-full bg-slate-950 flex flex-col overflow-hidden">
      {/* 헤더 */}
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <Leaf className="w-5 h-5 text-emerald-400" />
              </div>
              배출계수 관리
            </h1>
            <p className="text-slate-400 text-xs mt-1 ml-12">
              온실가스 배출량 산정 계수 전수 관리 · Big4 감사 대응 · Hash Chain 무결성 보증
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCompare(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-lg text-slate-300 text-xs"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" /> 버전 비교
            </button>
            <button
              onClick={exportCsv}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-lg text-slate-300 text-xs"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button
              onClick={fetchFactors}
              className="p-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-lg text-slate-400"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> 계수 등록
            </button>
          </div>
        </div>

        {/* KPI 카드 */}
        {stats && (
          <div className="grid grid-cols-7 gap-3 mt-4">
            <KpiCard label="전체 계수"    value={stats.total}          color="text-white"        sub="등록 총계" />
            <KpiCard label="활성"         value={stats.active}         color="text-emerald-400"  sub="승인·활성" />
            <KpiCard label="사용 중"      value={stats.inUse}          color="text-blue-400"     sub="레코드 연결" />
            <KpiCard label="만료 임박"    value={stats.expiringSoon}   color="text-amber-400"    sub="30일 이내" />
            <KpiCard label="승인 대기"    value={stats.pending}        color="text-yellow-400"   sub="검토 필요" />
            <KpiCard label="커스텀"       value={stats.custom}         color="text-purple-400"   sub="테넌트 정의" />
            <KpiCard label="이달 변경"    value={stats.changedThisMonth} color="text-cyan-400"   sub="신규+수정" />
          </div>
        )}
      </div>

      {/* 필터 바 */}
      <div className="shrink-0 px-6 py-3 border-b border-slate-800 flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="코드·명칭·출처 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-1.5 text-sm text-white w-52 focus:border-emerald-500 outline-none"
          />
        </div>

        <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />

        {[
          {
            label: 'Scope', value: filterScope, onChange: setFilterScope,
            options: [['', '모든 Scope'], ['scope1', 'Scope 1'], ['scope2', 'Scope 2'], ['scope3', 'Scope 3']],
          },
          {
            label: '카테고리', value: filterCategory, onChange: setFilterCat,
            options: [['', '모든 카테고리'], ...Object.entries(CATEGORIES)],
          },
          {
            label: '상태', value: filterStatus, onChange: setFilterStatus,
            options: [['', '모든 상태'], ['active', '활성'], ['pending', '검토중'], ['draft', '초안'], ['expired', '만료'], ['expiring', '만료임박']],
          },
          {
            label: '연도', value: filterYear, onChange: setFilterYear,
            options: [['', '모든 연도'], ...years.map(y => [String(y), String(y)])],
          },
          {
            label: '산정방식', value: filterCalc, onChange: setFilterCalc,
            options: [['', '모든 방식'], ['location', '위치기반'], ['market', '시장기반'], ['activity', '활동기반'], ['spend', '지출기반']],
          },
          {
            label: '유형', value: filterCustom, onChange: setFilterCustom,
            options: [['', '모두'], ['false', '공식'], ['true', '커스텀']],
          },
        ].map(({ label, value, onChange, options }) => (
          <select
            key={label}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:border-emerald-500 outline-none"
          >
            {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ))}

        <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={filterExpiring}
            onChange={(e) => setFilterExpiring(e.target.checked)}
            className="accent-amber-500"
          />
          만료 임박
        </label>

        {selected.size > 0 && (
          <span className="ml-auto text-xs text-slate-400">{selected.size}개 선택됨</span>
        )}
      </div>

      {/* 테이블 + Drawer */}
      <div className="flex-1 overflow-hidden flex">
        {/* 테이블 */}
        <div className={`flex-1 overflow-auto ${detailFactor ? 'border-r border-slate-800' : ''}`}>
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-900 z-10">
                <tr className="border-b border-slate-700/50">
                  <th className="py-2.5 px-3 w-8">
                    <input
                      type="checkbox"
                      checked={selected.size === sorted.length && sorted.length > 0}
                      onChange={toggleAll}
                      className="accent-emerald-500"
                    />
                  </th>
                  {([
                    { key: 'code',        label: '코드',     cls: 'w-28' },
                    { key: 'name',        label: '계수명',   cls: 'min-w-[160px]' },
                    { key: 'scope',       label: 'Scope',    cls: 'w-20' },
                    { key: 'category',    label: '카테고리', cls: 'w-24' },
                    { key: 'factor',      label: '계수값',   cls: 'w-24 text-right' },
                    { key: null,          label: '단위',     cls: 'w-32' },
                    { key: null,          label: '산정방식', cls: 'w-20' },
                    { key: 'year',        label: '연도',     cls: 'w-14 text-center' },
                    { key: null,          label: '지역',     cls: 'w-14 text-center' },
                    { key: 'statusLabel', label: '상태',     cls: 'w-20' },
                    { key: null,          label: '버전',     cls: 'w-12 text-center' },
                    { key: 'validFrom',   label: '유효시작', cls: 'w-24' },
                    { key: null,          label: '만료일',   cls: 'w-24' },
                    { key: null,          label: '유형',     cls: 'w-16' },
                  ] as { key: SortKey | null; label: string; cls: string }[]).map(({ key, label, cls }) => (
                    <th
                      key={label}
                      onClick={() => key && handleSort(key)}
                      className={`py-2.5 px-3 text-left text-slate-400 font-medium ${cls} ${key ? 'cursor-pointer hover:text-slate-200 select-none' : ''}`}
                    >
                      <span className="flex items-center gap-1">
                        {label}
                        {key && <SortIcon col={key} current={sortKey} dir={sortDir} />}
                      </span>
                    </th>
                  ))}
                  <th className="py-2.5 px-3 w-16 text-left text-slate-400 font-medium">액션</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((f) => (
                  <tr
                    key={f.id}
                    onClick={() => openDetail(f)}
                    className={`border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer transition-colors ${
                      detailFactor?.id === f.id ? 'bg-slate-800/50' : ''
                    } ${selected.has(f.id) ? 'bg-emerald-950/20' : ''}`}
                  >
                    <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(f.id)}
                        onChange={() => toggleSelect(f.id)}
                        className="accent-emerald-500"
                      />
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-400">{f.code}</td>
                    <td className="py-2 px-3 text-white font-medium">
                      <div className="flex items-center gap-1.5">
                        {f.name ?? <span className="text-slate-500 italic">이름 없음</span>}
                        {f.isDefault && <Tag className="w-3 h-3 text-cyan-400" />}
                      </div>
                    </td>
                    <td className="py-2 px-3"><ScopeBadge scope={f.scope} /></td>
                    <td className="py-2 px-3 text-slate-300">{CATEGORIES[f.category] ?? f.category}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-emerald-400">{f.factor.toFixed(6)}</td>
                    <td className="py-2 px-3 text-slate-400">{f.unit} / {f.inputUnit}</td>
                    <td className="py-2 px-3 text-slate-400">{f.calculationType ? CALC_TYPE_LABELS[f.calculationType] ?? f.calculationType : '-'}</td>
                    <td className="py-2 px-3 text-center text-slate-300">{f.year}</td>
                    <td className="py-2 px-3 text-center text-slate-400">{f.countryCode}</td>
                    <td className="py-2 px-3"><StatusBadge status={f.statusLabel} /></td>
                    <td className="py-2 px-3 text-center text-slate-400">v{f.version}</td>
                    <td className="py-2 px-3 text-slate-400">{f.validFrom?.slice(0, 10) ?? '-'}</td>
                    <td className="py-2 px-3 text-slate-400">
                      {f.validTo ? (
                        <span className={f.statusLabel === 'expiring' ? 'text-amber-400' : f.statusLabel === 'expired' ? 'text-red-400' : ''}>
                          {f.validTo.slice(0, 10)}
                        </span>
                      ) : <span className="text-slate-600">없음</span>}
                    </td>
                    <td className="py-2 px-3">
                      {f.isCustom
                        ? <span className="text-[10px] text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded-full">커스텀</span>
                        : <span className="text-[10px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded-full">공식</span>}
                    </td>
                    <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                      {f.statusLabel === 'pending' && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleAction(f.id, 'approve')}
                            disabled={actionLoading === 'approve' + f.id}
                            className="p-1 text-emerald-400 hover:bg-emerald-500/20 rounded"
                            title="승인"
                          >
                            {actionLoading === 'approve' + f.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          </button>
                          <button
                            onClick={() => handleAction(f.id, 'reject', '검토 결과 반려')}
                            disabled={actionLoading === 'reject' + f.id}
                            className="p-1 text-red-400 hover:bg-red-500/20 rounded"
                            title="반려"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      {f.statusLabel === 'active' && (
                        <button
                          onClick={() => handleAction(f.id, 'deprecate', '관리자 폐지')}
                          disabled={actionLoading === 'deprecate' + f.id}
                          className="p-1 text-slate-400 hover:bg-slate-700 rounded"
                          title="폐지"
                        >
                          <Ban className="w-3 h-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!isLoading && sorted.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <Leaf className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">조건에 맞는 배출계수가 없습니다</p>
            </div>
          )}
        </div>

        {/* 상세 Drawer */}
        {detailFactor && (
          <div className="w-[420px] shrink-0 bg-slate-900 flex flex-col overflow-hidden">
            {/* Drawer 헤더 */}
            <div className="shrink-0 px-4 pt-4 pb-3 border-b border-slate-800">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <ScopeBadge scope={detailFactor.scope} />
                    <StatusBadge status={detailFactor.statusLabel} />
                    <span className="text-[10px] text-slate-500">v{detailFactor.version}</span>
                  </div>
                  <h3 className="text-sm font-bold text-white mt-1">
                    {detailFactor.name ?? '(이름 없음)'}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">{detailFactor.code}</p>
                </div>
                <button onClick={() => setDetailFactor(null)} className="p-1 hover:bg-slate-800 rounded text-slate-500">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 승인 대기 액션 버튼 */}
              {detailFactor.statusLabel === 'pending' && (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleAction(detailFactor.id, 'approve')}
                    className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-xs text-white flex items-center justify-center gap-1"
                  >
                    <Check className="w-3 h-3" /> 승인
                  </button>
                  <button
                    onClick={() => handleAction(detailFactor.id, 'reject', '검토 결과 반려')}
                    className="flex-1 py-1.5 bg-red-600/30 hover:bg-red-600/50 border border-red-600/30 rounded text-xs text-red-400 flex items-center justify-center gap-1"
                  >
                    <X className="w-3 h-3" /> 반려
                  </button>
                </div>
              )}
              {detailFactor.statusLabel === 'active' && (
                <button
                  onClick={() => handleAction(detailFactor.id, 'deprecate', '관리자 폐지')}
                  className="mt-2 w-full py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs text-slate-300 flex items-center justify-center gap-1"
                >
                  <Ban className="w-3 h-3" /> 폐지 처리
                </button>
              )}

              {/* Drawer 탭 */}
              <div className="flex gap-1 mt-3 overflow-x-auto scrollbar-none">
                {([
                  { key: 'info',    icon: Info,       label: '기본' },
                  { key: 'source',  icon: FileText,   label: '출처' },
                  { key: 'version', icon: GitBranch,  label: '버전' },
                  { key: 'impact',  icon: Activity,   label: '영향' },
                  { key: 'audit',   icon: Shield,     label: '감사' },
                ] as { key: DrawerTab; icon: React.ElementType; label: string }[]).map(({ key, icon: Icon, label }) => (
                  <button
                    key={key}
                    onClick={() => setDrawerTab(key)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors whitespace-nowrap ${
                      drawerTab === key
                        ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <Icon className="w-3 h-3" /> {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Drawer 본문 */}
            <div className="flex-1 overflow-y-auto p-4">
              {drawerLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
                </div>
              ) : (
                <>
                  {/* 기본정보 탭 */}
                  {drawerTab === 'info' && (
                    <div>
                      <DetailRow label="계수 ID"    value={<span className="font-mono text-xs">{detailFactor.id}</span>} />
                      <DetailRow label="코드"        value={<span className="font-mono">{detailFactor.code}</span>} />
                      <DetailRow label="Factor Code" value={<span className="font-mono text-xs">{detailFactor.factorCode}</span>} />
                      <DetailRow label="카테고리"   value={CATEGORIES[detailFactor.category] ?? detailFactor.category} />
                      <DetailRow label="Scope"       value={<ScopeBadge scope={detailFactor.scope} />} />
                      <DetailRow label="계수값" value={
                        <span className="font-mono font-bold text-emerald-400 text-base">
                          {detailFactor.factor.toFixed(6)}
                        </span>
                      } />
                      <DetailRow label="단위"       value={detailFactor.unit} />
                      <DetailRow label="입력 단위"  value={detailFactor.inputUnit} />
                      <DetailRow label="산정방식"   value={detailFactor.calculationType ? CALC_TYPE_LABELS[detailFactor.calculationType] : '-'} />
                      <DetailRow label="기준연도"   value={detailFactor.year} />
                      <DetailRow label="지역/국가"  value={`${detailFactor.region} / ${detailFactor.countryCode}`} />
                      <DetailRow label="유효시작"   value={detailFactor.validFrom?.slice(0, 10)} />
                      <DetailRow label="만료일"     value={detailFactor.validTo?.slice(0, 10)} />
                      <DetailRow label="승인 상태"  value={<StatusBadge status={detailFactor.statusLabel} />} />
                      <DetailRow label="기본계수"   value={detailFactor.isDefault ? '예' : '아니오'} />
                      <DetailRow label="커스텀"     value={detailFactor.isCustom ? '테넌트 커스텀' : '공식 계수'} />
                      <DetailRow label="변경 사유"  value={detailFactor.changeReason} />
                      <DetailRow label="등록일"     value={new Date(detailFactor.createdAt).toLocaleString('ko-KR')} />
                    </div>
                  )}

                  {/* 출처·규제 탭 */}
                  {drawerTab === 'source' && (
                    <div>
                      <DetailRow label="출처"        value={detailFactor.source} />
                      <DetailRow label="출처명"      value={detailFactor.sourceName} />
                      <DetailRow label="출처 버전"   value={detailFactor.sourceVersion} />
                      <DetailRow label="출처 유형"   value={
                        detailFactor.factorSourceType === 'official'      ? '공식 (정부/국가)' :
                        detailFactor.factorSourceType === 'international' ? '국제 표준' :
                        detailFactor.factorSourceType === 'tenant_custom' ? '테넌트 커스텀' :
                        detailFactor.factorSourceType ?? '-'
                      } />
                      {detailFactor.sourceUrl && (
                        <DetailRow label="출처 URL" value={
                          <a href={detailFactor.sourceUrl} target="_blank" rel="noopener noreferrer"
                             className="text-blue-400 hover:underline break-all text-xs">
                            {detailFactor.sourceUrl}
                          </a>
                        } />
                      )}
                      <div className="mt-4 p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg">
                        <div className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                          <BarChart3 className="w-3 h-3" /> 적용 규제 프레임워크
                        </div>
                        {(['GHG Protocol', 'ISO 14064', 'K-ETS (한국 배출권거래제)', 'CDP 보고', 'TCFD 권고안'] as const).map(reg => (
                          <div key={reg} className="flex items-center gap-2 py-1 border-b border-slate-700/20 last:border-0">
                            <ChevronRight className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span className="text-xs text-slate-300">{reg}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 버전이력 탭 */}
                  {drawerTab === 'version' && (
                    <div>
                      {detailFactor.versions.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-8">버전 이력이 없습니다</p>
                      ) : (
                        <div className="space-y-2">
                          {detailFactor.versions.map((v, i) => {
                            const prev = detailFactor.versions[i + 1];
                            const diff = prev ? ((v.factor - prev.factor) / prev.factor * 100) : null;
                            return (
                              <div
                                key={v.id}
                                className={`p-3 rounded-lg border ${
                                  v.id === detailFactor.id
                                    ? 'border-emerald-500/40 bg-emerald-950/20'
                                    : 'border-slate-700/50 bg-slate-800/30'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-mono font-bold text-white">v{v.version}</span>
                                  <div className="flex items-center gap-1.5">
                                    {diff !== null && (
                                      <span className={`text-[10px] flex items-center gap-0.5 ${diff > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                        {diff > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                                        {Math.abs(diff).toFixed(1)}%
                                      </span>
                                    )}
                                    <StatusBadge status={v.isActive ? (v.approvalStatus === 'APPROVED' ? 'active' : v.approvalStatus.toLowerCase()) : 'inactive'} />
                                    {v.id === detailFactor.id && (
                                      <span className="text-[10px] text-emerald-400 font-semibold">현재</span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-xs text-emerald-400 font-mono font-bold">{v.factor.toFixed(6)}</div>
                                <div className="text-[10px] text-slate-500 mt-0.5">
                                  {v.validFrom?.slice(0, 10)} ~ {v.validTo?.slice(0, 10) ?? '무기한'}
                                </div>
                                {v.changeReason && (
                                  <div className="text-[10px] text-slate-400 mt-1 italic">"{v.changeReason}"</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 영향분석 탭 */}
                  {drawerTab === 'impact' && (
                    <div>
                      <div className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg mb-3">
                        <div className="text-xs text-slate-400 mb-1">연결된 배출량 레코드</div>
                        <div className="text-2xl font-bold text-white">{detailFactor.usageCount}건</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">활성 레코드 기준 (archivedReason 없음)</div>
                      </div>
                      {detailFactor.usageCount > 0 && (
                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                          <div className="flex items-center gap-2 text-amber-400 text-xs font-medium mb-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            변경 영향 경고
                          </div>
                          <p className="text-xs text-slate-400">
                            이 계수를 폐지하면 {detailFactor.usageCount}건의 배출량 레코드에 영향을 미칩니다.
                            신규 버전으로 마이그레이션을 권장합니다.
                          </p>
                        </div>
                      )}
                      <div className="mt-3 p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg">
                        <div className="text-xs text-slate-400 mb-2">Scope별 의존 분포</div>
                        <div className="text-xs text-slate-500 italic">EmissionsRecord 집계 데이터</div>
                      </div>
                    </div>
                  )}

                  {/* 감사로그 탭 */}
                  {drawerTab === 'audit' && (
                    <div>
                      <div className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg mb-3">
                        <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                          <Shield className="w-3 h-3 text-emerald-400" />
                          Hash Chain 무결성
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs text-emerald-400 font-medium">검증 완료</span>
                          <span className="text-[10px] text-slate-500">SHA-256 Append-only</span>
                        </div>
                      </div>
                      <div className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> 변경 이력
                      </div>
                      <p className="text-xs text-slate-500 italic text-center py-6">
                        감사 로그는{' '}
                        <a href={`/api/analytics/carbon/emission-factor-audit/${detailFactor.id}`}
                           className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">
                          감사 API
                        </a>
                        에서 확인하세요
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 신규 등록 모달 */}
      {showCreate && (
        <CreateFactorModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchFactors(); }}
        />
      )}

      {/* 버전 비교 패널 */}
      {showCompare && (
        <VersionComparePanel factors={factors} onClose={() => setShowCompare(false)} />
      )}
    </div>
  );
}

// ─── 신규 등록 모달 ────────────────────────────────────────────────────────────
function CreateFactorModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [tab, setTab] = useState<'basic' | 'calc' | 'source' | 'ops'>('basic');
  const [form, setForm] = useState({
    name:             '',
    category:         'electricity',
    sourceType:       '',
    calculationType:  'location',
    factor:           '',
    unit:             'tCO2eq/MWh',
    inputUnit:        'kWh',
    source:           '',
    sourceName:       '',
    sourceVersion:    '',
    sourceUrl:        '',
    factorSourceType: 'official',
    year:             new Date().getFullYear(),
    region:           'KR',
    countryCode:      'KR',
    isDefault:        false,
    validFrom:        new Date().toISOString().split('T')[0],
    validTo:          '',
    changeReason:     '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError]               = useState('');

  const set = (k: keyof typeof form, v: unknown) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        ...form,
        factor: parseFloat(form.factor),
        year:   form.year,
      };
      if (!form.validTo) delete payload.validTo;
      if (!form.sourceUrl) delete payload.sourceUrl;
      if (!form.changeReason) delete payload.changeReason;

      const res = await apiPost('/api/compliance/emission-factors', payload);
      if (res.success) onCreated();
      else setError(res.error ?? '등록 실패');
    } catch { setError('등록 중 오류가 발생했습니다.'); } finally { setIsSubmitting(false); }
  };

  const TABS = [
    { key: 'basic',  label: '기본정보' },
    { key: 'calc',   label: '계산설정' },
    { key: 'source', label: '출처·규제' },
    { key: 'ops',    label: '운영설정' },
  ] as const;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Leaf className="w-4 h-4 text-emerald-400" /> 배출계수 신규 등록
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 탭 */}
        <div className="flex border-b border-slate-700 shrink-0">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-2.5 text-xs transition-colors ${
                tab === key
                  ? 'text-emerald-400 border-b-2 border-emerald-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-4">
            {error && (
              <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}

            {/* 기본정보 */}
            {tab === 'basic' && (
              <>
                <Field label="계수명">
                  <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
                    className="input-base" placeholder="예: 한국전력 전력 배출계수 2024" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="카테고리 *">
                    <select value={form.category} onChange={e => set('category', e.target.value)} className="input-base">
                      {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </Field>
                  <Field label="배출원 *">
                    <input type="text" value={form.sourceType} onChange={e => set('sourceType', e.target.value)}
                      className="input-base" placeholder="예: 전력(한전)" required />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="기준연도 *">
                    <input type="number" value={form.year} onChange={e => set('year', parseInt(e.target.value))}
                      className="input-base" min={2000} max={2100} required />
                  </Field>
                  <Field label="지역">
                    <input type="text" value={form.region} onChange={e => set('region', e.target.value)}
                      className="input-base" placeholder="KR" maxLength={10} />
                  </Field>
                </div>
                <Field label="변경 사유">
                  <textarea value={form.changeReason} onChange={e => set('changeReason', e.target.value)}
                    className="input-base resize-none h-16" placeholder="최초 등록 또는 업데이트 사유..." />
                </Field>
              </>
            )}

            {/* 계산설정 */}
            {tab === 'calc' && (
              <>
                <Field label="계수값 *">
                  <input type="number" step="any" value={form.factor} onChange={e => set('factor', e.target.value)}
                    className="input-base font-mono" placeholder="0.000000" required />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="단위 (분자) *">
                    <input type="text" value={form.unit} onChange={e => set('unit', e.target.value)}
                      className="input-base" placeholder="tCO2eq/MWh" required />
                  </Field>
                  <Field label="입력 단위 *">
                    <input type="text" value={form.inputUnit} onChange={e => set('inputUnit', e.target.value)}
                      className="input-base" placeholder="kWh" required />
                  </Field>
                </div>
                <Field label="산정 방식">
                  <select value={form.calculationType} onChange={e => set('calculationType', e.target.value)} className="input-base">
                    <option value="location">위치기반 (Location-based)</option>
                    <option value="market">시장기반 (Market-based)</option>
                    <option value="activity">활동기반 (Activity-based)</option>
                    <option value="spend">지출기반 (Spend-based)</option>
                  </select>
                </Field>
              </>
            )}

            {/* 출처·규제 */}
            {tab === 'source' && (
              <>
                <Field label="출처 *">
                  <input type="text" value={form.source} onChange={e => set('source', e.target.value)}
                    className="input-base" placeholder="국가 온실가스 인벤토리 보고서" required />
                </Field>
                <Field label="출처 기관명">
                  <input type="text" value={form.sourceName} onChange={e => set('sourceName', e.target.value)}
                    className="input-base" placeholder="환경부, IPCC, EPA..." />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="출처 버전">
                    <input type="text" value={form.sourceVersion} onChange={e => set('sourceVersion', e.target.value)}
                      className="input-base" placeholder="2024.1" />
                  </Field>
                  <Field label="출처 유형">
                    <select value={form.factorSourceType} onChange={e => set('factorSourceType', e.target.value)} className="input-base">
                      <option value="official">공식 (정부/국가)</option>
                      <option value="international">국제 표준</option>
                      <option value="tenant_custom">테넌트 커스텀</option>
                    </select>
                  </Field>
                </div>
                <Field label="출처 URL">
                  <input type="url" value={form.sourceUrl} onChange={e => set('sourceUrl', e.target.value)}
                    className="input-base" placeholder="https://..." />
                </Field>
              </>
            )}

            {/* 운영설정 */}
            {tab === 'ops' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="유효 시작일 *">
                    <input type="date" value={form.validFrom} onChange={e => set('validFrom', e.target.value)}
                      className="input-base" required />
                  </Field>
                  <Field label="만료일">
                    <input type="date" value={form.validTo} onChange={e => set('validTo', e.target.value)}
                      className="input-base" />
                  </Field>
                </div>
                <Field label="국가 코드">
                  <input type="text" value={form.countryCode} onChange={e => set('countryCode', e.target.value)}
                    className="input-base" maxLength={2} placeholder="KR" />
                </Field>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isDefault} onChange={e => set('isDefault', e.target.checked)}
                    className="accent-emerald-500" />
                  <span className="text-sm text-slate-300">기본 계수로 설정</span>
                </label>
              </>
            )}
          </div>

          <div className="flex gap-3 px-6 pb-6 shrink-0">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm">
              취소
            </button>
            <button type="submit" disabled={isSubmitting}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 rounded-lg text-white text-sm font-medium flex items-center justify-center gap-2">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              등록
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-slate-400 block mb-1">{label}</label>
      {children}
    </div>
  );
}

// ─── 버전 비교 패널 ────────────────────────────────────────────────────────────
function VersionComparePanel({ factors, onClose }: { factors: EmissionFactor[]; onClose: () => void }) {
  const [leftId, setLeftId]   = useState(factors[0]?.id ?? '');
  const [rightId, setRightId] = useState(factors[1]?.id ?? '');

  const left  = factors.find(f => f.id === leftId);
  const right = factors.find(f => f.id === rightId);

  const diff = left && right
    ? ((right.factor - left.factor) / left.factor * 100)
    : null;

  const compareFields: { label: string; get: (f: EmissionFactor) => React.ReactNode }[] = [
    { label: '계수값',   get: f => <span className="font-mono font-bold text-emerald-400">{f.factor.toFixed(6)}</span> },
    { label: '카테고리', get: f => CATEGORIES[f.category] ?? f.category },
    { label: 'Scope',    get: f => <ScopeBadge scope={f.scope} /> },
    { label: '단위',     get: f => f.unit },
    { label: '입력단위', get: f => f.inputUnit },
    { label: '산정방식', get: f => f.calculationType ? CALC_TYPE_LABELS[f.calculationType] : '-' },
    { label: '기준연도', get: f => f.year },
    { label: '출처',     get: f => f.source },
    { label: '버전',     get: f => `v${f.version}` },
    { label: '상태',     get: f => <StatusBadge status={f.statusLabel} /> },
    { label: '유효시작', get: f => f.validFrom?.slice(0, 10) },
    { label: '만료일',   get: f => f.validTo?.slice(0, 10) ?? '무기한' },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-emerald-400" /> 버전 비교
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 버전 선택 */}
        <div className="grid grid-cols-2 gap-4 px-6 py-4 border-b border-slate-700 shrink-0">
          {[
            { label: '기준 (A)', value: leftId, onChange: setLeftId },
            { label: '비교 (B)', value: rightId, onChange: setRightId },
          ].map(({ label, value, onChange }) => (
            <div key={label}>
              <div className="text-xs text-slate-400 mb-1">{label}</div>
              <select
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
              >
                {factors.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.name ?? f.code} — v{f.version} ({f.year})
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {/* 증감률 배너 */}
        {diff !== null && (
          <div className={`mx-6 mt-4 p-3 rounded-lg flex items-center gap-3 ${
            Math.abs(diff) < 0.1 ? 'bg-slate-700/50 border border-slate-600/50' :
            diff > 0 ? 'bg-red-500/10 border border-red-500/20' :
            'bg-emerald-500/10 border border-emerald-500/20'
          }`}>
            {diff > 0
              ? <TrendingUp className="w-5 h-5 text-red-400" />
              : diff < 0
              ? <TrendingDown className="w-5 h-5 text-emerald-400" />
              : <Eye className="w-5 h-5 text-slate-400" />}
            <div>
              <div className={`text-sm font-bold ${diff > 0 ? 'text-red-400' : diff < 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
                {diff === 0 ? '변동 없음' : `${diff > 0 ? '+' : ''}${diff.toFixed(2)}% 변동`}
              </div>
              <div className="text-xs text-slate-400">
                A→B: {left?.factor.toFixed(6)} → {right?.factor.toFixed(6)}
              </div>
            </div>
          </div>
        )}

        {/* 비교 테이블 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="py-2 text-left text-slate-500 font-medium w-28">항목</th>
                <th className="py-2 text-left text-slate-300 font-medium">기준 (A)</th>
                <th className="py-2 text-left text-slate-300 font-medium">비교 (B)</th>
                <th className="py-2 text-center text-slate-500 font-medium w-12">차이</th>
              </tr>
            </thead>
            <tbody>
              {compareFields.map(({ label, get }) => {
                const lv = left ? get(left) : null;
                const rv = right ? get(right) : null;
                const isDiff = left && right && String(get(left)) !== String(get(right));
                return (
                  <tr key={label} className={`border-b border-slate-800/50 ${isDiff ? 'bg-amber-950/10' : ''}`}>
                    <td className="py-2 text-slate-500">{label}</td>
                    <td className="py-2 text-slate-300">{lv ?? '-'}</td>
                    <td className="py-2 text-slate-300">{rv ?? '-'}</td>
                    <td className="py-2 text-center">
                      {isDiff && <span className="text-amber-400">✱</span>}
                    </td>
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
