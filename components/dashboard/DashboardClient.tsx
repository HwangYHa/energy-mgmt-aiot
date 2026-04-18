'use client';

/**
 * components/dashboard/DashboardClient.tsx
 * HMI 이미지 자산 기반 대시보드 — ah_image*.png / gauge_loading.png / download.png 활용
 * Mobile-first responsive layout
 */

import React, { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { EnergyBarChart, EnergyLineChart } from '@/components/dashboard';
import { DashboardPanel } from '@/components/dashboard';
import { Loader2, AlertCircle, RefreshCw, FileText, Settings, Radio, Zap } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useRealtime, useRealtimeAggregates } from '@/hooks/use-realtime';
import { InvoiceUploadModal } from '@/features/carbon/components/InvoiceUploadModal';
import { apiGet } from '@/lib/api/client';
import { useRefreshInterval } from '@/hooks/use-display-settings';

// ─────────────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────────────

interface DashboardStats {
  kpis: {
    totalConsumption: number;
    consumptionUnit: string;
    consumptionTrend: { value: number | null; direction: 'up' | 'down' };
    efficiency: number;
    equipmentRate: number;
    drParticipation: number;
    carbonGoal: number;
  };
  realtime: {
    currentPower: number;
    dailyUsage: number;
    peakRatio: number;
    estimatedCost: number;
  };
  monthlyConsumption: Array<{ name: string; consumption: number; target: number }>;
  weeklyTrend: Array<{ name: string; current: number; previous: number }>;
  hourlyLoad: Array<{ name: string; load: number; peak: number }>;
  costAnalysis: Array<{ name: string; cost: number; savings: number }>;
  efficiencyTrend: Array<{ name: string; efficiency: number; target: number }>;
  carbonEmission: Array<{ name: string; emission: number; limit: number }>;
  costSavings: Array<{ name: string; profit: number; target: number }>;
  renewableEnergy: Array<{ name: string; solar: number; wind: number; ess: number }>;
  peakHourAnalysis: Array<{ name: string; value: number; avg: number }>;
  devices: { total: number; online: number; offline: number; error: number };
  sensors: { total: number; online: number; types: Array<{ type: string; count: number }> };
  topology?: {
    sites: Array<{ id: string; name: string; siteType: string }>;
    gateways: Array<{ id: string; name: string; status: string }>;
  };
  meta?: { hasInvoiceData?: boolean };
  dataSource?: 'db' | 'simulation';
}

// ─────────────────────────────────────────────────────
// 포맷팅
// ─────────────────────────────────────────────────────

const formatNumber   = (n: number) => n.toLocaleString('ko-KR');
const formatCurrency = (n: number) => `₩${n.toLocaleString('ko-KR')}`;

const fetcher = (url: string) =>
  apiGet<DashboardStats>(url).then((res) => {
    if (!res.data) throw new Error('데이터 조회 실패');
    return res.data;
  });

// ─────────────────────────────────────────────────────
// 애니메이션 카운터
// ─────────────────────────────────────────────────────

function AnimatedCounter({ value, className, style }: { value: number; className?: string; style?: React.CSSProperties }) {
  const [display, setDisplay] = useState(0);
  const rafRef  = useRef<number | null>(null);
  const prevRef = useRef(0);

  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    const from = prevRef.current;
    prevRef.current = value;
    const startTime = performance.now();
    const DURATION  = 1600;
    const animate   = (now: number) => {
      const t     = Math.min((now - startTime) / DURATION, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value]);

  return <span className={className} style={style}>{display.toLocaleString('ko-KR')}</span>;
}

// ─────────────────────────────────────────────────────
// 에너지 네트워크 SVG 시각화
// ─────────────────────────────────────────────────────

interface TopoNode { label: string; status?: string }

