'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Eye,
  Mail,
  Phone,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  UserCog,
} from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete, ApiError } from '@/lib/api/client';
import { toast } from '@/lib/toast';

interface User {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: 'viewer' | 'operator' | 'site_manager' | 'tenant_admin';
  isActive: boolean;
  isEmailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  managedSites: { id: string; name: string }[];
}

interface UsersResponse {
  success: boolean;
  data: User[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  stats: {
    total: number;
    viewer?: number;
    operator?: number;
    site_manager?: number;
    tenant_admin?: number;
  };
}

const roleConfig: Record<
  string,
  { label: string; icon: React.ReactNode; color: string; bgColor: string }
> = {
  tenant_admin: {
    label: '관리자',
    icon: <ShieldCheck className="w-3.5 h-3.5" />,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
  },
  site_manager: {
    label: '사이트 관리자',
    icon: <Shield className="w-3.5 h-3.5" />,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
  },
  operator: {
    label: '운영자',
    icon: <UserCog className="w-3.5 h-3.5" />,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/20',
  },
  viewer: {
    label: '조회자',
    icon: <Eye className="w-3.5 h-3.5" />,
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/20',
  },
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UsersResponse['stats'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Dropdown
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    role: 'viewer' as User['role'],
    isActive: true,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { search }),
        ...(roleFilter !== 'all' && { role: roleFilter }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
      });

      const response = await apiGet<UsersResponse['data']>(`/api/admin/users?${params}`);

      if (response.success && response.data) {
        setUsers(response.data as User[]);
        // stats와 meta는 response에 포함되어 있음
        const fullResponse = response as unknown as UsersResponse & { stats: UsersResponse['stats']; meta: UsersResponse['meta'] };
        if (fullResponse.stats) setStats(fullResponse.stats);
        if (fullResponse.meta) {
          setTotalPages(fullResponse.meta.totalPages);
          setTotal(fullResponse.meta.total);
        }
      } else {
        setError('사용자 목록을 불러오는데 실패했습니다');
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('네트워크 오류가 발생했습니다');
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Validate form
  const validateForm = (isCreate: boolean) => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = '이름을 입력하세요';
    }

