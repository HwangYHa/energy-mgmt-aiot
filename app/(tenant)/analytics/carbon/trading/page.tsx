'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, Leaf, DollarSign, ShoppingCart, Flame,
  AlertCircle, Loader2, RefreshCw, ExternalLink, CheckCircle2,
  Clock, Trash2, Shield, FileText, BarChart2, Filter, Download,
  ChevronDown, ChevronUp, BarChart3,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { apiDelete, ApiError, getCsrfToken } from '@/lib/api/client';
import { PlanLockedBanner } from '@/components/subscription/PlanLockedBanner';

// ─── 타입 ─────────────────────────────────────────────────────────────────────

type CarbonRegistry = 'K-ETS' | 'Verra' | 'GoldStandard' | 'CDM' | 'J-Credit' | 'OTHER';
type CreditType = 'KAU' | 'KCU' | 'OFFSET' | 'VER' | 'GS-VER' | 'CER';
type PaymentMethod = 'bank_transfer' | 'pg' | 'escrow';
type EventType = 'BUY' | 'SELL' | 'RETIRE' | 'CANCEL';

interface PortfolioPosition {
  registryId: string;
  registry: CarbonRegistry;
  projectId: string;
  creditType: CreditType;
  vintageYear: number;
  availableQuantity: number;
  retiredQuantity: number;
  weightedAvgCost: number;
  marketPrice: number;
  unrealizedPnl: number;
  realizedPnl: number;
  totalCost: number;
  marketValue: number;
  serialNumberStart: string;
  certificationBody: string;
}

interface PortfolioSummary {
  totalPositions: number;
  totalAvailableQuantity: number;
  totalRetiredQuantity: number;
  totalCost: number;
  totalMarketValue: number;
  totalUnrealizedPnl: number;
  totalRealizedPnl: number;
  marketPrice: number;
}

interface Portfolio {
  positions: PortfolioPosition[];
  summary: PortfolioSummary;
  calculatedAt: string;
}

interface LedgerTrade {
  id: string;
  eventType: EventType;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  currency: string;
  counterparty?: string;
  paymentStatus: string;
  settlementStatus: string;
  memo?: string;
  createdAt: string;
  registry: { registry: string; projectId: string; creditType: string; vintageYear: number };
  payment?: { paymentStatus: string; paymentMethod: string; amount: number } | null;
  hashSignature: string;
}

interface RetirementCert {
  id: string;
  retirementId: string;
  retiredQuantity: number;
  retirementReason: string;
  beneficiaryCompany: string;
  retirementDate: string;
  offsetScope?: string;
  compliancePeriod?: string;
  ketsSubmissionId?: string;
  registry?: { registry: string; projectId: string; creditType: string; vintageYear: number };
}

// ─── 시장 가격 타입 ──────────────────────────────────────────────────────────

interface MarketPriceRow {
  id: string;
  market: string;
  priceDate: string;
  price: number;
  currency: string;
  changeRate: number | null;
}

interface MarketPriceStats {
  min: number; max: number; avg: number; last: number;
  first: number; changeRate: number;
}

// ─── K-ETS 시세 차트 컴포넌트 ───────────────────────────────────────────────

