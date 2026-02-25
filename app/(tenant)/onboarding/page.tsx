'use client';
/**
 * 온보딩 위저드 — 구독 후 첫 설정 가이드
 *
 * 3단계:
 *   Step 1 — 사이트 등록
 *   Step 2 — 데이터 연결 (4가지 방법)
 *     탭 A: 고지서 파일 업로드 (CSV 자동파싱 / PDF→수동입력 폼 표시)
 *     탭 B: 직접 입력 (유형/기간/사용량)
 *     탭 C: 고객번호 조회 (KEPCO API / 도시가스 안내)
 *     탭 D: IoT 센서 연동 안내
 *   Step 3 — 완료
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2, FileText, ChevronRight, ChevronLeft,
  CheckCircle, Upload, Wifi, AlertCircle, ArrowRight,
  BarChart3, Plug, Link2, Loader2, Search,
  Zap, Flame, CheckCircle2, X, Info,
} from 'lucide-react';
import { apiPost, apiPut } from '@/lib/api/client';
import { fetchCsrfToken } from '@/hooks/use-csrf';
import { toast } from '@/lib/toast';

// ─────────────────────────────────────────────
// 공통 타입
// ─────────────────────────────────────────────

type DataMethod = 'invoice' | 'direct' | 'customer' | 'sensor' | 'skip' | null;

interface SaveResult {
  recordId: string;
  invoiceType: string;
  usage: number;
  unit: string;
  period: string;
  emissions: number;
  emissionsUnit: string;
  message: string;
}

const STEPS = [
  { id: 1, title: '사이트 등록',  desc: '첫 사업장을 등록합니다' },
  { id: 2, title: '데이터 연결',  desc: '에너지 데이터 수집 방법을 선택합니다' },
  { id: 3, title: '완료',        desc: '탄소 배출량 계산이 시작됩니다' },
] as const;

// ─────────────────────────────────────────────
// 단계 1: 사이트 등록
// ─────────────────────────────────────────────

function Step1Site({ onNext }: { onNext: (siteId: string) => void }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [industryType, setIndustryType] = useState('building');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error('사이트 이름을 입력해주세요.'); return; }
    setLoading(true);
    try {
      const res = await apiPost<{ id: string }>('/api/sites', {
        name: name.trim(), address, industryType,
      });
      toast.success(`사이트 "${name}"이 등록되었습니다.`);
      onNext(res.data?.id ?? '');
    } catch {
      toast.error('사이트 등록 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
        <Building2 className="w-8 h-8 text-cyan-400 flex-shrink-0" />
        <div>
          <p className="text-white font-semibold">첫 사업장을 등록하세요</p>
          <p className="text-sm text-slate-400">에너지를 관리할 건물/공장/시설을 추가합니다.</p>
        </div>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            사이트 이름 <span className="text-red-400">*</span>
          </label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="예: 본사 건물, 제1공장, 물류센터"
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none transition" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">주소</label>
          <input type="text" value={address} onChange={e => setAddress(e.target.value)}
            placeholder="예: 서울특별시 강남구 테헤란로 123"
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none transition" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">업종 분류</label>
          <select value={industryType} onChange={e => setIndustryType(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white focus:border-cyan-500 focus:outline-none transition">
            <option value="building">건물/사무소</option>
            <option value="manufacturing">제조업</option>
            <option value="industrial_complex">산업단지</option>
            <option value="datacenter">데이터센터</option>
            <option value="other">기타</option>
          </select>
        </div>
      </div>
      <button onClick={handleSubmit} disabled={loading || !name.trim()}
        className="w-full py-3 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2">
        {loading
          ? <><Loader2 className="w-5 h-5 animate-spin" />등록 중...</>
          : <>사이트 등록하기<ChevronRight className="w-5 h-5" /></>}
      </button>
      <p className="text-center text-sm text-slate-500">나중에 설정 → 사이트 관리에서도 추가할 수 있습니다.</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// 탭 A: 고지서 파일 업로드
// ─────────────────────────────────────────────

function TabFileUpload({ onSuccess }: { onSuccess: (r: SaveResult) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [utilityType, setUtilityType] = useState<'electricity' | 'gas'>('electricity');
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [manualRequired, setManualRequired] = useState(false);
  const [manualUsage, setManualUsage] = useState('');
  const [manualUnit, setManualUnit] = useState('kWh');
  const [manualPeriod, setManualPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [error, setError] = useState<string | null>(null);

  const applyFile = (f: File | null) => {
    setFile(f);
    setManualRequired(false);
    setError(null);
    if (f) {
      const lower = f.name.toLowerCase();
      if (lower.includes('가스') || lower.includes('gas')) {
        setUtilityType('gas');
        setManualUnit('m³');
      } else {
        setUtilityType('electricity');
        setManualUnit('kWh');
      }
    }
  };

  const handleUpload = async () => {
    setUploading(true);
    setError(null);
    try {
      // CSRF 토큰 획득 (직전에 fresh하게 가져옴)
      let csrfToken: string;
      try {
        csrfToken = await fetchCsrfToken();
      } catch {
        setError('보안 토큰 발급 실패. 페이지를 새로고침 후 다시 시도해주세요.');
        setUploading(false);
        return;
      }

      const formData = new FormData();
      if (file) formData.append('file', file);
      formData.append('utilityType', utilityType);
      if (manualRequired) {
        if (!manualUsage || parseFloat(manualUsage) <= 0) {
          setError('사용량을 입력해주세요 (양수)');
          setUploading(false);
          return;
        }
        formData.append('usage', manualUsage);
        formData.append('unit', manualUnit);
        formData.append('period', manualPeriod);
      }

      let res: Response;
      try {
        res = await fetch('/api/analytics/carbon/invoice', {
          method: 'POST',
          headers: { 'X-CSRF-Token': csrfToken },
          credentials: 'include',
          body: formData,
        });
      } catch (fetchErr) {
        // 네트워크 오류 (서버 연결 불가)
        setError(fetchErr instanceof Error ? fetchErr.message : '서버에 연결할 수 없습니다. 네트워크를 확인해주세요.');
        return;
      }

      // JSON 파싱 (HTML 응답 등 예외 처리)
      let json: Record<string, unknown>;
      try {
        json = await res.json();
      } catch {
        setError(`서버 응답 오류 (HTTP ${res.status}). 잠시 후 다시 시도해주세요.`);
        return;
      }

      if (!res.ok) {
        // CSRF 오류(403), 권한 오류(401/403), 검증 오류(422) 등 명확한 메시지 표시
        const msg =
          (json?.message as string | undefined) ??
          (json?.error as string | undefined) ??
          ((json?.details as Record<string, unknown>)?.message as string | undefined) ??
          `업로드 실패 (HTTP ${res.status})`;
        setError(msg);
        return;
      }

      const data = (json?.data ?? json) as Record<string, unknown>;
      if (data?.status === 'manual_required') {
        setManualRequired(true);
        setManualUnit((data.suggestedUnit as string | undefined) ?? 'kWh');
        toast.info('PDF/이미지에서 사용량을 읽을 수 없습니다. 아래에 직접 입력해주세요.');
        return;
      }

      toast.success((data?.message as string | undefined) ?? '고지서가 저장되었습니다.');
      onSuccess(data as unknown as SaveResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 유형 토글 */}
      <div className="grid grid-cols-2 gap-2">
        {(['electricity', 'gas'] as const).map(t => (
          <button key={t} onClick={() => { setUtilityType(t); setManualUnit(t === 'gas' ? 'm³' : 'kWh'); }}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border transition text-sm font-medium ${
              utilityType === t
                ? t === 'electricity' ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400' : 'border-orange-500 bg-orange-500/10 text-orange-400'
                : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500'
            }`}>
            {t === 'electricity' ? <><Zap className="w-4 h-4" />한국전력 (전기)</> : <><Flame className="w-4 h-4" />도시가스</>}
          </button>
        ))}
      </div>

      {/* 드래그앤드롭 */}
      <label>
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={e => { e.preventDefault(); setIsDragging(false); applyFile(e.dataTransfer.files[0] ?? null); }}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
            isDragging ? 'border-cyan-400 bg-cyan-500/10'
            : file ? 'border-emerald-500 bg-emerald-500/10'
            : 'border-slate-600 hover:border-cyan-500 bg-slate-800/50'}`}>
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <FileText className="w-6 h-6 text-emerald-400" />
              <div className="text-left">
                <p className="text-sm font-medium text-white">{file.name}</p>
                <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <button onClick={e => { e.preventDefault(); applyFile(null); }} className="ml-2 text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <p className="text-sm text-slate-300 font-medium">파일을 클릭하거나 드래그하여 업로드</p>
              <p className="text-xs text-slate-500 mt-1">PDF, CSV, JPG, PNG, XLSX 지원 · 최대 10MB</p>
              <p className="text-xs text-slate-600 mt-1">💡 CSV는 자동 파싱, PDF/이미지는 수동 입력 안내</p>
            </>
          )}
        </div>
        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.csv,.txt" className="hidden"
          onChange={e => applyFile(e.target.files?.[0] ?? null)} />
      </label>

      {/* PDF/이미지 수동 입력 폼 */}
      {manualRequired && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-3">
          <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold">
            <Info className="w-4 h-4" />PDF/이미지 — 사용량을 직접 입력해주세요
          </div>
          <p className="text-xs text-slate-400">
            고지서에서 <strong className="text-white">당월 사용량</strong>과 <strong className="text-white">청구 월</strong>을 확인하세요.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">청구 월</label>
              <input type="month" value={manualPeriod} onChange={e => setManualPeriod(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">단위</label>
              <select value={manualUnit} onChange={e => setManualUnit(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none">
                <option value="kWh">kWh (전기)</option>
                <option value="m³">m³ (가스)</option>
                <option value="MJ">MJ</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">사용량 ({manualUnit}) <span className="text-red-400">*</span></label>
            <input type="number" min="0" step="0.1" value={manualUsage} onChange={e => setManualUsage(e.target.value)}
              placeholder={utilityType === 'gas' ? '예: 234.5' : '예: 1234'}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm focus:border-cyan-500 focus:outline-none" />
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      {(file || manualRequired) && (
        <button onClick={handleUpload} disabled={uploading || (manualRequired && !manualUsage)}
          className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2">
          {uploading
            ? <><Loader2 className="w-5 h-5 animate-spin" />처리 중...</>
            : manualRequired
            ? <><CheckCircle2 className="w-5 h-5" />사용량 저장하기</>
            : <><Upload className="w-5 h-5" />고지서 업로드</>}
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 탭 B: 직접 입력
// ─────────────────────────────────────────────

function TabDirectInput({ onSuccess }: { onSuccess: (r: SaveResult) => void }) {
  const [utilityType, setUtilityType] = useState<'electricity' | 'gas'>('electricity');
  const [usage, setUsage] = useState('');
  const [unit, setUnit] = useState('kWh');
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUtilityChange = (t: 'electricity' | 'gas') => {
    setUtilityType(t);
    setUnit(t === 'gas' ? 'm³' : 'kWh');
  };

  const handleSubmit = async () => {
    if (!usage || parseFloat(usage) <= 0) { setError('사용량을 입력해주세요 (양수)'); return; }
    setError(null);
    setLoading(true);
    try {
      const res = await apiPost<SaveResult>('/api/analytics/carbon/invoice', {
        usage: parseFloat(usage), unit, period, utilityType,
      });
      if (!res.data) throw new Error('저장 실패');
      toast.success(res.data.message ?? '사용량이 저장되었습니다.');
      onSuccess(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm text-blue-300">
        <Info className="w-4 h-4 flex-shrink-0" />
        전기/가스 고지서를 보고 사용량을 직접 입력합니다. 즉시 배출량이 계산됩니다.
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(['electricity', 'gas'] as const).map(t => (
          <button key={t} onClick={() => handleUtilityChange(t)}
            className={`flex items-center justify-center gap-2 py-3 rounded-lg border transition font-medium ${
              utilityType === t
                ? t === 'electricity' ? 'border-yellow-500 bg-yellow-500/10 text-yellow-300' : 'border-orange-500 bg-orange-500/10 text-orange-300'
                : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500'
            }`}>
            {t === 'electricity' ? <><Zap className="w-5 h-5" />전기 (KEPCO)</> : <><Flame className="w-5 h-5" />도시가스</>}
          </button>
        ))}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">청구 월 <span className="text-red-400">*</span></label>
        <input type="month" value={period} onChange={e => setPeriod(e.target.value)}
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white focus:border-cyan-500 focus:outline-none transition" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-300 mb-1.5">사용량 <span className="text-red-400">*</span></label>
          <input type="number" min="0" step="0.1" value={usage} onChange={e => setUsage(e.target.value)}
            placeholder={utilityType === 'gas' ? '예: 234.5' : '예: 1234'}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none transition" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">단위</label>
          <select value={unit} onChange={e => setUnit(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white focus:border-cyan-500 focus:outline-none transition">
            <option value="kWh">kWh</option>
            <option value="m³">m³</option>
            <option value="MJ">MJ</option>
          </select>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        배출계수: {utilityType === 'electricity' ? '전력 0.4567 kgCO₂/kWh (한국전력 기준)' : '천연가스 2.176 kgCO₂/m³ (K-GHG 프로토콜)'}
      </p>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      <button onClick={handleSubmit} disabled={loading || !usage}
        className="w-full py-3 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2">
        {loading
          ? <><Loader2 className="w-5 h-5 animate-spin" />저장 중...</>
          : <><CheckCircle2 className="w-5 h-5" />배출량 계산 및 저장</>}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// 탭 C: 고객번호 조회
// ─────────────────────────────────────────────

interface CQResult {
  status: string;
  usage?: number;
  unit?: string;
  period?: string;
  recordId?: string;
  emissions?: number;
  message?: string;
  customerName?: string;
  suggestedAction?: string;
}

function TabCustomerQuery({ onSuccess }: { onSuccess: (r: SaveResult) => void }) {
  const [utility, setUtility] = useState<'kepco' | 'gas'>('kepco');
  const [customerNo, setCustomerNo] = useState('');
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CQResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleQuery = async () => {
    if (!customerNo.trim()) { setError('고객번호를 입력해주세요'); return; }
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await apiPost<CQResult>('/api/analytics/carbon/customer-query', {
        utility, customerNo: customerNo.trim(), period, saveRecord: true,
      });
      const data = res.data;
      if (!data) throw new Error('응답 없음');
      setResult(data);
      if (data.status === 'ok' && data.recordId) {
        toast.success(data.message ?? '사용량이 저장되었습니다.');
        onSuccess({
          recordId: data.recordId,
          invoiceType: 'electricity',
          usage: data.usage ?? 0,
          unit: data.unit ?? 'kWh',
          period: data.period ?? period,
          emissions: data.emissions ?? 0,
          emissionsUnit: 'tCO₂eq',
          message: data.message ?? '',
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '조회 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg text-sm text-purple-300">
        <Search className="w-4 h-4 flex-shrink-0" />
        고객번호로 한국전력 사용량을 자동 조회합니다. 고지서 상단의 고객번호를 입력하세요.
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(['kepco', 'gas'] as const).map(u => (
          <button key={u} onClick={() => { setUtility(u); setResult(null); setError(null); }}
            className={`flex items-center justify-center gap-2 py-3 rounded-lg border transition font-medium ${
              utility === u
                ? u === 'kepco' ? 'border-yellow-500 bg-yellow-500/10 text-yellow-300' : 'border-orange-500 bg-orange-500/10 text-orange-300'
                : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500'
            }`}>
            {u === 'kepco' ? <><Zap className="w-5 h-5" />한국전력 (KEPCO)</> : <><Flame className="w-5 h-5" />도시가스</>}
          </button>
        ))}
      </div>

      {utility === 'gas' && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <p className="text-sm font-semibold text-amber-400 flex items-center gap-2 mb-1">
            <AlertCircle className="w-4 h-4" />도시가스 자동 조회 미지원
          </p>
          <p className="text-sm text-slate-400">
            도시가스는 지역별 공급사(서울도시가스, KN에너지 등)에 따라 API가 다릅니다.
            <strong className="text-white"> 직접 입력 탭</strong>에서 고지서 사용량(m³)을 입력해주세요.
          </p>
        </div>
      )}

      {utility === 'kepco' && (
        <>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              고객번호 <span className="text-red-400">*</span>
            </label>
            <input type="text" value={customerNo}
              onChange={e => setCustomerNo(e.target.value.replace(/[^0-9\-]/g, ''))}
              placeholder="예: 1234567890123 (고지서 상단 확인)"
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none transition font-mono"
              maxLength={20} />
            <p className="text-xs text-slate-500 mt-1">
              한국전력 고지서 우측 상단 또는 한전 앱(My한전)에서 확인하세요.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              조회 월 <span className="text-red-400">*</span>
            </label>
            <input type="month" value={period} onChange={e => setPeriod(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white focus:border-cyan-500 focus:outline-none transition" />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}

          {result && (
            <div className={`p-4 rounded-xl border space-y-2 ${
              result.status === 'ok' ? 'bg-emerald-500/10 border-emerald-500/30'
              : result.status === 'api_key_required' ? 'bg-amber-500/10 border-amber-500/30'
              : 'bg-slate-800 border-slate-600'}`}>
              {result.status === 'ok' && (
                <>
                  <p className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />조회 성공
                    {result.customerName && <span className="text-white font-normal">— {result.customerName}</span>}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-slate-900 rounded-lg p-2">
                      <p className="text-xs text-slate-500">사용량</p>
                      <p className="font-bold text-white">{result.usage?.toLocaleString()} {result.unit}</p>
                    </div>
                    <div className="bg-slate-900 rounded-lg p-2">
                      <p className="text-xs text-slate-500">배출량</p>
                      <p className="font-bold text-emerald-400">{result.emissions} tCO₂eq</p>
                    </div>
                  </div>
                </>
              )}
              {result.status === 'api_key_required' && (
                <div>
                  <p className="text-sm font-semibold text-amber-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />API 키 미설정
                  </p>
                  <p className="text-sm text-slate-400 mt-1">{result.message}</p>
                  <p className="text-xs text-slate-500 mt-2">→ <strong className="text-slate-300">직접 입력 탭</strong>에서 고지서의 사용량을 입력해주세요.</p>
                </div>
              )}
              {['not_found', 'api_error', 'manual_required'].includes(result.status) && (
                <div>
                  <p className="text-sm text-slate-300 flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />{result.message}
                  </p>
                  {result.suggestedAction === 'manual_input' && (
                    <p className="text-xs text-slate-500 mt-2">→ <strong className="text-slate-300">직접 입력 탭</strong>에서 사용량을 입력해주세요.</p>
                  )}
                </div>
              )}
            </div>
          )}

          <button onClick={handleQuery}
            disabled={loading || !customerNo.trim() || result?.status === 'ok'}
            className="w-full py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="w-5 h-5 animate-spin" />조회 중...</>
              : result?.status === 'ok' ? <><CheckCircle2 className="w-5 h-5" />저장 완료</>
              : <><Search className="w-5 h-5" />사용량 조회</>}
          </button>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 단계 2: 데이터 연결 (4탭)
// ─────────────────────────────────────────────

type DataTab = 'file' | 'direct' | 'customer' | 'sensor';

function Step2DataMethod({ siteId: _siteId, onNext, onBack }: {
  siteId: string;
  onNext: (method: DataMethod) => void;
  onBack: () => void;
}) {
  const [activeTab, setActiveTab] = useState<DataTab>('file');
  const [savedResult, setSavedResult] = useState<SaveResult | null>(null);

  const tabs: Array<{ id: DataTab; label: string; icon: React.ReactNode; badge?: string }> = [
    { id: 'file',     label: '고지서 업로드', icon: <Upload className="w-4 h-4" />,  badge: '자동' },
    { id: 'direct',   label: '직접 입력',     icon: <FileText className="w-4 h-4" />, badge: '즉시' },
    { id: 'customer', label: '고객번호',      icon: <Search className="w-4 h-4" />,  badge: 'API' },
    { id: 'sensor',   label: 'IoT 센서',      icon: <Wifi className="w-4 h-4" /> },
  ];

  const handleDataSaved = useCallback((r: SaveResult) => {
    setSavedResult(r);
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
        <AlertCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-slate-300">
          에너지 사용량 데이터를 등록하면 즉시 탄소 배출량이 계산됩니다.
          <strong className="text-white"> 건너뛰기</strong>로 나중에 설정할 수도 있습니다.
        </p>
      </div>

      {/* 탭 바 */}
      <div className="grid grid-cols-4 gap-1 bg-slate-800 rounded-xl p-1">
        {tabs.map(tab => (
          <button key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSavedResult(null); }}
            className={`relative flex flex-col items-center gap-1 py-2.5 px-1 rounded-lg transition text-xs font-medium ${
              activeTab === tab.id ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'
            }`}>
            {tab.icon}
            <span className="leading-tight text-center">{tab.label}</span>
            {tab.badge && (
              <span className="absolute -top-1 -right-1 text-[9px] bg-cyan-500 text-white rounded px-1 leading-4">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 저장 완료 배너 */}
      {savedResult && (
        <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/50 rounded-xl">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-400">데이터 저장 완료</p>
            <p className="text-xs text-slate-400 truncate">{savedResult.message}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-bold text-white">{savedResult.emissions} tCO₂eq</p>
            <p className="text-xs text-slate-500">{savedResult.period}</p>
          </div>
        </div>
      )}

      {/* 탭 콘텐츠 */}
      {activeTab === 'file'     && <TabFileUpload     onSuccess={handleDataSaved} />}
      {activeTab === 'direct'   && <TabDirectInput    onSuccess={handleDataSaved} />}
      {activeTab === 'customer' && <TabCustomerQuery  onSuccess={handleDataSaved} />}
      {activeTab === 'sensor' && (
        <div className="space-y-4">
          <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
            <p className="text-sm font-semibold text-purple-400 flex items-center gap-2 mb-2">
              <Wifi className="w-4 h-4" />IoT 센서/PLC 연동 — 완전 자동화
            </p>
            <ul className="text-sm text-slate-400 space-y-1 list-disc list-inside">
              <li>전력계, PLC, BMS와 직접 연동하여 실시간 자동 수집</li>
              <li>AI 이상 탐지 및 수요 예측 활성화</li>
              <li>초기 게이트웨이 장치 설치 및 현장 설정 필요</li>
            </ul>
          </div>
          <div className="p-4 bg-slate-800 border border-slate-700 rounded-xl space-y-2">
            <p className="text-sm font-semibold text-white">연동 순서</p>
            <ol className="text-sm text-slate-400 space-y-1 list-decimal list-inside">
              <li>게이트웨이 장치 구매 또는 현장 설치 (별도 문의)</li>
              <li>설정 → 게이트웨이 관리에서 장치 등록</li>
              <li>현장 PLC/BMS와 Modbus/BACnet/OPC-UA 연결</li>
              <li>데이터 수집 시작 → 자동 탄소 계산 활성화</li>
            </ol>
            <a href="mailto:support@carboneum.kr" className="text-xs text-cyan-400 hover:underline">
              전문가 설치 지원 문의 →
            </a>
          </div>
        </div>
      )}

      {/* 하단 버튼 */}
      <div className="flex gap-3 pt-2">
        <button onClick={onBack}
          className="flex-none py-3 px-4 border border-slate-600 hover:border-slate-400 text-slate-300 font-semibold rounded-xl transition flex items-center gap-2">
          <ChevronLeft className="w-5 h-5" />이전
        </button>
        <button
          onClick={() => onNext(
            activeTab === 'sensor' ? 'sensor'
            : savedResult ? 'invoice'
            : 'skip'
          )}
          className={`flex-1 py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2 ${
            savedResult || activeTab === 'sensor'
              ? 'bg-cyan-500 hover:bg-cyan-600 text-white'
              : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
          }`}>
          {savedResult
            ? <><CheckCircle className="w-5 h-5" />완료 — 다음 단계</>
            : activeTab === 'sensor'
            ? <>설정 안내 보기<ChevronRight className="w-5 h-5" /></>
            : <>건너뛰고 다음 단계<ChevronRight className="w-5 h-5" /></>}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 단계 3: 완료
// ─────────────────────────────────────────────

function Step3Complete({ dataMethod, onFinish }: { dataMethod: DataMethod; onFinish: () => void }) {
  const router = useRouter();
  const isSensor = dataMethod === 'sensor';
  const isSkipped = dataMethod === 'skip';

  const quickActions = isSensor
    ? [
        { icon: <Plug className="w-5 h-5" />,    label: '게이트웨이 등록',  href: '/settings/gateways',   color: 'text-purple-400' },
        { icon: <BarChart3 className="w-5 h-5" />,label: '대시보드',        href: '/dashboard',            color: 'text-cyan-400' },
        { icon: <FileText className="w-5 h-5" />, label: '설치 가이드',     href: '/manual',               color: 'text-slate-400' },
      ]
    : [
        { icon: <BarChart3 className="w-5 h-5" />,label: '탄소 배출 현황',   href: '/analytics/carbon',    color: 'text-emerald-400' },
        { icon: <FileText className="w-5 h-5" />, label: '추가 데이터 등록', href: '/analytics/carbon',    color: 'text-cyan-400' },
        { icon: <Building2 className="w-5 h-5" />,label: '사이트 관리',      href: '/sites',               color: 'text-slate-400' },
      ];

  return (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <div className="w-20 h-20 bg-emerald-500/20 border border-emerald-500/50 rounded-full flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-emerald-400" />
        </div>
      </div>
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">
          {isSensor ? '설정 완료 — 연동 대기 중' : isSkipped ? '설정 완료' : '데이터 등록 완료!'}
        </h2>
        <p className="text-slate-400">
          {isSensor ? '게이트웨이 장치를 연결하면 실시간 모니터링이 시작됩니다.'
            : isSkipped ? '나중에 탄소 배출 분석 페이지에서 데이터를 등록할 수 있습니다.'
            : '탄소 배출량 계산이 활성화되었습니다.'}
        </p>
      </div>

      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border font-medium text-sm ${
        isSensor ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
        : isSkipped ? 'bg-slate-800 border-slate-600 text-slate-400'
        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}>
        <Wifi className="w-4 h-4" />
        {isSensor ? '데이터 연결 대기 중' : isSkipped ? '데이터 미연결' : '데이터 수집 준비 완료'}
      </div>

      {isSensor && (
        <div className="text-left p-4 bg-slate-800 border border-amber-500/20 rounded-xl space-y-2">
          <p className="text-sm font-semibold text-amber-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />IoT 센서 연동 안내
          </p>
          <ol className="text-sm text-slate-400 space-y-1 list-decimal list-inside">
            <li>게이트웨이 장치 구매 또는 현장 설치</li>
            <li>설정 → 게이트웨이 관리에서 장치 등록</li>
            <li>현장 PLC/BMS와 Modbus/BACnet/OPC-UA 연결</li>
            <li>데이터 수집 시작 → 자동 탄소 계산</li>
          </ol>
          <a href="mailto:support@carboneum.kr" className="text-xs text-cyan-400 hover:underline">
            전문가 설치 지원 문의 →
          </a>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {quickActions.map(a => (
          <button key={a.label} onClick={() => router.push(a.href)}
            className="p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-center transition">
            <div className={`flex justify-center mb-1 ${a.color}`}>{a.icon}</div>
            <p className="text-xs text-slate-300">{a.label}</p>
          </button>
        ))}
      </div>

      <button onClick={onFinish}
        className="w-full py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2">
        대시보드로 이동 <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// 메인 온보딩 페이지
// ─────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [siteId, setSiteId] = useState('');
  const [dataMethod, setDataMethod] = useState<DataMethod>(null);

  const updateStep = async (step: number) => {
    setCurrentStep(step);
    await apiPut('/api/onboarding', { step }).catch(() => null);
  };

  const handleFinish = async () => {
    try { await apiPut('/api/onboarding', { complete: true, dataMethod }); } catch { /* ignore */ }
    router.push('/dashboard');
  };

  const handleSkip = async () => {
    try { await apiPut('/api/onboarding', { complete: true }); } catch { /* ignore */ }
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#040e1c] via-[#051225] to-[#040e1c] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <Link2 className="w-6 h-6 text-cyan-400" />
            <span className="text-xl font-bold text-white">탄소이음</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">서비스 시작 설정</h1>
          <p className="text-slate-400 text-sm">몇 가지 설정으로 에너지 관리를 시작합니다</p>
        </div>

        {/* 진행 표시 */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((step, idx) => (
            <div key={step.id} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 ${currentStep > step.id ? 'opacity-70' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                  currentStep === step.id ? 'border-cyan-500 bg-cyan-500 text-white'
                  : currentStep > step.id ? 'border-emerald-500 bg-emerald-500 text-white'
                  : 'border-slate-600 bg-slate-800 text-slate-500'}`}>
                  {currentStep > step.id ? <CheckCircle className="w-4 h-4" /> : step.id}
                </div>
                <div className="hidden sm:block">
                  <p className={`text-xs font-semibold ${currentStep === step.id ? 'text-cyan-400' : 'text-slate-500'}`}>
                    {step.title}
                  </p>
                </div>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`w-8 h-0.5 ${currentStep > step.id ? 'bg-emerald-500' : 'bg-slate-700'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 md:p-8 shadow-xl">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white">{STEPS[currentStep - 1]?.title}</h2>
            <p className="text-sm text-slate-400">{STEPS[currentStep - 1]?.desc}</p>
          </div>

          {currentStep === 1 && (
            <Step1Site onNext={id => { setSiteId(id); updateStep(2); }} />
          )}
          {currentStep === 2 && (
            <Step2DataMethod
              siteId={siteId}
              onNext={method => { setDataMethod(method); updateStep(3); }}
              onBack={() => updateStep(1)}
            />
          )}
          {currentStep === 3 && (
            <Step3Complete dataMethod={dataMethod} onFinish={handleFinish} />
          )}
        </div>

        {currentStep < 3 && (
          <p className="text-center mt-4">
            <button onClick={handleSkip} className="text-sm text-slate-500 hover:text-slate-300 transition underline">
              건너뛰고 대시보드로 이동
            </button>
          </p>
        )}

        <div className="mt-6 p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
          <p className="text-xs text-slate-500 text-center leading-relaxed">
            탄소이음은 <strong className="text-slate-400">설정형 SaaS</strong>입니다.
            고지서 업로드 및 직접 입력은 즉시 사용 가능하며,
            IoT 연동은 현장 게이트웨이 설치 후 실시간 모니터링이 활성화됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
