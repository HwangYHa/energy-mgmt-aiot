// app/(tenant)/reports/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, Download, Calendar, Filter, CheckCircle, Loader2, RefreshCw } from 'lucide-react';
import { fetchWithCsrf } from '@/hooks/use-csrf';
import { toast } from '@/lib/toast';

interface ReportItem {
  id: string;
  type: string;
  period: string;
  fileUrl: string | null;
  createdAt: string;
}

export default function ReportsPage() {
  const [reportType, setReportType] = useState('energy');
  const [period, setPeriod] = useState('monthly');
  const [format, setFormat] = useState('pdf');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [recentReports, setRecentReports] = useState<ReportItem[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(true);
  const [reportsError, setReportsError] = useState<string | null>(null);

  const fetchRecentReports = useCallback(async () => {
    setIsLoadingReports(true);
    setReportsError(null);
    try {
      const res = await fetch('/api/reports/regulation?take=5');
      if (res.ok) {
        const data = await res.json();
        setRecentReports(data.data || []);
      } else {
        setReportsError('리포트 목록을 불러오지 못했습니다.');
      }
    } catch {
      setReportsError('서버에 연결할 수 없습니다.');
    } finally {
      setIsLoadingReports(false);
    }
  }, []);

  useEffect(() => {
    fetchRecentReports();
  }, [fetchRecentReports]);

  const handleGenerate = async () => {
    setIsGenerating(true);

    try {
      const response = await fetchWithCsrf('/api/reports/generate', {
        method: 'POST',
        body: JSON.stringify({
          type: reportType,
          period,
          startDate: startDate || new Date(Date.now() - 30 * 86400000).toISOString(),
          endDate: endDate || new Date().toISOString(),
          format,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        if (data.fileUrl) {
          window.open(data.fileUrl, '_blank');
        }

        toast.success('리포트가 생성되었습니다.');
        fetchRecentReports();
      } else {
        const err = await response.json().catch(() => null);
        toast.error(err?.message || '리포트 생성에 실패했습니다.');
      }
    } catch {
      toast.error('리포트 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  const reportTypeLabels: Record<string, string> = {
    energy: '에너지 사용량',
    cost: '비용 분석',
    carbon: '탄소 배출',
    comprehensive: '종합 리포트',
  };

  return (
    <div className="h-full bg-[#051225] text-white p-4 md:p-6">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <FileText className="w-6 h-6 text-blue-400" />
          </div>
          리포트 생성
        </h1>
        <p className="text-slate-400 text-sm mt-1">에너지 사용 리포트를 생성하고 다운로드합니다</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 왼쪽: 설정 */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Filter className="w-5 h-5 text-cyan-400" />
            리포트 설정
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">리포트 종류</label>
              <select value={reportType} onChange={(e) => setReportType(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50">
                <option value="energy">에너지 사용량</option>
                <option value="cost">비용 분석</option>
                <option value="carbon">탄소 배출</option>
                <option value="comprehensive">종합 리포트</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">기간</label>
              <select value={period} onChange={(e) => setPeriod(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50">
                <option value="daily">일간</option>
                <option value="weekly">주간</option>
                <option value="monthly">월간</option>
                <option value="yearly">연간</option>
                <option value="custom">사용자 정의</option>
              </select>
            </div>

            {period === 'custom' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">시작일</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">종료일</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50" />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">파일 형식</label>
              <div className="flex gap-4">
                {['pdf', 'excel'].map((f) => (
                  <label key={f} className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input type="radio" name="format" value={f} checked={format === f} onChange={(e) => setFormat(e.target.value)}
                      className="w-4 h-4 accent-cyan-500" />
                    <span>{f.toUpperCase()}</span>
                  </label>
                ))}
              </div>
            </div>

            <button onClick={handleGenerate} disabled={isGenerating}
              className="w-full py-3 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors flex items-center justify-center gap-2">
              {isGenerating ? (<><Loader2 className="w-5 h-5 animate-spin" /> 생성 중...</>) : (<><FileText className="w-5 h-5" /> 리포트 생성</>)}
            </button>
          </div>
        </div>

        {/* 오른쪽: 미리보기 */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">리포트 미리보기</h2>
          <div className="bg-white text-black rounded-lg p-6 min-h-[300px]">
            <h3 className="text-xl font-bold text-blue-600 mb-3">{reportTypeLabels[reportType] || reportType} 리포트</h3>
            <div className="mb-4 text-sm text-gray-600">
              <p><strong>기간:</strong> {period === 'custom' ? `${startDate} ~ ${endDate}` : period}</p>
              <p><strong>형식:</strong> {format.toUpperCase()}</p>
            </div>
            <div className="bg-gray-100 p-4 rounded mb-4">
              <h4 className="font-bold mb-2 text-gray-700">요약</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between"><span>총 에너지 사용량</span><span className="font-bold">-- kWh</span></li>
                <li className="flex justify-between"><span>피크 전력</span><span className="font-bold">-- kW</span></li>
                <li className="flex justify-between"><span>예상 비용</span><span className="font-bold">₩--</span></li>
              </ul>
            </div>
            <p className="text-xs text-gray-500 text-center mt-6">실제 데이터는 리포트 생성 시 반영됩니다</p>
          </div>
        </div>
      </div>

      {/* 규제 보고서 */}
      <div className="mt-6 bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          규제 보고서
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 p-4 rounded-lg transition-all text-left">
            <div className="text-lg font-bold mb-1">온실가스 배출량</div>
            <div className="text-sm opacity-75">환경부 보고</div>
          </button>
          <button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 p-4 rounded-lg transition-all text-left">
            <div className="text-lg font-bold mb-1">RE100</div>
            <div className="text-sm opacity-75">재생에너지 보고</div>
          </button>
          <button className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 p-4 rounded-lg transition-all text-left">
            <div className="text-lg font-bold mb-1">에너지 사용량</div>
            <div className="text-sm opacity-75">에너지관리공단</div>
          </button>
        </div>
      </div>

      {/* 최근 리포트 */}
      <div className="mt-6 bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-400" />
            최근 생성된 리포트
          </h2>
          <button onClick={fetchRecentReports} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition">
            <RefreshCw className={`w-4 h-4 ${isLoadingReports ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {reportsError ? (
          <div className="text-center py-8">
            <p className="text-sm text-red-400 mb-2">{reportsError}</p>
            <button onClick={fetchRecentReports} className="text-xs text-cyan-400 hover:text-cyan-300 transition">재시도</button>
          </div>
        ) : isLoadingReports ? (
          <div className="text-center py-8 text-slate-500"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /><p className="text-sm">불러오는 중...</p></div>
        ) : recentReports.length === 0 ? (
          <div className="text-center py-8 text-slate-500"><FileText className="w-8 h-8 mx-auto mb-2 opacity-50" /><p className="text-sm">생성된 리포트가 없습니다.</p></div>
        ) : (
          <div className="space-y-2">
            {recentReports.map((report) => (
              <div key={report.id} className="flex items-center justify-between p-4 bg-slate-900/50 border border-slate-700/30 rounded-lg hover:border-slate-600 transition">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-blue-400" />
                  <div>
                    <div className="font-medium text-sm">{reportTypeLabels[report.type] || report.type} 리포트</div>
                    <div className="text-xs text-slate-500">{new Date(report.createdAt).toLocaleString('ko-KR')}</div>
                  </div>
                </div>
                {report.fileUrl ? (
                  <a href={report.fileUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 text-blue-400 text-sm rounded-lg hover:bg-blue-500/20 transition">
                    <Download className="w-4 h-4" /> 다운로드
                  </a>
                ) : (
                  <span className="text-xs text-slate-500">파일 없음</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