function EnergyNetworkViz({ power, nodes: propNodes }: { power: number; nodes?: TopoNode[] }) {
  const CX = 200, CY = 155, R = 100;
  const nodeAngles = [270, 30, 90, 150, 210, 330];
  const defaultLabels = ['HQ', 'GW-01', 'Site A', 'PLC', 'ESS', 'GW-02'];
  const labelSource: TopoNode[] = propNodes && propNodes.length > 0 ? propNodes : defaultLabels.map(l => ({ label: l }));
  const nodes = nodeAngles.slice(0, labelSource.length).map((deg, i) => ({
    x: CX + R * Math.cos((deg * Math.PI) / 180),
    y: CY + R * Math.sin((deg * Math.PI) / 180),
    label: labelSource[i]?.label ?? defaultLabels[i] ?? `N${i}`,
    status: labelSource[i]?.status,
  }));

  return (
    <svg viewBox="0 0 400 310" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="nv_center" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#06b6d4" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="nv_hub" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#22d3ee" stopOpacity="1" />
          <stop offset="100%" stopColor="#0891b2" stopOpacity="0.5" />
        </radialGradient>
        <filter id="nv_blur">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* Grid */}
      {Array.from({ length: 18 }).map((_, i) => (
        <line key={`gh${i}`} x1="0" y1={i * 18} x2="400" y2={i * 18} stroke="#0a1f36" strokeWidth="0.5" />
      ))}
      {Array.from({ length: 23 }).map((_, i) => (
        <line key={`gv${i}`} x1={i * 18} y1="0" x2={i * 18} y2="310" stroke="#0a1f36" strokeWidth="0.5" />
      ))}

      {/* Glow */}
      <circle cx={CX} cy={CY} r="125" fill="url(#nv_center)" filter="url(#nv_blur)" />

      {/* Spinning rings */}
      <circle cx={CX} cy={CY} r={R + 18} fill="none" stroke="#06b6d4" strokeWidth="0.7"
        strokeDasharray="10 8" opacity="0.22">
        <animateTransform attributeName="transform" type="rotate"
          from={`0 ${CX} ${CY}`} to={`360 ${CX} ${CY}`} dur="28s" repeatCount="indefinite" />
      </circle>
      <circle cx={CX} cy={CY} r={R - 28} fill="none" stroke="#0891b2" strokeWidth="0.5"
        strokeDasharray="5 12" opacity="0.18">
        <animateTransform attributeName="transform" type="rotate"
          from={`360 ${CX} ${CY}`} to={`0 ${CX} ${CY}`} dur="20s" repeatCount="indefinite" />
      </circle>

      {/* Edge lines */}
      {nodes.map((n, i) => (
        <line key={`el${i}`} x1={CX} y1={CY} x2={n.x} y2={n.y}
          stroke="#06b6d4" strokeWidth="1" opacity="0.28" strokeDasharray="4 3" />
      ))}

      {/* Energy packets */}
      {nodes.map((n, i) => (
        <circle key={`pk${i}`} r="2.5" fill="#22d3ee" opacity="0.85">
          <animateMotion dur={`${2.5 + i * 0.45}s`} repeatCount="indefinite" begin={`${i * 0.6}s`}
            path={`M ${CX} ${CY} L ${n.x} ${n.y} L ${CX} ${CY}`} />
        </circle>
      ))}

      {/* Outer nodes */}
      {nodes.map((n, i) => {
        const isOffline = n.status === 'offline' || n.status === 'error';
        const nodeColor = isOffline ? '#ef4444' : '#0891b2';
        const ringColor = isOffline ? '#f87171' : '#22d3ee';
        const textColor = isOffline ? '#fca5a5' : '#67e8f9';
        return (
          <g key={`nd${i}`}>
            <circle cx={n.x} cy={n.y} r="10" fill={nodeColor} opacity="0.07">
              <animate attributeName="r" values="8;13;8" dur={`${2.2 + i * 0.3}s`} repeatCount="indefinite" />
            </circle>
            <circle cx={n.x} cy={n.y} r="4.5" fill={nodeColor} stroke={ringColor} strokeWidth="1" opacity="0.9" />
            <text x={n.x} y={n.y - 9} textAnchor="middle" fill={textColor} fontSize="7.5" fontFamily="monospace" opacity="0.85">
              {n.label}
            </text>
          </g>
        );
      })}

      {/* Hub */}
      <circle cx={CX} cy={CY} r="18" fill="#06b6d4" opacity="0.08">
        <animate attributeName="r" values="16;22;16" dur="2.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.08;0.14;0.08" dur="2.5s" repeatCount="indefinite" />
      </circle>
      <circle cx={CX} cy={CY} r="11" fill="url(#nv_hub)" />
      <circle cx={CX} cy={CY} r="14" fill="none" stroke="#22d3ee" strokeWidth="1.5" opacity="0.55">
        <animate attributeName="r"       values="11;18;11"     dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.55;0;0.55"  dur="2s" repeatCount="indefinite" />
      </circle>
      <text x={CX} y={CY - 16} textAnchor="middle" fill="#22d3ee" fontSize="9" fontFamily="monospace" fontWeight="bold">HUB</text>
      <text x={CX} y={CY + 26} textAnchor="middle" fill="#67e8f9" fontSize="10" fontFamily="monospace" fontWeight="bold" opacity="0.9">
        {power > 0 ? `${power.toLocaleString()} kW` : 'STANDBY'}
      </text>

      {/* Status bar */}
      <rect x="60" y="278" width="280" height="18" rx="3" fill="#04152a" opacity="0.8" />
      <text x="200" y="290" textAnchor="middle" fill="#0e7490" fontSize="8" fontFamily="monospace">
        {`NODE ${nodes.length}  ·  LINK ${nodes.length}  ·  STATUS: ${power > 0 ? 'ACTIVE' : 'IDLE'}`}
      </text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────
// GaugeCard — ah_image2.png + gauge_loading.png + download.png
// ─────────────────────────────────────────────────────

interface GaugeCardProps {
  value: number;       // 0–100
  label: string;
  sub: string;
  accent: 'cyan' | 'green' | 'amber' | 'purple';
}

const GAUGE_COLORS = {
  cyan:   { stroke: '#22d3ee', text: 'text-cyan-300',   glow: 'rgba(6,182,212,0.5)'   },
  green:  { stroke: '#4ade80', text: 'text-emerald-300', glow: 'rgba(74,222,128,0.5)'  },
  amber:  { stroke: '#fbbf24', text: 'text-amber-300',   glow: 'rgba(251,191,36,0.5)'  },
  purple: { stroke: '#a78bfa', text: 'text-purple-300',  glow: 'rgba(167,139,250,0.5)' },
};

function GaugeCard({ value, label, sub, accent }: GaugeCardProps) {
  const c    = GAUGE_COLORS[accent];
  const pct  = Math.min(100, Math.max(0, Math.round(value)));
  const r    = 30;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);

  return (
    <div className="relative overflow-hidden" style={{ minHeight: 110 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/ah_image2.png" alt="" className="absolute inset-0 w-full h-full object-fill pointer-events-none" />
      <div className="relative z-10 flex flex-col items-center pt-3 pb-2 px-1">
        <div className="relative" style={{ width: 72, height: 72 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/gauge_loading.png" alt="" className="absolute inset-0 w-full h-full object-contain opacity-20 pointer-events-none" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/download.png" alt="" className="absolute inset-0 w-full h-full object-contain opacity-25 pointer-events-none" />
          <svg className="absolute inset-0 -rotate-90" width="72" height="72" viewBox="0 0 72 72">
            <circle cx="36" cy="36" r={r} fill="none" stroke="#1e3a5f" strokeWidth="5" />
            <circle cx="36" cy="36" r={r} fill="none" stroke={c.stroke} strokeWidth="5"
              strokeDasharray={circ} strokeDashoffset={offset}
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 4px ${c.glow})`, transition: 'stroke-dashoffset 1s ease' }} />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cn('text-[15px] font-black font-mono tabular-nums', c.text)}
              style={{ textShadow: `0 0 10px ${c.glow}` }}>
              {pct}%
            </span>
          </div>
        </div>
        <p className={cn('text-[10px] font-bold mt-1.5 tracking-wide uppercase', c.text)}>{label}</p>
        <p className="text-[9px] text-slate-500 font-mono">{sub}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// CenterFrame — ah_image.png을 배경으로 사용
// ─────────────────────────────────────────────────────

function CenterFrame({ children, className, fill }: { children: React.ReactNode; className?: string; fill?: boolean }) {
  return (
    <div className={cn('relative overflow-hidden', fill && 'flex flex-col', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/ah_image.png" alt="" className="absolute inset-0 w-full h-full object-fill pointer-events-none opacity-90" />
      <div className={cn('relative z-10', fill && 'flex-1 flex flex-col min-h-0')}>{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// MetricRow
// ─────────────────────────────────────────────────────

function MetricRow({ label, value, colorClass = 'text-cyan-400', live = false }: {
  label: string; value: string; colorClass?: string; live?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-800/40 last:border-0">
      <span className="text-[10px] text-slate-500">{label}</span>
      <div className="flex items-center gap-1.5">
        {live && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />}
        <span className={cn('text-[11px] font-bold tabular-nums font-mono', colorClass)}>{value}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────────────

interface DashboardClientProps {
  initialData: DashboardStats | null;
}

export default function DashboardClient({ initialData }: DashboardClientProps) {
  const [currentTime, setCurrentTime] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);

  const refreshIntervalSec = useRefreshInterval();

  const { data: stats, error, isLoading, mutate } = useSWR<DashboardStats>(
    '/api/dashboard/stats', fetcher,
    { fallbackData: initialData ?? undefined, refreshInterval: refreshIntervalSec * 1000,
      revalidateOnFocus: true, keepPreviousData: true, dedupingInterval: 5_000 }
  );

  const { status: sseStatus, isConnected: sseConnected } = useRealtime();
  const realtimeAggregates = useRealtimeAggregates();

  useEffect(() => {
    const upd = () => setCurrentTime(new Date().toLocaleString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }));
    upd();
    const id = setInterval(upd, 1000);
    return () => clearInterval(id);
  }, []);

  const dataStatus: 'connected' | 'invoice_only' | 'disconnected' = (() => {
    if (realtimeAggregates.totalPower > 0 || (stats?.realtime?.currentPower ?? 0) > 0) return 'connected';
    if (stats?.meta?.hasInvoiceData) return 'invoice_only';
    return 'disconnected';
  })();

  const livePower = realtimeAggregates.totalPower > 0
    ? realtimeAggregates.totalPower
    : (stats?.realtime?.currentPower ?? 0);

  if (isLoading && !stats) {
    return (
      <div className="h-full bg-[#020c1b] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto" />
          <p className="mt-4 text-slate-500 font-mono tracking-widest text-xs">LOADING DASHBOARD...</p>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="h-full bg-[#020c1b] flex items-center justify-center">
        <div className="text-center max-w-sm p-6">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="mt-4 text-base font-semibold text-white">데이터 로드 실패</h2>
          <p className="mt-2 text-slate-400 text-sm">{error.message}</p>
          <button onClick={() => mutate()}
            className="mt-5 px-5 py-2 bg-cyan-700 hover:bg-cyan-600 text-white rounded flex items-center gap-2 mx-auto text-sm">
            <RefreshCw className="w-4 h-4" /> 다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const d = stats;

  return (
    <div className="h-full bg-[#020c1b] flex flex-col select-none">

      {/* ── 타이틀 헤더 ── */}
      <div className="relative flex-shrink-0 border-b border-cyan-900/40 bg-[#010a17]">
        {/* 장식 선 */}
        <div className="absolute inset-y-0 left-0 right-0 flex items-center pointer-events-none">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-cyan-600/20 to-cyan-600/5 mr-8" />
          <div className="flex-1 h-px bg-gradient-to-l from-transparent via-cyan-600/20 to-cyan-600/5 ml-8" />
        </div>

        {/* 타이틀 */}
        <div className="relative z-10 text-center pt-2 pb-1">
          <h1 className="text-[13px] sm:text-[15px] md:text-base font-black tracking-[0.25em] sm:tracking-[0.35em] uppercase"
            style={{ color: '#67e8f9', textShadow: '0 0 24px rgba(6,182,212,0.55)' }}>
            ◆ 에너지 운영 관리 시스템 ◆
          </h1>
          <p className="text-[10px] text-cyan-200/35 font-mono tracking-[0.2em] mt-0.5 pb-1" suppressHydrationWarning>
            {currentTime}
          </p>
        </div>

        {/* 상태 바 — 모바일 독립 행 */}
        <div className="relative z-10 flex items-center justify-between px-2 pb-2 gap-1.5 flex-wrap">
          {/* 좌측 상태 */}
          <div className="flex items-center gap-1.5">
            {dataStatus === 'invoice_only' && (
              <span className="text-[10px] text-blue-400 border border-blue-800/40 bg-blue-900/20 px-2 py-0.5 rounded font-mono flex items-center gap-1">
                <FileText className="w-2.5 h-2.5" /> 고지서
              </span>
            )}
            {dataStatus === 'disconnected' && (
              <Link href="/onboarding">
                <span className="text-[10px] text-amber-400 border border-amber-800/40 bg-amber-900/20 px-2 py-0.5 rounded font-mono flex items-center gap-1 cursor-pointer hover:bg-amber-900/40 transition">
                  <Settings className="w-2.5 h-2.5" /> 초기설정
                </span>
              </Link>
            )}
            {stats.dataSource === 'simulation' && (
              <span className="text-[9px] text-slate-700 font-mono">DEMO</span>
            )}
          </div>

          {/* 우측 액션 */}
          <div className="flex items-center gap-1.5 ml-auto">
            <div className={cn('flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border font-mono',
              sseConnected
                ? 'bg-emerald-500/10 border-emerald-600/20 text-emerald-400'
                : sseStatus === 'connecting'
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                : 'bg-slate-800/60 border-slate-700/30 text-slate-500')}>
              <Radio className={cn('w-2.5 h-2.5', sseConnected && 'animate-pulse')} />
              <span className="hidden sm:inline">{sseConnected
                ? `LIVE · ${realtimeAggregates.totalPower.toFixed(1)} kW`
                : sseStatus === 'connecting' ? 'CONN...' : 'OFFLINE'}</span>
              <span className="sm:hidden">{sseConnected
                ? `${realtimeAggregates.totalPower.toFixed(1)} kW`
                : sseStatus === 'connecting' ? '...' : 'OFF'}</span>
            </div>
            <button onClick={() => setShowUploadModal(true)}
              className="px-2 py-0.5 text-[10px] text-cyan-400 border border-cyan-800/40 rounded hover:bg-cyan-900/30 transition flex items-center gap-1 font-mono">
              <FileText className="w-2.5 h-2.5" />
              <span className="hidden sm:inline">고지서</span>
            </button>
            <button onClick={() => mutate()}
              className="p-1 text-slate-600 hover:text-cyan-400 border border-slate-800/40 rounded hover:border-cyan-800/40 transition">
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* ── ah_image4.png 헤더 하단 구분선 ── */}
      <div className="flex-shrink-0 h-3 w-full relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/ah_image4.png" alt="" className="absolute inset-0 w-full h-full object-fill opacity-80 pointer-events-none" />
      </div>

      {/* ── 모달 ── */}
      {showUploadModal && (
        <InvoiceUploadModal onClose={() => setShowUploadModal(false)} onUploaded={() => mutate()} />
      )}

      {/* ── 메인 레이아웃 ──
           모바일: 세로 스크롤, 섹션 순서 재정렬
           데스크탑 lg+: 3컬럼 고정 HMI 레이아웃
      ── */}
      <div className="flex-1 overflow-y-auto lg:overflow-hidden">
        <div className="lg:h-full flex flex-col lg:grid lg:grid-cols-12 gap-1.5 p-1.5">

          {/* ═══ [모바일 1순위] 중앙 컬럼 — KPI + 게이지 + 토폴로지 ═══ */}
          <div className="order-1 lg:col-span-6 lg:order-2 flex flex-col gap-1.5">

            {/* 메인 KPI */}
            <CenterFrame className="flex-shrink-0 rounded-sm">
              <div className="px-4 pt-3 pb-3 text-center">
                <p className="text-[9px] font-bold text-cyan-500/60 tracking-[0.4em] uppercase mb-1.5">
                  총 에너지 소비량 · Annual Cumulative
                </p>
                <div className="flex items-baseline justify-center gap-2">
                  <AnimatedCounter
                    value={d.kpis.totalConsumption}
                    className="font-black font-mono tabular-nums"
                    style={{
                      fontSize: 'clamp(28px, 5vw, 40px)',
                      color: '#67e8f9',
                      textShadow: '0 0 30px rgba(6,182,212,0.7)',
                      letterSpacing: '0.05em',
                    }}
                  />
                  <span className="text-sm text-cyan-400/50 font-mono font-bold">{d.kpis.consumptionUnit}</span>
                </div>
                <div className="flex items-center justify-center gap-3 mt-2 flex-wrap">
                  <div className={cn('flex items-center gap-1 text-xs font-mono font-semibold',
                    d.kpis.consumptionTrend.direction === 'down' ? 'text-emerald-400' : 'text-red-400')}>
                    <span>{d.kpis.consumptionTrend.direction === 'down' ? '▼' : '▲'}</span>
                    <span>{(d.kpis.consumptionTrend.value ?? 0).toFixed(1)}% 전년 대비</span>
                  </div>
                  <div className="w-px h-4 bg-slate-700" />
                  <div className="flex items-center gap-1.5 text-xs font-mono">
                    <Zap className="w-3 h-3 text-yellow-500" />
                    <span className="text-slate-500">현재</span>
                    <span className="text-yellow-300 font-bold">{formatNumber(Math.round(livePower))} kW</span>
                  </div>
                  <div className="w-px h-4 bg-slate-700" />
                  <div className="flex items-center gap-1.5 text-xs font-mono">
                    <span className="text-slate-500">금일</span>
                    <span className="text-cyan-300 font-bold">{formatNumber(d.realtime.dailyUsage)} kWh</span>
                  </div>
                </div>
              </div>
            </CenterFrame>

            {/* 4개 게이지 — 모바일에서도 가로 4분할 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 flex-shrink-0">
              <GaugeCard value={d.kpis.equipmentRate}   label="설비 가동률" sub="Equipment"  accent="green"  />
              <GaugeCard value={d.kpis.efficiency}      label="에너지 효율" sub="Efficiency" accent="cyan"   />
              <GaugeCard value={d.kpis.drParticipation} label="DR 참여율"   sub="Demand Res" accent="amber"  />
              <GaugeCard value={d.kpis.carbonGoal}      label="탄소 목표"   sub="Carbon"     accent="purple" />
            </div>

            {/* 실시간 현황 — 모바일에서 중앙에 위치 */}
            <DashboardPanel title="실시간 현황" variant="glow" className="flex-shrink-0 lg:hidden">
              <div className="grid grid-cols-2 gap-x-4 pt-0.5 pb-1 px-1">
                <MetricRow label="현재 전력"  value={`${formatNumber(Math.round(livePower))} kW`}
                  colorClass="text-cyan-400" live={sseConnected && livePower > 0} />
                <MetricRow label="금일 사용량" value={`${formatNumber(d.realtime.dailyUsage)} kWh`}
                  colorClass="text-emerald-400" />
                <MetricRow label="피크 대비"  value={`${d.realtime.peakRatio}%`}
                  colorClass="text-yellow-400" />
                <MetricRow label="예상 요금"  value={formatCurrency(d.realtime.estimatedCost)}
                  colorClass="text-orange-400" />
                <MetricRow label="디바이스"  value={`${d.devices?.online ?? 0}/${d.devices?.total ?? 0} ON`}
                  colorClass="text-slate-400" />
                <MetricRow label="센서"      value={`${d.sensors?.online ?? 0}/${d.sensors?.total ?? 0} ACT`}
                  colorClass="text-slate-400" />
              </div>
            </DashboardPanel>

            {/* 에너지 네트워크 시각화 */}
            <CenterFrame className="rounded-sm flex flex-col" fill>
              <div className="px-3 pt-1.5 pb-0 flex-shrink-0">
                <h3 className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-0.5 h-2.5 bg-cyan-500 rounded-full inline-block" />
                  에너지 네트워크 토폴로지
                </h3>
              </div>
              {/* 모바일: 고정 높이 / 데스크탑: flex-1 */}
              <div className="h-[280px] lg:flex-1 lg:h-auto">
                <EnergyNetworkViz
                  power={Math.round(livePower)}
                  nodes={[
                    ...(d.topology?.sites ?? []).map(s => ({
                      label: s.name.length > 8 ? s.name.slice(0, 7) + '…' : s.name,
                      status: 'online',
                    })),
                    ...(d.topology?.gateways ?? []).map(g => ({
                      label: g.name.length > 8 ? g.name.slice(0, 7) + '…' : g.name,
                      status: g.status,
                    })),
                  ]}
                />
              </div>
            </CenterFrame>
          </div>

          {/* ═══ [모바일 2순위] 좌측 컬럼 — 차트 4개 ═══ */}
          <div className="order-2 lg:col-span-3 lg:order-1 grid grid-cols-2 lg:grid-cols-1 lg:flex lg:flex-col gap-1.5">

            <DashboardPanel title="월별 에너지" variant="frame" fill
              className="min-h-[200px] lg:min-h-0 lg:flex-1">
              <EnergyBarChart
                data={d.monthlyConsumption}
                bars={[
                  { dataKey: 'consumption', color: '#06b6d4', name: '소비량' },
                  { dataKey: 'target',      color: '#22c55e', name: '목표'   },
                ]}
                height="100%"
                showLegend={false}
              />
            </DashboardPanel>

            <DashboardPanel title="주간 소비 추이" variant="frame" fill
              className="min-h-[200px] lg:min-h-0 lg:flex-1">
              <EnergyBarChart
                data={d.weeklyTrend}
                bars={[
                  { dataKey: 'current',  color: '#22d3ee', name: '이번주' },
                  { dataKey: 'previous', color: '#164e63', name: '지난주' },
                ]}
                height="100%"
                showLegend={false}
              />
            </DashboardPanel>

            <DashboardPanel title="시간대별 부하" variant="frame" fill
              className="min-h-[200px] lg:min-h-0 lg:flex-1">
              <EnergyBarChart
                data={d.hourlyLoad}
                bars={[
                  { dataKey: 'load', color: '#22d3ee', name: '부하' },
                  { dataKey: 'peak', color: '#f59e0b', name: '피크' },
                ]}
                height="100%"
                showLegend={false}
              />
            </DashboardPanel>

            <DashboardPanel title="피크 시간대" variant="frame" fill
              className="min-h-[200px] lg:min-h-0 lg:flex-1">
              <EnergyBarChart
                data={d.peakHourAnalysis}
                bars={[
                  { dataKey: 'value', color: '#fbbf24', name: '사용량' },
                  { dataKey: 'avg',   color: '#6366f1', name: '평균'   },
                ]}
                height="100%"
                showLegend={false}
              />
            </DashboardPanel>
          </div>

          {/* ═══ [모바일 3순위] 우측 컬럼 — 차트 3개 + 실시간 ═══ */}
          <div className="order-3 lg:col-span-3 lg:order-3 grid grid-cols-2 lg:grid-cols-1 lg:flex lg:flex-col gap-1.5">

            <DashboardPanel title="효율성 추이" variant="frame" fill
              className="min-h-[200px] lg:min-h-0 lg:flex-1">
              <EnergyLineChart
                data={d.efficiencyTrend}
                lines={[
                  { dataKey: 'efficiency', color: '#22d3ee', name: '효율' },
                  { dataKey: 'target',     color: '#f59e0b', name: '목표', dot: false },
                ]}
                height="100%"
                showLegend={false}
              />
            </DashboardPanel>

            <DashboardPanel title="비용 절감" variant="frame" fill
              className="min-h-[200px] lg:min-h-0 lg:flex-1">
              <EnergyLineChart
                data={d.costSavings}
                lines={[
                  { dataKey: 'profit', color: '#4ade80', name: '절감액'         },
                  { dataKey: 'target', color: '#f97316', name: '목표', dot: false },
                ]}
                height="100%"
                showLegend={false}
              />
            </DashboardPanel>

            {/* 탄소 배출량 — 모바일에서 2열 전체 너비 */}
            <DashboardPanel title="탄소 배출량 (tCO₂)" variant="frame" fill
              className="col-span-2 lg:col-span-1 min-h-[200px] lg:min-h-0 lg:flex-1">
              <EnergyBarChart
                data={d.carbonEmission}
                bars={[
                  { dataKey: 'emission', color: '#a78bfa', name: '배출량' },
                  { dataKey: 'limit',    color: '#ef4444', name: '한도'   },
                ]}
                height="100%"
                showLegend={false}
              />
            </DashboardPanel>

            {/* 실시간 현황 — 데스크탑에서만 여기에 표시 (모바일은 중앙 컬럼에 표시) */}
            <DashboardPanel title="실시간 현황" variant="glow"
              className="col-span-2 lg:col-span-1 hidden lg:block flex-shrink-0">
              <div className="pt-0.5 pb-1 px-1">
                <MetricRow label="현재 전력"  value={`${formatNumber(Math.round(livePower))} kW`}
                  colorClass="text-cyan-400" live={sseConnected && livePower > 0} />
                <MetricRow label="금일 사용량" value={`${formatNumber(d.realtime.dailyUsage)} kWh`}
                  colorClass="text-emerald-400" />
                <MetricRow label="피크 대비"  value={`${d.realtime.peakRatio}%`}
                  colorClass="text-yellow-400" />
                <MetricRow label="예상 요금"  value={formatCurrency(d.realtime.estimatedCost)}
                  colorClass="text-orange-400" />
                <MetricRow label="디바이스"  value={`${d.devices?.online ?? 0}/${d.devices?.total ?? 0} ON`}
                  colorClass="text-slate-400" />
                <MetricRow label="센서"      value={`${d.sensors?.online ?? 0}/${d.sensors?.total ?? 0} ACT`}
                  colorClass="text-slate-400" />
                {realtimeAggregates.alertCount > 0 && (
                  <MetricRow label="실시간 알림" value={`${realtimeAggregates.alertCount}건`}
                    colorClass="text-red-400" live />
                )}
              </div>
            </DashboardPanel>
          </div>

        </div>
      </div>

      {/* ── 하단 상태바 ── */}
      <div className="flex-shrink-0 h-6 border-t border-cyan-900/30 bg-[#010a17] flex items-center px-3 gap-3">
        <span className="text-[10px] font-mono text-slate-500">탄소이음 EMS v2.1</span>
        <span className="text-[10px] text-slate-700">|</span>
        <span className="text-[10px] font-mono text-slate-500">
          SRC: <span className={stats.dataSource === 'db' ? 'text-emerald-500' : 'text-amber-500'}>
            {stats.dataSource === 'db' ? 'DATABASE' : 'DEMO'}
          </span>
        </span>
        {error && stats && (
          <span className="text-[10px] text-yellow-500 font-mono ml-auto">⚠ 갱신 실패 · 캐시 데이터 표시 중</span>
        )}
      </div>
    </div>
  );
}
