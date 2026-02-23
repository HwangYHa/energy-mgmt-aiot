'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Leaf,
  DollarSign,
  ShoppingCart,
  Flame,
  AlertCircle,
  Loader2,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Clock,
} from 'lucide-react';

interface CarbonCredit {
  id: string;
  vintage: number;
  type: string;
  quantity: number;
  avgCost: number;
  createdAt: string;
}

interface CarbonTrade {
  id: string;
  creditId: string;
  tradeType: 'buy' | 'sell' | 'retire';
  quantity: number;
  price: number;
  totalAmount: number;
  memo: string | null;
  tradedAt: string;
  credit?: { type: string; vintage: number };
}

interface Portfolio {
  totalQuantity: number;
  totalValue: number;
  totalCost: number;
  unrealizedPnl: number;
  avgCost: number;
  marketPrice: number;
}

interface TradingData {
  portfolio: Portfolio;
  credits: CarbonCredit[];
  recentTrades: CarbonTrade[];
  marketPrice: number;
}

const CREDIT_TYPES = ['KAU', 'KCU', 'OFFSET'] as const;
const TRADE_TYPE_LABELS: Record<string, string> = {
  buy: '매수',
  sell: '매도',
  retire: '소각',
};
const TRADE_TYPE_COLORS: Record<string, string> = {
  buy: 'text-emerald-400 bg-emerald-500/10',
  sell: 'text-red-400 bg-red-500/10',
  retire: 'text-orange-400 bg-orange-500/10',
};

function formatKRW(amount: number) {
  return `₩${Math.round(amount).toLocaleString('ko-KR')}`;
}

