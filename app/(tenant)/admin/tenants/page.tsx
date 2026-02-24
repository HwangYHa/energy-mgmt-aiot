'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Shield,
  Building2,
  Users,
  MonitorSmartphone,
  Radio,
  Activity,
  RefreshCw,
  Search,
  Loader2,
  X,
  AlertTriangle,
  CheckCircle2,
  Ban,
  ChevronRight,
} from 'lucide-react';
import { toast } from '@/lib/toast';

interface TenantItem {
  id: string;
  name: string;
  businessNumber: string | null;
  domain: string | null;
  industryType: string;
  status: string;
  createdAt: string;
  _count: {
    users: number;
    sites: number;
    devices: number;
    sensors: number;
  };
  subscription: {
    id: string;
    status: string;
    endDate: string;
    plan: { name: string; tier: string };
  } | null;
  measurementsToday: number;
}

interface TenantDetail {
  id: string;
  name: string;
  businessNumber: string | null;
  domain: string | null;
  industryType: string;
  status: string;
  createdAt: string;
  users: Array<{ id: string; name: string | null; email: string; role: string; lastLoginAt: string | null }>;
  sites: Array<{ id: string; name: string; isActive: boolean; _count: { devices: number } }>;
  subscriptions: Array<{
    id: string;
    status: string;
    startDate: string;
    endDate: string;
    plan: { name: string; tier: string; monthlyPrice: string };
  }>;
  _count: { devices: number; sensors: number; measurements: number; auditLogs: number };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  active: { label: '활성', color: 'text-green-400', icon: CheckCircle2 },
  suspended: { label: '정지', color: 'text-amber-400', icon: AlertTriangle },
  terminated: { label: '해지', color: 'text-red-400', icon: Ban },
};

const INDUSTRY_LABELS: Record<string, string> = {
  manufacturing: '제조업',
  building: '빌딩',
  industrial_complex: '산업단지',
  datacenter: '데이터센터',
  other: '기타',
};

