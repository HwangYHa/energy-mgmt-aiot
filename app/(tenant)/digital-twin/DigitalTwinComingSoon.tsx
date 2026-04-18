'use client';

import { useState } from 'react';
import { Cpu, X, Bell, Layers, Zap, Network, Radio, Activity } from 'lucide-react';
import Link from 'next/link';

export default function DigitalTwinComingSoon() {
  const [dismissed, setDismissed] = useState(false);

  const features = [
    { icon: Layers,   label: '3D 시설 공간 모델링',      desc: '사이트 → 건물 → 층 → 구역 계층 구조' },
    { icon: Cpu,      label: '설비 노드 실시간 매핑',     desc: 'IoT 센서 데이터와 공간 좌표 연동' },
    { icon: Activity, label: '이상 징후 실시간 탐지',     desc: 'AI 기반 Z-score 이상 감지 시각화' },
    { icon: Zap,      label: '에너지 흐름 시각화',        desc: '전력·열 흐름 애니메이션 표현' },
    { icon: Network,  label: 'BIM/CAD 연동',              desc: 'IFC 포맷 도면 직접 임포트 지원' },
    { icon: Radio,    label: '무선 센서 커버리지 맵',     desc: 'Zigbee/LoRa 신호 강도 시각화' },
  ];

  return (
    <div className="relative min-h-screen bg-[#020c1b] flex flex-col items-center justify-center p-6 overflow-hidden select-none">

      {/* 배경 그리드 */}
      <div className="absolute inset-0 pointer-events-none">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dt_grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#0a1f36" strokeWidth="0.8"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dt_grid)" />
        </svg>
        {/* 글로우 */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-cyan-500/5 blur-[80px]" />
      </div>

      {/* 개발 중 알림 모달 */}
      {!dismissed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="relative bg-slate-900 border border-cyan-700/40 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            {/* 상단 장식 */}
            <div className="h-1 w-full bg-gradient-to-r from-cyan-600 via-blue-500 to-purple-600" />
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                  <Cpu className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">디지털 트윈</h2>
                  <p className="text-xs text-cyan-400 font-mono">현재 개발 중입니다</p>
                </div>
                <button
                  onClick={() => setDismissed(true)}
                  className="ml-auto p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-slate-700 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed mb-5">
                시설 디지털 트윈 기능은 현재 <span className="text-amber-400 font-semibold">개발 중</span>입니다.
                3D 시설 모델, 실시간 설비 매핑, AI 이상 탐지 등 강력한 기능이 준비 중입니다.
              </p>

              <div className="space-y-2 mb-5">
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-widest mb-2">예정 기능</p>
                {features.slice(0, 3).map(f => (
                  <div key={f.label} className="flex items-start gap-2.5 text-xs">
                    <f.icon className="w-3.5 h-3.5 text-cyan-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-white font-medium">{f.label}</span>
                      <span className="text-slate-500 ml-1.5">{f.desc}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setDismissed(true)}
                  className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-xl font-medium transition"
                >
                  미리보기
                </button>
                <Link
                  href="/dashboard"
                  className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white text-sm rounded-xl font-medium transition text-center"
                >
                  대시보드로
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 페이지 본체 — 흐릿한 미리보기 */}
      <div className={`relative z-10 text-center max-w-2xl transition-all duration-500 ${dismissed ? 'opacity-100' : 'opacity-40 blur-sm pointer-events-none'}`}>

        {/* 아이콘 */}
        <div className="relative mx-auto w-28 h-28 mb-6">
          <div className="absolute inset-0 rounded-full bg-cyan-500/10 animate-ping" />
          <div className="absolute inset-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <Cpu className="w-12 h-12 text-cyan-400" />
          </div>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full mb-4">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs text-amber-400 font-semibold font-mono tracking-wider">UNDER DEVELOPMENT</span>
        </div>

        <h1 className="text-3xl font-black text-white mb-2" style={{ textShadow: '0 0 30px rgba(6,182,212,0.4)' }}>
          디지털 트윈
        </h1>
        <p className="text-slate-400 text-sm mb-8">
          물리적 시설을 가상 공간에 1:1로 재현하고<br />
          실시간 데이터로 운영 최적화를 실현합니다
        </p>

        {/* 기능 카드 그리드 */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8 text-left">
          {features.map(f => (
            <div key={f.label} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3 hover:border-cyan-700/50 transition">
              <f.icon className="w-5 h-5 text-cyan-400 mb-2" />
              <p className="text-xs font-semibold text-white mb-0.5">{f.label}</p>
              <p className="text-[11px] text-slate-500">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* 알림 신청 */}
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 flex items-center gap-4">
          <Bell className="w-5 h-5 text-slate-500 shrink-0" />
          <p className="text-xs text-slate-400 text-left flex-1">
            출시 예정: <span className="text-white font-semibold">2026년 하반기</span> · 엔터프라이즈 플랜 고객 우선 제공
          </p>
          <Link
            href="/dashboard"
            className="shrink-0 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-xs rounded-lg font-medium transition"
          >
            대시보드
          </Link>
        </div>
      </div>
    </div>
  );
}
