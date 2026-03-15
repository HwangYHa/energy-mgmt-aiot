'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, Plus, RefreshCw, Loader2,
  BarChart3, Calendar, Save, X, AlertCircle, CheckCircle2,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { getCsrfToken } from '@/lib/api/client';

// ─── 타입 ───────────────────────────────────────────────────────────────────

interface PriceRow {
  id: string;
  market: string;
  priceDate: string;
  price: number;
  currency: string;
  unit: string;
  source: string | null;
  changeRate: number | null;
  volume: number | null;
  notes: string | null;
}

interface PriceStats {
  min: number; max: number; avg: number; last: number; changeRate: number;
}

const MARKETS = ['KETS', 'EU_ETS', 'VCM', 'GOLD_STANDARD'] as const;
type Market = typeof MARKETS[number];

const MARKET_LABELS: Record<Market, string> = {
  KETS:          'K-ETS (한국)',
  EU_ETS:        'EU ETS',
  VCM:           'VCM (자발적)',
  GOLD_STANDARD: 'Gold Standard',
};

const MARKET_CURRENCY: Record<Market, string> = {
  KETS: 'KRW', EU_ETS: 'EUR', VCM: 'KRW', GOLD_STANDARD: 'USD',
};

function formatPrice(price: number, currency: string) {
  const sym = { KRW: '₩', EUR: '€', USD: '$' }[currency] ?? '';
  return `${sym}${price.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}`;
}

// ─── 페이지 ────────────────────────────────────────────────────────────────

