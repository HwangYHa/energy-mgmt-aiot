'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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
  ChevronDown,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { apiGet, apiPatch } from '@/lib/api/client';

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

interface GlobalStats {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  totalUsers: number;
  measurementsToday: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  active:     { label: '활성', color: 'text-green-400',  icon: CheckCircle2 },
  suspended:  { label: '정지', color: 'text-amber-400',  icon: AlertTriangle },
  terminated: { label: '해지', color: 'text-red-400',    icon: Ban },
};

const INDUSTRY_LABELS: Record<string, string> = {
  manufacturing:     '제조업',
  building:          '빌딩',
  industrial_complex:'산업단지',
  datacenter:        '데이터센터',
  other:             '기타',
};

const TIER_BADGE: Record<string, string> = {
  trial:      'bg-slate-700 text-slate-300',
  basic:      'bg-blue-900/40 text-blue-300',
  pro:        'bg-violet-900/40 text-violet-300',
  enterprise: 'bg-emerald-900/40 text-emerald-300',
};

export default function SuperAdminTenantsPage() {
  const [tenants, setTenants]               = useState<TenantItem[]>([]);
  const [isLoading, setIsLoading]           = useState(true);
  const [isLoadingMore, setIsLoadingMore]   = useState(false);
  const [stats, setStats]                   = useState<GlobalStats | null>(null);
  const [total, setTotal]                   = useState(0);
  const [hasMore, setHasMore]               = useState(false);
  const [skip, setSkip]                     = useState(0);
  const [search, setSearch]                 = useState('');
  const [searchInput, setSearchInput]       = useState('');
  const [filterStatus, setFilterStatus]     = useState('');
  const [selectedTenant, setSelectedTenant] = useState<TenantDetail | null>(null);
  const [detailLoading, setDetailLoading]   = useState(false);
  const [accessDenied, setAccessDenied]     = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const TAKE = 20;

  const fetchTenants = useCallback(async (newSkip = 0, append = false) => {
    if (newSkip === 0) setIsLoading(true);
    else setIsLoadingMore(true);

    try {
      const params = new URLSearchParams({ skip: String(newSkip), take: String(TAKE) });
      if (filterStatus) params.set('status', filterStatus);
      if (search)       params.set('q', search);

      const res = await apiGet<TenantItem[]>(`/api/admin/tenants?${params}`);

      const incoming = res.data ?? [];
      const pagination = (res as any).pagination ?? {};
      const apiStats   = (res as any).meta?.stats as GlobalStats | undefined;

      if (append) {
        setTenants((prev) => [...prev, ...incoming]);
      } else {
        setTenants(incoming);
      }
      setTotal(pagination.total ?? incoming.length);
      setHasMore(pagination.hasMore ?? false);
      setSkip(newSkip);
      if (apiStats) setStats(apiStats);
    } catch (err: any) {
      if (err?.status === 403) {
        setAccessDenied(true);
      } else {
        toast.error('테넌트 목록을 불러오지 못했습니다.');
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [filterStatus, search]);

  // 검색어 디바운스 (500ms)
  const handleSearchInput = (val: string) => {
    setSearchInput(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(val), 500);
  };

  // 검색/필터 변경 시 첫 페이지부터 다시
  useEffect(() => {
    fetchTenants(0, false);
  }, [fetchTenants]);

  const loadMore = () => fetchTenants(skip + TAKE, true);

  const viewDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await apiGet<TenantDetail>(`/api/admin/tenants/${id}`);
      setSelectedTenant(res.data ?? null);
    } catch {
      toast.error('테넌트 상세 정보를 불러오지 못했습니다.');
    } finally {
      setDetailLoading(false);
    }
  };

  const changeTenantStatus = async (id: string, status: string) => {
    const label = STATUS_CONFIG[status]?.label || status;
    if (!confirm(`테넌트 상태를 '${label}'(으)로 변경하시겠습니까?`)) return;

    try {
      await apiPatch(`/api/admin/tenants/${id}`, { status });
      toast.success(`상태가 '${label}'(으)로 변경되었습니다.`);
      fetchTenants(0, false);
      if (selectedTenant?.id === id) viewDetail(id);
    } catch {
      toast.error('상태 변경에 실패했습니다.');
    }
  };

  if (accessDenied) {
    return (
      <div className="h-full bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">접근 거부</h2>
          <p className="text-gray-400">이 페이지는 시스템 관리자(Super Admin)만 접근할 수 있습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-900 text-white p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Shield className="w-7 h-7 text-red-400" />
            테넌트 관리
          </h1>
          <p className="text-gray-400 mt-1">Super Admin — 전체 테넌트 관리 및 모니터링</p>
        </div>
        <button
          onClick={() => fetchTenants(0, false)}
          disabled={isLoading}
          className="p-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 전체 통계 — API에서 받은 실제 집계 값 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-6">
        <StatCard icon={Building2}    label="전체 테넌트" value={stats?.totalTenants   ?? total}          color="text-cyan-400"   loading={!stats} />
        <StatCard icon={CheckCircle2} label="활성"        value={stats?.activeTenants   ?? 0}              color="text-green-400"  loading={!stats} />
        <StatCard icon={AlertTriangle}label="정지"        value={stats?.suspendedTenants ?? 0}             color="text-amber-400"  loading={!stats} />
        <StatCard icon={Users}        label="전체 사용자" value={stats?.totalUsers       ?? 0}             color="text-blue-400"   loading={!stats} />
        <StatCard icon={Activity}     label="오늘 측정"   value={stats?.measurementsToday ?? 0}            color="text-purple-400" loading={!stats} />
      </div>

      {/* 필터 */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="테넌트명 또는 도메인 검색..."
            value={searchInput}
            onChange={(e) => handleSearchInput(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-cyan-500"
          />
          {searchInput && (
            <button
              onClick={() => { setSearchInput(''); setSearch(''); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
        >
          <option value="">모든 상태</option>
          <option value="active">활성</option>
          <option value="suspended">정지</option>
          <option value="terminated">해지</option>
        </select>
        <span className="text-xs text-gray-500">
          {total > 0 ? `총 ${total.toLocaleString()}개` : ''}
        </span>
      </div>

      <div className="flex gap-6">
        {/* 테넌트 목록 */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            </div>
          ) : tenants.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-gray-500">
              {search || filterStatus ? '검색 결과가 없습니다.' : '테넌트가 없습니다.'}
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {tenants.map((tenant) => {
                  const statusCfg = STATUS_CONFIG[tenant.status] ?? STATUS_CONFIG.active!;
                  const { color: statusColor, icon: StatusIcon } = statusCfg;
                  const tierBadge = TIER_BADGE[tenant.subscription?.plan?.tier ?? ''] ?? TIER_BADGE.trial;
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
                          <StatusIcon className={`w-5 h-5 shrink-0 ${statusColor}`} />
                          <div>
                            <div className="font-semibold">{tenant.name}</div>
                            <div className="text-xs text-gray-400">
                              {INDUSTRY_LABELS[tenant.industryType] || tenant.industryType}
                              {tenant.domain && ` · ${tenant.domain}`}
                              {tenant.businessNumber && ` · ${tenant.businessNumber}`}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {tenant.subscription && (
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${tierBadge}`}>
                              {tenant.subscription.plan.name}
                            </span>
                          )}
                          <ChevronRight className="w-4 h-4 text-gray-500" />
                        </div>
                      </div>
                      <div className="flex items-center flex-wrap gap-4 mt-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" /> {tenant._count.users.toLocaleString()}명
                        </span>
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5" /> {tenant._count.sites.toLocaleString()}개 사이트
                        </span>
                        <span className="flex items-center gap-1">
                          <MonitorSmartphone className="w-3.5 h-3.5" /> {tenant._count.devices.toLocaleString()}대
                        </span>
                        <span className="flex items-center gap-1">
                          <Radio className="w-3.5 h-3.5" /> {tenant._count.sensors.toLocaleString()}개 센서
                        </span>
                        <span className="flex items-center gap-1">
                          <Activity className="w-3.5 h-3.5" /> 오늘 {tenant.measurementsToday.toLocaleString()}건
                        </span>
                        {tenant.subscription?.endDate && (
                          <span className="text-gray-500">
                            만료 {new Date(tenant.subscription.endDate).toLocaleDateString('ko-KR')}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 더 보기 */}
              {hasMore && (
                <div className="flex justify-center mt-6">
                  <button
                    onClick={loadMore}
                    disabled={isLoadingMore}
                    className="flex items-center gap-2 px-6 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm hover:bg-slate-700 transition disabled:opacity-50"
                  >
                    {isLoadingMore ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                    더 보기 ({total - tenants.length}개 남음)
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* 상세 패널 */}
        {(selectedTenant || detailLoading) && (
          <div className="w-96 shrink-0 bg-slate-800 rounded-lg border border-slate-700 p-6 sticky top-6 max-h-[calc(100vh-120px)] overflow-y-auto">
            {detailLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
              </div>
            ) : selectedTenant ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold">{selectedTenant.name}</h3>
                    {selectedTenant.domain && (
                      <p className="text-xs text-gray-400 mt-0.5">{selectedTenant.domain}</p>
                    )}
                  </div>
                  <button onClick={() => setSelectedTenant(null)} className="p-1 hover:bg-slate-700 rounded">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* 기본 정보 */}
                <div className="mb-5 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-gray-400">업종</span>
                    <span>{INDUSTRY_LABELS[selectedTenant.industryType] || selectedTenant.industryType}</span>
                  </div>
                  {selectedTenant.businessNumber && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">사업자번호</span>
                      <span>{selectedTenant.businessNumber}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-400">가입일</span>
                    <span>{new Date(selectedTenant.createdAt).toLocaleDateString('ko-KR')}</span>
                  </div>
                </div>

                {/* 상태 변경 */}
                <div className="mb-6">
                  <label className="text-xs text-gray-400 block mb-2">상태 관리</label>
                  <div className="flex gap-2">
                    {(['active', 'suspended', 'terminated'] as const).map((s) => {
                      const cfg = STATUS_CONFIG[s]!;
                      return (
                        <button
                          key={s}
                          onClick={() => changeTenantStatus(selectedTenant.id, s)}
                          className={`flex-1 py-2 rounded text-xs font-medium transition ${
                            selectedTenant.status === s
                              ? 'bg-slate-600 text-white ring-1 ring-cyan-500'
                              : 'bg-slate-700 text-gray-400 hover:bg-slate-600'
                          }`}
                        >
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 리소스 현황 */}
                <div className="mb-6">
                  <label className="text-xs text-gray-400 block mb-2">리소스 현황</label>
                  <div className="grid grid-cols-2 gap-2">
                    <MiniStat label="디바이스"   value={selectedTenant._count.devices} />
                    <MiniStat label="센서"       value={selectedTenant._count.sensors} />
                    <MiniStat label="측정 데이터" value={selectedTenant._count.measurements} />
                    <MiniStat label="감사 로그"  value={selectedTenant._count.auditLogs} />
                  </div>
                </div>

                {/* 구독 이력 */}
                {selectedTenant.subscriptions.length > 0 && (
                  <div className="mb-6">
                    <label className="text-xs text-gray-400 block mb-2">
                      구독 이력 ({selectedTenant.subscriptions.length}건)
                    </label>
                    <div className="space-y-2">
                      {selectedTenant.subscriptions.map((sub) => (
                        <div key={sub.id} className="bg-slate-700/50 rounded p-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{sub.plan.name}</span>
                            <span className={sub.status === 'ACTIVE' ? 'text-green-400' : 'text-gray-400'}>
                              {sub.status === 'ACTIVE' ? '활성' : sub.status}
                            </span>
                          </div>
                          <div className="text-gray-400 mt-1">
                            {new Date(sub.startDate).toLocaleDateString('ko-KR')} ~{' '}
                            {new Date(sub.endDate).toLocaleDateString('ko-KR')}
                          </div>
                          <div className="text-gray-500 mt-0.5">
                            월 {Number(sub.plan.monthlyPrice).toLocaleString()}원
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 사용자 목록 */}
                {selectedTenant.users.length > 0 && (
                  <div className="mb-6">
                    <label className="text-xs text-gray-400 block mb-2">
                      사용자 ({selectedTenant.users.length}명)
                    </label>
                    <div className="space-y-2">
                      {selectedTenant.users.slice(0, 5).map((u) => (
                        <div key={u.id} className="flex items-center justify-between bg-slate-700/50 rounded p-2 text-xs">
                          <div>
                            <div className="font-medium">{u.name || u.email}</div>
                            <div className="text-gray-400">{u.email}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-cyan-400">{u.role}</div>
                            {u.lastLoginAt && (
                              <div className="text-gray-500 mt-0.5">
                                {new Date(u.lastLoginAt).toLocaleDateString('ko-KR')}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {selectedTenant.users.length > 5 && (
                        <p className="text-xs text-gray-500 text-center">+{selectedTenant.users.length - 5}명 더</p>
                      )}
                    </div>
                  </div>
                )}

                {/* 사이트 목록 */}
                {selectedTenant.sites.length > 0 && (
                  <div>
                    <label className="text-xs text-gray-400 block mb-2">
                      사이트 ({selectedTenant.sites.length}개)
                    </label>
                    <div className="space-y-2">
                      {selectedTenant.sites.map((s) => (
                        <div key={s.id} className="flex items-center justify-between bg-slate-700/50 rounded p-2 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${s.isActive ? 'bg-green-400' : 'bg-gray-500'}`} />
                            <span>{s.name}</span>
                          </div>
                          <span className="text-gray-400">{s._count.devices}대</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  loading,
}: {
  icon: typeof Building2;
  label: string;
  value: number;
  color: string;
  loading?: boolean;
}) {
  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      {loading ? (
        <div className="h-8 w-16 bg-slate-700 rounded animate-pulse" />
      ) : (
        <div className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</div>
      )}
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