export default function SuperAdminTenantsPage() {
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedTenant, setSelectedTenant] = useState<TenantDetail | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const fetchTenants = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      params.set('take', '50');

      const res = await fetch(`/api/admin/tenants?${params}`);
      if (res.status === 403) {
        setAccessDenied(true);
        return;
      }
      const json = await res.json();
      if (json.success) {
        setTenants(json.data);
        setTotal(json.pagination?.total || json.data.length);
      }
    } catch {
      // error handled
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const viewDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/tenants/${id}`);
      const json = await res.json();
      if (json.success) setSelectedTenant(json.data);
    } catch {
      // ignore
    }
  };

  const changeTenantStatus = async (id: string, status: string) => {
    const label = STATUS_CONFIG[status]?.label || status;
    if (!confirm(`테넌트 상태를 '${label}'(으)로 변경하시겠습니까?`)) return;

    try {
      const { fetchWithCsrf } = await import('@/hooks/use-csrf');
      const res = await fetchWithCsrf(`/api/admin/tenants/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        fetchTenants();
        if (selectedTenant?.id === id) {
          viewDetail(id);
        }
      }
    } catch {
      toast.error('상태 변경 실패');
    }
  };

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">접근 거부</h2>
          <p className="text-gray-400">이 페이지는 시스템 관리자(Super Admin)만 접근할 수 있습니다.</p>
        </div>
      </div>
    );
  }

  const filteredTenants = tenants.filter((t) =>
    search ? t.name.toLowerCase().includes(search.toLowerCase()) || t.domain?.toLowerCase().includes(search.toLowerCase()) : true
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Shield className="w-7 h-7 text-red-400" />
            테넌트 관리
          </h1>
          <p className="text-gray-400 mt-1">Super Admin - 전체 테넌트 관리 및 모니터링</p>
        </div>
        <button onClick={fetchTenants} className="p-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* 전체 통계 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-6">
        <StatCard icon={Building2} label="전체 테넌트" value={total} color="text-cyan-400" />
        <StatCard icon={CheckCircle2} label="활성" value={tenants.filter((t) => t.status === 'active').length} color="text-green-400" />
        <StatCard icon={AlertTriangle} label="정지" value={tenants.filter((t) => t.status === 'suspended').length} color="text-amber-400" />
        <StatCard icon={Users} label="전체 사용자" value={tenants.reduce((s, t) => s + t._count.users, 0)} color="text-blue-400" />
        <StatCard icon={Activity} label="오늘 측정" value={tenants.reduce((s, t) => s + t.measurementsToday, 0)} color="text-purple-400" />
      </div>

      {/* 필터 */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="테넌트명 또는 도메인 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">모든 상태</option>
          <option value="active">활성</option>
          <option value="suspended">정지</option>
          <option value="terminated">해지</option>
        </select>
      </div>

      <div className="flex gap-6">
        {/* 테넌트 목록 */}
        <div className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTenants.map((tenant) => {
                const fallback = { label: '활성', color: 'text-green-400', icon: CheckCircle2 };
                const { color: statusColor, icon: StatusIcon } = STATUS_CONFIG[tenant.status] || fallback;
                return (
                  <div
                    key={tenant.id}
                    className={`bg-slate-800 rounded-lg border p-4 cursor-pointer transition hover:border-cyan-600 ${
                      selectedTenant?.id === tenant.id ? 'border-cyan-500' : 'border-slate-700'
                    }`}
                    onClick={() => viewDetail(tenant.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <StatusIcon className={`w-5 h-5 ${statusColor}`} />
                        <div>
                          <div className="font-semibold">{tenant.name}</div>
                          <div className="text-xs text-gray-400">
                            {INDUSTRY_LABELS[tenant.industryType] || tenant.industryType}
                            {tenant.domain && ` · ${tenant.domain}`}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    </div>
                    <div className="flex items-center gap-6 mt-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" /> {tenant._count.users}명
                      </span>
                      <span className="flex items-center gap-1">
                        <MonitorSmartphone className="w-3.5 h-3.5" /> {tenant._count.devices}대
                      </span>
                      <span className="flex items-center gap-1">
                        <Radio className="w-3.5 h-3.5" /> {tenant._count.sensors}개
                      </span>
                      <span className="flex items-center gap-1">
                        <Activity className="w-3.5 h-3.5" /> {tenant.measurementsToday}건
                      </span>
                      {tenant.subscription && (
                        <span className="bg-cyan-900/30 text-cyan-300 px-2 py-0.5 rounded">
                          {tenant.subscription.plan.name}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 상세 패널 */}
        {selectedTenant && (
          <div className="w-96 bg-slate-800 rounded-lg border border-slate-700 p-6 sticky top-6 max-h-[calc(100vh-120px)] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">{selectedTenant.name}</h3>
              <button onClick={() => setSelectedTenant(null)} className="p-1 hover:bg-slate-700 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 상태 변경 */}
            <div className="mb-6">
              <label className="text-xs text-gray-400 block mb-2">상태 관리</label>
              <div className="flex gap-2">
                {([
                  { key: 'active', label: '활성' },
                  { key: 'suspended', label: '정지' },
                  { key: 'terminated', label: '해지' },
                ] as const).map((s) => (
                  <button
                    key={s.key}
                    onClick={() => changeTenantStatus(selectedTenant.id, s.key)}
                    className={`flex-1 py-2 rounded text-xs font-medium transition ${
                      selectedTenant.status === s.key
                        ? 'bg-slate-600 text-white'
                        : 'bg-slate-700 text-gray-400 hover:bg-slate-600'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 리소스 현황 */}
            <div className="mb-6">
              <label className="text-xs text-gray-400 block mb-2">리소스 현황</label>
              <div className="grid grid-cols-2 gap-2">
                <MiniStat label="디바이스" value={selectedTenant._count.devices} />
                <MiniStat label="센서" value={selectedTenant._count.sensors} />
                <MiniStat label="측정 데이터" value={selectedTenant._count.measurements} />
                <MiniStat label="감사 로그" value={selectedTenant._count.auditLogs} />
              </div>
            </div>

            {/* 사용자 목록 */}
            <div className="mb-6">
              <label className="text-xs text-gray-400 block mb-2">사용자 ({selectedTenant.users.length}명)</label>
              <div className="space-y-2">
                {selectedTenant.users.slice(0, 5).map((u) => (
                  <div key={u.id} className="flex items-center justify-between bg-slate-700/50 rounded p-2 text-xs">
                    <div>
                      <div className="font-medium">{u.name || u.email}</div>
                      <div className="text-gray-400">{u.email}</div>
                    </div>
                    <span className="text-cyan-400">{u.role}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 사이트 목록 */}
            <div className="mb-6">
              <label className="text-xs text-gray-400 block mb-2">사이트 ({selectedTenant.sites.length}개)</label>
              <div className="space-y-2">
                {selectedTenant.sites.map((s) => (
                  <div key={s.id} className="flex items-center justify-between bg-slate-700/50 rounded p-2 text-xs">
                    <span>{s.name}</span>
                    <span className="text-gray-400">{s._count.devices}대</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 구독 정보 */}
            {selectedTenant.subscriptions.length > 0 && (
              <div>
                <label className="text-xs text-gray-400 block mb-2">구독 이력</label>
                <div className="space-y-2">
                  {selectedTenant.subscriptions.map((sub) => (
                    <div key={sub.id} className="bg-slate-700/50 rounded p-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{sub.plan.name}</span>
                        <span className={sub.status === 'active' ? 'text-green-400' : 'text-gray-400'}>
                          {sub.status}
                        </span>
                      </div>
                      <div className="text-gray-400 mt-1">
                        {new Date(sub.startDate).toLocaleDateString('ko-KR')} ~{' '}
                        {new Date(sub.endDate).toLocaleDateString('ko-KR')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Building2; label: string; value: number; color: string }) {
  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-slate-700/50 rounded p-2 text-center">
      <div className="text-lg font-bold">{value.toLocaleString()}</div>
      <div className="text-xs text-gray-400">{label}</div>
    </div>
  );
}
