'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  ArrowLeft,
  Edit,
  Trash2,
  MapPin,
  Zap,
  Server,
  Calendar,
  Settings,
  Plus,
  ChevronRight,
  AlertCircle,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  Factory,
  Building,
  Warehouse,
  Store,
  Layers,
  BarChart3,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';

// Types
interface Device {
  id: string;
  name: string;
  deviceType: string;
  status: 'online' | 'offline' | 'error' | 'maintenance';
}

interface Gateway {
  id: string;
  name: string | null;
  serialNumber: string;
  status: 'online' | 'offline' | 'error' | 'maintenance';
}

interface Manager {
  id: string;
  name: string;
  email: string;
}

interface Site {
  id: string;
  name: string;
  code: string | null;
  siteType: 'factory' | 'office' | 'warehouse' | 'retail' | 'mixed';
  address: string | null;
  city: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  areaSqm: number | null;
  floors: number | null;
  peakPowerKw: number | null;
  operatingHours: Record<string, any> | null;
  isActive: boolean;
  metadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
  manager: Manager | null;
  devices: Device[];
  gateways: Gateway[];
  _count: {
    devices: number;
    gateways: number;
  };
}

// Site type configuration
const siteTypeConfig = {
  factory: { label: '공장', icon: Factory, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  office: { label: '사무실', icon: Building, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  warehouse: { label: '창고', icon: Warehouse, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  retail: { label: '매장', icon: Store, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  mixed: { label: '복합', icon: Layers, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
};

// Device status configuration
const deviceStatusConfig = {
  online: { label: '온라인', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircle },
  offline: { label: '오프라인', color: 'text-slate-400', bg: 'bg-slate-500/10', icon: XCircle },
  error: { label: '오류', color: 'text-red-400', bg: 'bg-red-500/10', icon: AlertCircle },
  maintenance: { label: '점검중', color: 'text-amber-400', bg: 'bg-amber-500/10', icon: Clock },
};

export default function SiteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const siteId = params.id as string;

  const [site, setSite] = useState<Site | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Fetch site
  const fetchSite = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/sites/${siteId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch site');
      }

      setSite(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '사이트 정보를 불러올 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    if (siteId) {
      fetchSite();
    }
  }, [siteId, fetchSite]);

  // Delete site
  const handleDelete = async () => {
    try {
      const { fetchWithCsrf } = await import('@/hooks/use-csrf');
      const response = await fetchWithCsrf(`/api/sites/${siteId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || data.details || 'Failed to delete site');
      }

      router.push('/sites');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '사이트 삭제에 실패했습니다.');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#051225] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">사이트 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !site) {
    return (
      <div className="min-h-screen bg-[#051225] flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">오류가 발생했습니다</h2>
          <p className="text-slate-400 mb-6">{error || '사이트를 찾을 수 없습니다.'}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push('/sites')}
              className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
            >
              목록으로 돌아가기
            </button>
            <button
              onClick={fetchSite}
              className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
            >
              다시 시도
            </button>
          </div>
        </div>
      </div>
    );
  }

  const typeConfig = siteTypeConfig[site.siteType];
  const TypeIcon = typeConfig.icon;

  // Calculate device stats
  const deviceStats = {
    online: site.devices.filter((d) => d.status === 'online').length,
    offline: site.devices.filter((d) => d.status === 'offline').length,
    error: site.devices.filter((d) => d.status === 'error').length,
  };

  return (
    <div className="min-h-screen bg-[#051225] p-4 md:p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400 mb-6">
        <Link href="/sites" className="hover:text-white transition-colors">
          사이트 관리
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-white">{site.name}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
        <div className="flex items-start gap-4">
          <button
            onClick={() => router.push('/sites')}
            className="p-2 rounded-lg bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className={cn('p-2 rounded-lg', typeConfig.bg)}>
                <TypeIcon className={cn('w-6 h-6', typeConfig.color)} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{site.name}</h1>
                {site.code && (
                  <p className="text-sm text-slate-400 font-mono">{site.code}</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span
                className={cn(
                  'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
                  typeConfig.bg,
                  typeConfig.color
                )}
              >
                {typeConfig.label}
              </span>
              <span
                className={cn(
                  'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
                  site.isActive
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-slate-500/10 text-slate-400'
                )}
              >
                {site.isActive ? '운영중' : '비활성'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => router.push(`/sites/${site.id}/edit`)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            <Edit className="w-4 h-4" />
            수정
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            삭제
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-cyan-500/10 rounded-lg">
              <Zap className="w-5 h-5 text-cyan-400" />
            </div>
            <span className="text-slate-400 text-sm">총 설비</span>
          </div>
          <p className="text-2xl font-bold text-white">{site._count.devices}</p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-slate-400 text-sm">온라인</span>
          </div>
          <p className="text-2xl font-bold text-emerald-400">{deviceStats.online}</p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Server className="w-5 h-5 text-amber-400" />
            </div>
            <span className="text-slate-400 text-sm">게이트웨이</span>
          </div>
          <p className="text-2xl font-bold text-white">{site._count.gateways}</p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <TrendingUp className="w-5 h-5 text-purple-400" />
            </div>
            <span className="text-slate-400 text-sm">피크 전력</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {site.peakPowerKw ? `${site.peakPowerKw.toLocaleString()} kW` : '-'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Site Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-cyan-400" />
              기본 정보
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {site.address && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-slate-400">주소</p>
                    <p className="text-white">{site.address}</p>
                    {site.city && (
                      <p className="text-slate-400">
                        {site.city}, {site.country}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {site.areaSqm && (
                <div className="flex items-start gap-3">
                  <Layers className="w-5 h-5 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-slate-400">면적</p>
                    <p className="text-white">{site.areaSqm.toLocaleString()} ㎡</p>
                    {site.floors && (
                      <p className="text-slate-400">{site.floors}층</p>
                    )}
                  </div>
                </div>
              )}

              {site.manager && (
                <div className="flex items-start gap-3">
                  <Settings className="w-5 h-5 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-slate-400">담당자</p>
                    <p className="text-white">{site.manager.name}</p>
                    <p className="text-slate-400 text-sm">{site.manager.email}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-400">등록일</p>
                  <p className="text-white">
                    {new Date(site.createdAt).toLocaleDateString('ko-KR')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Devices List */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-cyan-400" />
                설비 목록
              </h3>
              <Link
                href={`/devices?siteId=${site.id}`}
                className="flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                전체 보기
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            {site.devices.length === 0 ? (
              <div className="text-center py-8">
                <Zap className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 mb-4">등록된 설비가 없습니다.</p>
                <Link
                  href={`/devices/new?siteId=${site.id}`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  설비 추가
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {site.devices.slice(0, 5).map((device) => {
                  const statusConfig = deviceStatusConfig[device.status];
                  const StatusIcon = statusConfig.icon;

                  return (
                    <Link
                      key={device.id}
                      href={`/devices/${device.id}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 hover:bg-slate-900 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn('p-2 rounded-lg', statusConfig.bg)}>
                          <StatusIcon className={cn('w-4 h-4', statusConfig.color)} />
                        </div>
                        <div>
                          <p className="text-white font-medium group-hover:text-cyan-400 transition-colors">
                            {device.name}
                          </p>
                          <p className="text-xs text-slate-400">{device.deviceType}</p>
                        </div>
                      </div>
                      <span
                        className={cn(
                          'text-xs px-2 py-1 rounded',
                          statusConfig.bg,
                          statusConfig.color
                        )}
                      >
                        {statusConfig.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">빠른 작업</h3>
            <div className="space-y-2">
              <Link
                href={`/devices/new?siteId=${site.id}`}
                className="flex items-center gap-3 p-3 rounded-lg bg-slate-900/50 hover:bg-slate-900 transition-colors text-white"
              >
                <Plus className="w-5 h-5 text-cyan-400" />
                <span>설비 추가</span>
              </Link>
              <Link
                href={`/monitoring?siteId=${site.id}`}
                className="flex items-center gap-3 p-3 rounded-lg bg-slate-900/50 hover:bg-slate-900 transition-colors text-white"
              >
                <Activity className="w-5 h-5 text-emerald-400" />
                <span>실시간 모니터링</span>
              </Link>
              <Link
                href={`/analytics/energy?siteId=${site.id}`}
                className="flex items-center gap-3 p-3 rounded-lg bg-slate-900/50 hover:bg-slate-900 transition-colors text-white"
              >
                <BarChart3 className="w-5 h-5 text-purple-400" />
                <span>에너지 분석</span>
              </Link>
            </div>
          </div>

          {/* Gateways */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Server className="w-5 h-5 text-amber-400" />
              게이트웨이
            </h3>

            {site.gateways.length === 0 ? (
              <p className="text-slate-400 text-sm">등록된 게이트웨이가 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {site.gateways.map((gateway) => {
                  return (
                    <div
                      key={gateway.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50"
                    >
                      <div>
                        <p className="text-white text-sm">{gateway.name || gateway.serialNumber}</p>
                        <p className="text-xs text-slate-400 font-mono">{gateway.serialNumber}</p>
                      </div>
                      <span
                        className={cn(
                          'w-2 h-2 rounded-full',
                          gateway.status === 'online' ? 'bg-emerald-400' : 'bg-slate-400'
                        )}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-white mb-2">사이트 삭제</h3>
            <p className="text-slate-400 mb-6">
              <span className="text-white font-medium">{site.name}</span> 사이트를 삭제하시겠습니까?
              {site._count.devices > 0 && (
                <span className="block mt-2 text-amber-400">
                  주의: 이 사이트에는 {site._count.devices}개의 설비가 연결되어 있습니다.
                  먼저 설비를 이동하거나 삭제해야 합니다.
                </span>
              )}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={site._count.devices > 0}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