    if (isCreate) {
      if (!formData.email.trim()) {
        errors.email = '이메일을 입력하세요';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        errors.email = '올바른 이메일 형식이 아닙니다';
      }

      if (!formData.password) {
        errors.password = '비밀번호를 입력하세요';
      } else if (formData.password.length < 8) {
        errors.password = '비밀번호는 8자 이상이어야 합니다';
      } else if (!/[A-Z]/.test(formData.password)) {
        errors.password = '대문자를 포함해야 합니다';
      } else if (!/[a-z]/.test(formData.password)) {
        errors.password = '소문자를 포함해야 합니다';
      } else if (!/[0-9]/.test(formData.password)) {
        errors.password = '숫자를 포함해야 합니다';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Create user
  const handleCreate = async () => {
    if (!validateForm(true)) return;

    setActionLoading(true);
    try {
      const response = await apiPost<User>('/api/admin/users', formData);

      if (response.success) {
        setShowCreateModal(false);
        resetForm();
        fetchUsers();
      } else {
        setFormErrors({ submit: response.error || '사용자 생성에 실패했습니다' });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setFormErrors({ submit: err.message });
      } else {
        setFormErrors({ submit: '네트워크 오류가 발생했습니다' });
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Update user
  const handleUpdate = async () => {
    if (!selectedUser || !validateForm(false)) return;

    setActionLoading(true);
    try {
      const response = await apiPut<User>(`/api/admin/users/${selectedUser.id}`, {
        name: formData.name,
        phone: formData.phone || null,
        role: formData.role,
        isActive: formData.isActive,
      });

      if (response.success) {
        setShowEditModal(false);
        setSelectedUser(null);
        resetForm();
        fetchUsers();
      } else {
        setFormErrors({ submit: response.error || '사용자 수정에 실패했습니다' });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setFormErrors({ submit: err.message });
      } else {
        setFormErrors({ submit: '네트워크 오류가 발생했습니다' });
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Delete user
  const handleDelete = async () => {
    if (!selectedUser) return;

    setActionLoading(true);
    try {
      const response = await apiDelete(`/api/admin/users/${selectedUser.id}`);

      if (response.success) {
        setShowDeleteModal(false);
        setSelectedUser(null);
        fetchUsers();
      } else {
        toast.error(response.error || '사용자 삭제에 실패했습니다');
      }
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('네트워크 오류가 발생했습니다');
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      name: '',
      phone: '',
      role: 'viewer',
      isActive: true,
    });
    setFormErrors({});
  };

  // Open edit modal
  const openEdit = (user: User) => {
    setSelectedUser(user);
    setFormData({
      email: user.email,
      password: '',
      name: user.name,
      phone: user.phone || '',
      role: user.role,
      isActive: user.isActive,
    });
    setFormErrors({});
    setShowEditModal(true);
    setOpenDropdown(null);
  };

  // Open delete modal
  const openDelete = (user: User) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
    setOpenDropdown(null);
  };

  // Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '로그인 기록 없음';
    return new Date(dateStr).toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-[#051225] p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-7 h-7 text-cyan-400" />
            사용자 관리
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            팀 멤버를 관리하고 역할을 할당합니다
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>사용자 추가</span>
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-600/30 rounded-lg">
                <Users className="w-5 h-5 text-slate-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
                <p className="text-xs text-slate-400">전체</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 border border-purple-500/30 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <ShieldCheck className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-400">
                  {stats.tenant_admin || 0}
                </p>
                <p className="text-xs text-slate-400">관리자</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Shield className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-400">
                  {stats.site_manager || 0}
                </p>
                <p className="text-xs text-slate-400">사이트 관리자</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 border border-cyan-500/30 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/20 rounded-lg">
                <UserCog className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-cyan-400">
                  {stats.operator || 0}
                </p>
                <p className="text-xs text-slate-400">운영자</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-600/30 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-600/20 rounded-lg">
                <Eye className="w-5 h-5 text-slate-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-300">
                  {stats.viewer || 0}
                </p>
                <p className="text-xs text-slate-400">조회자</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="이름 또는 이메일로 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          {/* Role Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-400" />
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500/50"
            >
              <option value="all">모든 역할</option>
              <option value="tenant_admin">관리자</option>
              <option value="site_manager">사이트 관리자</option>
              <option value="operator">운영자</option>
              <option value="viewer">조회자</option>
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500/50"
          >
            <option value="all">모든 상태</option>
            <option value="active">활성</option>
            <option value="inactive">비활성</option>
          </select>

          {/* Refresh */}
          <button
            onClick={() => fetchUsers()}
            disabled={loading}
            className="p-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-slate-400 hover:text-white hover:border-slate-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <span className="text-red-400">{error}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  사용자
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  역할
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">
                  연락처
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">
                  최근 로그인
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  상태
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-2" />
                    <p className="text-slate-400">불러오는 중...</p>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Users className="w-12 h-12 text-slate-600 mx-auto mb-2" />
                    <p className="text-slate-400">사용자가 없습니다</p>
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const role = roleConfig[user.role] || {
                    label: '조회자',
                    icon: <Eye className="w-3.5 h-3.5" />,
                    color: 'text-slate-400',
                    bgColor: 'bg-slate-500/20',
                  };
                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-800/30 transition-colors"
                    >
                      {/* User Info */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-white font-medium">{user.name}</p>
                            <p className="text-slate-400 text-sm flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {user.email}
                              {user.isEmailVerified && (
                                <CheckCircle className="w-3 h-3 text-emerald-400 ml-1" />
                              )}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${role.bgColor} ${role.color}`}
                        >
                          {role.icon}
                          {role.label}
                        </span>
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-3 hidden md:table-cell">
                        {user.phone ? (
                          <span className="text-slate-300 text-sm flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {user.phone}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-sm">-</span>
                        )}
                      </td>

                      {/* Last Login */}
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-slate-400 text-sm flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDateTime(user.lastLoginAt)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center">
                        {user.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-400">
                            <CheckCircle className="w-3 h-3" />
                            활성
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-500/20 text-slate-400">
                            <XCircle className="w-3 h-3" />
                            비활성
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="relative">
                          <button
                            onClick={() =>
                              setOpenDropdown(
                                openDropdown === user.id ? null : user.id
                              )
                            }
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
                          >
                            <MoreVertical className="w-5 h-5" />
                          </button>

                          {openDropdown === user.id && (
                            <>
                              <div
                                className="fixed inset-0 z-10"
                                onClick={() => setOpenDropdown(null)}
                              />
                              <div className="absolute right-0 mt-1 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 py-1">
                                <button
                                  onClick={() => openEdit(user)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors"
                                >
                                  <Edit className="w-4 h-4" />
                                  수정
                                </button>
                                <button
                                  onClick={() => openDelete(user)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/20 transition-colors"
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
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700/50">
            <p className="text-sm text-slate-400">
              총 {total}명 중 {(page - 1) * 20 + 1}-{Math.min(page * 20, total)}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm bg-slate-700/50 text-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
              >
                이전
              </button>
              <span className="text-sm text-slate-400">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm bg-slate-700/50 text-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
              >
                다음
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-700">
              <h2 className="text-xl font-semibold text-white">사용자 추가</h2>
              <p className="text-sm text-slate-400 mt-1">
                새 팀 멤버를 추가합니다
              </p>
            </div>
            <div className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  이름 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="홍길동"
                  className={`w-full px-3 py-2.5 bg-slate-900/50 border rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 ${
                    formErrors.name ? 'border-red-500' : 'border-slate-700'
                  }`}
                />
                {formErrors.name && (
                  <p className="text-red-400 text-xs mt-1">{formErrors.name}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  이메일 <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="user@company.com"
                  className={`w-full px-3 py-2.5 bg-slate-900/50 border rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 ${
                    formErrors.email ? 'border-red-500' : 'border-slate-700'
                  }`}
                />
                {formErrors.email && (
                  <p className="text-red-400 text-xs mt-1">{formErrors.email}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  비밀번호 <span className="text-red-400">*</span>
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder="8자 이상, 대소문자 및 숫자 포함"
                  className={`w-full px-3 py-2.5 bg-slate-900/50 border rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 ${
                    formErrors.password ? 'border-red-500' : 'border-slate-700'
                  }`}
                />
                {formErrors.password && (
                  <p className="text-red-400 text-xs mt-1">
                    {formErrors.password}
                  </p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  전화번호
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="010-1234-5678"
                  className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  역할 <span className="text-red-400">*</span>
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      role: e.target.value as User['role'],
                    })
                  }
                  className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="viewer">조회자 - 데이터 조회만 가능</option>
                  <option value="operator">운영자 - 제어 기능 사용 가능</option>
                  <option value="site_manager">
                    사이트 관리자 - 사이트/설비 관리
                  </option>
                  <option value="tenant_admin">
                    관리자 - 모든 기능 사용 가능
                  </option>
                </select>
              </div>

              {/* Active */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                />
                <label htmlFor="isActive" className="text-sm text-slate-300">
                  계정 활성화
                </label>
              </div>

              {/* Error */}
              {formErrors.submit && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-400" />
                  <span className="text-red-400 text-sm">
                    {formErrors.submit}
                  </span>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleCreate}
                disabled={actionLoading}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                추가
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-700">
              <h2 className="text-xl font-semibold text-white">사용자 수정</h2>
              <p className="text-sm text-slate-400 mt-1">
                {selectedUser.email}
              </p>
            </div>
            <div className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  이름 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className={`w-full px-3 py-2.5 bg-slate-900/50 border rounded-lg text-white focus:outline-none focus:border-cyan-500/50 ${
                    formErrors.name ? 'border-red-500' : 'border-slate-700'
                  }`}
                />
                {formErrors.name && (
                  <p className="text-red-400 text-xs mt-1">{formErrors.name}</p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  전화번호
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="010-1234-5678"
                  className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  역할
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      role: e.target.value as User['role'],
                    })
                  }
                  className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="viewer">조회자</option>
                  <option value="operator">운영자</option>
                  <option value="site_manager">사이트 관리자</option>
                  <option value="tenant_admin">관리자</option>
                </select>
              </div>

              {/* Active */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="editIsActive"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                />
                <label htmlFor="editIsActive" className="text-sm text-slate-300">
                  계정 활성화
                </label>
              </div>

              {/* Info */}
              <div className="bg-slate-900/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">가입일</span>
                  <span className="text-slate-300">
                    {formatDate(selectedUser.createdAt)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">최근 로그인</span>
                  <span className="text-slate-300">
                    {formatDateTime(selectedUser.lastLoginAt)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">이메일 인증</span>
                  <span
                    className={
                      selectedUser.isEmailVerified
                        ? 'text-emerald-400'
                        : 'text-yellow-400'
                    }
                  >
                    {selectedUser.isEmailVerified ? '완료' : '미완료'}
                  </span>
                </div>
              </div>

              {/* Error */}
              {formErrors.submit && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-400" />
                  <span className="text-red-400 text-sm">
                    {formErrors.submit}
                  </span>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedUser(null);
                  resetForm();
                }}
                className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleUpdate}
                disabled={actionLoading}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && selectedUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 bg-red-500/20 rounded-full mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <h2 className="text-xl font-semibold text-white text-center mb-2">
                사용자 삭제
              </h2>
              <p className="text-slate-400 text-center mb-4">
                <span className="text-white font-medium">
                  {selectedUser.name}
                </span>
                님을 삭제하시겠습니까?
              </p>
              <p className="text-yellow-400 text-sm text-center bg-yellow-500/10 rounded-lg p-3">
                이 작업은 되돌릴 수 없습니다. 사용자의 모든 권한이 제거됩니다.
              </p>
            </div>
            <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedUser(null);
                }}
                className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
