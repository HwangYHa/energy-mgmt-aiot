'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  Trash2,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { generateDownloadFilename } from '@/lib/utils/filename';
import { apiGet, apiPost, apiDelete } from '@/lib/api/client';

// ──────────────────────────────────────────────
// 타입 정의
// ──────────────────────────────────────────────

interface DownloadHistoryItem {
  id: string;
  category: string;
  format: string;
  filename: string;
  startDate: string;
  endDate: string;
  rowCount: number;
  sizeBytes: number;
  /** DB에서 로드된 이력은 completed | failed, 낙관적 UI는 processing 포함 */
  status: 'completed' | 'failed' | 'processing';
  createdAt: string;
  filepath?: string | null; // 저장된 파일 경로
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

// ──────────────────────────────────────────────
// 상수
// ──────────────────────────────────────────────

const DATA_CATEGORIES = [
  { id: 'energy',  label: '에너지 사용량',  description: '전력 소비 시계열 데이터', icon: '⚡', type: 'energy_meter' },
  { id: 'sensor',  label: '센서 데이터',    description: '전체 센서 수집 원본 데이터', icon: '📡', type: '' },
  { id: 'device',  label: '설비 가동 기록', description: '설비 상태 변경 이력', icon: '🏭', type: '' },
  { id: 'alert',   label: '알림 이력',      description: '알림 발생 및 처리 기록', icon: '🔔', type: '' },
  { id: 'cost',    label: '비용 데이터',    description: '전력 요금 및 비용 분석', icon: '💰', type: 'power_meter' },
  { id: 'carbon',  label: '탄소 배출 데이터', description: '탄소 배출량 및 감축 기록', icon: '🌱', type: 'energy_meter' },
] as const;

const FORMAT_OPTIONS = [
  { value: 'csv',  label: 'CSV',   icon: FileText,        description: '범용 테이블 형식', disabled: false },
  { value: 'xlsx', label: 'Excel', icon: FileSpreadsheet, description: '리포트 페이지 이용', disabled: true },
  { value: 'json', label: 'JSON',  icon: FileText,        description: 'API 연동용 JSON',  disabled: false },
] as const;

const STATUS_CONFIG = {
  processing: { icon: Loader2,      label: '생성 중', color: 'text-cyan-400',    spin: true  },
  completed:  { icon: CheckCircle2, label: '완료',    color: 'text-emerald-400', spin: false },
  failed:     { icon: AlertCircle,  label: '실패',    color: 'text-red-400',     spin: false },
};

const MAX_ROWS = 5000; // 단일 다운로드 최대 건수

// ──────────────────────────────────────────────
// 유틸리티
// ──────────────────────────────────────────────

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
  return '\uFEFF' + [headers, ...lines].join('\n');
}

