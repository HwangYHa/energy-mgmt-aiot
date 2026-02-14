'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FileText,
  RefreshCw,
  Loader2,
  Download,
  Clock,
  CheckCircle2,
  Send,
  XCircle,
  Calendar,
  Cpu,
} from 'lucide-react';

interface RegReport {
  id: string;
  reportType: string;
  reportName: string;
  period: string;
  status: string;
  dueDate: string;
  submittedDate: string | null;
  approvedDate: string | null;
  totalEmissions: string;
  scope1: string;
  scope2: string;
  scope3: string;
  fileUrl: string | null;
  pdfUrl: string | null;
  createdAt: string;
}

interface CalcEngine {
  id: string;
  version: string;
  name: string;
  methodology: string;
  isActive: boolean;
  releasedAt: string;
}

type StatusCfg = { label: string; color: string; bg: string; icon: typeof CheckCircle2 };
const STATUS_CONFIG: Record<string, StatusCfg> = {
  draft: { label: '작성중', color: 'text-slate-400', bg: 'bg-slate-500/10', icon: Clock },
  submitted: { label: '제출됨', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: Send },
  approved: { label: '승인', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
  rejected: { label: '반려', color: 'text-red-400', bg: 'bg-red-500/10', icon: XCircle },
};

const REPORT_TYPES: Record<string, string> = {
  ghg_inventory: 'GHG 인벤토리',
  energy_report: '에너지 사용 보고서',
  emission_report: '배출량 보고서',
  mrv_report: 'MRV 보고서',
};

export default function ComplianceReportsPage() {
  const [reports, setReports] = useState<RegReport[]>([]);
  const [calcEngines, setCalcEngines] = useState<CalcEngine[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [reportsRes, enginesRes] = await Promise.all([
        fetch('/api/reports/regulation').then((r) => r.json()),
        fetch('/api/compliance/calc-engine').then((r) => r.json()),
      ]);
      if (reportsRes.success) setReports(reportsRes.data || []);
      if (enginesRes.success) setCalcEngines(enginesRes.data || []);
    } catch { /* silent */ } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalEmissions = reports.reduce((sum, r) => sum + parseFloat(r.totalEmissions || '0'), 0);

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <FileText className="w-6 h-6 text-blue-400" />
            </div>
            규제 리포트
          </h1>
          <p className="text-slate-400 text-sm mt-1">규제 보고서 생성 및 제출 관리</p>
        </div>
        <button onClick={fetchData} className="p-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 text-slate-400">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="text-xs text-slate-400">전체 보고서</div>
          <div className="text-2xl font-bold text-blue-400">{reports.length}</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="text-xs text-slate-400">작성중</div>
          <div className="text-2xl font-bold text-slate-400">{reports.filter((r) => r.status === 'draft').length}</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="text-xs text-slate-400">승인완료</div>
          <div className="text-2xl font-bold text-emerald-400">{reports.filter((r) => r.status === 'approved').length}</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="text-xs text-slate-400">총 배출량</div>
          <div className="text-2xl font-bold text-amber-400">{totalEmissions.toFixed(1)}</div>
          <div className="text-[10px] text-slate-500">tCO2eq</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="text-xs text-slate-400">계산 엔진</div>
          <div className="text-2xl font-bold text-purple-400">{calcEngines.filter((e) => e.isActive).length}</div>
          <div className="text-[10px] text-slate-500">활성 버전</div>
        </div>
      </div>

      {/* 계산 엔진 버전 */}
      {calcEngines.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
            <Cpu className="w-4 h-4" /> 계산 엔진 버전
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {calcEngines.map((engine) => (
              <div key={engine.id} className={`flex-shrink-0 bg-slate-800/50 border rounded-xl p-4 min-w-[200px] ${engine.isActive ? 'border-emerald-500/30' : 'border-slate-700/50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono text-cyan-400">v{engine.version}</span>
                  {engine.isActive && <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">활성</span>}
                </div>
                <div className="text-sm text-white font-medium">{engine.name}</div>
                <div className="text-xs text-slate-400 mt-1">{engine.methodology}</div>
                <div className="text-[10px] text-slate-500 mt-2">{new Date(engine.releasedAt).toLocaleDateString('ko-KR')}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 보고서 목록 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>규제 보고서가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const cfg = (STATUS_CONFIG[report.status] || STATUS_CONFIG.draft) as StatusCfg;
            const StatusIcon = cfg.icon;
            return (
              <div key={report.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <StatusIcon className={`w-5 h-5 ${cfg.color}`} />
                    <div>
                      <span className="font-semibold text-white">{report.reportName}</span>
                      <span className="text-xs text-slate-500 ml-2">{REPORT_TYPES[report.reportType] || report.reportType}</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {report.pdfUrl && (
                      <a href={report.pdfUrl} className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg" title="PDF 다운로드">
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div>
                    <span className="text-xs text-slate-500 block">기간</span>
                    <span className="text-slate-200 flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-blue-400" /> {report.period}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">제출기한</span>
                    <span className="text-slate-200 text-xs">{new Date(report.dueDate).toLocaleDateString('ko-KR')}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">총 배출량</span>
                    <span className="text-amber-400 font-bold">{parseFloat(report.totalEmissions).toFixed(1)} tCO2eq</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Scope 1/2/3</span>
                    <span className="text-slate-300 text-xs">
                      {parseFloat(report.scope1).toFixed(1)} / {parseFloat(report.scope2).toFixed(1)} / {parseFloat(report.scope3).toFixed(1)}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">제출일</span>
                    <span className="text-slate-300 text-xs">{report.submittedDate ? new Date(report.submittedDate).toLocaleDateString('ko-KR') : '-'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
