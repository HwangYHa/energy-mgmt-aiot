'use client';

/**
 * InvoiceUploadModal — 고지서(전기/가스) 업로드 모달
 *
 * 기능:
 *  - 드래그 앤 드롭 + 클릭 파일 선택
 *  - POST /api/analytics/carbon/invoice (CSRF 자동 포함)
 *  - 성공: 추출 결과(사용량/단위/기간/배출량) 표시
 *  - manual_required: 수동 입력 폼 표시 후 재제출
 *  - toast 알림
 */

import { useState, useCallback, useRef, DragEvent } from 'react';
import { X, Upload, Loader2, FileText, CheckCircle, AlertCircle, ChevronRight } from 'lucide-react';
import { getCsrfToken } from '@/lib/api/client';
import { toast } from '@/lib/toast';

interface Props {
  onClose: () => void;
  onUploaded: () => void;
}

interface UploadResult {
  status: 'success' | 'manual_required';
  // 성공 시
  invoiceType?: string;
  usage?: number;
  unit?: string;
  period?: string;
  emissions?: number;
  emissionsUnit?: string;
  emissionFactor?: number;
  extractionMethod?: string;
  message?: string;
  // manual_required 시
  fields?: Array<{ name: string; label: string; type: string; placeholder?: string; options?: string[] }>;
  filename?: string;
}

const ACCEPTED = '.pdf,.jpg,.jpeg,.png,.xlsx,.xls,.csv,.txt';
const ACCEPTED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel', 'text/csv', 'text/plain'];

const INVOICE_TYPE_LABEL: Record<string, string> = {
  electricity: '전기 고지서',
  gas: '가스 고지서',
};

const EXTRACTION_METHOD_LABEL: Record<string, string> = {
  csv: 'CSV 파싱',
  xlsx: 'Excel 파싱',
  claude_vision: 'AI (Claude Vision)',
  manual: '수동 입력',
};

