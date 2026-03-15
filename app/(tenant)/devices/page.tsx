'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Zap,
  Plus,
  Search,
  RefreshCw,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  AlertCircle,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Settings,
  Activity,
  Thermometer,
  Gauge,
  Lightbulb,
  Cpu,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchWithCsrf } from '@/hooks/use-csrf';
import { toast } from '@/lib/toast';

// Types
interface Device {
  id: string;
  name: string;
  deviceType: string;
  status: 'online' | 'offline' | 'error' | 'maintenance';
  lastSeenAt: string | null;
  siteId: string;
  site?: {
    id: string;
    name: string;
  };
}

interface DevicesResponse {
  data: Device[];
  nextCursor: string | null;
  pageSize: number;
}

// Device type configuration
const deviceTypeConfig: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  HVAC: { label: 'HVAC', icon: Thermometer, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  LIGHTING: { label: '조명', icon: Lightbulb, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  METER: { label: '계량기', icon: Gauge, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  POWER_FACTOR: { label: '역률', icon: Zap, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  TEMPERATURE_SENSOR: { label: '온도센서', icon: Thermometer, color: 'text-red-400', bg: 'bg-red-500/10' },
  PRODUCTION_EQUIPMENT: { label: '생산설비', icon: Cpu, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  OTHER: { label: '기타', icon: Settings, color: 'text-slate-400', bg: 'bg-slate-500/10' },
};

// Status configuration
const statusConfig = {
  online: { label: '온라인', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircle },
  offline: { label: '오프라인', color: 'text-slate-400', bg: 'bg-slate-500/10', icon: XCircle },
  error: { label: '오류', color: 'text-red-400', bg: 'bg-red-500/10', icon: AlertCircle },
  maintenance: { label: '점검중', color: 'text-amber-400', bg: 'bg-amber-500/10', icon: Clock },
};

function DevicesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSiteId = searchParams.get('siteId');

  const [devices, setDevices] = useState<Device[]>([]);
  const [sites, setSites] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterSiteId, setFilterSiteId] = useState<string | null>(initialSiteId);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // Fetch sites for filter dropdown
  const fetchSites = useCallback(async () => {
    try {
      const response = await fetch('/api/sites?take=100');
      const data = await response.json();
      if (data.success) {
        setSites(data.data);
      }
    } catch {
      // Silently fail - sites are optional for filtering
    }
  }, []);

  // Fetch devices
  const fetchDevices = useCallback(async (cursor?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('take', '20');
      if (cursor) params.set('cursor', cursor);
      if (filterSiteId) params.set('siteId', filterSiteId);

      const response = await fetch(`/api/devices?${params.toString()}`);
      const data: DevicesResponse = await response.json();

      if (!response.ok) {
        throw new Error('Failed to fetch devices');
      }

      if (cursor) {
        setDevices((prev) => [...prev, ...data.data]);
      } else {
        setDevices(data.data);
      }
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : '설비 목록을 불러올 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [filterSiteId]);

  useEffect(() => {
    fetchSites();
  }, [fetchSites]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  // Delete device
  const handleDelete = async (device: Device) => {
    try {
      const response = await fetchWithCsrf(`/api/devices/${device.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete device');
      }

      setShowDeleteConfirm(false);
      setSelectedDevice(null);
      fetchDevices();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '설비 삭제에 실패했습니다.');
    }
  };

  // Filter devices
  const filteredDevices = devices.filter((device) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!device.name.toLowerCase().includes(query)) return false;
    }
    if (filterStatus && device.status !== filterStatus) return false;
    if (filterType && device.deviceType !== filterType) return false;
    return true;
  });

  // Calculate stats
  const stats = {
    total: devices.length,
    online: devices.filter((d) => d.status === 'online').length,
    offline: devices.filter((d) => d.status === 'offline').length,
    error: devices.filter((d) => d.status === 'error').length,
  };

  return (
    <div className="h-full bg-[#051225] p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg">
              <Zap className="w-6 h-6 text-cyan-400" />
            </div>
            설비 관리
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            에너지 설비를 관리하고 모니터링합니다.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-5 h-5" />
          새 설비 추가
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <p className="text-slate-400 text-sm mb-1">총 설비</p>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <p className="text-slate-400 text-sm mb-1">온라인</p>
          <p className="text-2xl font-bold text-emerald-400">{stats.online}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <p className="text-slate-400 text-sm mb-1">오프라인</p>
          <p className="text-2xl font-bold text-slate-400">{stats.offline}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <p className="text-slate-400 text-sm mb-1">오류</p>
          <p className="text-2xl font-bold text-red-400">{stats.error}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="설비명으로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          />
        </div>

        {/* Site Filter */}
        <select
          value={filterSiteId || ''}
          onChange={(e) => setFilterSiteId(e.target.value || null)}
          className="px-3 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
        >
          <option value="">전체 사이트</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={filterStatus || ''}
          onChange={(e) => setFilterStatus(e.target.value || null)}
          className="px-3 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
        >
          <option value="">전체 상태</option>
          {Object.entries(statusConfig).map(([key, config]) => (
            <option key={key} value={key}>
              {config.label}
            </option>
          ))}
        </select>

        {/* Type Filter */}
        <select
          value={filterType || ''}
          onChange={(e) => setFilterType(e.target.value || null)}
          className="px-3 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
        >
          <option value="">전체 유형</option>
          {Object.entries(deviceTypeConfig).map(([key, config]) => (
            <option key={key} value={key}>
              {config.label}
            </option>
          ))}
        </select>

        {/* Refresh */}
        <button
          onClick={() => fetchDevices()}
          disabled={isLoading}
          className="p-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('w-5 h-5', isLoading && 'animate-spin')} />
        </button>
      </div>

      {/* Content */}
      {isLoading && devices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
          <p className="text-slate-400">설비 목록을 불러오는 중...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20">
          <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => fetchDevices()}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            다시 시도
          </button>
        </div>
      ) : filteredDevices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Zap className="w-16 h-16 text-slate-600 mb-4" />
          <h3 className="text-xl font-semibold text-slate-300 mb-2">
            {searchQuery || filterStatus || filterType || filterSiteId
              ? '검색 결과가 없습니다'
              : '등록된 설비가 없습니다'}
          </h3>
          <p className="text-slate-400 mb-6">
            {searchQuery || filterStatus || filterType || filterSiteId
              ? '다른 검색어나 필터를 사용해 보세요.'
              : '새 설비를 추가하여 에너지 모니터링을 시작하세요.'}
          </p>
          {!searchQuery && !filterStatus && !filterType && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium transition-colors"
            >
              <Plus className="w-5 h-5" />
              첫 번째 설비 추가
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Devices Table */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">
                      설비명
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">
                      유형
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">
                      상태
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">
                      마지막 통신
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase">
                      작업
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDevices.map((device) => {
                    const typeConfig = deviceTypeConfig[device.deviceType] || {
                      label: '기타',
                      icon: Settings,
                      color: 'text-slate-400',
                      bg: 'bg-slate-500/10',
                    };
                    const TypeIcon = typeConfig.icon;
                    const status = statusConfig[device.status as keyof typeof statusConfig] || {
                      label: '알 수 없음',
                      color: 'text-slate-400',
                      bg: 'bg-slate-500/10',
                      icon: AlertCircle,
                    };
                    const StatusIcon = status.icon;

                    return (
                      <tr
                        key={device.id}
                        className="border-b border-slate-700/30 hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="px-4 py-4">
                          <Link
                            href={`/devices/${device.id}`}
                            className="flex items-center gap-3 group"
                          >
                            <div className={cn('p-2 rounded-lg', typeConfig.bg)}>
                              <TypeIcon className={cn('w-5 h-5', typeConfig.color)} />
                            </div>
                            <div>
                              <p className="text-white font-medium group-hover:text-cyan-400 transition-colors">
                                {device.name}
                              </p>
                              {device.site && (
                                <p className="text-xs text-slate-400 flex items-center gap-1">
                                  <Building2 className="w-3 h-3" />
                                  {device.site.name}
                                </p>
                              )}
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium',
                              typeConfig.bg,
                              typeConfig.color
                            )}
                          >
                            {typeConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium',
                              status.bg,
                              status.color
                            )}
                          >
                            <StatusIcon className="w-3.5 h-3.5" />
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-400">
                          {device.lastSeenAt
                            ? new Date(device.lastSeenAt).toLocaleString('ko-KR')
                            : '-'}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="relative inline-block">
                            <button
                              onClick={() =>
                                setActionMenuId(actionMenuId === device.id ? null : device.id)
                              }
                              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                            >
                              <MoreVertical className="w-5 h-5" />
                            </button>

                            {actionMenuId === device.id && (
                              <>
                                <div
                                  className="fixed inset-0 z-40"
                                  onClick={() => setActionMenuId(null)}
                                />
                                <div className="absolute right-0 mt-1 w-44 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
                                  <Link
                                    href={`/devices/${device.id}`}
                                    onClick={() => setActionMenuId(null)}
                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                                  >
                                    <Eye className="w-4 h-4" />
                                    상세 보기
                                  </Link>
                                  <Link
                                    href={`/monitoring?deviceId=${device.id}`}
                                    onClick={() => setActionMenuId(null)}
                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                                  >
                                    <Activity className="w-4 h-4" />
                                    모니터링
                                  </Link>
                                  <button
                                    onClick={() => {
                                      router.push(`/devices/${device.id}/edit`);
                                      setActionMenuId(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                                  >
                                    <Edit className="w-4 h-4" />
                                    수정
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedDevice(device);
                                      setShowDeleteConfirm(true);
                                      setActionMenuId(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    삭제
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Load More */}
          {nextCursor && (
            <div className="flex justify-center mt-6">
              <button
                onClick={() => fetchDevices(nextCursor)}
                disabled={isLoading}
                className="px-6 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                {isLoading ? '불러오는 중...' : '더 보기'}
              </button>
            </div>
          )}
        </>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <DeviceCreateModal
          sites={sites}
          defaultSiteId={filterSiteId}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchDevices();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedDevice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-white mb-2">설비 삭제</h3>
            <p className="text-slate-400 mb-6">
              <span className="text-white font-medium">{selectedDevice.name}</span> 설비를
              삭제하시겠습니까?
              <br />이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setSelectedDevice(null);
                }}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => handleDelete(selectedDevice)}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
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

// Device Create Modal
function DeviceCreateModal({
  sites,
  defaultSiteId,
  onClose,
  onCreated,
}: {
  sites: { id: string; name: string }[];
  defaultSiteId: string | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    deviceType: 'METER',
    protocol: 'modbus_tcp',
    siteId: defaultSiteId || '',
    connectionConfig: {
      host: '',
      port: 502,
    },
    controlCapable: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (!formData.siteId) {
        throw new Error('사이트를 선택해주세요.');
      }

      const response = await fetchWithCsrf('/api/devices', {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create device');
      }

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : '설비 생성에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-white">새 설비 추가</h2>
          <p className="text-sm text-slate-400 mt-1">에너지 설비 정보를 입력하세요.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              설비명 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
              placeholder="예: 1공장 전력계량기"
              required
              className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
          </div>

          {/* Site */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              사이트 <span className="text-red-400">*</span>
            </label>
            <select
              value={formData.siteId}
              onChange={(e) => setFormData((f) => ({ ...f, siteId: e.target.value }))}
              required
              className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            >
              <option value="">사이트 선택</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </div>

          {/* Device Type */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              설비 유형 <span className="text-red-400">*</span>
            </label>
            <select
              value={formData.deviceType}
              onChange={(e) => setFormData((f) => ({ ...f, deviceType: e.target.value }))}
              className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            >
              {Object.entries(deviceTypeConfig).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>

          {/* Protocol */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              통신 프로토콜 <span className="text-red-400">*</span>
            </label>
            <select
              value={formData.protocol}
              onChange={(e) => setFormData((f) => ({ ...f, protocol: e.target.value }))}
              className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            >
              <option value="modbus_tcp">Modbus TCP</option>
              <option value="modbus_rtu">Modbus RTU</option>
              <option value="bacnet">BACnet</option>
              <option value="opcua">OPC-UA</option>
              <option value="mqtt">MQTT</option>
              <option value="http">HTTP</option>
            </select>
          </div>

          {/* Connection Config */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Host/IP <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.connectionConfig.host}
                onChange={(e) =>
                  setFormData((f) => ({
                    ...f,
                    connectionConfig: { ...f.connectionConfig, host: e.target.value },
                  }))
                }
                placeholder="192.168.1.100"
                required
                className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Port <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                value={formData.connectionConfig.port}
                onChange={(e) =>
                  setFormData((f) => ({
                    ...f,
                    connectionConfig: { ...f.connectionConfig, port: parseInt(e.target.value) || 0 },
                  }))
                }
                placeholder="502"
                required
                min="1"
                max="65535"
                className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>
          </div>

          {/* Control Capable */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="controlCapable"
              checked={formData.controlCapable}
              onChange={(e) => setFormData((f) => ({ ...f, controlCapable: e.target.checked }))}
              className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500/50"
            />
            <label htmlFor="controlCapable" className="text-sm text-slate-300">
              제어 가능 설비
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.name || !formData.siteId}
              className="flex-1 px-4 py-2.5 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  생성 중...
                </>
              ) : (
                '설비 생성'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Loading fallback component
function DevicesPageLoading() {
  return (
    <div className="h-full bg-[#051225] flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="mt-4 text-slate-400">Loading devices...</p>
      </div>
    </div>
  );
}

// Export with Suspense wrapper for useSearchParams
export default function DevicesPage() {
  return (
    <Suspense fallback={<DevicesPageLoading />}>
      <DevicesPageContent />
    </Suspense>
  );
}
