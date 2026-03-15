'use client';

/**
 * app/(tenant)/admin/sandbox/page.tsx
 *
 * Super Admin — 규제 샌드박스 관리 페이지
 *
 * 규제 샌드박스 (Regulatory Sandbox):
 * 신기술·신서비스를 기존 규제에서 일시적으로 면제받아 실증할 수 있는 제도
 *
 * - 슈퍼 관리자: 전체 신청 목록 조회 + 심사(승인/반려/검토 중)
 * - 일반 테넌트: 자사 신청 목록 + 신규 신청
 */

import { useEffect, useState, useCallback } from 'react';
import {
  FlaskConical, Shield, RefreshCw, Search, Loader2, X, Plus,
  CheckCircle2, Clock, XCircle, Archive,
  Building2, Calendar, User, Mail, Phone, ClipboardList,
  Edit3,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { apiPost, apiPatch } from '@/lib/api/client';

// ─── 타입 ────────────────────────────────────────────────────────

type SandboxStatus = 'pending' | 'reviewing' | 'approved' | 'rejected' | 'expired' | 'withdrawn';
type RegulationType = 'energy_trading' | 're100' | 'demand_response' | 'carbon_market' | 'ems_new' | 'p2p_energy' | 'other';

interface SandboxItem {
  id: string;
  tenantId: string;
  tenantName: string | null;
  title: string;
  description: string | null;
  regulationType: RegulationType;
  exemptionScope: string | null;
  status: SandboxStatus;
  appliedAt: string;
  reviewStartedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  expireDate: string | null;
  reviewNote: string | null;
  conditions: unknown;
  applicantName: string | null;
  applicantEmail: string | null;
  contactPhone: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Stats {
  pending?: number;
  reviewing?: number;
  approved?: number;
  rejected?: number;
  expired?: number;
  withdrawn?: number;
}

// ─── 상수 ────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<SandboxStatus, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  pending:    { label: '신청 접수',   color: 'text-gray-400',    bg: 'bg-gray-700/40',    icon: Clock        },
  reviewing:  { label: '검토 중',     color: 'text-amber-400',   bg: 'bg-amber-900/30',   icon: ClipboardList },
  approved:   { label: '승인',        color: 'text-emerald-400', bg: 'bg-emerald-900/30', icon: CheckCircle2 },
  rejected:   { label: '반려',        color: 'text-red-400',     bg: 'bg-red-900/30',     icon: XCircle      },
  expired:    { label: '기간 만료',   color: 'text-slate-400',   bg: 'bg-slate-700/40',   icon: Archive      },
  withdrawn:  { label: '신청 취하',   color: 'text-slate-500',   bg: 'bg-slate-800/60',   icon: X            },
};

const REG_TYPE_CONFIG: Record<RegulationType, { label: string; desc: string }> = {
  energy_trading:   { label: '전력 거래',           desc: 'P2P 전력 거래, 가상발전소(VPP) 등' },
  re100:            { label: 'RE100 / 재생에너지',   desc: 'PPA, 녹색 프리미엄 등 재생에너지 조달' },
  demand_response:  { label: '수요반응(DR)',          desc: '수요자원 거래 및 부하 조정' },
  carbon_market:    { label: '탄소 시장',             desc: 'K-ETS, VCM, 탄소 크레딧 거래' },
  ems_new:          { label: '신규 EMS',              desc: 'IoT 기반 에너지관리시스템 신서비스' },
  p2p_energy:       { label: 'P2P 에너지 거래',       desc: '분산에너지 P2P 직거래' },
  other:            { label: '기타',                  desc: '기타 에너지 관련 규제 특례' },
};

// ─── 메인 컴포넌트 ────────────────────────────────────────────────

export default function SandboxPage() {
  const [items, setItems]             = useState<SandboxItem[]>([]);
  const [stats, setStats]             = useState<Stats | null>(null);
  const [isLoading, setIsLoading]     = useState(true);
  const [filterStatus, setFilterStatus]   = useState('');
  const [filterType, setFilterType]       = useState('');
  const [search, setSearch]           = useState('');
  const [selected, setSelected]       = useState<SandboxItem | null>(null);
  const [showApplyModal, setShowApplyModal]   = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ take: '100' });
      if (filterStatus) params.set('status', filterStatus);
      if (filterType)   params.set('regulationType', filterType);
      const res  = await fetch(`/api/admin/sandbox?${params}`);
      if (res.status === 403) { setAccessDenied(true); return; }
      const json = await res.json();
      if (json.success) {
        setItems(json.data.items ?? []);
        setStats(json.data.stats ?? null);
      }
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, [filterStatus, filterType]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const filteredItems = items.filter((it) =>
    search
      ? it.title.toLowerCase().includes(search.toLowerCase()) ||
        (it.tenantName?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
        (it.applicantName?.toLowerCase().includes(search.toLowerCase()) ?? false)
      : true
  );

  if (accessDenied) {
    return (
      <div className="h-full bg-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">접근 거부</h2>
          <p className="text-slate-400">이 페이지는 시스템 관리자(Super Admin)만 접근할 수 있습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-900 text-white">
      {/* 헤더 */}
      <div className="bg-slate-800/50 border-b border-slate-700 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-500/10 rounded-lg">
            <FlaskConical className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">규제 샌드박스</h1>
            <p className="text-xs text-slate-400">신기술 규제 특례 신청 · 심사 · 관리</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* 통계 카드 */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            {(Object.keys(STATUS_CONFIG) as SandboxStatus[]).map((s) => {
              const cfg = STATUS_CONFIG[s];
              const Icon = cfg.icon;
              const cnt = (stats as Record<string, number>)[s] ?? 0;
              return (
                <button key={s}
                  onClick={() => setFilterStatus(filterStatus === s ? '' : s)}
                  className={`rounded-xl border p-3 text-center transition cursor-pointer ${
                    filterStatus === s
                      ? `${cfg.bg} border-current ${cfg.color}`
                      : 'bg-slate-800 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <Icon className={`w-5 h-5 mx-auto mb-1 ${filterStatus === s ? cfg.color : 'text-slate-400'}`} />
                  <div className={`text-lg font-bold ${filterStatus === s ? cfg.color : 'text-slate-100'}`}>{cnt}</div>
                  <div className="text-[10px] text-slate-400">{cfg.label}</div>
                </button>
              );
            })}
          </div>
        )}

        {/* 툴바 */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="제목·업체명·신청자 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm"
            />
          </div>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">
            <option value="">모든 유형</option>
            {(Object.keys(REG_TYPE_CONFIG) as RegulationType[]).map((k) => (
              <option key={k} value={k}>{REG_TYPE_CONFIG[k].label}</option>
            ))}
          </select>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={fetchItems}
              className="p-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => setShowApplyModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-medium transition">
              <Plus className="w-4 h-4" />
              신규 신청
            </button>
          </div>
        </div>

        {/* 목록 + 상세 */}
        <div className="flex gap-6">
          {/* 목록 */}
          <div className="flex-1 min-w-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-20 text-slate-500">
                <FlaskConical className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>신청 내역이 없습니다</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredItems.map((item) => {
                  const sc  = STATUS_CONFIG[item.status];
                  const rc  = REG_TYPE_CONFIG[item.regulationType];
                  const Sic = sc.icon;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelected(item)}
                      className={`bg-slate-800 rounded-lg border p-4 cursor-pointer transition hover:border-violet-600 ${
                        selected?.id === item.id ? 'border-violet-500' : 'border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className={`p-2 rounded-lg ${sc.bg} flex-shrink-0 mt-0.5`}>
                            <Sic className={`w-4 h-4 ${sc.color}`} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${sc.bg} ${sc.color}`}>{sc.label}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-violet-900/30 text-violet-300">
                                {rc?.label ?? item.regulationType}
                              </span>
                            </div>
                            <div className="font-medium text-slate-100 text-sm mt-1 leading-snug">{item.title}</div>
                            {item.tenantName && (
                              <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                                <Building2 className="w-3 h-3" /> {item.tenantName}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-slate-500 flex-shrink-0">
                          {new Date(item.appliedAt).toLocaleDateString('ko-KR')}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 상세 패널 */}
          {selected && (
            <SandboxDetailPanel
              item={selected}
              onClose={() => setSelected(null)}
              onReview={() => setShowReviewModal(true)}
            />
          )}
        </div>
      </div>

      {/* 신규 신청 모달 */}
      {showApplyModal && (
        <ApplyModal
          onClose={() => setShowApplyModal(false)}
          onCreated={() => { fetchItems(); setShowApplyModal(false); }}
        />
      )}

      {/* 심사 모달 (super admin) */}
      {showReviewModal && selected && (
        <ReviewModal
          item={selected}
          onClose={() => setShowReviewModal(false)}
          onSaved={(updated) => {
            fetchItems();
            setSelected(updated);
            setShowReviewModal(false);
          }}
        />
      )}
    </div>
  );
}

// ─── 상세 패널 ───────────────────────────────────────────────────

function SandboxDetailPanel({
  item,
  onClose,
  onReview,
}: {
  item: SandboxItem;
  onClose: () => void;
  onReview: () => void;
}) {
  const sc = STATUS_CONFIG[item.status];
  const rc = REG_TYPE_CONFIG[item.regulationType];
  const Sic = sc.icon;
  const canReview = ['pending', 'reviewing', 'approved', 'rejected'].includes(item.status);

  return (
    <div className="w-96 flex-shrink-0 bg-slate-800 rounded-lg border border-slate-700 p-5 sticky top-0 max-h-[calc(100vh-200px)] overflow-y-auto">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Sic className={`w-4 h-4 ${sc.color}`} />
          <span className={`text-xs px-2 py-0.5 rounded-full ${sc.bg} ${sc.color}`}>{sc.label}</span>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-slate-700 rounded transition">
          <X className="w-4 h-4" />
        </button>
      </div>

      <h3 className="font-semibold text-slate-100 text-sm leading-snug mb-4">{item.title}</h3>

      {/* 유형 */}
      <div className="mb-4">
        <div className="text-xs text-slate-400 mb-1">규제 유형</div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full bg-violet-900/30 text-violet-300">{rc?.label}</span>
          <span className="text-xs text-slate-400">{rc?.desc}</span>
        </div>
      </div>

      {/* 신청 업체 + 일시 */}
      <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
        <div className="bg-slate-700/40 rounded-lg p-3">
          <div className="text-slate-400 mb-1 flex items-center gap-1"><Building2 className="w-3 h-3" /> 신청 업체</div>
          <div className="text-slate-100 font-medium">{item.tenantName ?? '—'}</div>
        </div>
        <div className="bg-slate-700/40 rounded-lg p-3">
          <div className="text-slate-400 mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> 신청일</div>
          <div className="text-slate-100 font-medium">{new Date(item.appliedAt).toLocaleDateString('ko-KR')}</div>
        </div>
      </div>

      {/* 신청자 */}
      {(item.applicantName || item.applicantEmail || item.contactPhone) && (
        <div className="mb-4">
          <div className="text-xs text-slate-400 mb-2">신청자 정보</div>
          <div className="bg-slate-700/40 rounded-lg p-3 space-y-1 text-xs">
            {item.applicantName  && <div className="flex items-center gap-2"><User  className="w-3.5 h-3.5 text-slate-400" /> {item.applicantName}</div>}
            {item.applicantEmail && <div className="flex items-center gap-2"><Mail  className="w-3.5 h-3.5 text-slate-400" /> {item.applicantEmail}</div>}
            {item.contactPhone   && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-slate-400" /> {item.contactPhone}</div>}
          </div>
        </div>
      )}

      {/* 신청 내용 */}
      {item.description && (
        <div className="mb-4">
          <div className="text-xs text-slate-400 mb-2">신청 내용</div>
          <div className="bg-slate-700/40 rounded-lg p-3 text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
            {item.description}
          </div>
        </div>
      )}

      {/* 면제 범위 */}
      {item.exemptionScope && (
        <div className="mb-4">
          <div className="text-xs text-slate-400 mb-2">면제 범위</div>
          <div className="bg-slate-700/40 rounded-lg p-3 text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
            {item.exemptionScope}
          </div>
        </div>
      )}

      {/* 심사 일정 */}
      {(item.reviewStartedAt || item.reviewedAt || item.expireDate) && (
        <div className="mb-4">
          <div className="text-xs text-slate-400 mb-2">심사 일정</div>
          <div className="space-y-1.5 text-xs">
            {item.reviewStartedAt && (
              <div className="flex justify-between">
                <span className="text-slate-400">검토 시작</span>
                <span className="text-slate-200">{new Date(item.reviewStartedAt).toLocaleDateString('ko-KR')}</span>
              </div>
            )}
            {item.reviewedAt && (
              <div className="flex justify-between">
                <span className="text-slate-400">심사 완료</span>
                <span className="text-slate-200">{new Date(item.reviewedAt).toLocaleDateString('ko-KR')}</span>
              </div>
            )}
            {item.expireDate && (
              <div className="flex justify-between">
                <span className="text-slate-400">특례 만료</span>
                <span className="text-amber-300 font-medium">{new Date(item.expireDate).toLocaleDateString('ko-KR')}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 심사 의견 */}
      {item.reviewNote && (
        <div className="mb-4">
          <div className="text-xs text-slate-400 mb-2">심사 의견</div>
          <div className={`rounded-lg p-3 text-xs whitespace-pre-wrap leading-relaxed ${
            item.status === 'approved' ? 'bg-emerald-900/30 text-emerald-200' :
            item.status === 'rejected' ? 'bg-red-900/30 text-red-200'         :
            'bg-slate-700/40 text-slate-300'
          }`}>
            {item.reviewNote}
          </div>
        </div>
      )}

      {/* 심사 버튼 */}
      {canReview && (
        <button onClick={onReview}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-medium transition mt-2">
          <Edit3 className="w-4 h-4" />
          심사 처리
        </button>
      )}
    </div>
  );
}

// ─── 신규 신청 모달 ──────────────────────────────────────────────

function ApplyModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    title:          '',
    description:    '',
    regulationType: 'ems_new' as RegulationType,
    exemptionScope: '',
    applicantName:  '',
    applicantEmail: '',
    contactPhone:   '',
  });
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    if (!form.title.trim()) { toast.error('제목을 입력하세요'); return; }

    setIsSaving(true);
    try {
      const res = await apiPost('/api/admin/sandbox', {
        title:          form.title,
        description:    form.description    || null,
        regulationType: form.regulationType,
        exemptionScope: form.exemptionScope || null,
        applicantName:  form.applicantName  || null,
        applicantEmail: form.applicantEmail || null,
        contactPhone:   form.contactPhone   || null,
      });
      if (res.success) {
        toast.success('규제 샌드박스 신청이 접수되었습니다');
        onCreated();
      } else {
        toast.error((res as any).error ?? '신청 실패');
      }
    } catch { toast.error('신청 오류'); }
    finally { setIsSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-violet-400" />
            규제 샌드박스 신청
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-700 rounded"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-4">
          {/* 제목 */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">신청 제목 <span className="text-red-400">*</span></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="예: IoT 기반 P2P 에너지 거래 플랫폼 규제 특례 신청"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm" />
          </div>

          {/* 규제 유형 */}
          <div>
            <label className="text-xs text-slate-400 mb-2 block">규제 유형 <span className="text-red-400">*</span></label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(REG_TYPE_CONFIG) as RegulationType[]).map((k) => (
                <button key={k}
                  onClick={() => setForm({ ...form, regulationType: k })}
                  className={`text-left px-3 py-2 rounded-lg border text-xs transition ${
                    form.regulationType === k
                      ? 'bg-violet-900/40 border-violet-500 text-violet-200'
                      : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  <div className="font-medium">{REG_TYPE_CONFIG[k].label}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{REG_TYPE_CONFIG[k].desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 신청 내용 */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">신청 내용 (상세)</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={4} placeholder="서비스 개요, 기술 방식, 예상 효과 등 상세 내용..."
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm resize-none" />
          </div>

          {/* 면제 범위 */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">면제 요청 범위</label>
            <textarea value={form.exemptionScope} onChange={(e) => setForm({ ...form, exemptionScope: e.target.value })}
              rows={2} placeholder="면제 또는 특례 적용을 요청하는 법령·규제 조항 명시..."
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm resize-none" />
          </div>

          {/* 신청자 정보 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">담당자 이름</label>
              <input value={form.applicantName} onChange={(e) => setForm({ ...form, applicantName: e.target.value })}
                placeholder="홍길동" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">연락처</label>
              <input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                placeholder="02-0000-0000" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">이메일</label>
            <input type="email" value={form.applicantEmail} onChange={(e) => setForm({ ...form, applicantEmail: e.target.value })}
              placeholder="contact@company.com" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose}
            className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition">취소</button>
          <button onClick={save} disabled={isSaving}
            className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-medium transition disabled:opacity-50">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : '신청 접수'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 심사 처리 모달 (super admin) ─────────────────────────────────

function ReviewModal({
  item,
  onClose,
  onSaved,
}: {
  item: SandboxItem;
  onClose: () => void;
  onSaved: (updated: SandboxItem) => void;
}) {
  const [status, setStatus]   = useState<SandboxStatus>(item.status);
  const [note, setNote]       = useState(item.reviewNote ?? '');
  const [expireDate, setExpireDate] = useState(item.expireDate ? item.expireDate.split('T')[0] : '');
  const [isSaving, setIsSaving] = useState(false);

  const REVIEWABLE: SandboxStatus[] = ['pending', 'reviewing', 'approved', 'rejected'];

  const save = async () => {
    setIsSaving(true);
    try {
      const res = await apiPatch('/api/admin/sandbox', {
        id: item.id,
        status,
        reviewNote: note || null,
        expireDate: expireDate || null,
      });
      if (res.success) {
        toast.success(`심사 처리: ${STATUS_CONFIG[status].label}`);
        onSaved({ ...item, status, reviewNote: note || null, expireDate: expireDate || null });
      } else {
        toast.error((res as any).error ?? '처리 실패');
      }
    } catch { toast.error('처리 오류'); }
    finally { setIsSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-violet-400" />
            심사 처리
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-700 rounded"><X className="w-4 h-4" /></button>
        </div>

        <div className="bg-slate-700/40 rounded-lg p-3 mb-5 text-xs">
          <div className="text-slate-400 mb-1">신청 건</div>
          <div className="text-slate-100 font-medium">{item.title}</div>
          {item.tenantName && <div className="text-slate-400 mt-1">{item.tenantName}</div>}
        </div>

        <div className="space-y-4">
          {/* 상태 변경 */}
          <div>
            <label className="text-xs text-slate-400 mb-2 block">심사 결과</label>
            <div className="grid grid-cols-3 gap-2">
              {REVIEWABLE.map((s) => {
                const cfg = STATUS_CONFIG[s];
                const Ic  = cfg.icon;
                return (
                  <button key={s} onClick={() => setStatus(s)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition ${
                      status === s
                        ? `${cfg.bg} border-current ${cfg.color} ring-1 ring-current`
                        : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    <Ic className="w-3.5 h-3.5 flex-shrink-0" />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 특례 만료일 (승인 시) */}
          {status === 'approved' && (
            <div>
              <label className="text-xs text-slate-400 mb-1 block">특례 만료일</label>
              <input type="date" value={expireDate} onChange={(e) => setExpireDate(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm" />
            </div>
          )}

          {/* 심사 의견 */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">심사 의견</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)}
              rows={4} placeholder="승인/반려 이유, 조건, 권고사항 등..."
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm resize-none" />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose}
            className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition">취소</button>
          <button onClick={save} disabled={isSaving}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
              status === 'approved' ? 'bg-emerald-700 hover:bg-emerald-600' :
              status === 'rejected' ? 'bg-red-700 hover:bg-red-600' :
              'bg-violet-600 hover:bg-violet-500'
            }`}
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : `${STATUS_CONFIG[status].label} 처리`}
          </button>
        </div>
      </div>
    </div>
  );
}
