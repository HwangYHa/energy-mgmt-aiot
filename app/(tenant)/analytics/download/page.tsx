'use client';

import { useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileText,
  Calendar,
  Loader2,
  CheckCircle2,
  Clock,
  HardDrive,
  AlertCircle,
} from 'lucide-react';
import { generateDownloadFilename } from '@/lib/utils/filename';

interface DownloadJob {
  id: string;
  name: string;
  format: string;
  status: 'ready' | 'processing' | 'completed' | 'failed';
  size: string;
  createdAt: string;
  downloadUrl: string | null;
}

interface RawDataRow {
  id: string;
  timestamp: string;
  sensorId: string;
  sensorName: string;
  type: string;
  value: number | null;
  unit: string;
  quality: string;
}

const DATA_CATEGORIES = [
  { id: 'energy', label: '에너지 사용량', description: '전력 소비 시계열 데이터', icon: '⚡', type: 'energy_meter' },
  { id: 'sensor', label: '센서 데이터', description: '전체 센서 수집 원본 데이터', icon: '📡', type: '' },
  { id: 'device', label: '설비 가동 기록', description: '설비 상태 변경 이력', icon: '🏭', type: '' },
  { id: 'alert', label: '알림 이력', description: '알림 발생 및 처리 기록', icon: '🔔', type: '' },
  { id: 'cost', label: '비용 데이터', description: '전력 요금 및 비용 분석 데이터', icon: '💰', type: 'power_meter' },
  { id: 'carbon', label: '탄소 배출 데이터', description: '탄소 배출량 및 감축 기록', icon: '🌱', type: 'energy_meter' },
];

const FORMAT_OPTIONS = [
  { value: 'csv', label: 'CSV', icon: FileText, description: '범용 테이블 형식' },
  { value: 'xlsx', label: 'Excel', icon: FileSpreadsheet, description: '리포트 페이지 이용' },
  { value: 'json', label: 'JSON', icon: FileText, description: 'API 연동용 JSON' },
];

const STATUS_CONFIG = {
  ready: { icon: Clock, label: '준비', color: 'text-slate-400' },
  processing: { icon: Loader2, label: '생성 중', color: 'text-cyan-400' },
  completed: { icon: CheckCircle2, label: '완료', color: 'text-emerald-400' },
  failed: { icon: AlertCircle, label: '실패', color: 'text-red-400' },
};

function rowsToCsv(rows: RawDataRow[]): string {
  const headers = ['시간', '센서ID', '센서명', '타입', '측정값', '단위', '품질'].join(',');
  const lines = rows.map((r) =>
    [
      r.timestamp,
      r.sensorId,
      `"${(r.sensorName ?? '').replace(/"/g, '""')}"`,
      r.type ?? '',
      r.value !== null ? r.value : '',
      r.unit ?? '',
      r.quality ?? '',
    ].join(',')
  );
  return '\uFEFF' + [headers, ...lines].join('\n'); // BOM for Korean in Excel
}

