'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Search,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Lightbulb,
  Bug,
  CreditCard,
  User,
  X,
  Save,
} from 'lucide-react';
import { apiGet, apiPatch } from '@/lib/api/client';
import { toast } from '@/lib/toast';

interface Inquiry {
  id: string;
  name: string;
  email: string;
  category: string;
  subject: string;
  status: string;
  tenantId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface InquiryDetail extends Inquiry {
  message: string;
  adminNote: string | null;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

const CATEGORIES = [
  { value: 'general', label: '일반', icon: HelpCircle, color: 'text-gray-400' },
  { value: 'technical', label: '기술', icon: AlertTriangle, color: 'text-cyan-400' },
  { value: 'billing', label: '결제', icon: CreditCard, color: 'text-amber-400' },
  { value: 'feature', label: '기능요청', icon: Lightbulb, color: 'text-purple-400' },
  { value: 'bug', label: '버그', icon: Bug, color: 'text-red-400' },
  { value: 'account', label: '계정', icon: User, color: 'text-green-400' },
];

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ElementType }
> = {
  pending: { label: '접수됨', color: 'text-gray-300', bg: 'bg-gray-600', icon: Clock },
  in_progress: { label: '처리중', color: 'text-cyan-300', bg: 'bg-cyan-700/40', icon: RefreshCw },
  resolved: { label: '해결됨', color: 'text-green-300', bg: 'bg-green-700/40', icon: CheckCircle2 },
  closed: { label: '종료', color: 'text-gray-500', bg: 'bg-gray-700/40', icon: XCircle },
};

const STATUS_FLOW: Record<string, string[]> = {
  pending: ['in_progress', 'resolved', 'closed'],
  in_progress: ['resolved', 'closed', 'pending'],
  resolved: ['closed', 'in_progress'],
  closed: ['pending'],
};

export default function AdminSupportPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [selected, setSelected] = useState<InquiryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchInquiries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (filterStatus) params.set('status', filterStatus);
      if (filterCategory) params.set('category', filterCategory);