export function InvoiceUploadModal({ onClose, onUploaded }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  // manual_required 시 입력 값
  const [manualValues, setManualValues] = useState<Record<string, string>>({
    usage: '', unit: 'kWh', period: new Date().toISOString().slice(0, 7),
  });
  const inputRef = useRef<HTMLInputElement>(null);

  // ─── 파일 유효성 검사 ────────────────────────────────────────────────────
  const validateFile = (f: File): string | null => {
    if (f.size > 10 * 1024 * 1024) return '파일 크기는 10MB 이하여야 합니다.';
    const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
    const validExts = ['pdf', 'jpg', 'jpeg', 'png', 'xlsx', 'xls', 'csv', 'txt'];
    if (!validExts.includes(ext) && !ACCEPTED_MIME.includes(f.type)) {
      return '지원 형식: PDF, JPG, PNG, XLSX, CSV, TXT';
    }
    return null;
  };

  const handleFileChange = (f: File) => {
    const err = validateFile(f);
    if (err) { toast.warn(err); return; }
    setFile(f);
    setResult(null);
  };

  // ─── 드래그 앤 드롭 ──────────────────────────────────────────────────────
  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  }, []);
  const onDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
  }, []);
  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileChange(dropped);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── 업로드 실행 ─────────────────────────────────────────────────────────
  const doUpload = async (extraFields?: Record<string, string>) => {
    if (!file) { toast.warn('파일을 선택해주세요.'); return; }

    setUploading(true);
    try {
      const csrfToken = await getCsrfToken();
      const fd = new FormData();
      fd.append('file', file);
      if (extraFields) {
        Object.entries(extraFields).forEach(([k, v]) => { if (v) fd.append(k, v); });
      }

      const res = await fetch('/api/analytics/carbon/invoice', {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken },
        body: fd,
      });
      const json = await res.json() as { success: boolean; data?: UploadResult & { status?: string }; error?: string };

      if (!res.ok || !json.success) {
        throw new Error(json.error ?? '업로드에 실패했습니다.');
      }

      const data = json.data!;
      if (data.status === 'manual_required') {
        setResult({ ...data, status: 'manual_required' });
        toast.info('사용량을 자동으로 추출하지 못했습니다. 직접 입력해주세요.');
      } else {
        setResult({ ...data, status: 'success' });
        toast.success(`고지서 업로드 완료! ${data.emissions?.toFixed(3)} ${data.emissionsUnit ?? 'tCO₂'} 등록`);
        onUploaded();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  };

  // ─── 수동 입력 후 재제출 ─────────────────────────────────────────────────
  const handleManualSubmit = async () => {
    const { usage, period } = manualValues;
    if (!usage || parseFloat(usage) <= 0) { toast.warn('사용량을 입력해주세요.'); return; }
    if (!/^\d{4}-\d{2}$/.test(period ?? '')) { toast.warn('청구 월을 YYYY-MM 형식으로 입력해주세요.'); return; }
    await doUpload(manualValues);
  };

  // ─── UI 상태별 렌더링 ────────────────────────────────────────────────────
  const renderDropZone = () => (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all select-none ${
        dragOver
          ? 'border-cyan-400 bg-cyan-500/10 scale-[1.01]'
          : file
          ? 'border-emerald-400/60 bg-emerald-500/5'
          : 'border-slate-600 bg-slate-800/30 hover:border-slate-500 hover:bg-slate-800/50'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFileChange(f); }}
      />
      {file ? (
        <>
          <FileText className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
          <p className="text-emerald-300 font-medium text-sm">{file.name}</p>
          <p className="text-slate-500 text-xs mt-1">{(file.size / 1024).toFixed(1)} KB</p>
          <p className="text-slate-500 text-xs mt-2">다른 파일로 변경하려면 클릭하거나 드래그하세요</p>
        </>
      ) : (
        <>
          <Upload className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-300 font-medium text-sm">파일을 여기에 드래그하거나 클릭하여 선택</p>
          <p className="text-slate-500 text-xs mt-2">지원: PDF · JPG · PNG · XLSX · CSV · TXT (최대 10MB)</p>
        </>
      )}
    </div>
  );

  const renderSuccess = () => {
    if (!result || result.status !== 'success') return null;
    const typeLabel = INVOICE_TYPE_LABEL[result.invoiceType ?? ''] ?? result.invoiceType ?? '-';
    const methodLabel = EXTRACTION_METHOD_LABEL[result.extractionMethod ?? ''] ?? result.extractionMethod ?? '-';
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-emerald-400">
          <CheckCircle className="w-5 h-5" />
          <span className="font-semibold">업로드 및 배출량 계산 완료</span>
        </div>
        <div className="bg-slate-800/60 rounded-xl border border-slate-700 divide-y divide-slate-700/50 text-sm">
          {[
            ['고지서 유형',   typeLabel],
            ['사용 기간',     result.period ?? '-'],
            ['에너지 사용량', `${result.usage?.toLocaleString('ko-KR')} ${result.unit}`],
            ['배출계수',      result.emissionFactor != null ? `${result.emissionFactor} tCO₂/${result.unit}` : '-'],
            ['탄소 배출량',   `${result.emissions?.toFixed(3)} ${result.emissionsUnit ?? 'tCO₂'}`],
            ['추출 방법',     methodLabel],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between px-4 py-2.5">
              <span className="text-slate-400">{label}</span>
              <span className="text-white font-medium">{value}</span>
            </div>
          ))}
        </div>
        {result.message && (
          <p className="text-slate-400 text-xs">{result.message}</p>
        )}
        <button
          onClick={onClose}
          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium text-sm transition"
        >
          닫기
        </button>
      </div>
    );
  };

  const renderManualForm = () => {
    if (!result || result.status !== 'manual_required') return null;
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-amber-300 text-xs">
            파일에서 사용량을 자동 추출하지 못했습니다. 고지서를 확인하고 아래에 직접 입력해주세요.
          </p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              사용량 <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="예: 1234.5"
              value={manualValues.usage}
              onChange={e => setManualValues(v => ({ ...v, usage: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">단위</label>
            <select
              value={manualValues.unit}
              onChange={e => setManualValues(v => ({ ...v, unit: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:border-cyan-500 focus:outline-none"
            >
              <option value="kWh">kWh (전기)</option>
              <option value="m³">m³ (가스)</option>
              <option value="MJ">MJ (가스 열량)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              청구 월 <span className="text-red-400">*</span>
            </label>
            <input
              type="month"
              value={manualValues.period}
              onChange={e => setManualValues(v => ({ ...v, period: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>
        <button
          onClick={handleManualSubmit}
          disabled={uploading}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-white rounded-xl font-medium text-sm transition"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
          {uploading ? '계산 중...' : '배출량 계산'}
        </button>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-cyan-500/15 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">고지서 업로드</h3>
              <p className="text-xs text-slate-400">전기·가스 고지서로 탄소 배출량 자동 계산</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 바디 */}
        <div className="p-5 space-y-4">
          {result?.status === 'success' ? (
            renderSuccess()
          ) : result?.status === 'manual_required' ? (
            <>
              {renderDropZone()}
              {renderManualForm()}
            </>
          ) : (
            <>
              {renderDropZone()}
              <button
                onClick={() => doUpload()}
                disabled={uploading || !file}
                className="w-full flex items-center justify-center gap-2 py-3 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-sm transition"
              >
                {uploading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> AI 분석 중...</>
                ) : (
                  <><Upload className="w-4 h-4" /> 업로드 및 배출량 계산</>
                )}
              </button>
              <p className="text-center text-xs text-slate-500">
                AI가 자동으로 사용량을 추출하고 K-ETS 기준 배출계수를 적용합니다
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
