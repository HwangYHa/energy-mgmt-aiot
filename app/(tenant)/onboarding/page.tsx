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
  BarChart3, Clock, Plug, Link2,
} from 'lucide-react';
import { apiPost, apiPut } from '@/lib/api/client';
import { toast } from '@/lib/toast';

// ─────────────────────────────────────────────
// 단계 정의
// ─────────────────────────────────────────────

const STEPS = [
  { id: 1, title: '사이트 등록', desc: '첫 사업장을 등록합니다' },
  { id: 2, title: '데이터 연결', desc: '에너지 데이터 수집 방법을 선택합니다' },
  { id: 3, title: '탄소 계산 활성화', desc: '배출량 계산을 시작합니다' },
] as const;

type DataMethod = 'invoice' | 'file' | 'sensor' | null;

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
      const res = await apiPost<{ id: string }>('/api/sites', { name: name.trim(), address, industryType });
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
            <option value="building">건물/사무소</option>
            <option value="manufacturing">제조업</option>
            <option value="industrial_complex">산업단지</option>
            <option value="datacenter">데이터센터</option>
            <option value="other">기타</option>
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
// 단계 2: 데이터 연결 방식 선택
// ─────────────────────────────────────────────

function Step2DataMethod({ siteId, onNext, onBack }: { siteId: string; onNext: (method: DataMethod) => void; onBack: () => void }) {
  const [selected, setSelected] = useState<DataMethod>(null);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const methods = [
    {
      id: 'invoice' as DataMethod,
      icon: <FileText className="w-8 h-8" />,
      title: '고지서 업로드',
      badge: '즉시 시작',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      desc: '한국전력 청구서 또는 도시가스 고지서를 업로드하면 즉시 탄소 배출량을 계산합니다.',
      pros: ['설치 없이 즉시 시작', '과거 데이터 소급 입력 가능', '고지서 기반 정확한 사용량'],
      cons: ['월 1회 수동 업로드 필요'],
    },
    {
      id: 'file' as DataMethod,
      icon: <Upload className="w-8 h-8" />,
      title: 'Excel/CSV 일괄 업로드',
      badge: '반자동',
      badgeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      desc: '에너지 사용량 데이터를 Excel 파일로 일괄 업로드합니다.',
      pros: ['대량 데이터 일괄 처리', '기존 ERP/시스템 연동 가능'],
      cons: ['데이터 정제 작업 필요'],
    },
    {
      id: 'sensor' as DataMethod,
      icon: <Wifi className="w-8 h-8" />,
      title: 'IoT 센서/PLC 연동',
      badge: '완전 자동화',
      badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      desc: '전력계, PLC, BMS 등과 직접 연동하여 실시간 자동 수집합니다.',
      pros: ['실시간 모니터링', '자동 배출량 계산', 'AI 예측·이상탐지 활성화'],
      cons: ['초기 설치 필요 (게이트웨이 장치)', '현장 환경 설정 필요'],
    },
  ];

  const handleInvoiceUpload = async () => {
    if (!invoiceFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', invoiceFile);
      formData.append('siteId', siteId);
      const res = await fetch('/api/analytics/carbon/invoice', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('업로드 실패');
      toast.success('고지서가 업로드되었습니다. 배출량 계산이 시작됩니다.');
      onNext('invoice');
    } catch {
      toast.error('파일 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
        <AlertCircle className="w-6 h-6 text-emerald-400 flex-shrink-0" />
        <p className="text-sm text-slate-300">
          <strong className="text-emerald-400">안내:</strong> 데이터 연동은 구독과 별도로 설정이 필요합니다.
          고지서 업로드는 설치 없이 즉시 시작할 수 있습니다.
        </p>
      </div>

      <div className="space-y-3">
        {methods.map(m => (
          <div
            key={m.id}
            onClick={() => setSelected(m.id)}
            className={`p-5 border rounded-xl cursor-pointer transition-all ${
              selected === m.id
                ? 'border-cyan-500 bg-cyan-500/10'
                : 'border-slate-700 bg-slate-800/50 hover:border-slate-500'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`p-2 rounded-lg ${selected === m.id ? 'text-cyan-400 bg-cyan-500/20' : 'text-slate-400 bg-slate-700'}`}>
                {m.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-white font-semibold">{m.title}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${m.badgeColor}`}>
                    {m.badge}
                  </span>
                </div>
                <p className="text-sm text-slate-400 mb-2">{m.desc}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {m.pros.map(p => (
                    <span key={p} className="text-xs text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> {p}
                    </span>
                  ))}
                  {m.cons.map(c => (
                    <span key={c} className="text-xs text-amber-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {c}
                    </span>
                  ))}
                </div>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
                selected === m.id ? 'border-cyan-500 bg-cyan-500' : 'border-slate-600'
              }`}>
                {selected === m.id && <div className="w-2 h-2 bg-white rounded-full" />}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 고지서 업로드 UI */}
      {selected === 'invoice' && (
        <div className="p-4 bg-slate-800 border border-slate-600 rounded-xl space-y-3">
          <p className="text-sm font-medium text-white">고지서 파일 첨부</p>
          <p className="text-xs text-slate-400">한국전력 전기요금 청구서, 도시가스 고지서 (PDF, JPG, PNG 지원)</p>
          <label className="block">
            <div className="border-2 border-dashed border-slate-600 hover:border-cyan-500 rounded-lg p-6 text-center cursor-pointer transition">
              <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <p className="text-sm text-slate-400">
                {invoiceFile ? invoiceFile.name : '파일을 클릭하거나 드래그하여 업로드'}
              </p>
            </div>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.xlsx,.csv"
              className="hidden"
              onChange={e => setInvoiceFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {invoiceFile && (
            <button
              onClick={handleInvoiceUpload}
              disabled={uploading}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 text-white font-semibold rounded-lg transition"
            >
              {uploading ? '업로드 중...' : '지금 업로드하기'}
            </button>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3 border border-slate-600 hover:border-slate-400 text-slate-300 font-semibold rounded-xl transition flex items-center justify-center gap-2"
        >
          <ChevronLeft className="w-5 h-5" /> 이전
        </button>
        <button
          onClick={() => selected && onNext(selected)}
          disabled={!selected}
          className="flex-2 flex-1 py-3 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2"
        >
          {selected === 'invoice' && invoiceFile ? '업로드 완료' :
           selected === 'sensor' ? '설정 안내 보기' : '다음 단계'}
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <p className="text-center text-sm text-slate-500">
        나중에 설정 → 게이트웨이 관리에서도 변경할 수 있습니다.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// 단계 3: 탄소 계산 활성화 / 완료
// ─────────────────────────────────────────────

function Step3Complete({ dataMethod, onFinish }: { dataMethod: DataMethod; onFinish: () => void }) {
  const router = useRouter();

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

      {/* 빠른 이동 */}
      <div className="grid grid-cols-3 gap-3">
        {quickActions.map(a => (
          <button
            key={a.href}
            onClick={() => router.push(a.href)}
            className="p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-center transition"
          >
            <div className={`flex justify-center mb-1 ${a.color}`}>{a.icon}</div>
            <p className="text-xs text-slate-300">{a.label}</p>
          </button>
        ))}
      </div>

      <button
        onClick={onFinish}
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
  const [currentStep, setCurrentStep] = useState(1);
  const [siteId, setSiteId] = useState('');
  const [dataMethod, setDataMethod] = useState<DataMethod>(null);

  // 단계 이동 시 서버에 진행 상태 기록
  const updateStep = async (step: number) => {
    setCurrentStep(step);
    await apiPut('/api/onboarding', { step }).catch(() => null);
  };

  const handleFinish = async () => {
    try {
      await apiPut('/api/onboarding', { complete: true, dataMethod });
    } catch {
      // 완료 기록 실패해도 대시보드로 이동
    }
    router.push('/dashboard');
  };

  const handleSkip = async () => {
    try {
      await apiPut('/api/onboarding', { complete: true });
    } catch { /* 무시 */ }
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#040e1c] via-[#051225] to-[#040e1c] flex items-center justify-center px-4 py-12">
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