export default function CarbonTradingPage() {
  const [data, setData] = useState<TradingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'buy' | 'retire'>('buy');

  // 매수 폼
  const [buyForm, setBuyForm] = useState({
    vintage: new Date().getFullYear(),
    type: 'KAU' as string,
    quantity: '',
    price: '',
    memo: '',
  });
  const [isBuying, setIsBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [buySuccess, setBuySuccess] = useState(false);

  // 소각 폼
  const [retireForm, setRetireForm] = useState({
    creditId: '',
    quantity: '',
    memo: '',
  });
  const [isRetiring, setIsRetiring] = useState(false);
  const [retireError, setRetireError] = useState<string | null>(null);
  const [retireSuccess, setRetireSuccess] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/carbon/trading');
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? '조회 실패');
      }
      const json = await res.json() as TradingData;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : '데이터 조회 중 오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleBuy = async () => {
    setBuyError(null);
    setBuySuccess(false);
    if (!buyForm.quantity || !buyForm.price) {
      setBuyError('수량과 단가를 입력해주세요');
      return;
    }
    setIsBuying(true);
    try {
      const res = await fetch('/api/carbon/trading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vintage: buyForm.vintage,
          type: buyForm.type,
          quantity: Number(buyForm.quantity),
          price: Number(buyForm.price),
          memo: buyForm.memo || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? '매수 실패');
      }
      setBuySuccess(true);
      setBuyForm({ vintage: new Date().getFullYear(), type: 'KAU', quantity: '', price: '', memo: '' });
      await fetchData();
    } catch (e) {
      setBuyError(e instanceof Error ? e.message : '매수 처리 중 오류가 발생했습니다');
    } finally {
      setIsBuying(false);
    }
  };

  const handleRetire = async () => {
    setRetireError(null);
    setRetireSuccess(false);
    if (!retireForm.creditId || !retireForm.quantity) {
      setRetireError('크레딧과 수량을 선택해주세요');
      return;
    }
    setIsRetiring(true);
    try {
      const res = await fetch('/api/carbon/retire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creditId: retireForm.creditId,
          quantity: Number(retireForm.quantity),
          memo: retireForm.memo || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? '소각 실패');
      }
      setRetireSuccess(true);
      setRetireForm({ creditId: '', quantity: '', memo: '' });
      await fetchData();
    } catch (e) {
      setRetireError(e instanceof Error ? e.message : '소각 처리 중 오류가 발생했습니다');
    } finally {
      setIsRetiring(false);
    }
  };

  const pnlPositive = (data?.portfolio.unrealizedPnl ?? 0) >= 0;

  return (
    <div className="min-h-screen bg-[#051225] text-white p-4 md:p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <Leaf className="w-6 h-6 text-emerald-400" />
            </div>
            탄소배출권 거래소
          </h1>
          <p className="text-slate-400 text-sm mt-1">K-ETS 배출권 포트폴리오 관리</p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="https://ets.krx.co.kr"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            K-ETS 시장
          </a>
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        </div>
      </div>

      {/* 시장 가격 배너 */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">K-ETS 현물 참고가</span>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded">KAU</span>
              <span className="font-mono font-semibold text-white">
                {data ? formatKRW(data.marketPrice) : '—'}/tCO₂
              </span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded">KCU</span>
              <span className="font-mono font-semibold text-white">
                {data ? formatKRW(data.marketPrice * 0.85) : '—'}/tCO₂
              </span>
              <TrendingDown className="w-4 h-4 text-red-400" />
            </div>
          </div>
          <span className="text-xs text-slate-600 ml-auto">
            <Clock className="w-3 h-3 inline mr-1" />
            환경부 K-ETS 참고 단가 (실시간 아님)
          </span>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* 포트폴리오 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Leaf className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-slate-400">보유 크레딧</span>
          </div>
          {isLoading ? (
            <div className="h-8 bg-slate-700/50 rounded animate-pulse" />
          ) : (
            <>
              <p className="text-2xl font-bold text-white">
                {(data?.portfolio.totalQuantity ?? 0).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}
                <span className="text-sm font-normal text-slate-400 ml-1">tCO₂</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {data?.credits.length ?? 0}개 크레딧 보유
              </p>
            </>
          )}
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-cyan-400" />
            <span className="text-sm text-slate-400">현재 평가액</span>
          </div>
          {isLoading ? (
            <div className="h-8 bg-slate-700/50 rounded animate-pulse" />
          ) : (
            <>
              <p className="text-2xl font-bold text-white">
                {formatKRW(data?.portfolio.totalValue ?? 0)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                평균 단가 {formatKRW(data?.portfolio.avgCost ?? 0)}/tCO₂
              </p>
            </>
          )}
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            {pnlPositive ? (
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-400" />
            )}
            <span className="text-sm text-slate-400">평가 손익</span>
          </div>
          {isLoading ? (
            <div className="h-8 bg-slate-700/50 rounded animate-pulse" />
          ) : (
            <>
              <p className={`text-2xl font-bold ${pnlPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                {pnlPositive ? '+' : ''}{formatKRW(data?.portfolio.unrealizedPnl ?? 0)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                매입액 {formatKRW(data?.portfolio.totalCost ?? 0)}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 매수/소각 패널 */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
          {/* 탭 헤더 */}
          <div className="flex border-b border-slate-700/50">
            <button
              onClick={() => setActiveTab('buy')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition ${
                activeTab === 'buy'
                  ? 'text-emerald-400 border-b-2 border-emerald-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              매수
            </button>
            <button
              onClick={() => setActiveTab('retire')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition ${
                activeTab === 'retire'
                  ? 'text-orange-400 border-b-2 border-orange-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Flame className="w-4 h-4" />
              소각 (상계)
            </button>
          </div>

          <div className="p-5 space-y-4">
            {activeTab === 'buy' ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">발행연도 (Vintage)</label>
                    <select
                      value={buyForm.vintage}
                      onChange={(e) => setBuyForm((f) => ({ ...f, vintage: Number(e.target.value) }))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-emerald-500 focus:outline-none"
                    >
                      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">크레딧 타입</label>
                    <select
                      value={buyForm.type}
                      onChange={(e) => setBuyForm((f) => ({ ...f, type: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-emerald-500 focus:outline-none"
                    >
                      {CREDIT_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">수량 (tCO₂)</label>
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={buyForm.quantity}
                      onChange={(e) => setBuyForm((f) => ({ ...f, quantity: e.target.value }))}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">단가 (KRW/tCO₂)</label>
                    <input
                      type="number"
                      min="1"
                      value={buyForm.price}
                      onChange={(e) => setBuyForm((f) => ({ ...f, price: e.target.value }))}
                      placeholder={String(data?.marketPrice ?? 8500)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {buyForm.quantity && buyForm.price && (
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2 text-sm text-emerald-400">
                    총액: {formatKRW(Number(buyForm.quantity) * Number(buyForm.price))}
                  </div>
                )}

                <div>
                  <label className="text-xs text-slate-500 mb-1 block">메모 (선택)</label>
                  <input
                    type="text"
                    value={buyForm.memo}
                    onChange={(e) => setBuyForm((f) => ({ ...f, memo: e.target.value }))}
                    placeholder="거래 메모"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                {buyError && (
                  <div className="flex items-center gap-2 text-red-400 text-xs">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {buyError}
                  </div>
                )}
                {buySuccess && (
                  <div className="flex items-center gap-2 text-emerald-400 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    매수가 완료되었습니다
                  </div>
                )}

                <button
                  onClick={handleBuy}
                  disabled={isBuying}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {isBuying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                  매수 실행
                </button>
              </>
            ) : (
              <>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">소각할 크레딧</label>
                  <select
                    value={retireForm.creditId}
                    onChange={(e) => setRetireForm((f) => ({ ...f, creditId: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-orange-500 focus:outline-none"
                  >
                    <option value="">크레딧 선택</option>
                    {(data?.credits ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.type} {c.vintage} — {c.quantity.toFixed(1)} tCO₂ 보유
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-500 mb-1 block">소각 수량 (tCO₂)</label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={retireForm.quantity}
                    onChange={(e) => setRetireForm((f) => ({ ...f, quantity: e.target.value }))}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-orange-500 focus:outline-none"
                  />
                </div>

                {retireForm.creditId && retireForm.quantity && (
                  <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg px-3 py-2 text-xs text-orange-400">
                    ⚠ 소각된 크레딧은 취소할 수 없습니다. {retireForm.quantity} tCO₂의 배출량을 상계합니다.
                  </div>
                )}

                <div>
                  <label className="text-xs text-slate-500 mb-1 block">소각 사유</label>
                  <input
                    type="text"
                    value={retireForm.memo}
                    onChange={(e) => setRetireForm((f) => ({ ...f, memo: e.target.value }))}
                    placeholder="배출량 상계 사유"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-600 focus:border-orange-500 focus:outline-none"
                  />
                </div>

                {retireError && (
                  <div className="flex items-center gap-2 text-red-400 text-xs">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {retireError}
                  </div>
                )}
                {retireSuccess && (
                  <div className="flex items-center gap-2 text-emerald-400 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    소각이 완료되었습니다
                  </div>
                )}

                <button
                  onClick={handleRetire}
                  disabled={isRetiring}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {isRetiring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4" />}
                  소각 실행
                </button>
              </>
            )}
          </div>
        </div>

        {/* 보유 크레딧 목록 */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700/50">
            <h2 className="text-base font-semibold">보유 크레딧 현황</h2>
          </div>
          <div className="divide-y divide-slate-700/30">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-4 animate-pulse">
                  <div className="h-4 bg-slate-700/50 rounded w-1/2 mb-2" />
                  <div className="h-3 bg-slate-700/30 rounded w-2/3" />
                </div>
              ))
            ) : (data?.credits ?? []).length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Leaf className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>보유 크레딧이 없습니다</p>
                <p className="text-xs mt-1">매수 탭에서 크레딧을 매수하세요</p>
              </div>
            ) : (
              (data?.credits ?? []).map((credit) => (
                <div key={credit.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold bg-slate-700/50 px-2 py-0.5 rounded text-slate-300">
                        {credit.type}
                      </span>
                      <span className="text-xs text-slate-500">{credit.vintage}년</span>
                    </div>
                    <p className="text-white font-semibold">
                      {credit.quantity.toFixed(1)} tCO₂
                    </p>
                    <p className="text-xs text-slate-500">
                      평균 매입가 {formatKRW(credit.avgCost)}/t
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-cyan-400 font-medium">
                      {formatKRW(credit.quantity * (data?.marketPrice ?? 0))}
                    </p>
                    <p className="text-xs text-slate-500">현재 평가액</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 거래 내역 테이블 */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700/50">
          <h2 className="text-base font-semibold">거래 내역</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50 text-left">
                <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase">날짜</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase">유형</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase">크레딧</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase text-right">수량</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase text-right">단가</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase text-right">총액</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-700/30">
                    <td colSpan={6} className="px-4 py-3">
                      <div className="h-4 bg-slate-700/30 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : (data?.recentTrades ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500 text-sm">
                    거래 내역이 없습니다
                  </td>
                </tr>
              ) : (
                (data?.recentTrades ?? []).map((trade) => (
                  <tr key={trade.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition">
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                      {new Date(trade.tradedAt).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded ${TRADE_TYPE_COLORS[trade.tradeType] ?? ''}`}>
                        {TRADE_TYPE_LABELS[trade.tradeType] ?? trade.tradeType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {trade.credit ? `${trade.credit.type} ${trade.credit.vintage}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-white">
                      {trade.quantity.toFixed(1)} t
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">
                      {trade.tradeType === 'retire' ? '—' : formatKRW(trade.price)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-white">
                      {trade.tradeType === 'retire' ? '—' : formatKRW(trade.totalAmount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