function MarketPriceChart() {
  const [prices, setPrices]   = useState<MarketPriceRow[]>([]);
  const [stats, setStats]     = useState<MarketPriceStats | null>(null);
  const [latest, setLatest]   = useState<MarketPriceRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen]       = useState(true);
  const [days, setDays]       = useState(30);

  const fetch30d = useCallback(async (d: number) => {
    setLoading(true);
    try {
      const [histRes, latRes] = await Promise.all([
        fetch(`/api/carbon/market-prices?market=KETS&days=${d}`, { credentials: 'include' }),
        fetch('/api/carbon/market-prices?market=KETS&latest=true', { credentials: 'include' }),
      ]);
      const [hist, lat] = await Promise.all([histRes.json(), latRes.json()]);
      if (hist.success) { setPrices(hist.data ?? []); setStats(hist.stats); }
      if (lat.success)  setLatest(lat.data ?? null);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetch30d(days); }, [fetch30d, days]);

  const chartData = prices.map((p) => ({
    date:  new Date(p.priceDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
    price: Number(p.price),
    cr:    p.changeRate != null ? Number(p.changeRate) : null,
  }));

  const isUp  = (stats?.changeRate ?? 0) >= 0;
  const curPrice = latest ? Number(latest.price) : stats?.last ?? null;

  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden">
      {/* 헤더 */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <BarChart3 className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold text-white">K-ETS 시세 차트</span>
          {curPrice && (
            <span className="text-base font-mono font-bold text-emerald-300">
              ₩{Math.round(curPrice).toLocaleString('ko-KR')}
              <span className="text-xs text-slate-500 font-normal ml-1">/tCO₂</span>
            </span>
          )}
          {stats && (
            <span className={`flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded ${
              isUp ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'
            }`}>
              {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {isUp ? '+' : ''}{stats.changeRate.toFixed(2)}% ({days}일)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={(e) => { e.stopPropagation(); setDays(d); }}
              className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                days === d
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-500 hover:text-slate-300 bg-slate-700/40'
              }`}
            >
              {d}일
            </button>
          ))}
          {open ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </div>
      </button>

      {/* 차트 본문 */}
      {open && (
        <div className="px-4 pb-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
            </div>
          ) : prices.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-slate-600 text-sm gap-1">
              <BarChart2 className="w-6 h-6 opacity-30" />
              <p>시세 데이터가 없습니다.</p>
              <p className="text-xs">마이그레이션 SQL 적용 후 사용 가능합니다.</p>
            </div>
          ) : (
            <>
              {/* 통계 뱃지 */}
              {stats && (
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {[
                    { label: '현재가', value: `₩${Math.round(curPrice ?? stats.last).toLocaleString('ko-KR')}`, color: 'text-emerald-300' },
                    { label: `${days}일 고가`, value: `₩${Math.round(stats.max).toLocaleString('ko-KR')}`, color: 'text-amber-300' },
                    { label: `${days}일 저가`, value: `₩${Math.round(stats.min).toLocaleString('ko-KR')}`, color: 'text-blue-300' },
                    { label: '평균', value: `₩${Math.round(stats.avg).toLocaleString('ko-KR')}`, color: 'text-slate-300' },
                  ].map((s) => (
                    <div key={s.label} className="bg-slate-900/50 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-slate-500">{s.label}</p>
                      <p className={`text-sm font-mono font-semibold ${s.color}`}>{s.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* 차트 */}
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `₩${(v / 1000).toFixed(0)}k`}
                    domain={['auto', 'auto']}
                    width={48}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#94a3b8' }}
                    formatter={(v: number) => [`₩${v.toLocaleString('ko-KR')}`, 'K-ETS KAU']}
                  />
                  {stats && (
                    <ReferenceLine
                      y={stats.avg}
                      stroke="#64748b"
                      strokeDasharray="4 2"
                      label={{ value: '평균', position: 'insideTopRight', fontSize: 9, fill: '#64748b' }}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="#34d399"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#34d399' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 상수 ─────────────────────────────────────────────────────────────────────

const REGISTRIES: CarbonRegistry[] = ['K-ETS', 'Verra', 'GoldStandard', 'CDM', 'J-Credit', 'OTHER'];
const CREDIT_TYPES: CreditType[] = ['KAU', 'KCU', 'OFFSET', 'VER', 'GS-VER', 'CER'];
const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'bank_transfer', label: '계좌 이체' },
  { value: 'pg',            label: 'PG 결제 (토스페이먼츠)' },
  { value: 'escrow',        label: '에스크로 결제' },
];

const EVENT_COLORS: Record<string, string> = {
  BUY:    'text-emerald-400 bg-emerald-500/10',
  SELL:   'text-red-400 bg-red-500/10',
  RETIRE: 'text-orange-400 bg-orange-500/10',
  CANCEL: 'text-slate-400 bg-slate-500/10',
};
const EVENT_LABELS: Record<string, string> = {
  BUY: '매수', SELL: '매도', RETIRE: '소각', CANCEL: '취소',
};
const PAYMENT_STATUS_COLORS: Record<string, string> = {
  INITIATED: 'text-blue-400', PENDING: 'text-yellow-400',
  SETTLED:   'text-emerald-400', FAILED: 'text-red-400', 'N/A': 'text-slate-600',
};

function formatKRW(n: number) { return `₩${Math.round(n).toLocaleString('ko-KR')}`; }
function isWithinCancelWindow(createdAt: string) {
  return Date.now() - new Date(createdAt).getTime() < 60 * 60 * 1000;
}
function generateIdempotencyKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ─── 페이지 컴포넌트 ──────────────────────────────────────────────────────────

export default function CarbonTradingPage() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [trades, setTrades]       = useState<LedgerTrade[]>([]);
  const [certs, setCerts]         = useState<RetirementCert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [isPlanLocked, setIsPlanLocked] = useState(false);

  const [activeTab, setActiveTab] = useState<'buy' | 'sell' | 'retire'>('buy');
  const [subTab, setSubTab]       = useState<'portfolio' | 'trades' | 'certs'>('portfolio');
  const [tradeFilter, setTradeFilter] = useState<EventType | ''>('');
  const [certFilter, setCertFilter]   = useState('');

  // ── 매수 폼 ──
  const [buyForm, setBuyForm] = useState({
    registry: 'K-ETS' as CarbonRegistry,
    projectId: '',
    serialNumberStart: '',
    serialNumberEnd: '',
    vintageYear: new Date().getFullYear(),
    creditType: 'KAU' as CreditType,
    certificationBody: '환경부',
    issuanceDate: new Date().toISOString().slice(0, 10),
    quantity: '',
    unitPrice: '',
    counterparty: '',
    paymentMethod: 'bank_transfer' as PaymentMethod,
    memo: '',
  });
  const [isBuying, setIsBuying]         = useState(false);
  const [buyError, setBuyError]         = useState<string | null>(null);
  const [buySuccess, setBuySuccess]     = useState(false);
  const [showBuyConfirm, setShowBuyConfirm] = useState(false);

  // ── 매도 폼 ──
  const [sellForm, setSellForm] = useState({
    registryId: '', quantity: '', unitPrice: '',
    counterparty: '', paymentMethod: 'bank_transfer' as PaymentMethod, memo: '',
  });
  const [isSelling, setIsSelling]     = useState(false);
  const [sellError, setSellError]     = useState<string | null>(null);
  const [sellSuccess, setSellSuccess] = useState(false);
  const [showSellConfirm, setShowSellConfirm] = useState(false);

  // ── 소각 폼 ──
  const [retireForm, setRetireForm] = useState({
    registryId: '', quantity: '', retirementReason: '', beneficiaryCompany: '',
    offsetScope: 'scope1' as 'scope1' | 'scope2' | 'scope3',
    compliancePeriod: String(new Date().getFullYear()),
    registryReference: '', memo: '',
  });
  const [isRetiring, setIsRetiring]         = useState(false);
  const [retireError, setRetireError]       = useState<string | null>(null);
  const [retireSuccess, setRetireSuccess]   = useState<RetirementCert | null>(null);
  const [showRetireConfirm, setShowRetireConfirm] = useState(false);

  const [cancelingId, setCancelingId] = useState<string | null>(null);

  // ── 데이터 로드 ──
  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setIsPlanLocked(false);
    try {
      const [pfRes, trRes, certRes] = await Promise.all([
        fetch('/api/carbon/portfolio',      { credentials: 'include' }),
        fetch('/api/carbon/trades?limit=50', { credentials: 'include' }),
        fetch('/api/carbon/retirement?limit=50', { credentials: 'include' }),
      ]);

      if (!pfRes.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const err = await pfRes.json().catch(() => ({} as any));
        const msg = err.error ?? err.message ?? '조회 실패';
        if (pfRes.status === 402) {
          setIsPlanLocked(true);
          window.dispatchEvent(new CustomEvent('ems:upgrade', {
            detail: { message: msg, upgradeUrl: '/settings/subscription' },
          }));
        }
        throw new Error(msg);
      }

      const [pfData, trData, certData] = await Promise.all([
        pfRes.json(), trRes.ok ? trRes.json() : { data: { items: [] } },
        certRes.ok ? certRes.json() : { data: { items: [] } },
      ]);

      setPortfolio(pfData.data ?? pfData);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setTrades(((trData.data ?? trData) as any).items ?? []);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setCerts(((certData.data ?? certData) as any).items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '데이터 조회 중 오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const selectedSellReg   = useMemo(() => portfolio?.positions.find((p) => p.registryId === sellForm.registryId),   [portfolio?.positions, sellForm.registryId]);
  const selectedRetireReg = useMemo(() => portfolio?.positions.find((p) => p.registryId === retireForm.registryId), [portfolio?.positions, retireForm.registryId]);
  const filteredTrades    = useMemo(() => tradeFilter ? trades.filter((t) => t.eventType === tradeFilter) : trades, [trades, tradeFilter]);
  const filteredCerts     = useMemo(() => certFilter  ? certs.filter((c) => c.compliancePeriod === certFilter) : certs, [certs, certFilter]);

  // ── 매수 ──
  const handleBuy = async () => {
    setBuyError(null);
    setBuySuccess(false);
    const qty = Number(buyForm.quantity);
    const prc = Number(buyForm.unitPrice);
    if (!buyForm.projectId || !buyForm.quantity || !buyForm.unitPrice) { setBuyError('프로젝트 ID, 수량, 단가를 입력해주세요'); return; }
    if (qty <= 0 || prc <= 0) { setBuyError('수량과 단가는 0보다 커야 합니다'); return; }
    setShowBuyConfirm(false);
    setIsBuying(true);
    try {
      const idempotencyKey = generateIdempotencyKey();
      const csrfToken = await getCsrfToken();
      const res = await fetch('/api/carbon/trading/buy', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': idempotencyKey, 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ ...buyForm, quantity: qty, unitPrice: prc }),
      });
      if (!res.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const err = await res.json().catch(() => ({} as any));
        throw new Error(err.error ?? err.message ?? '매수 처리 실패');
      }
      setBuySuccess(true);
      setBuyForm((f) => ({ ...f, projectId: '', serialNumberStart: '', serialNumberEnd: '', quantity: '', unitPrice: '', memo: '', counterparty: '' }));
      void fetchAll();
    } catch (e) {
      setBuyError(e instanceof Error ? e.message : '매수 처리 중 오류');
    } finally {
      setIsBuying(false);
    }
  };

  // ── 매도 ──
  const handleSell = async () => {
    setSellError(null);
    setSellSuccess(false);
    const qty = Number(sellForm.quantity);
    const prc = Number(sellForm.unitPrice);
    if (!sellForm.registryId || !sellForm.quantity || !sellForm.unitPrice) { setSellError('크레딧, 수량, 단가를 선택/입력해주세요'); return; }
    if (selectedSellReg && qty > selectedSellReg.availableQuantity) { setSellError(`보유 수량(${selectedSellReg.availableQuantity.toFixed(1)} tCO₂)을 초과합니다`); return; }
    setShowSellConfirm(false);
    setIsSelling(true);
    try {
      const idempotencyKey = generateIdempotencyKey();
      const csrfToken = await getCsrfToken();
      const res = await fetch('/api/carbon/trading/sell', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': idempotencyKey, 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ registryId: sellForm.registryId, quantity: qty, unitPrice: prc, counterparty: sellForm.counterparty, paymentMethod: sellForm.paymentMethod, memo: sellForm.memo }),
      });
      if (!res.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const err = await res.json().catch(() => ({} as any));
        throw new Error(err.error ?? err.message ?? '매도 처리 실패');
      }
      setSellSuccess(true);
      setSellForm((f) => ({ ...f, registryId: '', quantity: '', unitPrice: '', memo: '', counterparty: '' }));
      void fetchAll();
    } catch (e) {
      setSellError(e instanceof Error ? e.message : '매도 처리 중 오류');
    } finally {
      setIsSelling(false);
    }
  };

  // ── 소각 ──
  const handleRetire = async () => {
    setRetireError(null);
    setRetireSuccess(null);
    const qty = Number(retireForm.quantity);
    if (!retireForm.registryId || !retireForm.quantity || !retireForm.retirementReason || !retireForm.beneficiaryCompany) {
      setRetireError('크레딧, 수량, 소각 사유, 수혜 기업을 입력해주세요'); return;
    }
    if (selectedRetireReg && qty > selectedRetireReg.availableQuantity) {
      setRetireError(`보유 수량(${selectedRetireReg.availableQuantity.toFixed(1)} tCO₂)을 초과합니다`); return;
    }
    setShowRetireConfirm(false);
    setIsRetiring(true);
    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch('/api/carbon/retirement', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ ...retireForm, quantity: qty }),
      });
      if (!res.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const err = await res.json().catch(() => ({} as any));
        throw new Error(err.error ?? err.message ?? '소각 처리 실패');
      }
      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cert = ((data.data ?? data) as any).certificate as RetirementCert;
      setRetireSuccess(cert);
      setRetireForm((f) => ({ ...f, registryId: '', quantity: '', retirementReason: '', beneficiaryCompany: '', memo: '', registryReference: '' }));
      void fetchAll();
    } catch (e) {
      setRetireError(e instanceof Error ? e.message : '소각 처리 중 오류');
    } finally {
      setIsRetiring(false);
    }
  };

  const handleCancelTrade = async (id: string) => {
    if (!confirm('이 매수 거래를 취소하시겠습니까?')) return;
    setCancelingId(id);
    try {
      await apiDelete('/api/carbon/trades', { body: { ledgerEntryId: id } });
      void fetchAll();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : e instanceof Error ? e.message : '취소 실패');
    } finally {
      setCancelingId(null);
    }
  };

  const downloadCertificate = async (certId: string, retirementId: string) => {
    const res  = await fetch(`/api/carbon/retirement/${certId}/certificate?format=json`, { credentials: 'include' });
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `CarbonRetirement_${retirementId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const summary     = portfolio?.summary;
  const pnlPositive = (summary?.totalUnrealizedPnl ?? 0) >= 0;

  // ═══════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="h-full bg-[#051225] text-white p-4 md:p-6 space-y-6">

      {isPlanLocked && error && (
        <PlanLockedBanner message={error} requiredPlan="PROFESSIONAL"
          onRetry={() => { setIsPlanLocked(false); void fetchAll(); }} />
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <Leaf className="w-6 h-6 text-emerald-400" />
            </div>
            탄소배출권 거래소 v2
          </h1>
          <p className="text-slate-400 text-sm mt-1">K-ETS / Verra 레지스트리 기반 컴플라이언스 거래</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="https://ets.krx.co.kr" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition">
            <ExternalLink className="w-3.5 h-3.5" />K-ETS 시장
          </a>
          <button onClick={() => void fetchAll()} disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />새로고침
          </button>
        </div>
      </div>

      {/* 시장가 배너 */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 flex items-center gap-6 flex-wrap text-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs bg-slate-700/50 px-1.5 py-0.5 rounded text-slate-400">KAU</span>
          <span className="font-mono font-semibold">{summary ? formatKRW(summary.marketPrice) : '—'}/tCO₂</span>
          <TrendingUp className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-slate-700/50 px-1.5 py-0.5 rounded text-slate-400">KCU</span>
          <span className="font-mono font-semibold">{summary ? formatKRW(summary.marketPrice * 0.85) : '—'}/tCO₂</span>
          <TrendingDown className="w-4 h-4 text-red-400" />
        </div>
        <div className="flex items-center gap-1.5 ml-auto text-xs text-slate-600">
          <Shield className="w-3 h-3" />SHA-256 해시체인 감사 원장
        </div>
        <span className="text-xs text-slate-600"><Clock className="w-3 h-3 inline mr-1" />환경부 K-ETS 참고 단가</span>
      </div>

      {/* K-ETS 시세 차트 */}
      <MarketPriceChart />

      {error && !isPlanLocked && (
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* ── 포트폴리오 요약 카드 ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: <Leaf className="w-4 h-4 text-emerald-400" />, label: '보유 크레딧', value: `${(summary?.totalAvailableQuantity ?? 0).toLocaleString('ko-KR', { maximumFractionDigits: 1 })} tCO₂`, sub: `${summary?.totalPositions ?? 0}개 포지션` },
          { icon: <DollarSign className="w-4 h-4 text-cyan-400" />, label: '평가액', value: formatKRW(summary?.totalMarketValue ?? 0), sub: `취득원가 ${formatKRW(summary?.totalCost ?? 0)}` },
          { icon: pnlPositive ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />, label: '평가 손익', value: `${pnlPositive ? '+' : ''}${formatKRW(summary?.totalUnrealizedPnl ?? 0)}`, sub: `실현 손익 ${formatKRW(summary?.totalRealizedPnl ?? 0)}`, color: pnlPositive ? 'text-emerald-400' : 'text-red-400' },
          { icon: <Flame className="w-4 h-4 text-orange-400" />, label: '총 소각량', value: `${(summary?.totalRetiredQuantity ?? 0).toLocaleString('ko-KR', { maximumFractionDigits: 1 })} tCO₂`, sub: `인증서 ${certs.length}건` },
        ].map((card, i) => (
          <div key={i} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">{card.icon}<span className="text-xs text-slate-400">{card.label}</span></div>
            {isLoading
              ? <div className="h-7 bg-slate-700/50 rounded animate-pulse" />
              : <p className={`text-xl font-bold ${card.color ?? 'text-white'}`}>{card.value}</p>}
            <p className="text-xs text-slate-500 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── 거래 패널 ── */}
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="flex border-b border-slate-700/50">
            {([
              { key: 'buy',    label: '매수', icon: <ShoppingCart className="w-3.5 h-3.5" />, active: 'text-emerald-400 border-emerald-400' },
              { key: 'sell',   label: '매도', icon: <TrendingDown className="w-3.5 h-3.5" />, active: 'text-red-400 border-red-400' },
              { key: 'retire', label: '소각', icon: <Flame className="w-3.5 h-3.5" />, active: 'text-orange-400 border-orange-400' },
            ] as const).map(({ key, label, icon, active }) => (
              <button key={key} onClick={() => setActiveTab(key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition ${activeTab === key ? `${active} border-b-2` : 'text-slate-400 hover:text-white'}`}>
                {icon}{label}
              </button>
            ))}
          </div>

          <div className="p-4 space-y-3">

            {/* ── BUY ── */}
            {activeTab === 'buy' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">레지스트리</label>
                    <select value={buyForm.registry} onChange={(e) => setBuyForm((f) => ({ ...f, registry: e.target.value as CarbonRegistry }))}
                      className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:border-emerald-500 focus:outline-none">
                      {REGISTRIES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">크레딧 타입</label>
                    <select value={buyForm.creditType} onChange={(e) => setBuyForm((f) => ({ ...f, creditType: e.target.value as CreditType }))}
                      className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:border-emerald-500 focus:outline-none">
                      {CREDIT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">프로젝트 ID</label>
                  <input type="text" value={buyForm.projectId} onChange={(e) => setBuyForm((f) => ({ ...f, projectId: e.target.value }))}
                    placeholder="예: KAU-2025-001"
                    className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">일련번호 시작</label>
                    <input type="text" value={buyForm.serialNumberStart} onChange={(e) => setBuyForm((f) => ({ ...f, serialNumberStart: e.target.value }))}
                      placeholder="KAU-2025-00001"
                      className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">일련번호 끝</label>
                    <input type="text" value={buyForm.serialNumberEnd} onChange={(e) => setBuyForm((f) => ({ ...f, serialNumberEnd: e.target.value }))}
                      placeholder="KAU-2025-10000"
                      className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">빈티지 연도</label>
                    <select value={buyForm.vintageYear} onChange={(e) => setBuyForm((f) => ({ ...f, vintageYear: Number(e.target.value) }))}
                      className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:border-emerald-500 focus:outline-none">
                      {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">발행일</label>
                    <input type="date" value={buyForm.issuanceDate} onChange={(e) => setBuyForm((f) => ({ ...f, issuanceDate: e.target.value }))}
                      className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:border-emerald-500 focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">인증 기관</label>
                  <input type="text" value={buyForm.certificationBody} onChange={(e) => setBuyForm((f) => ({ ...f, certificationBody: e.target.value }))}
                    placeholder="환경부 / Verra / Gold Standard"
                    className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">수량 (tCO₂)</label>
                    <input type="number" min="0.1" step="0.1" value={buyForm.quantity} onChange={(e) => setBuyForm((f) => ({ ...f, quantity: e.target.value }))}
                      className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:border-emerald-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">
                      단가 (KRW)
                      {summary && (
                        <button type="button" onClick={() => setBuyForm((f) => ({ ...f, unitPrice: String(summary.marketPrice) }))}
                          className="ml-1 text-emerald-500/70 hover:text-emerald-400 underline text-xs">시장가</button>
                      )}
                    </label>
                    <input type="number" min="1" value={buyForm.unitPrice} onChange={(e) => setBuyForm((f) => ({ ...f, unitPrice: e.target.value }))}
                      className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:border-emerald-500 focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">결제 방식</label>
                  <select value={buyForm.paymentMethod} onChange={(e) => setBuyForm((f) => ({ ...f, paymentMethod: e.target.value as PaymentMethod }))}
                    className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:border-emerald-500 focus:outline-none">
                    {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                {buyForm.quantity && buyForm.unitPrice && Number(buyForm.quantity) > 0 && Number(buyForm.unitPrice) > 0 && (
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2 text-xs text-emerald-400">
                    총액: <strong>{formatKRW(Number(buyForm.quantity) * Number(buyForm.unitPrice))}</strong>
                    <span className="ml-2 text-slate-500">· {PAYMENT_METHODS.find((m) => m.value === buyForm.paymentMethod)?.label}</span>
                  </div>
                )}
                {buyError && <div className="flex items-center gap-2 text-red-400 text-xs"><AlertCircle className="w-3.5 h-3.5 shrink-0" />{buyError}</div>}
                {buySuccess && <div className="flex items-center gap-2 text-emerald-400 text-xs"><CheckCircle2 className="w-3.5 h-3.5" />매수가 완료되었습니다</div>}
                {showBuyConfirm ? (
                  <div className="bg-slate-900 border border-emerald-500/30 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-semibold text-emerald-400">매수 주문 확인</p>
                    <div className="text-xs text-slate-400 space-y-1">
                      <p>레지스트리: <span className="text-white">{buyForm.registry} / {buyForm.creditType}</span></p>
                      <p>프로젝트: <span className="text-white">{buyForm.projectId}</span></p>
                      <p>수량: <span className="text-white">{buyForm.quantity} tCO₂</span></p>
                      <p>총액: <span className="text-emerald-400 font-semibold">{formatKRW(Number(buyForm.quantity) * Number(buyForm.unitPrice))}</span></p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => void handleBuy()} disabled={isBuying}
                        className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium disabled:opacity-50 flex items-center justify-center gap-1">
                        {isBuying ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}확인 매수
                      </button>
                      <button onClick={() => setShowBuyConfirm(false)} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs">취소</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowBuyConfirm(true)} disabled={isBuying}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                    <ShoppingCart className="w-4 h-4" />매수 주문
                  </button>
                )}
              </>
            )}

            {/* ── SELL ── */}
            {activeTab === 'sell' && (
              <>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">매도 크레딧</label>
                  <select value={sellForm.registryId} onChange={(e) => setSellForm((f) => ({ ...f, registryId: e.target.value, quantity: '' }))}
                    className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:border-red-500 focus:outline-none">
                    <option value="">크레딧 선택</option>
                    {(portfolio?.positions ?? []).filter((p) => p.availableQuantity > 0).map((p) => (
                      <option key={p.registryId} value={p.registryId}>[{p.registry}] {p.creditType} {p.vintageYear} — {p.availableQuantity.toFixed(1)} tCO₂</option>
                    ))}
                  </select>
                </div>
                {selectedSellReg && (
                  <div className="bg-slate-900/50 border border-slate-700/30 rounded-lg px-3 py-2 text-xs text-slate-400 grid grid-cols-3 gap-2">
                    <div><p className="text-slate-600">WAC</p><p className="text-white">{formatKRW(selectedSellReg.weightedAvgCost)}/t</p></div>
                    <div><p className="text-slate-600">시장가</p><p className="text-white">{formatKRW(selectedSellReg.marketPrice)}/t</p></div>
                    <div><p className="text-slate-600">평가 손익</p><p className={selectedSellReg.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>{selectedSellReg.unrealizedPnl >= 0 ? '+' : ''}{formatKRW(selectedSellReg.unrealizedPnl)}</p></div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 flex items-center gap-1">수량 (tCO₂)
                      {selectedSellReg && <button type="button" onClick={() => setSellForm((f) => ({ ...f, quantity: String(selectedSellReg.availableQuantity) }))} className="text-red-500/70 hover:text-red-400 underline">최대</button>}
                    </label>
                    <input type="number" min="0.1" step="0.1" max={selectedSellReg?.availableQuantity} value={sellForm.quantity} onChange={(e) => setSellForm((f) => ({ ...f, quantity: e.target.value }))}
                      className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:border-red-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">매도 단가 (KRW)</label>
                    <input type="number" min="1" value={sellForm.unitPrice} onChange={(e) => setSellForm((f) => ({ ...f, unitPrice: e.target.value }))}
                      className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:border-red-500 focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">결제 방식</label>
                  <select value={sellForm.paymentMethod} onChange={(e) => setSellForm((f) => ({ ...f, paymentMethod: e.target.value as PaymentMethod }))}
                    className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:border-red-500 focus:outline-none">
                    {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                {sellError && <div className="flex items-center gap-2 text-red-400 text-xs"><AlertCircle className="w-3.5 h-3.5 shrink-0" />{sellError}</div>}
                {sellSuccess && <div className="flex items-center gap-2 text-emerald-400 text-xs"><CheckCircle2 className="w-3.5 h-3.5" />매도가 완료되었습니다</div>}
                {showSellConfirm ? (
                  <div className="bg-slate-900 border border-red-500/30 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-semibold text-red-400">매도 주문 확인</p>
                    <div className="text-xs text-slate-400 space-y-1">
                      <p>수량: <span className="text-white">{sellForm.quantity} tCO₂</span></p>
                      <p>총 매도금액: <span className="text-red-400 font-semibold">{formatKRW(Number(sellForm.quantity) * Number(sellForm.unitPrice))}</span></p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => void handleSell()} disabled={isSelling}
                        className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-medium disabled:opacity-50 flex items-center justify-center gap-1">
                        {isSelling ? <Loader2 className="w-3 h-3 animate-spin" /> : null}확인 매도
                      </button>
                      <button onClick={() => setShowSellConfirm(false)} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs">취소</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowSellConfirm(true)} disabled={isSelling || !sellForm.registryId || !sellForm.quantity || !sellForm.unitPrice}
                    className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                    <TrendingDown className="w-4 h-4" />매도 주문
                  </button>
                )}
              </>
            )}

            {/* ── RETIRE ── */}
            {activeTab === 'retire' && (
              <>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">소각할 크레딧</label>
                  <select value={retireForm.registryId} onChange={(e) => setRetireForm((f) => ({ ...f, registryId: e.target.value, quantity: '' }))}
                    className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:border-orange-500 focus:outline-none">
                    <option value="">크레딧 선택</option>
                    {(portfolio?.positions ?? []).filter((p) => p.availableQuantity > 0).map((p) => (
                      <option key={p.registryId} value={p.registryId}>[{p.registry}] {p.creditType} {p.vintageYear} — {p.availableQuantity.toFixed(1)} tCO₂</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 flex items-center gap-1">소각 수량 (tCO₂)
                    {selectedRetireReg && <button type="button" onClick={() => setRetireForm((f) => ({ ...f, quantity: String(selectedRetireReg.availableQuantity) }))} className="text-orange-500/70 hover:text-orange-400 underline">최대 {selectedRetireReg.availableQuantity.toFixed(1)}t</button>}
                  </label>
                  <input type="number" min="0.1" step="0.1" max={selectedRetireReg?.availableQuantity} value={retireForm.quantity} onChange={(e) => setRetireForm((f) => ({ ...f, quantity: e.target.value }))}
                    className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:border-orange-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">수혜 기업 (상계 주체)</label>
                  <input type="text" value={retireForm.beneficiaryCompany} onChange={(e) => setRetireForm((f) => ({ ...f, beneficiaryCompany: e.target.value }))}
                    placeholder="(주)탄소이음"
                    className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder:text-slate-600 focus:border-orange-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">소각 사유</label>
                  <input type="text" value={retireForm.retirementReason} onChange={(e) => setRetireForm((f) => ({ ...f, retirementReason: e.target.value }))}
                    placeholder="2025년 Scope 1 배출량 상계"
                    className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder:text-slate-600 focus:border-orange-500 focus:outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">상계 스코프</label>
                    <select value={retireForm.offsetScope} onChange={(e) => setRetireForm((f) => ({ ...f, offsetScope: e.target.value as 'scope1' | 'scope2' | 'scope3' }))}
                      className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:border-orange-500 focus:outline-none">
                      <option value="scope1">Scope 1 (직접)</option>
                      <option value="scope2">Scope 2 (전력)</option>
                      <option value="scope3">Scope 3 (가치사슬)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">준수 연도</label>
                    <input type="text" value={retireForm.compliancePeriod} onChange={(e) => setRetireForm((f) => ({ ...f, compliancePeriod: e.target.value }))}
                      placeholder="2025"
                      className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:border-orange-500 focus:outline-none" />
                  </div>
                </div>
                {retireForm.registryId && retireForm.quantity && Number(retireForm.quantity) > 0 && (
                  <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg px-3 py-2 text-xs text-orange-400">
                    ⚠ 소각은 <strong>취소 불가</strong>합니다. <strong>{retireForm.quantity} tCO₂</strong> 상계 후 인증서 발급.
                  </div>
                )}
                {retireError && <div className="flex items-center gap-2 text-red-400 text-xs"><AlertCircle className="w-3.5 h-3.5 shrink-0" />{retireError}</div>}
                {retireSuccess && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                      <CheckCircle2 className="w-4 h-4" />소각 완료 — 인증서 발급
                    </div>
                    <p className="text-xs text-slate-400">인증서: <span className="text-white font-mono">{retireSuccess.retirementId}</span></p>
                    <button onClick={() => void downloadCertificate(retireSuccess.id, retireSuccess.retirementId)}
                      className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 underline">
                      <Download className="w-3 h-3" />인증서 다운로드 (JSON)
                    </button>
                  </div>
                )}
                {showRetireConfirm ? (
                  <div className="bg-slate-900 border border-orange-500/30 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-semibold text-orange-400">소각 최종 확인</p>
                    <div className="text-xs text-slate-400 space-y-1">
                      <p>수량: <span className="text-white">{retireForm.quantity} tCO₂</span></p>
                      <p>수혜 기업: <span className="text-white">{retireForm.beneficiaryCompany}</span></p>
                      <p>스코프: <span className="text-white">{retireForm.offsetScope}</span></p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => void handleRetire()} disabled={isRetiring}
                        className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-medium disabled:opacity-50 flex items-center justify-center gap-1">
                        {isRetiring ? <Loader2 className="w-3 h-3 animate-spin" /> : <Flame className="w-3 h-3" />}소각 확정
                      </button>
                      <button onClick={() => setShowRetireConfirm(false)} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs">취소</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowRetireConfirm(true)}
                    disabled={isRetiring || !retireForm.registryId || !retireForm.quantity || !retireForm.retirementReason || !retireForm.beneficiaryCompany}
                    className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                    <Flame className="w-4 h-4" />소각 주문
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── 정보 패널 ── */}
        <div className="lg:col-span-3 bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden flex flex-col">
          <div className="flex border-b border-slate-700/50 px-4">
            {([
              { key: 'portfolio', label: '포지션',   icon: <BarChart2 className="w-3.5 h-3.5" /> },
              { key: 'trades',    label: '거래 원장', icon: <FileText className="w-3.5 h-3.5" /> },
              { key: 'certs',     label: '인증서',    icon: <Shield className="w-3.5 h-3.5" /> },
            ] as const).map(({ key, label, icon }) => (
              <button key={key} onClick={() => setSubTab(key)}
                className={`flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 transition ${subTab === key ? 'border-blue-400 text-blue-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
                {icon}{label}
              </button>
            ))}
          </div>

          {/* ── 포지션 ── */}
          {subTab === 'portfolio' && (
            <div className="flex-1 overflow-y-auto divide-y divide-slate-700/30">
              {isLoading ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-4 animate-pulse"><div className="h-4 bg-slate-700/50 rounded w-3/4 mb-2" /><div className="h-3 bg-slate-700/30 rounded w-1/2" /></div>
              )) : (portfolio?.positions ?? []).length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Leaf className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>보유 포지션 없음</p>
                  <p className="text-xs mt-1">매수 탭에서 크레딧을 취득하세요</p>
                </div>
              ) : (portfolio?.positions ?? []).map((pos) => (
                <div key={pos.registryId} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-xs font-semibold bg-slate-700/50 px-2 py-0.5 rounded text-slate-300">{pos.registry}</span>
                        <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded">{pos.creditType}</span>
                        <span className="text-xs text-slate-500">{pos.vintageYear}년</span>
                      </div>
                      <p className="text-xs text-slate-500 font-mono truncate max-w-xs">{pos.projectId}</p>
                      <p className="text-xs text-slate-700">{pos.certificationBody} · {pos.serialNumberStart}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-bold text-white">{pos.availableQuantity.toFixed(1)} <span className="text-xs font-normal text-slate-400">tCO₂</span></p>
                      <p className="text-xs text-cyan-400">{formatKRW(pos.marketValue)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div><p className="text-slate-600">WAC</p><p className="text-white">{formatKRW(pos.weightedAvgCost)}/t</p></div>
                    <div><p className="text-slate-600">평가 손익</p><p className={pos.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>{pos.unrealizedPnl >= 0 ? '+' : ''}{formatKRW(pos.unrealizedPnl)}</p></div>
                    <div><p className="text-slate-600">소각량</p><p className="text-orange-400">{pos.retiredQuantity.toFixed(1)} t</p></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── 거래 원장 ── */}
          {subTab === 'trades' && (
            <div className="flex flex-col flex-1">
              <div className="px-4 py-2 flex items-center gap-2 border-b border-slate-700/30">
                <Filter className="w-3 h-3 text-slate-500" />
                <select value={tradeFilter} onChange={(e) => setTradeFilter(e.target.value as EventType | '')}
                  className="bg-slate-900 border border-slate-700 rounded text-xs text-white px-2 py-1 focus:outline-none">
                  <option value="">전체 유형</option>
                  {(['BUY', 'SELL', 'RETIRE', 'CANCEL'] as const).map((t) => <option key={t} value={t}>{EVENT_LABELS[t]}</option>)}
                </select>
                <span className="text-xs text-slate-600 ml-auto">{filteredTrades.length}건 · 해시체인 보호</span>
              </div>
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-700/50">
                      {['날짜', '유형', '크레딧', '수량', '단가', '총액', '결제', '해시', '취소'].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-left font-medium text-slate-500 uppercase whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrades.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-8 text-slate-500">거래 내역이 없습니다</td></tr>
                    ) : filteredTrades.map((t) => {
                      const canCancel = t.eventType === 'BUY' && isWithinCancelWindow(t.createdAt) && t.paymentStatus !== 'SETTLED';
                      return (
                        <tr key={t.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition">
                          <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">
                            {new Date(t.createdAt).toLocaleDateString('ko-KR')} <span className="text-slate-600">{new Date(t.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                          </td>
                          <td className="px-3 py-2.5"><span className={`px-1.5 py-0.5 rounded ${EVENT_COLORS[t.eventType] ?? ''}`}>{EVENT_LABELS[t.eventType] ?? t.eventType}</span></td>
                          <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">{t.registry ? `${t.registry.registry} ${t.registry.creditType} ${t.registry.vintageYear}` : '—'}</td>
                          <td className="px-3 py-2.5 font-mono text-white text-right">{t.quantity.toFixed(1)} t</td>
                          <td className="px-3 py-2.5 font-mono text-slate-400 text-right">{t.unitPrice > 0 ? formatKRW(t.unitPrice) : '—'}</td>
                          <td className="px-3 py-2.5 font-mono text-white text-right">{t.totalAmount > 0 ? formatKRW(t.totalAmount) : '—'}</td>
                          <td className="px-3 py-2.5"><span className={PAYMENT_STATUS_COLORS[t.paymentStatus] ?? 'text-slate-600'}>{t.paymentStatus}</span></td>
                          <td className="px-3 py-2.5"><span className="font-mono text-slate-700" title={t.hashSignature}>{t.hashSignature.slice(0, 8)}…</span></td>
                          <td className="px-3 py-2.5 text-center">
                            {canCancel ? (
                              <button onClick={() => void handleCancelTrade(t.id)} disabled={cancelingId === t.id}
                                className="p-1 text-slate-500 hover:text-red-400 disabled:opacity-50" title="매수 취소">
                                {cancelingId === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                              </button>
                            ) : <span className="text-slate-700">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── 소각 인증서 ── */}
          {subTab === 'certs' && (
            <div className="flex flex-col flex-1">
              <div className="px-4 py-2 flex items-center gap-2 border-b border-slate-700/30">
                <Filter className="w-3 h-3 text-slate-500" />
                <input type="text" placeholder="준수 연도 (예: 2025)" value={certFilter} onChange={(e) => setCertFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded text-xs text-white px-2 py-1 focus:outline-none w-36" />
                <span className="text-xs text-slate-600 ml-auto">{filteredCerts.length}건</span>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-slate-700/30">
                {filteredCerts.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>발급된 인증서가 없습니다</p>
                  </div>
                ) : filteredCerts.map((cert) => (
                  <div key={cert.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs text-orange-400">{cert.retirementId}</span>
                          {cert.offsetScope && <span className="text-xs bg-orange-500/10 text-orange-400 px-1.5 py-0.5 rounded">{cert.offsetScope}</span>}
                          {cert.compliancePeriod && <span className="text-xs bg-slate-700/50 text-slate-400 px-1.5 py-0.5 rounded">{cert.compliancePeriod}년</span>}
                        </div>
                        <p className="text-sm font-bold text-white">{cert.retiredQuantity.toFixed(1)} tCO₂ 소각</p>
                        <p className="text-xs text-slate-500">{cert.retirementReason}</p>
                        <p className="text-xs text-slate-600">{cert.beneficiaryCompany}</p>
                        {cert.registry && <p className="text-xs text-slate-700">{cert.registry.registry} · {cert.registry.creditType} {cert.registry.vintageYear}</p>}
                        {cert.ketsSubmissionId && <p className="text-xs text-blue-400">K-ETS: {cert.ketsSubmissionId}</p>}
                      </div>
                      <button onClick={() => void downloadCertificate(cert.id, cert.retirementId)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition whitespace-nowrap shrink-0">
                        <Download className="w-3 h-3" />인증서
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
