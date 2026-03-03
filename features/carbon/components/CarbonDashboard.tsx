'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  Leaf, TrendingDown, TrendingUp, Target, Lightbulb,
  Calendar, Plus, Download, RefreshCw, AlertCircle,
  CheckCircle, Settings, FileText, CheckCircle2, Clock, Loader2, ArrowRight,
} from 'lucide-react';
import { InvoiceUploadModal } from './InvoiceUploadModal';
import { toast } from '@/lib/toast';
import { useCarbonData, useCarbonExport, useAvailableYears, useRecentEmissions } from '../hooks/use-carbon-data';
import { useMilestones } from '../hooks/use-milestones';
import { FuelModal } from './FuelModal';
import { TransportModal } from './TransportModal';

export function CarbonDashboard() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [openModal, setOpenModal] = useState<'fuel' | 'transport' | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  const { monthlyData, footprint, isLoading, error, refresh } = useCarbonData(year);
  const { exportCSV, exportJSON, exportPDF } = useCarbonExport(year);
  const { years: availableYears } = useAvailableYears();
  const { records: recentEntries, refresh: refreshRecent } = useRecentEmissions();
  const { milestones, achieved, inProgress, nextPending, isLoading: msLoading } = useMilestones();

  const handleExportCSV = async () => {
    try { await exportCSV(); }
    catch { toast.error('CSV 생성 중 오류가 발생했습니다.'); }
  };

  const handleExportJSON = async () => {
    try { await exportJSON(); }
    catch { toast.error('JSON 내보내기 중 오류가 발생했습니다.'); }
  };

  const handleExportPDF = async () => {
    try {
      toast.success?.('규제 리포트 PDF 생성 중...');
      await exportPDF();
      toast.success('규제 리포트 PDF가 생성되었습니다.');
    } catch {
      toast.error('PDF 생성 중 오류가 발생했습니다.');
    }
  };

  // Scope별 Pie Chart 데이터
  const scopeData = footprint
    ? [
        { name: 'Scope 1 (직접 배출)', value: footprint.emissions.scope1, color: '#EF4444' },
        { name: 'Scope 2 (간접 배출)', value: footprint.emissions.scope2, color: '#F59E0B' },
        { name: 'Scope 3 (기타)',       value: footprint.emissions.scope3, color: '#10B981' },
      ].filter((d) => d.value > 0)
    : [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#051225] text-white">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-green-400 mx-auto mb-4" />
          <p className="text-xl">탄소 배출 데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#051225] text-white">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-xl mb-2">데이터 로딩 실패</p>
          <p className="text-slate-400 mb-4">{error.message}</p>
          <button
            onClick={refresh}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#051225] text-white p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Leaf className="w-8 h-8 text-green-400" />
            탄소 배출 분석
          </h1>
          <p className="text-slate-400 mt-1">
            온실가스 배출량 및 감축 현황 (ISO 14064, K-ETS 기준)
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {/* 연도 선택 (데이터 기반 동적) */}
          {availableYears.map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={`px-4 py-2 rounded font-medium transition-colors ${
                year === y
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
              }`}
            >
              {y}
            </button>
          ))}

          <button
            onClick={() => setShowInvoiceModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg font-medium transition-colors text-sm"
          >
            <FileText className="w-4 h-4" /> 고지서 업로드
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors text-sm"
          >
            <Download className="w-4 h-4" />CSV
          </button>
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors text-sm"
          >
            <Download className="w-4 h-4" />JSON
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-400 rounded-lg font-medium transition-colors text-sm"
            title="K-MRV 온실가스 명세서 PDF (환경부 규제 대응)"
          >
            <Download className="w-4 h-4" />규제 리포트 PDF
          </button>
          <button
            onClick={refresh}
            className="p-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg transition-colors"
            title="새로고침"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            disabled
            className="p-2 bg-slate-800/50 rounded-lg opacity-50 cursor-not-allowed"
            title="설정 (준비 중)"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {showInvoiceModal && (
        <InvoiceUploadModal
          onClose={() => setShowInvoiceModal(false)}
          onUploaded={() => {
            // refresh data after upload
            refresh();
          }}
        />
      )}
      {/* KPI Cards */}
      {footprint && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 총 배출량 */}
          <div className="bg-slate-800/50 rounded-lg p-6 border-2 border-green-500 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full -mr-16 -mt-16" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <Leaf className="w-5 h-5 text-green-400" />
                <span className="text-sm text-slate-400">총 배출량</span>
              </div>
              <div className="text-4xl font-bold text-green-400 mb-1">
                {footprint.progress.current.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}
              </div>
              <div className="text-sm text-slate-400">tCO₂eq</div>
            </div>
          </div>

          {/* 목표 대비 */}
          <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-5 h-5 text-blue-400" />
              <span className="text-sm text-slate-400">목표 대비</span>
            </div>
            <div className={`text-4xl font-bold mb-1 ${footprint.progress.achievement <= 100 ? 'text-green-400' : 'text-red-400'}`}>
              {footprint.progress.achievement.toFixed(1)}%
            </div>
            <div className="text-sm text-slate-400">
              목표: {footprint.progress.target.toLocaleString('ko-KR')} tCO₂eq
            </div>
            {footprint.progress.achievement <= 100 ? (
              <div className="flex items-center gap-1 mt-2 text-green-400 text-xs">
                <CheckCircle className="w-3 h-3" />목표 달성
              </div>
            ) : (
              <div className="flex items-center gap-1 mt-2 text-red-400 text-xs">
                <AlertCircle className="w-3 h-3" />목표 초과
              </div>
            )}
          </div>

          {/* 전년 대비 감축 */}
          <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-2">
              {footprint.progress.reductionRate > 0 ? (
                <TrendingDown className="w-5 h-5 text-green-400" />
              ) : (
                <TrendingUp className="w-5 h-5 text-red-400" />
              )}
              <span className="text-sm text-slate-400">전년 대비</span>
            </div>
            <div className={`text-4xl font-bold mb-1 ${footprint.progress.reductionRate > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {Math.abs(footprint.progress.reductionRate).toFixed(1)}%
            </div>
            <div className="text-sm text-slate-400">
              {footprint.progress.reduction > 0 ? '감축' : '증가'}:{' '}
              {Math.abs(footprint.progress.reduction).toLocaleString('ko-KR', { maximumFractionDigits: 1 })} tCO₂eq
            </div>
          </div>

          {/* Scope 2 */}
          <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-5 h-5 text-yellow-400" />
              <span className="text-sm text-slate-400">Scope 2 (전력)</span>
            </div>
            <div className="text-4xl font-bold text-yellow-400 mb-1">
              {footprint.emissions.scope2.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}
            </div>
            <div className="text-sm text-slate-400">
              {((footprint.emissions.scope2 / footprint.emissions.total) * 100).toFixed(1)}% (전체 배출량 대비)
            </div>
          </div>
        </div>
      )}

      {/* 데이터 입력 버튼 */}
      <div className="flex gap-4">
        <button
          onClick={() => setOpenModal('fuel')}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
        >
          <Plus className="w-5 h-5" />연료 사용량 등록
        </button>
        <button
          onClick={() => setOpenModal('transport')}
          className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors"
        >
          <Plus className="w-5 h-5" />운송 거리 등록
        </button>
      </div>

      {/* 모달 */}
      {openModal === 'fuel' && (
        <FuelModal onClose={() => setOpenModal(null)} onSuccess={refresh} />
      )}
      {openModal === 'transport' && (
        <TransportModal onClose={() => setOpenModal(null)} onSuccess={refresh} />
      )}

      {/* 최근 등록 항목 (디버그용) */}
      {recentEntries.length > 0 && (
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50 mt-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold">최근 등록 데이터</h3>
            <button
              onClick={() => refreshRecent()}
              className="text-xs text-cyan-300 hover:text-cyan-200"
            >
              새로고침
            </button>
          </div>
          <div className="overflow-x-auto text-xs">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="py-2 px-3 text-left">기간</th>
                  <th className="py-2 px-3 text-left">유형</th>
                  <th className="py-2 px-3 text-right">사용량</th>
                  <th className="py-2 px-3 text-right">배출</th>
                </tr>
              </thead>
              <tbody>
                {recentEntries.map((r, i) => (
                  <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="py-2 px-3">{r.period}</td>
                    <td className="py-2 px-3">{r.sourceType}</td>
                    <td className="py-2 px-3 text-right">{r.amount}{r.unit || ''}</td>
                    <td className="py-2 px-3 text-right">{r.calculatedEmission?.toFixed?.(2) || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 월별 배출량 추이 */}
      <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700/50">
        <h2 className="text-xl font-bold mb-4">월별 배출량 추이</h2>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="monthName" stroke="#94a3b8" tick={{ fill: '#94a3b8' }} />
            <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8' }} label={{ value: 'tCO₂eq', angle: -90, position: 'insideLeft', fill: '#94a3b8' }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
              formatter={(value: number) => `${value.toFixed(2)} tCO₂eq`}
              // use a subtler cursor so the bar highlight isn't stark white
              cursor={{ fill: 'rgba(255,255,255,0.1)' }}
            />
            <Legend />
            <Bar dataKey="scope1" name="Scope 1 (직접 배출)" stackId="a" fill="#EF4444" />
            <Bar dataKey="scope2" name="Scope 2 (간접 배출)" stackId="a" fill="#F59E0B" />
            <Bar dataKey="scope3" name="Scope 3 (기타)"       stackId="a" fill="#10B981" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Scope 분석 Pie */}
        <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700/50">
          <h2 className="text-xl font-bold mb-4">Scope별 배출 비율</h2>
          {scopeData.length > 0 && footprint && (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={scopeData}
                    cx="50%" cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name.split(' ')[0]} ${(percent * 100).toFixed(1)}%`}
                    outerRadius={100}
                    dataKey="value"
                  >
                    {scopeData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                    formatter={(value: number) => `${value.toFixed(2)} tCO₂eq`}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between p-2 bg-red-900/30 border border-red-700 rounded">
                  <span className="text-sm">Scope 1 (직접 배출)</span>
                  <span className="font-bold">{footprint.emissions.scope1.toFixed(2)} tCO₂eq</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-yellow-900/30 border border-yellow-700 rounded">
                  <span className="text-sm">Scope 2 (간접 배출)</span>
                  <span className="font-bold">{footprint.emissions.scope2.toFixed(2)} tCO₂eq</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-green-900/30 border border-green-700 rounded">
                  <span className="text-sm">Scope 3 (기타)</span>
                  <span className="font-bold">{footprint.emissions.scope3.toFixed(2)} tCO₂eq</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* AI 감축 권장사항 */}
        <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700/50">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-400" />
            AI 감축 권장사항
          </h2>
          {footprint && footprint.recommendations.length > 0 ? (
            <div className="space-y-3">
              {footprint.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-3 p-4 bg-slate-700/50 rounded hover:bg-slate-700/70 transition-colors">
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {i + 1}
                  </div>
                  <p className="text-sm text-slate-300 pt-1">{rec}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-slate-400 py-8">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-2" />
              <p className="text-lg">훌륭합니다!</p>
              <p className="text-sm mt-2">목표를 달성하고 있습니다.</p>
              <p className="text-xs text-gray-500 mt-1">현재 수준을 유지하세요.</p>
            </div>
          )}
        </div>
      </div>

      {/* 배출원별 상세 테이블 */}
      {footprint && footprint.breakdown.length > 0 && (
        <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700/50">
          <h2 className="text-xl font-bold mb-4">배출원별 상세 데이터</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="text-left py-3 px-4">카테고리</th>
                  <th className="text-left py-3 px-4">배출원</th>
                  <th className="text-right py-3 px-4">사용량</th>
                  <th className="text-right py-3 px-4">배출량</th>
                  <th className="text-right py-3 px-4">비율</th>
                </tr>
              </thead>
              <tbody>
                {footprint.breakdown.map((item, i) => (
                  <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="py-3 px-4">{item.category}</td>
                    <td className="py-3 px-4">{item.sourceType}</td>
                    <td className="text-right py-3 px-4">{item.amount.toFixed(2)} {item.unit}</td>
                    <td className="text-right py-3 px-4 font-medium">{item.emission.toFixed(2)} tCO₂eq</td>
                    <td className="text-right py-3 px-4">
                      <span className="px-2 py-1 bg-green-600/20 text-green-400 rounded text-sm">
                        {item.percentage.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 탄소 로드맵 마일스톤 현황 */}
      <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-400" />
            탄소 로드맵 마일스톤 현황
          </h2>
          <Link
            href="/analytics/carbon/roadmap"
            className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            로드맵 관리
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {msLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
          </div>
        ) : milestones.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-sm">
            마일스톤 데이터가 없습니다.
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {/* 달성 현황 요약 바 */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${Math.round((achieved.length / milestones.length) * 100)}%` }}
                />
              </div>
              <span className="text-sm text-slate-400 whitespace-nowrap">
                {achieved.length} / {milestones.length} 달성
              </span>
            </div>

            {/* 마일스톤 목록 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {milestones.map((m) => {
                const isAchieved = m.status === 'achieved';
                const isInProgress = m.status === 'in_progress';

                return (
                  <div
                    key={m.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      isAchieved
                        ? 'bg-emerald-500/5 border-emerald-500/20'
                        : isInProgress
                        ? 'bg-cyan-500/5 border-cyan-500/20'
                        : 'bg-slate-700/30 border-slate-700/50'
                    }`}
                  >
                    <div className={`mt-0.5 flex-shrink-0 ${
                      isAchieved ? 'text-emerald-400' : isInProgress ? 'text-cyan-400' : 'text-slate-500'
                    }`}>
                      {isAchieved ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : isInProgress ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Clock className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500 font-mono">{m.year}</p>
                      <p className={`text-sm font-medium truncate ${
                        isAchieved ? 'text-emerald-300' : isInProgress ? 'text-cyan-300' : 'text-slate-400'
                      }`}>
                        {m.title}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 현재 진행 + 다음 목표 */}
            {(inProgress ?? nextPending) && (
              <div className="flex flex-wrap gap-3 pt-1">
                {inProgress && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-xs text-cyan-400">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    진행중: {inProgress.year} {inProgress.title}
                  </div>
                )}
                {nextPending && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-700/50 border border-slate-600/30 rounded-full text-xs text-slate-400">
                    <Clock className="w-3 h-3" />
                    다음 목표: {nextPending.year} {nextPending.title}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
