'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Plus,
  Search,
  Filter,
  MapPin,
  Zap,
  ChevronRight,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  AlertCircle,
  Loader2,
  RefreshCw,
  Factory,
  Building,
  Warehouse,
  Store,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchWithCsrf } from '@/hooks/use-csrf';
import { toast } from '@/lib/toast';

// Types
interface Site {
  id: string;
  name: string;
  code: string | null;
  siteType: 'factory' | 'office' | 'warehouse' | 'retail' | 'mixed';
  city: string | null;
  country: string;
  isActive: boolean;
  createdAt: string;
  _count?: {
    devices: number;
    gateways: number;
  };
}

interface SitesResponse {
  success: boolean;
  data: Site[];
  pagination: {
    skip: number;
    take: number;
    total: number;
    hasMore: boolean;
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

export default function SitesPage() {
  const router = useRouter();
  const [sites, setSites] = useState<Site[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ skip: 0, take: 20, total: 0, hasMore: false });

  // Fetch sites
  const fetchSites = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('skip', String(pagination.skip));
      params.set('take', String(pagination.take));
      if (filterType) params.set('siteType', filterType);

      const response = await fetch(`/api/sites?${params.toString()}`);
      const data: SitesResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.success === false ? '사이트를 가져오는 데 실패했습니다.' : '알 수 없는 오류');
      }

      setSites(data.data);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : '사이트 목록을 불러올 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [pagination.skip, pagination.take, filterType]);

  useEffect(() => {
    fetchSites();
  }, [fetchSites]);

  // Delete site
  const handleDelete = async (site: Site) => {
    try {
      const response = await fetchWithCsrf(`/api/sites/${site.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete site');
      }

      setShowDeleteConfirm(false);
      setSelectedSite(null);
      fetchSites();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '사이트 삭제에 실패했습니다.');
    }
  };

  // Filter sites by search query
  const filteredSites = sites.filter((site) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      site.name.toLowerCase().includes(query) ||
      site.code?.toLowerCase().includes(query) ||
      site.city?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="min-h-screen bg-[#051225] p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg">
              <Building2 className="w-6 h-6 text-cyan-400" />
            </div>
            사이트 관리
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            사업장 및 시설을 관리합니다. ({pagination.total}개)
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-5 h-5" />
          새 사이트 추가
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="사이트명, 코드, 도시로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          />
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-slate-400" />
          <select
            value={filterType || ''}
            onChange={(e) => setFilterType(e.target.value || null)}
            className="px-3 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          >
            <option value="">전체 유형</option>
            {Object.entries(siteTypeConfig).map(([key, config]) => (
              <option key={key} value={key}>
                {config.label}
              </option>
            ))}
          </select>
        </div>

        {/* Refresh */}
        <button
          onClick={fetchSites}
          disabled={isLoading}
          className="p-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('w-5 h-5', isLoading && 'animate-spin')} />
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
          <p className="text-slate-400">사이트 목록을 불러오는 중...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20">
          <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={fetchSites}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            다시 시도
          </button>
        </div>
      ) : filteredSites.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Building2 className="w-16 h-16 text-slate-600 mb-4" />
          <h3 className="text-xl font-semibold text-slate-300 mb-2">
            {searchQuery || filterType ? '검색 결과가 없습니다' : '등록된 사이트가 없습니다'}
          </h3>
          <p className="text-slate-400 mb-6">
            {searchQuery || filterType
              ? '다른 검색어나 필터를 사용해 보세요.'
              : '새 사이트를 추가하여 에너지 관리를 시작하세요.'}
          </p>
          {!searchQuery && !filterType && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium transition-colors"
            >
              <Plus className="w-5 h-5" />
              첫 번째 사이트 추가
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Sites Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSites.map((site) => {
              const typeConfig = siteTypeConfig[site.siteType];
              const TypeIcon = typeConfig.icon;

              return (
                <div
                  key={site.id}
                  className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 hover:border-cyan-500/30 transition-colors group relative"
                >
                  {/* Action Menu Button */}
                  <div className="absolute top-4 right-4">
                    <button
                      onClick={() => setActionMenuId(actionMenuId === site.id ? null : site.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>

                    {/* Dropdown Menu */}
                    {actionMenuId === site.id && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setActionMenuId(null)}
                        />
                        <div className="absolute right-0 mt-1 w-44 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
                          <button
                            onClick={() => {
                              router.push(`/sites/${site.id}`);
                              setActionMenuId(null);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                            상세 보기
                          </button>
                          <button
                            onClick={() => {
                              router.push(`/sites/${site.id}/edit`);
                              setActionMenuId(null);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                            수정
                          </button>
                          <button
                            onClick={() => {
                              setSelectedSite(site);
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

                  {/* Site Type Badge */}
                  <div
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium mb-3',
                      typeConfig.bg,
                      typeConfig.color
                    )}
                  >
                    <TypeIcon className="w-3.5 h-3.5" />
                    {typeConfig.label}
                  </div>

                  {/* Site Name */}
                  <h3 className="text-lg font-semibold text-white mb-1">{site.name}</h3>
                  {site.code && (
                    <p className="text-xs text-slate-500 font-mono mb-3">{site.code}</p>
                  )}

                  {/* Location */}
                  {site.city && (
                    <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
                      <MapPin className="w-4 h-4" />
                      <span>
                        {site.city}, {site.country}
                      </span>
                    </div>
                  )}

                  {/* Stats */}
                  {site._count && (
                    <div className="flex items-center gap-4 pt-4 border-t border-slate-700/50">
                      <div className="flex items-center gap-1.5 text-sm">
                        <Zap className="w-4 h-4 text-amber-400" />
                        <span className="text-slate-300">
                          {site._count.devices}
                          <span className="text-slate-500 ml-1">설비</span>
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Status Badge */}
                  <div className="mt-4 flex items-center justify-between">
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                        site.isActive
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-slate-500/10 text-slate-400'
                      )}
                    >
                      {site.isActive ? '운영중' : '비활성'}
                    </span>

                    <button
                      onClick={() => router.push(`/sites/${site.id}`)}
                      className="flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      자세히
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {pagination.total > pagination.take && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPagination((p) => ({ ...p, skip: Math.max(0, p.skip - p.take) }))}
                disabled={pagination.skip === 0}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                이전
              </button>
              <span className="text-slate-400 px-4">
                {Math.floor(pagination.skip / pagination.take) + 1} /{' '}
                {Math.ceil(pagination.total / pagination.take)}
              </span>
              <button
                onClick={() => setPagination((p) => ({ ...p, skip: p.skip + p.take }))}
                disabled={!pagination.hasMore}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                다음
              </button>
            </div>
          )}
        </>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <SiteCreateModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchSites();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedSite && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-white mb-2">사이트 삭제</h3>
            <p className="text-slate-400 mb-6">
              <span className="text-white font-medium">{selectedSite.name}</span> 사이트를 삭제하시겠습니까?
              <br />이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setSelectedSite(null);
                }}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => handleDelete(selectedSite)}
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

// Site Create Modal Component
function SiteCreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    siteType: 'factory' as const,
    address: '',
    city: '',
    country: 'KR',
    areaSqm: '',
    peakPowerKw: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetchWithCsrf('/api/sites', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          areaSqm: formData.areaSqm ? parseFloat(formData.areaSqm) : undefined,
          peakPowerKw: formData.peakPowerKw ? parseFloat(formData.peakPowerKw) : undefined,
          code: formData.code || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create site');
      }

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : '사이트 생성에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-white">새 사이트 추가</h2>
          <p className="text-sm text-slate-400 mt-1">사업장 정보를 입력하세요.</p>
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
              사이트명 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
              placeholder="예: 서울 본사 공장"
              required
              className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
          </div>

          {/* Code */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              사이트 코드
            </label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData((f) => ({ ...f, code: e.target.value }))}
              placeholder="예: SITE-001"
              className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
          </div>

          {/* Site Type */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              사이트 유형 <span className="text-red-400">*</span>
            </label>
            <select
              value={formData.siteType}
              onChange={(e) => setFormData((f) => ({ ...f, siteType: e.target.value as any }))}
              className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            >
              {Object.entries(siteTypeConfig).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">주소</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData((f) => ({ ...f, address: e.target.value }))}
              placeholder="예: 서울시 강남구 테헤란로 123"
              className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
          </div>

          {/* City & Country */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">도시</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData((f) => ({ ...f, city: e.target.value }))}
                placeholder="예: 서울"
                className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">국가</label>
              <select
                value={formData.country}
                onChange={(e) => setFormData((f) => ({ ...f, country: e.target.value }))}
                className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              >
                <option value="KR">대한민국</option>
                <option value="US">미국</option>
                <option value="JP">일본</option>
                <option value="CN">중국</option>
              </select>
            </div>
          </div>

          {/* Area & Peak Power */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                면적 (㎡)
              </label>
              <input
                type="number"
                value={formData.areaSqm}
                onChange={(e) => setFormData((f) => ({ ...f, areaSqm: e.target.value }))}
                placeholder="예: 5000"
                min="0"
                step="0.01"
                className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                피크 전력 (kW)
              </label>
              <input
                type="number"
                value={formData.peakPowerKw}
                onChange={(e) => setFormData((f) => ({ ...f, peakPowerKw: e.target.value }))}
                placeholder="예: 1000"
                min="0"
                step="0.01"
                className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>
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
              disabled={isSubmitting || !formData.name}
              className="flex-1 px-4 py-2.5 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  생성 중...
                </>
              ) : (
                '사이트 생성'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
