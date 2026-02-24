'use client';

/**
 * /admin/partners — 설치 파트너 포털
 *
 * 기능:
 * - 파트너 업체 목록 및 상태 (super_admin)
 * - 기존 테넌트를 파트너로 등록
 * - 파트너에게 클라이언트 테넌트 배정
 * - 파트너가 관리하는 현장/게이트웨이 현황
 *
 * 파트너 = 현장 설치·유지보수를 담당하는 외부 사업자
 * 탄소이음은 파트너가 현장에 게이트웨이를 설치하고
 * 클라이언트가 SaaS를 구독하는 3자 구조를 지원
 */

import { useEffect, useState } from 'react';
import {
  Building2,
  Plus,
  Search,
  Link2,
  CheckCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  UserPlus,
  Unlink,
} from 'lucide-react';
import { apiGet, apiPost, apiPut } from '@/lib/api/client';
import { toast } from '@/lib/toast';
import { useSession } from 'next-auth/react';

// ── 타입 ──────────────────────────────────────────────────────

interface ClientTenant {
  id: string;
  name: string;
  industryType: string;
  adminEmail: string;
  gatewayCount: number;
  joinedAt: string;
}

interface Partner {
  id: string;
  name: string;
  industryType: string;
  adminName?: string;
  adminEmail?: string;
  siteCount: number;
  gatewayCount: number;
  joinedAt: string;
  clients: ClientTenant[];
}

interface AllTenant {
  id: string;
  name: string;
  adminEmail?: string;
  isPartner: boolean;
  partnerId?: string;
}

// ── 컬러 뱃지 ─────────────────────────────────────────────────

const INDUSTRY_LABELS: Record<string, string> = {
  manufacturing: '제조업',
  building: '빌딩',
  industrial_complex: '산업단지',
  datacenter: '데이터센터',
  other: '기타',
};

// ─────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────────────────────