export default function DataDownloadPage() {
  const [selectedCategory, setSelectedCategory] = useState('energy');
  const [format, setFormat] = useState('csv');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadHistory, setDownloadHistory] = useState<DownloadJob[]>([]);

  const handleGenerate = async () => {
    setError(null);

    if (format === 'xlsx') {
      setError('Excel 형식은 보고서 생성 페이지(/reports)에서 지원됩니다.');
      return;
    }

    setIsGenerating(true);
    const catLabel = DATA_CATEGORIES.find((c) => c.id === selectedCategory)?.label ?? selectedCategory;
    const jobId = `job-${Date.now()}`;
    const jobName = generateDownloadFilename(catLabel, '', format);

    setDownloadHistory((prev) => [
      {
        id: jobId,
        name: jobName,
        format,
        status: 'processing' as const,
        size: '-',
        createdAt: new Date().toISOString(),
        downloadUrl: null,
      },
      ...prev,
    ]);

    try {
      const catConfig = DATA_CATEGORIES.find((c) => c.id === selectedCategory);
      const sensorType = catConfig?.type ?? '';

      const params = new URLSearchParams({
        start: new Date(startDate).toISOString(),
        end: new Date(endDate).toISOString(),
        pageSize: '1000',
        page: '1',
      });
      if (sensorType) params.set('type', sensorType);

      const res = await fetch(`/api/analytics/raw-data?${params}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error((errJson as { message?: string }).message ?? `데이터 조회 실패 (${res.status})`);
      }

      const json = await res.json() as { data?: RawDataRow[] };
      const rows: RawDataRow[] = (json.data ?? []).filter((r) => r.value !== null);

      let content: string;
      let mimeType: string;

      if (format === 'csv') {
        content = rowsToCsv(rows);
        mimeType = 'text/csv;charset=utf-8;';
      } else {
        content = JSON.stringify(
          { category: selectedCategory, period: { start: startDate, end: endDate }, count: rows.length, data: rows },
          null,
          2
        );
        mimeType = 'application/json';
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const sizeKB = Math.round(blob.size / 1024);
      const sizeStr = sizeKB >= 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;

      setDownloadHistory((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? { ...j, status: 'completed' as const, size: sizeStr, downloadUrl: url }
            : j
        )
      );
    } catch (err) {
      setDownloadHistory((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, status: 'failed' as const } : j))
      );
      setError(err instanceof Error ? err.message : '파일 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#051225] text-white p-4 md:p-6 space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <Download className="w-6 h-6 text-emerald-400" />
          </div>
          데이터 다운로드
        </h1>
        <p className="text-slate-400 text-sm mt-1">수집 데이터를 파일로 내보내기</p>
      </div>

      {/* 에러 배너 */}
      {error && (
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: 다운로드 설정 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 데이터 카테고리 선택 */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">데이터 선택</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {DATA_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`p-4 rounded-xl border text-left transition ${
                    selectedCategory === cat.id
                      ? 'bg-cyan-500/10 border-cyan-500/50'
                      : 'bg-slate-800/30 border-slate-700/30 hover:border-slate-600'
                  }`}
                >
                  <div className="text-2xl mb-2">{cat.icon}</div>
                  <div className="text-sm font-medium text-white">{cat.label}</div>
                  <div className="text-xs text-slate-500 mt-1">{cat.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 기간 & 형식 */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">기간 및 형식</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">시작일</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">종료일</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">파일 형식</label>
                <div className="flex gap-2">
                  {FORMAT_OPTIONS.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setFormat(f.value)}
                      className={`flex-1 flex flex-col items-center gap-1 px-3 py-2 rounded-lg border text-xs transition ${
                        format === f.value
                          ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400'
                          : 'bg-slate-800/30 border-slate-700/30 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <f.icon className="w-4 h-4" />
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="mt-6 w-full flex items-center justify-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium transition disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  파일 생성 중...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  다운로드 파일 생성
                </>
              )}
            </button>
          </div>
        </div>

        {/* 오른쪽: 다운로드 이력 */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-slate-400" />
            다운로드 이력
          </h2>
          <div className="space-y-3">
            {downloadHistory.length === 0 && (
              <p className="text-center text-slate-500 text-sm py-6">
                이번 세션에서 생성된 다운로드 파일이 없습니다.
              </p>
            )}
            {downloadHistory.map((job) => {
              const statusConf = STATUS_CONFIG[job.status];
              const StatusIcon = statusConf.icon;
              return (
                <div
                  key={job.id}
                  className="p-3 bg-slate-800/30 border border-slate-700/30 rounded-lg"
                >
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-sm text-white truncate pr-2">{job.name}</span>
                    <StatusIcon
                      className={`w-4 h-4 flex-shrink-0 ${statusConf.color} ${
                        job.status === 'processing' ? 'animate-spin' : ''
                      }`}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{job.size}</span>
                    <span>
                      {new Date(job.createdAt).toLocaleString('ko-KR', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  {job.status === 'completed' && job.downloadUrl && (
                    <a
                      href={job.downloadUrl}
                      download={job.name}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-lg hover:bg-cyan-500/20 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      다운로드
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