function formatSize(bytes: number): string {
  if (!bytes || bytes === 0) return '-';
  const kb = bytes / 1024;
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`;
}

function getCategoryMeta(id: string) {
  return DATA_CATEGORIES.find((c) => c.id === id);
}

function formatDateKo(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ──────────────────────────────────────────────
// 페이지 컴포넌트
// ──────────────────────────────────────────────

export default function DataDownloadPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('energy');
  const [format, setFormat] = useState<string>('csv');

  // Hydration 방지: 날짜 초기값은 빈 문자열 → useEffect에서 설정
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [datesReady, setDatesReady] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // DB에서 불러온 이력 목록
  const [history, setHistory] = useState<DownloadHistoryItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);

  // 현재 세션에서 생성된 Blob URL 저장 (historyId → objectURL)
  const [blobUrls, setBlobUrls] = useState<Record<string, string>>({});
  // ref로도 동기화하여 unmount 시 안전하게 모두 해제
  const blobUrlsRef = useRef<Record<string, string>>({});

  // 클라이언트 마운트 후 날짜 초기값 설정 (SSR/CSR Hydration 불일치 방지)
  useEffect(() => {
    const now = new Date();
    const end = now.toISOString().slice(0, 10);
    now.setMonth(now.getMonth() - 1);
    const start = now.toISOString().slice(0, 10);
    setEndDate(end);
    setStartDate(start);
    setDatesReady(true);
  }, []);

  // DB에서 다운로드 이력 로드
  const loadHistory = useCallback(async () => {
    setIsHistoryLoading(true);
    try {
      const res = await apiGet<DownloadHistoryItem[]>('/api/analytics/download/history');
      setHistory(res.data ?? []);
    } catch {
      setHistory([]);
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // blobUrls 변경 시 ref 동기화 (렌더링에는 state 사용, 정리에는 ref 사용)
  useEffect(() => {
    blobUrlsRef.current = blobUrls;
  }, [blobUrls]);

  // 언마운트 시에만 Blob URL 일괄 정리 (dependency [] → 진짜 unmount)
  useEffect(() => {
    return () => {
      Object.values(blobUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  /**
   * 핵심 파일 생성 로직 — handleGenerate / handleRegenerate 공용
   * @param params 카테고리·형식·기간 오버라이드 (미제공 시 현재 폼 값 사용)
   */
  const runGenerate = async (params?: {
    category?: string;
    format?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const cat    = params?.category  ?? selectedCategory;
    const fmt    = params?.format    ?? format;
    const start  = params?.startDate ?? startDate;
    const end    = params?.endDate   ?? endDate;

    setError(null);

    // XLSX 서버 생성 불가 안내
    if (fmt === 'xlsx') {
      setError('Excel 형식은 보고서 생성 페이지(/reports)에서 지원됩니다.');
      return;
    }

    if (!start || !end) {
      setError('시작일과 종료일을 입력해주세요.');
      return;
    }

    // 날짜 역전 검증
    if (start > end) {
      setError('시작일이 종료일보다 늦을 수 없습니다.');
      return;
    }

    setIsGenerating(true);
    const catMeta  = getCategoryMeta(cat);
    const catLabel = catMeta?.label ?? cat;
    const filename = generateDownloadFilename(catLabel, '', fmt);

    // 낙관적 UI: 'processing' 상태로 즉시 이력 목록 상단에 표시
    const tempId = `temp-${Date.now()}`;
    setHistory((prev) => [
      {
        id: tempId,
        category: cat,
        format: fmt,
        filename,
        startDate: start,
        endDate: end,
        rowCount: 0,
        sizeBytes: 0,
        status: 'processing' as const,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);

    try {
      // ── 데이터 조회 (apiGet — credentials 자동 포함) ──
      const sensorType = catMeta?.type ?? '';
      const qs = new URLSearchParams({
        start:    new Date(start).toISOString(),
        end:      new Date(end + 'T23:59:59').toISOString(),
        pageSize: String(MAX_ROWS),
        page:     '1',
      });
      if (sensorType) qs.set('type', sensorType);

      const rawRes = await apiGet<RawDataRow[]>(`/api/analytics/raw-data?${qs}`);
      if (!rawRes.success) {
        throw new Error(rawRes.error ?? '데이터 조회에 실패했습니다.');
      }

      const rows: RawDataRow[] = (rawRes.data ?? []).filter((r) => r.value !== null);

      // ── 파일 콘텐츠 생성 ──
      let content: string;
      let mimeType: string;

      if (fmt === 'csv') {
        content  = rowsToCsv(rows);
        mimeType = 'text/csv;charset=utf-8;';
      } else {
        content = JSON.stringify(
          {
            category: cat,
            period:   { start, end },
            count:    rows.length,
            data:     rows,
          },
          null,
          2
        );
        mimeType = 'application/json';
      }

      const blob      = new Blob([content], { type: mimeType });
      const blobUrl   = URL.createObjectURL(blob);
      const sizeBytes = blob.size;

      // ── DB에 이력 저장 (파일 콘텐츠 포함) ──
      let savedId = tempId;
      try {
        // 파일 콘텐츠를 Base64로 인코딩하여 서버로 전송
        const base64Content = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(',')[1] || '');
          reader.readAsDataURL(blob);
        });

        const saved = await apiPost<{ id: string }>('/api/analytics/download/history', {
          category: cat,
          format:   fmt,
          filename,
          startDate: start,
          endDate:   end,
          rowCount:  rows.length,
          sizeBytes,
          status:   'completed',
          fileContent: base64Content, // Base64 인코딩된 파일 콘텐츠
        });
        // successResponse({ id }) → saved.data.id
        savedId = saved.data?.id ?? tempId;
      } catch {
        // DB 저장 실패해도 다운로드는 계속 진행
      }

      // Blob URL 저장 (세션 동안 유지)
      setBlobUrls((prev) => ({ ...prev, [savedId]: blobUrl }));

      // 이력 목록 업데이트 (tempId → savedId, processing → completed)
      setHistory((prev) =>
        prev.map((item) =>
          item.id === tempId
            ? { ...item, id: savedId, rowCount: rows.length, sizeBytes, status: 'completed' as const }
            : item
        )
      );

      // 즉시 다운로드 트리거
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.click();
    } catch (err) {
      // 실패: 낙관적 항목을 'failed'로 변경 후 DB에 기록
      setHistory((prev) =>
        prev.map((item) =>
          item.id === tempId ? { ...item, status: 'failed' as const } : item
        )
      );
      setError(err instanceof Error ? err.message : '파일 생성 중 오류가 발생했습니다.');

      try {
        await apiPost('/api/analytics/download/history', {
          category: cat,
          format:   fmt,
          filename,
          startDate: start,
          endDate:   end,
          rowCount:  0,
          sizeBytes: 0,
          status:   'failed',
        });
      } catch { /* ignore */ }
    } finally {
      setIsGenerating(false);
    }
  };

  /** 폼 값으로 생성 */
  const handleGenerate = () => runGenerate();

  /** 이력 항목 설정으로 재생성 (이전 세션 이력 재다운로드) */
  const handleRegenerate = (item: DownloadHistoryItem) =>
    runGenerate({
      category:  item.category,
      format:    item.format,
      startDate: item.startDate,
      endDate:   item.endDate,
    });

  const handleDeleteItem = async (id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
    if (blobUrls[id]) {
      URL.revokeObjectURL(blobUrls[id]);
      setBlobUrls((prev) => { const n = { ...prev }; delete n[id]; return n; });
    }
    try {
      await apiDelete(`/api/analytics/download/history?id=${id}`);
    } catch { /* 이미 UI에서 제거됨 — 무시 */ }
  };

  const handleClearAll = async () => {
    Object.values(blobUrls).forEach((url) => URL.revokeObjectURL(url));
    setBlobUrls({});
    setHistory([]);
    try {
      await apiDelete('/api/analytics/download/history?all=1');
    } catch { /* ignore */ }
  };

  // 이력 통계
  const historyStats = {
    total:      history.filter((h) => h.status !== 'processing').length,
    completed:  history.filter((h) => h.status === 'completed').length,
    failed:     history.filter((h) => h.status === 'failed').length,
    totalRows:  history.filter((h) => h.status === 'completed').reduce((s, h) => s + h.rowCount, 0),
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
        <p className="text-slate-400 text-sm mt-1">
          수집 데이터를 파일로 내보내기 · 최대 {MAX_ROWS.toLocaleString()}건
        </p>
      </div>

      {/* 에러 배너 */}
      {error && (
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-300">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-300 text-xs flex-shrink-0"
          >
            닫기
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── 왼쪽: 다운로드 설정 ── */}
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
                      ? 'bg-cyan-500/10 border-cyan-500/50 ring-1 ring-cyan-500/30'
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
              {/* 시작일 */}
              <div>
                <label className="text-xs text-slate-500 mb-1 block">시작일</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="date"
                    value={startDate}
                    max={endDate || undefined}
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={!datesReady}
                    className="w-full pl-10 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-cyan-500 focus:outline-none disabled:opacity-50"
                  />
                </div>
              </div>

              {/* 종료일 */}
              <div>
                <label className="text-xs text-slate-500 mb-1 block">종료일</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(e) => setEndDate(e.target.value)}
                    disabled={!datesReady}
                    className="w-full pl-10 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-cyan-500 focus:outline-none disabled:opacity-50"
                  />
                </div>
              </div>

              {/* 파일 형식 */}
              <div>
                <label className="text-xs text-slate-500 mb-1 block">파일 형식</label>
                <div className="flex gap-2">
                  {FORMAT_OPTIONS.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => !f.disabled && setFormat(f.value)}
                      disabled={f.disabled}
                      title={f.disabled ? '보고서 페이지에서 지원됩니다' : f.description}
                      className={`flex-1 flex flex-col items-center gap-1 px-3 py-2 rounded-lg border text-xs transition ${
                        f.disabled
                          ? 'bg-slate-900/30 border-slate-700/20 text-slate-600 cursor-not-allowed opacity-50'
                          : format === f.value
                            ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400'
                            : 'bg-slate-800/30 border-slate-700/30 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <f.icon className="w-4 h-4" />
                      {f.label}
                      {f.disabled && <span className="text-[9px] text-slate-600">미지원</span>}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 최대 건수 안내 */}
            <p className="mt-3 text-[11px] text-slate-600">
              ※ 최대 {MAX_ROWS.toLocaleString()}건이 다운로드됩니다. 더 많은 데이터는 기간을 나눠 여러 번 내보내세요.
            </p>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !datesReady}
              className="mt-5 w-full flex items-center justify-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-600 disabled:bg-cyan-800 text-white rounded-lg font-medium transition disabled:opacity-60 disabled:cursor-not-allowed"
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

        {/* ── 오른쪽: 다운로드 이력 (DB 연동) ── */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 flex flex-col">
          {/* 이력 헤더 */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-slate-400" />
              다운로드 이력
            </h2>
            <div className="flex items-center gap-1">
              <button
                onClick={loadHistory}
                disabled={isHistoryLoading}
                className="p-1.5 text-slate-500 hover:text-slate-300 transition rounded"
                title="새로고침"
              >
                <RefreshCw className={`w-4 h-4 ${isHistoryLoading ? 'animate-spin' : ''}`} />
              </button>
              {history.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="p-1.5 text-slate-500 hover:text-red-400 transition rounded"
                  title="전체 이력 삭제"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* 통계 요약 */}
          {historyStats.total > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-slate-900/50 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-white">{historyStats.total}</div>
                <div className="text-[10px] text-slate-500">총 건수</div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-emerald-400">{historyStats.completed}</div>
                <div className="text-[10px] text-slate-500">성공</div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-white">
                  {historyStats.totalRows.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-500">총 행수</div>
              </div>
            </div>
          )}

          {/* 이력 목록 */}
          <div className="flex-1 space-y-2 overflow-y-auto max-h-[460px] pr-1">
            {isHistoryLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-10">
                <HardDrive className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">다운로드 이력이 없습니다.</p>
              </div>
            ) : (
              history.map((item) => {
                const statusKey  = item.status in STATUS_CONFIG ? item.status : 'completed';
                const statusConf = STATUS_CONFIG[statusKey as keyof typeof STATUS_CONFIG];
                const StatusIcon = statusConf.icon;
                const catMeta    = getCategoryMeta(item.category);
                const blobUrl    = blobUrls[item.id];
                const isTemp     = item.id.startsWith('temp-');

                return (
                  <div
                    key={item.id}
                    className={`p-3 rounded-lg border group transition ${
                      item.status === 'processing'
                        ? 'bg-cyan-500/5 border-cyan-500/20'
                        : item.status === 'failed'
                          ? 'bg-red-500/5 border-red-500/20'
                          : 'bg-slate-800/30 border-slate-700/30'
                    }`}
                  >
                    {/* 상단: 파일명 + 상태 아이콘 + 삭제 */}
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1 min-w-0 mr-2">
                        <span className="text-xs font-medium text-white block truncate" title={item.filename}>
                          {item.filename}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {catMeta?.icon} {catMeta?.label ?? item.category} · {item.format.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <StatusIcon
                          className={`w-4 h-4 ${statusConf.color} ${statusConf.spin ? 'animate-spin' : ''}`}
                        />
                        {!isTemp && (
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-600 hover:text-red-400 transition"
                            title="이력 삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 기간 + 건수 + 용량 */}
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                      <span>
                        <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                        {item.startDate} ~ {item.endDate}
                        {item.rowCount > 0 && (
                          <span className="ml-1 text-slate-400">
                            ({item.rowCount.toLocaleString()}건)
                          </span>
                        )}
                      </span>
                      <span>{formatSize(item.sizeBytes)}</span>
                    </div>

                    {/* 생성 시각 */}
                    <div className="text-[10px] text-slate-600 mt-0.5">
                      {formatDateKo(item.createdAt)}
                    </div>

                    {/* 액션 버튼 영역 */}
                    {item.status === 'completed' && (
                      blobUrl ? (
                        // 현재 세션에서 생성한 경우 → 직접 다운로드
                        <a
                          href={blobUrl}
                          download={item.filename}
                          className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-lg hover:bg-cyan-500/20 transition"
                        >
                          <Download className="w-3.5 h-3.5" />
                          다운로드
                        </a>
                      ) : item.filepath ? (
                        // 이전 세션 이력 + 서버에 파일 있음 → 서버에서 다운로드
                        <a
                          href={`/api/analytics/download/file/${item.id}`}
                          download={item.filename}
                          className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-lg hover:bg-cyan-500/20 transition"
                        >
                          <Download className="w-3.5 h-3.5" />
                          다운로드
                        </a>
                      ) : (
                        // 파일 없음 → 재생성
                        <button
                          onClick={() => handleRegenerate(item)}
                          disabled={isGenerating}
                          className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 bg-slate-700/30 border border-slate-600/30 rounded-lg hover:bg-slate-700/50 hover:text-slate-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          title="동일한 조건으로 다시 생성합니다"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          재생성
                        </button>
                      )
                    )}

                    {item.status === 'failed' && (
                      <button
                        onClick={() => handleRegenerate(item)}
                        disabled={isGenerating}
                        className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-red-400 bg-red-500/5 border border-red-500/20 rounded-lg hover:bg-red-500/10 transition disabled:opacity-50"
                        title="다시 시도"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        다시 시도
                      </button>
                    )}

                    {item.status === 'processing' && (
                      <div className="mt-2 text-[10px] text-cyan-400/70 text-center animate-pulse">
                        파일 생성 중...
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* 이력 푸터 */}
          {history.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-700/30 text-[10px] text-slate-600 text-center">
              총 {historyStats.total}건 저장됨 · 완료된 이력은 언제든 다운로드 가능
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