      const res = await apiGet<{ inquiries: Inquiry[] }>(
        `/api/support?${params}`
      );
      setInquiries(res.data?.inquiries ?? []);
      const m = res.meta;
      if (m) {
        setPagination({
          page: Number(m.page ?? page),
          limit: Number(m.limit ?? 20),
          total: res.pagination?.total ?? 0,
          totalPages: Number(m.totalPages ?? 1),
          hasMore: res.pagination?.hasMore ?? false,
        });
      }
    } catch {
      toast.error('문의 목록을 불러오는 데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [page, search, filterStatus, filterCategory]);

  useEffect(() => {
    fetchInquiries();
  }, [fetchInquiries]);

  const openDetail = async (inquiry: Inquiry) => {
    setDetailLoading(true);
    setSelected(null);
    try {
      const res = await apiGet<{ inquiry: InquiryDetail }>(`/api/support/${inquiry.id}`);
      setSelected(res.data?.inquiry ?? null);
      setAdminNote(res.data?.inquiry?.adminNote ?? '');
    } catch {
      toast.error('문의 상세 정보를 불러오는 데 실패했습니다.');
    } finally {
      setDetailLoading(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    setUpdatingStatus(true);
    try {
      await apiPatch(`/api/support/${id}`, { status });
      toast.success('상태가 업데이트되었습니다.');
      setSelected((prev) => (prev ? { ...prev, status } : null));
      setInquiries((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
    } catch {
      toast.error('상태 업데이트에 실패했습니다.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const saveNote = async () => {
    if (!selected) return;
    setSavingNote(true);
    try {
      await apiPatch(`/api/support/${selected.id}`, { adminNote });
      toast.success('메모가 저장되었습니다.');
      setSelected((prev) => (prev ? { ...prev, adminNote } : null));
    } catch {
      toast.error('메모 저장에 실패했습니다.');
    } finally {
      setSavingNote(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchInquiries();
  };

  // Summary counts
  const statusCounts = inquiries.reduce(
    (acc, i) => {
      acc[i.status] = (acc[i.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-cyan-400" />
            고객 지원 관리
          </h1>
          <p className="text-sm text-gray-400 mt-1">문의 처리 및 피드백 관리</p>
        </div>
        <button
          onClick={fetchInquiries}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const Icon = cfg.icon;
          return (
            <button
              key={key}
              onClick={() => {
                setFilterStatus(filterStatus === key ? '' : key);
                setPage(1);
              }}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                filterStatus === key
                  ? 'border-cyan-500 bg-cyan-500/10'
                  : 'border-gray-700 bg-gray-800 hover:border-gray-500'
              }`}
            >
              <Icon className={`w-4 h-4 ${cfg.color}`} />
              <div>
                <p className="text-xs text-gray-400">{cfg.label}</p>
                <p className="text-lg font-bold text-white">{statusCounts[key] ?? 0}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Search + Filters */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="제목, 이름, 이메일 검색..."
            className="w-full pl-9 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => {
            setFilterCategory(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
        >
          <option value="">전체 유형</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm transition-colors"
        >
          검색
        </button>
      </form>

      {/* Main Content: List + Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* List */}
        <div className={`${selected ? 'lg:col-span-2' : 'lg:col-span-5'}`}>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-7 h-7 text-cyan-400 animate-spin" />
            </div>
          ) : inquiries.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>문의 내역이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {inquiries.map((inquiry) => {
                const cat = CATEGORIES.find((c) => c.value === inquiry.category);
                const Icon = cat?.icon ?? HelpCircle;
                const statusCfg = STATUS_CONFIG[inquiry.status] ?? STATUS_CONFIG['pending']!;
                const StatusIcon = statusCfg.icon;
                const isSelected = selected?.id === inquiry.id;

                return (
                  <div
                    key={inquiry.id}
                    onClick={() => openDetail(inquiry)}
                    className={`bg-gray-800 border rounded-lg p-4 cursor-pointer transition-all hover:border-gray-500 ${
                      isSelected ? 'border-cyan-500 bg-gray-800' : 'border-gray-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${cat?.color ?? 'text-gray-400'}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {inquiry.subject}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {inquiry.name} · {inquiry.email}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        <span
                          className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${statusCfg.bg} ${statusCfg.color}`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {statusCfg.label}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(inquiry.createdAt).toLocaleDateString('ko-KR')}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-sm text-white rounded-lg"
              >
                이전
              </button>
              <span className="text-sm text-gray-400">
                {page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={!pagination.hasMore}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-sm text-white rounded-lg"
              >
                다음
              </button>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {(selected || detailLoading) && (
          <div className="lg:col-span-3 bg-gray-800 border border-gray-700 rounded-lg p-5">
            {detailLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
              </div>
            ) : selected ? (
              <div className="space-y-5">
                {/* Detail Header */}
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-white">{selected.subject}</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {selected.name} · {selected.email} ·{' '}
                      {new Date(selected.createdAt).toLocaleString('ko-KR')}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="shrink-0 ml-2 p-1.5 text-gray-400 hover:text-white rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Status Change */}
                <div>
                  <p className="text-xs text-gray-400 mb-2">상태 변경</p>
                  <div className="flex gap-2 flex-wrap">
                    {(STATUS_FLOW[selected.status] ?? []).map((s) => {
                      const cfg = STATUS_CONFIG[s] ?? STATUS_CONFIG['pending']!;
                      const SIcon = cfg.icon;
                      return (
                        <button
                          key={s}
                          onClick={() => updateStatus(selected.id, s)}
                          disabled={updatingStatus}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors ${cfg.bg} ${cfg.color} border-transparent hover:border-gray-500`}
                        >
                          {updatingStatus ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <SIcon className="w-3 h-3" />
                          )}
                          → {cfg.label}
                        </button>
                      );
                    })}
                    <span
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs ${STATUS_CONFIG[selected.status]?.bg} ${STATUS_CONFIG[selected.status]?.color}`}
                    >
                      현재: {STATUS_CONFIG[selected.status]?.label}
                    </span>
                  </div>
                </div>

                {/* Message */}
                <div>
                  <p className="text-xs text-gray-400 mb-2">문의 내용</p>
                  <div className="bg-gray-900/60 rounded-lg p-4 text-sm text-gray-200 whitespace-pre-wrap max-h-52 overflow-y-auto leading-relaxed">
                    {selected.message}
                  </div>
                </div>

                {/* Admin Note */}
                <div>
                  <p className="text-xs text-gray-400 mb-2">관리자 메모 (내부용)</p>
                  <textarea
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    placeholder="처리 내용, 참고 사항 등을 입력하세요..."
                    rows={4}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500 resize-none"
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={saveNote}
                      disabled={savingNote}
                      className="flex items-center gap-1.5 px-4 py-1.5 bg-gray-600 hover:bg-gray-500 text-white rounded-lg text-sm transition-colors"
                    >
                      {savingNote ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      메모 저장
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
