'use client';
/**
 * 온보딩 위저드 — 구독 후 첫 설정 가이드
 * 3단계: 사이트 등록 → 데이터 연결 방식 → 탄소 계산 활성화
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2, FileText, ChevronRight, ChevronLeft,
  CheckCircle, Upload, Wifi, AlertCircle, ArrowRight,
  BarChart3, Plug, Link2, PenLine, Zap, Loader2,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { apiPost, apiPut, ApiError, getCsrfToken } from '@/lib/api/client';
import { toast } from '@/lib/toast';

// ─────────────────────────────────────────────
// 단계 정의
// ─────────────────────────────────────────────

const STEPS = [
  { id: 1, title: '사이트 등록', desc: '첫 사업장을 등록합니다' },
  { id: 2, title: '데이터 연결', desc: '에너지 데이터 수집 방법을 선택합니다' },
  { id: 3, title: '탄소 계산 활성화', desc: '배출량 계산을 시작합니다' },
] as const;

type DataMethod = 'invoice' | 'manual' | 'sensor' | null;

// ─────────────────────────────────────────────
// 단계 1: 사이트 등록
// ─────────────────────────────────────────────

function Step1Site({ onNext }: { onNext: (siteId: string) => void }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [industryType, setIndustryType] = useState('office');
  const [loading, setLoading] = useState(false);
  const [limitError, setLimitError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error('사이트 이름을 입력해주세요.'); return; }
    setLoading(true);
    setLimitError(null);
    try {
      const res = await apiPost<{ id: string }>('/api/sites', { name: name.trim(), address, siteType: industryType });
      toast.success(`사이트 "${name}"이 등록되었습니다.`);
      onNext(res.data?.id ?? '');
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        // 플랜 한도 초과 — 인라인 메시지로 업그레이드/건너뛰기 안내
        setLimitError(err.message);
      } else {
        toast.error(err instanceof ApiError ? err.message : '사이트 등록 중 오류가 발생했습니다.');
      }
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

      {/* 플랜 한도 초과 인라인 안내 */}
      {limitError && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-amber-300 mb-3">{limitError}</p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => router.push('/settings/subscription')}
                  className="text-xs font-medium text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1 transition"
                >
                  플랜 업그레이드 <ArrowRight className="w-3 h-3" />
                </button>
                <span className="text-slate-700 text-xs">·</span>
                <button
                  onClick={() => onNext('')}
                  className="text-xs text-slate-400 hover:text-slate-300 hover:underline transition"
                >
                  기존 사업장으로 계속 진행
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            사이트 이름 <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="예: 본사 건물, 제1공장, 물류센터"
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none transition"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">주소</label>
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="예: 서울특별시 강남구 테헤란로 123"
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none transition"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">업종 분류</label>
          <select
            value={industryType}
            onChange={e => setIndustryType(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white focus:border-cyan-500 focus:outline-none transition"
          >
            <option value="office">사무소/건물</option>
            <option value="factory">공장/제조</option>
            <option value="warehouse">물류/창고</option>
            <option value="retail">소매/상업</option>
            <option value="mixed">복합시설</option>
          </select>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading || !name.trim()}
        className="w-full py-3 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2"
      >
        {loading ? '등록 중...' : '사이트 등록하기'}
        {!loading && <ChevronRight className="w-5 h-5" />}
      </button>

      <p className="text-center text-sm text-slate-500">
        나중에 설정 → 사이트 관리에서도 추가할 수 있습니다.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// 단계 2: 데이터 연결 방식 선택 (탭 기반)
// ─────────────────────────────────────────────

function Step2DataMethod({ siteId, onNext, onBack }: { siteId: string; onNext: (method: DataMethod) => void; onBack: () => void }) {
  type Tab = 'invoice' | 'manual' | 'sensor';
  const [activeTab, setActiveTab] = useState<Tab>('invoice');

  // ── 고지서 업로드 탭 ──
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [uploading, setUploading]     = useState(false);

  // ── 수동 입력 탭 ──
  const [energyType,       setEnergyType]       = useState<'electricity' | 'gas'>('electricity');
  const [usageAmount,      setUsageAmount]       = useState('');
  const [period,           setPeriod]            = useState(new Date().toISOString().slice(0, 7));
  const [manualSubmitting, setManualSubmitting]  = useState(false);
  const [manualError,      setManualError]       = useState<string | null>(null);
  const [manualDone,       setManualDone]        = useState(false);

  // ── 핸들러: 고지서 업로드 ──
  const handleInvoiceUpload = async () => {
    if (!invoiceFile) return;
    setUploading(true);
    try {
      const csrfToken = await getCsrfToken();
      const formData  = new FormData();
      formData.append('file',   invoiceFile);
      formData.append('siteId', siteId);
      const res = await fetch('/api/analytics/carbon/invoice', {
        method:      'POST',
        headers:     { 'X-CSRF-Token': csrfToken },
        credentials: 'include',
        body:        formData,
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as Record<string, unknown>;
        throw new Error(String(json.error ?? json.message ?? `업로드 실패 (HTTP ${res.status})`));
      }
      toast.success('고지서가 업로드되었습니다. AI 배출량 계산이 시작됩니다.');
      onNext('invoice');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '파일 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  };

  // ── 핸들러: 수동 입력 ──
  const handleManualSubmit = async () => {
    if (!usageAmount) { setManualError('사용량을 입력해주세요.'); return; }
    setManualError(null);
    setManualSubmitting(true);
    try {
      await apiPost('/api/analytics/carbon/register-fuel', {
        sourceType: energyType === 'electricity' ? 'ELECTRICITY' : 'GAS',
        amount:     Number(usageAmount),
        unit:       energyType === 'electricity' ? 'kWh' : 'm3',
        period,
      });
      setManualDone(true);
      toast.success('에너지 사용량이 등록되었습니다.');
      setTimeout(() => onNext('manual'), 1200);
    } catch (e) {
      setManualError(e instanceof ApiError ? e.message : '등록 중 오류가 발생했습니다.');
    } finally {
      setManualSubmitting(false);
    }
  };

  const TABS = [
    { id: 'invoice' as Tab, Icon: FileText, label: '고지서 업로드', badge: '즉시 시작', badgeClass: 'bg-emerald-500/20 text-emerald-400' },
    { id: 'manual'  as Tab, Icon: PenLine,  label: '수동 입력',    badge: '직접 입력', badgeClass: 'bg-blue-500/20 text-blue-400' },
    { id: 'sensor'  as Tab, Icon: Zap,      label: 'IoT 연동',     badge: '완전 자동', badgeClass: 'bg-purple-500/20 text-purple-400' },
  ] as const;

  return (
    <div className="space-y-5">
      {/* 상단 안내 */}
      <div className="flex items-start gap-3 p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
        <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-slate-300">
          아래 세 가지 방법 중 하나를 선택해 에너지 데이터를 연결하세요.
          나중에 언제든 변경할 수 있습니다.
        </p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex bg-slate-800/70 rounded-xl p-1 gap-1">
        {TABS.map(({ id, Icon, label, badge, badgeClass }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 px-2 rounded-lg text-center transition-all ${
              activeTab === id
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Icon className="w-4 h-4" />
              <span className="text-xs font-semibold hidden sm:inline">{label}</span>
              <span className="text-xs font-semibold sm:hidden">
                {id === 'invoice' ? '고지서' : id === 'manual' ? '수동' : 'IoT'}
              </span>
            </div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${badgeClass}`}>
              {badge}
            </span>
          </button>
        ))}
      </div>

      {/* ─── 고지서 업로드 탭 ─── */}
      {activeTab === 'invoice' && (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-white mb-1">한국전력 청구서 · 도시가스 고지서 업로드</p>
            <p className="text-xs text-slate-500 mb-3">
              PDF, JPG, PNG, Excel, CSV 지원 — 업로드 즉시 AI가 사용량과 탄소 배출량을 계산합니다
            </p>
            <label className="block cursor-pointer">
              <div className={`border-2 border-dashed rounded-xl p-8 text-center transition ${
                invoiceFile
                  ? 'border-emerald-500/50 bg-emerald-500/5'
                  : 'border-slate-600 hover:border-cyan-500/50 hover:bg-slate-800/50'
              }`}>
                {invoiceFile ? (
                  <>
                    <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                    <p className="text-sm text-emerald-400 font-medium">{invoiceFile.name}</p>
                    <p className="text-xs text-slate-500 mt-1">다른 파일로 변경하려면 클릭</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">파일을 클릭하거나 드래그하여 업로드</p>
                    <p className="text-xs text-slate-600 mt-1">최대 10MB</p>
                  </>
                )}
              </div>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.xlsx,.csv"
                className="hidden"
                onChange={e => setInvoiceFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          {invoiceFile && (
            <button
              onClick={handleInvoiceUpload}
              disabled={uploading}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2"
            >
              {uploading
                ? <><Loader2 className="w-4 h-4 animate-spin" />업로드 중...</>
                : <><Upload className="w-4 h-4" />지금 업로드하기</>}
            </button>
          )}
          <p className="text-xs text-center text-slate-600">
            고지서 없이 진행하려면 아래 "다음 단계" 버튼을 클릭하세요
          </p>
        </div>
      )}

      {/* ─── 수동 입력 탭 ─── */}
      {activeTab === 'manual' && (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-white mb-1">월간 에너지 사용량 직접 입력</p>
            <p className="text-xs text-slate-500 mb-3">
              고지서 없이 알고 있는 사용량을 입력하면 즉시 탄소 배출량을 계산합니다
            </p>
          </div>

          {/* 에너지 종류 선택 */}
          <div className="flex gap-2">
            {([
              { val: 'electricity' as const, label: '전기', unit: 'kWh', icon: '⚡' },
              { val: 'gas'         as const, label: '도시가스', unit: 'm³', icon: '🔥' },
            ]).map(({ val, label, unit, icon }) => (
              <button
                key={val}
                onClick={() => { setEnergyType(val); setManualError(null); }}
                className={`flex-1 py-2.5 px-3 rounded-lg border text-sm font-medium transition flex items-center justify-center gap-2 ${
                  energyType === val
                    ? 'border-cyan-500 bg-cyan-500/15 text-cyan-300'
                    : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                }`}
              >
                <span>{icon}</span>
                {label} ({unit})
              </button>
            ))}
          </div>

          {/* 사용량 + 기간 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">
                사용량 ({energyType === 'electricity' ? 'kWh' : 'm³'})
              </label>
              <input
                type="number" min="0" step="1"
                value={usageAmount}
                onChange={e => { setUsageAmount(e.target.value); setManualError(null); }}
                placeholder="예: 850"
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none transition"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">사용 기간 (월)</label>
              <input
                type="month"
                value={period}
                onChange={e => setPeriod(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:border-cyan-500 focus:outline-none transition"
              />
            </div>
          </div>

          {manualError && (
            <p className="text-xs text-red-400 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />{manualError}
            </p>
          )}
          {manualDone && (
            <p className="text-xs text-emerald-400 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" />등록 완료! 배출량 계산이 시작됩니다.
            </p>
          )}

          <button
            onClick={handleManualSubmit}
            disabled={manualSubmitting || manualDone || !usageAmount}
            className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2"
          >
            {manualSubmitting
              ? <><Loader2 className="w-4 h-4 animate-spin" />등록 중...</>
              : manualDone
              ? <><CheckCircle className="w-4 h-4" />등록 완료</>
              : <><PenLine className="w-4 h-4" />사용량 등록하기</>}
          </button>
          <p className="text-xs text-center text-slate-600">
            여러 달의 데이터는 탄소 배출 현황 페이지에서 추가 입력 가능합니다
          </p>
        </div>
      )}

      {/* ─── IoT 연동 탭 ─── */}
      {activeTab === 'sensor' && (
        <div className="space-y-4">
          <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
            <p className="text-sm font-semibold text-purple-400 flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4" /> IoT 센서/PLC 자동 연동
            </p>
            <p className="text-xs text-slate-400 mb-3">
              전력계, PLC, BMS 등 현장 장비와 직접 연동하면 데이터가 자동으로 수집됩니다.
              AI 이상 탐지와 부하 예측이 활성화됩니다.
            </p>
            <ol className="text-xs text-slate-400 space-y-1.5 list-decimal list-inside">
              <li>게이트웨이 장치 구매 / 현장 설치 (별도 문의)</li>
              <li>설정 → 게이트웨이 관리에서 장치 등록</li>
              <li>현장 장비와 Modbus/BACnet/OPC-UA 연결</li>
              <li>데이터 수집 시작 → 자동 탄소 계산</li>
            </ol>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: '실시간 모니터링', icon: '📡', desc: '1분 주기' },
              { label: 'AI 이상 탐지',   icon: '🤖', desc: '자동 알림' },
              { label: '탄소 자동 계산', icon: '🌱', desc: '무인 운영' },
            ].map(f => (
              <div key={f.label} className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-xl">
                <div className="text-2xl mb-1">{f.icon}</div>
                <p className="text-xs font-medium text-white">{f.label}</p>
                <p className="text-[10px] text-slate-500">{f.desc}</p>
              </div>
            ))}
          </div>

          <a
            href="mailto:carbonieum.official@gmail.com"
            className="block w-full py-3 text-center border border-purple-500/30 text-purple-400 hover:bg-purple-500/10 font-medium text-sm rounded-xl transition"
          >
            전문가 설치 지원 문의 →
          </a>
        </div>
      )}

      {/* 네비게이션 */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-5 py-3 border border-slate-600 hover:border-slate-400 text-slate-300 font-semibold rounded-xl transition"
        >
          <ChevronLeft className="w-5 h-5" /> 이전
        </button>
        <button
          onClick={() => onNext(activeTab)}
          className="flex-1 py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2"
        >
          다음 단계 <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <p className="text-center text-xs text-slate-600">
        데이터 연동은 나중에 설정 → 게이트웨이 관리에서도 변경할 수 있습니다
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// 단계 3: 탄소 계산 활성화 / 완료
// ─────────────────────────────────────────────

// onFinish(href?) — href 없으면 /dashboard 기본값
function Step3Complete({ dataMethod, onFinish }: { dataMethod: DataMethod; onFinish: (href?: string) => void }) {
  const isSensorMethod = dataMethod === 'sensor';

  const quickActions = isSensorMethod
    ? [
        { icon: <Plug className="w-5 h-5" />, label: '게이트웨이 등록', href: '/settings/gateways', color: 'text-purple-400' },
        { icon: <BarChart3 className="w-5 h-5" />, label: '대시보드 보기', href: '/dashboard', color: 'text-cyan-400' },
        { icon: <FileText className="w-5 h-5" />, label: '설치 가이드', href: '/manual', color: 'text-slate-400' },
      ]
    : [
        { icon: <BarChart3 className="w-5 h-5" />, label: '탄소 배출 현황', href: '/analytics/carbon', color: 'text-emerald-400' },
        { icon: <FileText className="w-5 h-5" />, label: '고지서 추가 업로드', href: '/analytics/carbon', color: 'text-cyan-400' },
        { icon: <Building2 className="w-5 h-5" />, label: '사이트 관리', href: '/sites', color: 'text-slate-400' },
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
          {isSensorMethod ? '설정 완료 — 연동 대기 중' : '설정 완료!'}
        </h2>
        <p className="text-slate-400">
          {isSensorMethod
            ? '게이트웨이 장치를 연결하면 실시간 모니터링이 시작됩니다.'
            : '탄소 배출량 계산이 활성화되었습니다. 데이터를 분석해보세요.'}
        </p>
      </div>

      {/* 데이터 연결 상태 배지 */}
      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border font-medium text-sm ${
        isSensorMethod
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
      }`}>
        <Wifi className="w-4 h-4" />
        {isSensorMethod ? '데이터 연결 대기 중' : '데이터 수집 준비 완료'}
      </div>

      {/* 센서 연동 안내 */}
      {isSensorMethod && (
        <div className="text-left p-4 bg-slate-800 border border-amber-500/20 rounded-xl space-y-2">
          <p className="text-sm font-semibold text-amber-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> IoT 센서 연동 안내
          </p>
          <ol className="text-sm text-slate-400 space-y-1 list-decimal list-inside">
            <li>게이트웨이 장치 구매 또는 현장 설치 (별도 문의)</li>
            <li>설정 → 게이트웨이 관리에서 장치 등록</li>
            <li>현장 PLC/BMS와 Modbus/BACnet/OPC-UA 프로토콜 연결</li>
            <li>데이터 수집 시작 → 자동 탄소 계산</li>
          </ol>
          <a href="mailto:support@carboneum.kr" className="text-xs text-cyan-400 hover:underline">
            전문가 설치 지원 문의 →
          </a>
        </div>
      )}

      {/* 빠른 이동 — onFinish(href)로 먼저 onboarding 완료 처리 후 이동 */}
      <div className="grid grid-cols-3 gap-3">
        {quickActions.map(a => (
          <button
            key={a.label}
            onClick={() => onFinish(a.href)}
            className="p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-center transition"
          >
            <div className={`flex justify-center mb-1 ${a.color}`}>{a.icon}</div>
            <p className="text-xs text-slate-300">{a.label}</p>
          </button>
        ))}
      </div>

      <button
        onClick={() => onFinish('/dashboard')}
        className="w-full py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2"
      >
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
  const { update: updateSession } = useSession();
  const [currentStep, setCurrentStep] = useState(1);
  const [siteId, setSiteId] = useState('');
  const [dataMethod, setDataMethod] = useState<DataMethod>(null);

  // 단계 이동 시 서버에 진행 상태 기록
  const updateStep = async (step: number) => {
    setCurrentStep(step);
    await apiPut('/api/onboarding', { step }).catch(() => null);
  };

  const handleFinish = async (href = '/dashboard') => {
    try {
      await apiPut('/api/onboarding', { complete: true, dataMethod });
      // JWT의 onboardingCompleted를 즉시 갱신 — 미들웨어 리다이렉트 루프 방지
      await updateSession();
    } catch {
      // 완료 기록 실패해도 이동은 허용
    }
    router.push(href);
  };

  const handleSkip = async () => {
    try {
      await apiPut('/api/onboarding', { complete: true });
      // JWT의 onboardingCompleted를 즉시 갱신
      await updateSession();
    } catch { /* 무시 */ }
    router.push('/dashboard');
  };

  return (
    <div className="h-full bg-gradient-to-b from-[#040e1c] via-[#051225] to-[#040e1c] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">

        {/* 헤더 브랜드 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <Link2 className="w-6 h-6 text-cyan-400" />
            <span className="text-xl font-bold text-white">탄소이음</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">서비스 시작 설정</h1>
          <p className="text-slate-400 text-sm">몇 가지 설정으로 에너지 관리를 시작합니다</p>
        </div>

        {/* 진행 단계 표시 */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((step, idx) => (
            <div key={step.id} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 ${currentStep > step.id ? 'opacity-60' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                  currentStep === step.id
                    ? 'border-cyan-500 bg-cyan-500 text-white'
                    : currentStep > step.id
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-slate-600 bg-slate-800 text-slate-500'
                }`}>
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

        {/* 현재 단계 카드 */}
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

        {/* 건너뛰기 */}
        {currentStep < 3 && (
          <p className="text-center mt-4">
            <button
              onClick={handleSkip}
              className="text-sm text-slate-500 hover:text-slate-300 transition underline"
            >
              건너뛰고 대시보드로 이동
            </button>
          </p>
        )}

        {/* 기대치 관리 안내 */}
        <div className="mt-6 p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
          <p className="text-xs text-slate-500 text-center leading-relaxed">
            탄소이음은 <strong className="text-slate-400">설정형 SaaS</strong>입니다.
            데이터 연동에는 별도 설정이 필요하며, 고지서 업로드는 즉시 사용 가능합니다.
            IoT 연동은 현장 게이트웨이 설치 후 실시간 모니터링이 활성화됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