export default function PartnersPage() {
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === 'super_admin';

  const [partners, setPartners] = useState<Partner[]>([]);
  const [allTenants, setAllTenants] = useState<AllTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 모달 상태
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState<string | null>(null); // partnerId

  // ── 데이터 로드 ───────────────────────────────────────────

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ partners: Partner[] }>('/api/admin/partners?includeClients=true');
      setPartners(res.data?.partners ?? []);
    } catch {
      toast.error('파트너 목록 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  const loadAllTenants = async () => {
    try {
      const res = await apiGet<{ tenants: AllTenant[] }>('/api/admin/tenants?limit=200&status=active');
      const tenants = (res.data as Record<string, unknown>)?.tenants as AllTenant[] ?? [];
      setAllTenants(tenants);
    } catch {
      // 무시
    }
  };

  useEffect(() => {
    loadData();
    if (isSuperAdmin) loadAllTenants();
  }, [isSuperAdmin]);

  // ── 파트너 등록 ───────────────────────────────────────────

  const handleRegisterPartner = async (tenantId: string) => {
    try {
      await apiPost('/api/admin/partners', { tenantId });
      toast.success('파트너로 등록되었습니다.');
      setShowRegisterModal(false);
      loadData();
    } catch {
      toast.error('파트너 등록 실패');
    }
  };

  // ── 클라이언트 배정 ───────────────────────────────────────

  const handleAssignClient = async (clientTenantId: string, partnerId: string) => {
    try {
      await apiPut('/api/admin/partners', { clientTenantId, partnerId });
      toast.success('클라이언트가 파트너에게 배정되었습니다.');
      setShowAssignModal(null);
      loadData();
    } catch {
      toast.error('클라이언트 배정 실패');
    }
  };

  const handleUnassignClient = async (clientTenantId: string) => {
    try {
      await apiPut('/api/admin/partners', { clientTenantId, partnerId: null });
      toast.success('파트너 연결이 해제되었습니다.');
      loadData();
    } catch {
      toast.error('해제 실패');
    }
  };

  // ── 필터링 ───────────────────────────────────────────────

  const filtered = partners.filter(
    (p) =>
      !search ||
      p.name.includes(search) ||
      p.adminEmail?.includes(search)
  );

  // ─────────────────────────────────────────────────────────
  // 렌더링
  // ─────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Link2 className="w-6 h-6 text-emerald-400" />
            설치 파트너 포털
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            현장 게이트웨이 설치·유지보수를 담당하는 파트너 업체를 관리합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadData}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {isSuperAdmin && (
            <button
              onClick={() => setShowRegisterModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition"
            >
              <Plus className="w-4 h-4" />
              파트너 등록
            </button>
          )}
        </div>
      </div>

      {/* 파트너 구조 설명 */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg mt-0.5">
            <Link2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">3자 협력 구조</p>
            <p className="text-xs text-slate-400 mt-1">
              <span className="text-emerald-400 font-medium">탄소이음</span> (플랫폼) →{' '}
              <span className="text-blue-400 font-medium">파트너</span> (현장 설치·유지보수) →{' '}
              <span className="text-amber-400 font-medium">클라이언트</span> (SaaS 구독 업체)
            </p>
            <p className="text-xs text-slate-500 mt-1">
              파트너는 현장에 Edge Gateway를 설치하고 Modbus/BACnet/OPC-UA로 설비를 연결합니다.
              탄소이음은 클라우드 분석과 SaaS를 제공합니다.
            </p>
          </div>
        </div>
      </div>

      {/* 검색 */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          placeholder="파트너명 또는 이메일 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none"
        />
      </div>

      {/* 파트너 목록 */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <Link2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">등록된 파트너가 없습니다.</p>
          {isSuperAdmin && (
            <button
              onClick={() => setShowRegisterModal(true)}
              className="mt-4 text-sm text-emerald-400 hover:text-emerald-300"
            >
              첫 번째 파트너 등록 →
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((partner) => (
            <PartnerCard
              key={partner.id}
              partner={partner}
              isExpanded={expandedId === partner.id}
              onToggle={() => setExpandedId(expandedId === partner.id ? null : partner.id)}
              onAssignClient={isSuperAdmin ? () => setShowAssignModal(partner.id) : undefined}
              onUnassignClient={isSuperAdmin ? handleUnassignClient : undefined}
            />
          ))}
        </div>
      )}

      {/* 파트너 등록 모달 */}
      {showRegisterModal && (
        <RegisterPartnerModal
          tenants={allTenants.filter((t) => !t.isPartner)}
          onRegister={handleRegisterPartner}
          onClose={() => setShowRegisterModal(false)}
        />
      )}

      {/* 클라이언트 배정 모달 */}
      {showAssignModal && (
        <AssignClientModal
          partnerId={showAssignModal}
          tenants={allTenants.filter((t) => !t.isPartner)}
          onAssign={(clientId) => handleAssignClient(clientId, showAssignModal)}
          onClose={() => setShowAssignModal(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 파트너 카드
// ─────────────────────────────────────────────────────────────

function PartnerCard({
  partner,
  isExpanded,
  onToggle,
  onAssignClient,
  onUnassignClient,
}: {
  partner: Partner;
  isExpanded: boolean;
  onToggle: () => void;
  onAssignClient?: () => void;
  onUnassignClient?: (clientId: string) => void;
}) {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
      {/* 파트너 헤더 */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-4 hover:bg-slate-800/50 transition text-left"
      >
        <div className="p-2 bg-blue-500/10 rounded-lg">
          <Building2 className="w-5 h-5 text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">{partner.name}</span>
            <span className="px-1.5 py-0.5 text-xs rounded bg-blue-500/20 text-blue-400 font-medium">
              파트너
            </span>
            <span className="text-xs text-slate-500">
              {INDUSTRY_LABELS[partner.industryType] ?? partner.industryType}
            </span>
          </div>
          <p className="text-xs text-slate-500 truncate">
            {partner.adminEmail ?? '이메일 없음'}
          </p>
        </div>
        {/* 지표 */}
        <div className="hidden sm:flex items-center gap-6 text-center">
          <div>
            <p className="text-lg font-bold text-white">{partner.clients.length}</p>
            <p className="text-xs text-slate-500">클라이언트</p>
          </div>
          <div>
            <p className="text-lg font-bold text-white">{partner.gatewayCount}</p>
            <p className="text-xs text-slate-500">게이트웨이</p>
          </div>
          <div>
            <p className="text-lg font-bold text-white">{partner.siteCount}</p>
            <p className="text-xs text-slate-500">사이트</p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
        )}
      </button>

      {/* 클라이언트 목록 (확장) */}
      {isExpanded && (
        <div className="border-t border-slate-700 p-4 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-400">
              관리 클라이언트 ({partner.clients.length}개)
            </span>
            {onAssignClient && (
              <button
                onClick={onAssignClient}
                className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition"
              >
                <UserPlus className="w-3.5 h-3.5" />
                클라이언트 배정
              </button>
            )}
          </div>

          {partner.clients.length === 0 ? (
            <p className="text-xs text-slate-600 text-center py-4">
              아직 배정된 클라이언트가 없습니다.
            </p>
          ) : (
            <div className="space-y-2">
              {partner.clients.map((client) => (
                <div
                  key={client.id}
                  className="flex items-center justify-between p-3 bg-slate-800 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-amber-500/10 rounded">
                      <Building2 className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{client.name}</p>
                      <p className="text-xs text-slate-500">
                        {client.adminEmail} · 게이트웨이 {client.gatewayCount}대
                      </p>
                    </div>
                  </div>
                  {onUnassignClient && (
                    <button
                      onClick={() => onUnassignClient(client.id)}
                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition"
                      title="연결 해제"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 파트너 등록 모달
// ─────────────────────────────────────────────────────────────

function RegisterPartnerModal({
  tenants,
  onRegister,
  onClose,
}: {
  tenants: AllTenant[];
  onRegister: (tenantId: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = tenants.filter(
    (t) => !search || t.name.includes(search) || t.adminEmail?.includes(search)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">파트너 등록</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-400">
            기존 테넌트를 파트너로 승격합니다. 파트너는 다른 업체의 현장 설치를 대행할 수 있습니다.
          </p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="테넌트 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {filtered.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition ${
                  selected === t.id
                    ? 'bg-emerald-500/20 border border-emerald-500/50'
                    : 'bg-slate-800 border border-transparent hover:border-slate-600'
                }`}
              >
                <Building2 className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-white">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.adminEmail ?? '관리자 없음'}</p>
                </div>
                {selected === t.id && <CheckCircle className="w-4 h-4 text-emerald-400 ml-auto" />}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-slate-600 text-center py-8">검색 결과 없음</p>
            )}
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-slate-700">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm transition"
          >
            취소
          </button>
          <button
            onClick={() => selected && onRegister(selected)}
            disabled={!selected}
            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition disabled:opacity-40"
          >
            파트너로 등록
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 클라이언트 배정 모달
// ─────────────────────────────────────────────────────────────

function AssignClientModal({
  partnerId,
  tenants,
  onAssign,
  onClose,
}: {
  partnerId: string;
  tenants: AllTenant[];
  onAssign: (clientId: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const unassigned = tenants.filter((t) => !t.partnerId || t.partnerId !== partnerId);
  const filtered = unassigned.filter(
    (t) => !search || t.name.includes(search) || t.adminEmail?.includes(search)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">클라이언트 배정</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="클라이언트 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {filtered.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition ${
                  selected === t.id
                    ? 'bg-blue-500/20 border border-blue-500/50'
                    : 'bg-slate-800 border border-transparent hover:border-slate-600'
                }`}
              >
                <Building2 className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-white">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.adminEmail}</p>
                </div>
                {selected === t.id && <CheckCircle className="w-4 h-4 text-blue-400 ml-auto" />}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-slate-700">
          <button onClick={onClose} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm transition">
            취소
          </button>
          <button
            onClick={() => selected && onAssign(selected)}
            disabled={!selected}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition disabled:opacity-40"
          >
            배정
          </button>
        </div>
      </div>
    </div>
  );
}