export default function CarbonMarketPricesPage() {
  const [market, setMarket]   = useState<Market>('KETS');
  const [days, setDays]       = useState(30);
  const [rows, setRows]       = useState<PriceRow[]>([]);
  const [stats, setStats]     = useState<PriceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const [form, setForm] = useState({
    market:     'KETS' as Market,
    priceDate:  new Date().toISOString().slice(0, 10),
    price:      '',
    currency:   'KRW',
    unit:       'tCO2',
    source:     'KAU',
    changeRate: '',
    volume:     '',
    notes:      '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/carbon/market-prices?market=${market}&days=${days}`, { credentials: 'include' });
      const json = await res.json();
      if (json.success) {
        setRows(json.data ?? []);
        setStats(json.stats ?? null);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [market, days]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async () => {
    if (!form.price || !form.priceDate) {
      showToast('error', '날짜와 가격을 입력해주세요'); return;
    }
    setSaving(true);
    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch('/api/carbon/market-prices', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({
          market:     form.market,
          priceDate:  form.priceDate,
          price:      Number(form.price),
          currency:   form.currency,
          unit:       form.unit,
          source:     form.source || null,
          changeRate: form.changeRate ? Number(form.changeRate) : null,
          volume:     form.volume    ? Number(form.volume)     : null,
          notes:      form.notes     || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? '저장 실패');
      showToast('success', '가격이 저장되었습니다');
      setShowForm(false);
      setForm((f) => ({ ...f, price: '', changeRate: '', volume: '', notes: '', source: 'KAU' }));
      void fetchData();
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  // 차트용 데이터
  const chartData = [...rows].reverse().map((r) => ({
    date:  new Date(r.priceDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
    price: Number(r.price),
  }));

  const isUp = (stats?.changeRate ?? 0) >= 0;

  return (
    <div className="h-full bg-[#051225] text-white p-4 md:p-6 space-y-6">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm ${
          toast.type === 'success'
            ? 'bg-emerald-900/90 border border-emerald-600/50 text-emerald-200'
            : 'bg-red-900/90 border border-red-600/50 text-red-200'
        }`}>
          {toast.type === 'success'
            ? <CheckCircle2 className="w-4 h-4" />
            : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <BarChart3 className="w-6 h-6 text-emerald-400" />
            </div>
            탄소 시장 가격 관리
          </h1>
          <p className="text-slate-400 text-sm mt-1">K-ETS · EU-ETS · VCM 시장 가격 이력 조회 및 등록</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void fetchData()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />새로고침
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 transition"
          >
            <Plus className="w-3.5 h-3.5" />가격 등록
          </button>
        </div>
      </div>

      {/* 가격 등록 폼 */}
      {showForm && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-white">새 가격 데이터 등록</p>
            <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-slate-300">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">시장</label>
              <select
                value={form.market}
                onChange={(e) => {
                  const m = e.target.value as Market;
                  setForm((f) => ({ ...f, market: m, currency: MARKET_CURRENCY[m] }));
                }}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white"
              >
                {MARKETS.map((m) => <option key={m} value={m}>{MARKET_LABELS[m]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">날짜</label>
              <input
                type="date"
                value={form.priceDate}
                onChange={(e) => setForm((f) => ({ ...f, priceDate: e.target.value }))}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">가격</label>
              <input
                type="number"
                placeholder="예: 12900"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">통화</label>
              <input
                type="text"
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">출처/종목</label>
              <input
                type="text"
                placeholder="KAU, EUA, VER…"
                value={form.source}
                onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">등락률 (%)</label>
              <input
                type="number"
                step="0.01"
                placeholder="예: 1.18"
                value={form.changeRate}
                onChange={(e) => setForm((f) => ({ ...f, changeRate: e.target.value }))}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">거래량</label>
              <input
                type="number"
                placeholder="tCO₂ 거래량"
                value={form.volume}
                onChange={(e) => setForm((f) => ({ ...f, volume: e.target.value }))}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">메모</label>
              <input
                type="text"
                placeholder="특이사항…"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-500 disabled:opacity-50 transition"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              저장
            </button>
          </div>
        </div>
      )}

      {/* 시장 탭 + 기간 선택 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-slate-800/50 border border-slate-700/50 rounded-xl p-1">
          {MARKETS.map((m) => (
            <button
              key={m}
              onClick={() => setMarket(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                market === m
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              {MARKET_LABELS[m]}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {[7, 30, 90, 180].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                days === d
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-500 hover:text-slate-300 bg-slate-800/50'
              }`}
            >
              {d}일
            </button>
          ))}
        </div>
      </div>

      {/* 통계 KPI */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: '현재가', value: formatPrice(stats.last, rows[0]?.currency ?? 'KRW'), color: 'text-emerald-300' },
            { label: `${days}일 고가`, value: formatPrice(stats.max, rows[0]?.currency ?? 'KRW'), color: 'text-amber-300' },
            { label: `${days}일 저가`, value: formatPrice(stats.min, rows[0]?.currency ?? 'KRW'), color: 'text-blue-300' },
            { label: '평균', value: formatPrice(stats.avg, rows[0]?.currency ?? 'KRW'), color: 'text-slate-300' },
            {
              label: `${days}일 등락`,
              value: `${isUp ? '+' : ''}${stats.changeRate.toFixed(2)}%`,
              color: isUp ? 'text-emerald-400' : 'text-red-400',
              icon: isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />,
            },
          ].map((k) => (
            <div key={k.label} className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">{k.label}</p>
              <p className={`text-lg font-mono font-bold mt-0.5 flex items-center gap-1 ${k.color}`}>
                {'icon' in k && k.icon}
                {k.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* 차트 */}
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
        <p className="text-xs text-slate-500 mb-3 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" />
          {MARKET_LABELS[market]} — 최근 {days}일 가격 추이
        </p>
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-600 gap-2">
            <BarChart3 className="w-8 h-8 opacity-30" />
            <p className="text-sm">데이터가 없습니다. 마이그레이션 SQL 적용 후 사용 가능합니다.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => {
                  const cur = rows[0]?.currency ?? 'KRW';
                  return cur === 'KRW' ? `₩${(v / 1000).toFixed(0)}k` : `${v}`;
                }}
                domain={['auto', 'auto']}
                width={52}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#94a3b8' }}
                formatter={(v: number) => [formatPrice(v, rows[0]?.currency ?? 'KRW'), MARKET_LABELS[market]]}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
              <Line
                name={MARKET_LABELS[market]}
                type="monotone"
                dataKey="price"
                stroke="#34d399"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, fill: '#34d399' }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 가격 테이블 */}
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
          <p className="text-sm font-semibold text-white">
            가격 이력 <span className="text-slate-500 font-normal ml-1">({rows.length}건)</span>
          </p>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-10 text-slate-600 text-sm">가격 데이터가 없습니다</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] text-slate-500 uppercase tracking-wider bg-slate-900/30">
                  <th className="px-4 py-2 text-left">날짜</th>
                  <th className="px-4 py-2 text-right">가격</th>
                  <th className="px-4 py-2 text-right">등락률</th>
                  <th className="px-4 py-2 text-right">거래량</th>
                  <th className="px-4 py-2 text-left">출처</th>
                  <th className="px-4 py-2 text-left">메모</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const cr = r.changeRate != null ? Number(r.changeRate) : null;
                  return (
                    <tr key={r.id} className={`border-t border-slate-700/30 ${i % 2 === 0 ? '' : 'bg-slate-900/20'}`}>
                      <td className="px-4 py-2.5 text-slate-300 font-mono text-xs">
                        {new Date(r.priceDate).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-emerald-300">
                        {formatPrice(Number(r.price), r.currency)}
                        <span className="text-slate-600 text-[10px] ml-1">/{r.unit}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {cr != null ? (
                          <span className={`flex items-center justify-end gap-0.5 text-xs ${cr >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {cr >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {cr >= 0 ? '+' : ''}{cr.toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-slate-700">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-400 font-mono text-xs">
                        {r.volume != null ? r.volume.toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs">{r.source ?? '—'}</td>
                      <td className="px-4 py-2.5 text-slate-600 text-xs truncate max-w-[120px]">{r.notes ?? ''}</td>
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
