'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  LayoutGrid, GripVertical, ChevronDown, ChevronRight,
  Eye, EyeOff, Shield, Loader2, Save, Settings,
  AlertCircle, Plus, Trash2, Pencil, Check, X,
  FolderPlus,
} from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api/client';
import { toast } from '@/lib/toast';

interface MenuItem {
  id: string;
  code: string;
  label: string;
  path: string;
  icon: string;
  minRole: string;
  sortOrder: number;
  enabled: boolean;
  featureRequired: string | null;
  badgeType: string | null;
}

interface MenuGroup {
  id: string;
  code: string;
  label: string;
  icon: string;
  minRole: string;
  sortOrder: number;
  section: string;
  items: MenuItem[];
}

// ── 모달 타입 ─────────────────────────────────────────────────────
interface CreateGroupForm {
  code: string; name: string; icon: string; minRole: string; sortOrder: string;
}
interface CreateItemForm {
  code: string; name: string; path: string; icon: string; minRole: string; sortOrder: string;
}
interface EditGroupForm  { id: string; name: string; icon: string; minRole: string; }
interface EditItemForm   { id: string; name: string; path: string; icon: string; minRole: string; }

const ROLE_LABELS: Record<string, string> = {
  viewer: '뷰어', operator: '운영자', site_manager: '사이트 관리자',
  tenant_admin: '테넌트 관리자', super_admin: '슈퍼 관리자',
};
const ROLE_COLORS: Record<string, string> = {
  viewer:       'text-slate-400 bg-slate-500/10',
  operator:     'text-blue-400 bg-blue-500/10',
  site_manager: 'text-amber-400 bg-amber-500/10',
  tenant_admin: 'text-purple-400 bg-purple-500/10',
  super_admin:  'text-red-400 bg-red-500/10',
};
const ROLES = Object.keys(ROLE_LABELS);

// ── 공통 입력 스타일 ───────────────────────────────────────────────
const inp = 'w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500';
const inpSm = 'bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500';

// ── 역할 선택 공통 ─────────────────────────────────────────────────
function RoleSelect({ value, onChange, small }: { value: string; onChange: (v: string) => void; small?: boolean }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className={small ? inpSm : inp}>
      {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
    </select>
  );
}

// ── 모달 래퍼 ─────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function MenuManagementPage() {
  const [menuGroups,     setMenuGroups]     = useState<MenuGroup[]>([]);
  const [isLoading,      setIsLoading]      = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [saving,         setSaving]         = useState(false);
  const [hasChanges,     setHasChanges]     = useState(false);
  const [actionLoading,  setActionLoading]  = useState(false);

  // 인라인 역할 편집 (기존)
  const [editingRole,    setEditingRole]    = useState<string | null>(null);

  // 그룹 인라인 수정
  const [editGroup,   setEditGroup]   = useState<EditGroupForm | null>(null);
  // 항목 인라인 수정
  const [editItem,    setEditItem]    = useState<EditItemForm | null>(null);

  // 그룹 생성 모달
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [cgForm, setCgForm] = useState<CreateGroupForm>({
    code: '', name: '', icon: 'LayoutGrid', minRole: 'viewer', sortOrder: '99',
  });

  // 항목 생성 모달 (어느 그룹에 추가할지)
  const [createItemGroupId, setCreateItemGroupId] = useState<string | null>(null);
  const [ciForm, setCiForm] = useState<CreateItemForm>({
    code: '', name: '', path: '', icon: 'Circle', minRole: 'viewer', sortOrder: '99',
  });

  // ── 데이터 로드 ────────────────────────────────────────────────
  const fetchMenus = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiGet<MenuGroup[]>('/api/menus?all=true');
      if (res.success && res.data) {
        setMenuGroups(res.data);
        setExpandedGroups(new Set(res.data.map(g => g.id)));
        setHasChanges(false);
      } else {
        setError('메뉴 데이터를 불러오지 못했습니다.');
      }
    } catch {
      setError('API 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchMenus(); }, [fetchMenus]);

  // ── 기존: toggle / role 변경 (batch 저장 방식 유지) ─────────────
  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleItemEnabled = (groupId: string, itemId: string) => {
    setMenuGroups(prev => prev.map(g =>
      g.id === groupId ? { ...g, items: g.items.map(i => i.id === itemId ? { ...i, enabled: !i.enabled } : i) } : g
    ));
    setHasChanges(true);
  };

  const updateItemRole = (groupId: string, itemId: string, role: string) => {
    setMenuGroups(prev => prev.map(g =>
      g.id === groupId ? { ...g, items: g.items.map(i => i.id === itemId ? { ...i, minRole: role } : i) } : g
    ));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiPost('/api/admin/menus', { groups: menuGroups });
      setHasChanges(false);
      toast.success('메뉴 설정이 저장되었습니다.');
    } catch {
      toast.error('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // ── CRUD 헬퍼 ─────────────────────────────────────────────────
  async function runAction(payload: Record<string, unknown>, successMsg: string) {
    setActionLoading(true);
    try {
      await apiPost('/api/admin/menus', payload);
      toast.success(successMsg);
      await fetchMenus();
    } catch {
      toast.error('작업 실패');
    } finally {
      setActionLoading(false);
    }
  }

  // 그룹 생성
  const handleCreateGroup = async () => {
    if (!cgForm.code.trim() || !cgForm.name.trim()) { toast.error('코드와 이름을 입력하세요'); return; }
    await runAction({
      action: 'create_group', code: cgForm.code.trim(), name: cgForm.name.trim(),
      icon: cgForm.icon || 'LayoutGrid', minRole: cgForm.minRole,
      sortOrder: parseInt(cgForm.sortOrder) || 99,
    }, '그룹이 생성되었습니다.');
    setShowCreateGroup(false);
    setCgForm({ code: '', name: '', icon: 'LayoutGrid', minRole: 'viewer', sortOrder: '99' });
  };

  // 그룹 삭제
  const handleDeleteGroup = async (group: MenuGroup) => {
    if (!confirm(`"${group.label}" 그룹과 하위 ${group.items.length}개 항목을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    await runAction({ action: 'delete_group', id: group.id }, '그룹이 삭제되었습니다.');
  };

  // 그룹 이름/아이콘/역할 수정
  const handleUpdateGroup = async () => {
    if (!editGroup) return;
    if (!editGroup.name.trim()) { toast.error('이름을 입력하세요'); return; }
    await runAction({
      action: 'update_group', id: editGroup.id,
      name: editGroup.name.trim(), icon: editGroup.icon, minRole: editGroup.minRole,
    }, '그룹이 수정되었습니다.');
    setEditGroup(null);
  };

  // 항목 생성
  const handleCreateItem = async () => {
    if (!createItemGroupId) return;
    if (!ciForm.code.trim() || !ciForm.name.trim()) { toast.error('코드와 이름을 입력하세요'); return; }
    await runAction({
      action: 'create_item', groupId: createItemGroupId,
      code: ciForm.code.trim(), name: ciForm.name.trim(),
      path: ciForm.path.trim(), icon: ciForm.icon || 'Circle',
      minRole: ciForm.minRole, sortOrder: parseInt(ciForm.sortOrder) || 99,
    }, '메뉴 항목이 생성되었습니다.');
    setCreateItemGroupId(null);
    setCiForm({ code: '', name: '', path: '', icon: 'Circle', minRole: 'viewer', sortOrder: '99' });
  };

  // 항목 삭제
  const handleDeleteItem = async (item: MenuItem, groupLabel: string) => {
    if (!confirm(`"${item.label}" 항목을 "${groupLabel}" 그룹에서 삭제하시겠습니까?`)) return;
    await runAction({ action: 'delete_item', id: item.id }, '메뉴 항목이 삭제되었습니다.');
  };

  // 항목 이름/경로/아이콘/역할 수정
  const handleUpdateItem = async () => {
    if (!editItem) return;
    if (!editItem.name.trim()) { toast.error('이름을 입력하세요'); return; }
    await runAction({
      action: 'update_item', id: editItem.id,
      name: editItem.name.trim(), path: editItem.path.trim(),
      icon: editItem.icon, minRole: editItem.minRole,
    }, '항목이 수정되었습니다.');
    setEditItem(null);
  };

  // ── 로딩 ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#051225] text-white">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-cyan-400" />
          <p className="text-slate-400">메뉴 구성 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#051225] text-white p-4 md:p-6 space-y-6">
      {/* ── 헤더 ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <LayoutGrid className="w-6 h-6 text-purple-400" />
            </div>
            메뉴 관리
          </h1>
          <p className="text-slate-400 text-sm mt-1">사이드바 메뉴 구성 · 생성 · 삭제 · 권한 설정</p>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <span className="flex items-center gap-1.5 text-sm text-amber-400">
              <AlertCircle className="w-4 h-4" />저장되지 않은 변경사항
            </span>
          )}
          <button
            onClick={() => setShowCreateGroup(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition"
          >
            <FolderPlus className="w-4 h-4" />새 그룹
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            저장
          </button>
        </div>
      </div>

      {/* ── 에러 배너 ── */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center justify-between">
          <p className="text-sm text-red-300">{error}</p>
          <button onClick={fetchMenus} className="px-3 py-1.5 bg-red-500/20 text-red-300 rounded-lg text-sm hover:bg-red-500/30 transition">재시도</button>
        </div>
      )}

      {/* ── 통계 ── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="text-sm text-slate-400">메뉴 그룹</div>
          <div className="text-2xl font-bold text-white mt-1">{menuGroups.length}</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="text-sm text-slate-400">전체 메뉴 항목</div>
          <div className="text-2xl font-bold text-white mt-1">{menuGroups.reduce((s, g) => s + g.items.length, 0)}</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="text-sm text-slate-400">비활성 항목</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">
            {menuGroups.reduce((s, g) => s + g.items.filter(i => !i.enabled).length, 0)}
          </div>
        </div>
      </div>

      {/* ── 메뉴 그룹 목록 ── */}
      <div className="space-y-3">
        {menuGroups.map((group) => (
          <div key={group.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
            {/* 그룹 헤더 */}
            {editGroup?.id === group.id ? (
              /* ── 인라인 그룹 수정 모드 ── */
              <div className="flex items-center gap-3 px-5 py-3 bg-slate-700/30">
                <input autoFocus value={editGroup.name} onChange={e => setEditGroup({ ...editGroup, name: e.target.value })}
                  placeholder="그룹 이름" className={`${inpSm} flex-1`}
                  onKeyDown={e => { if (e.key === 'Enter') handleUpdateGroup(); if (e.key === 'Escape') setEditGroup(null); }} />
                <input value={editGroup.icon} onChange={e => setEditGroup({ ...editGroup, icon: e.target.value })}
                  placeholder="아이콘 (예: LayoutGrid)" className={`${inpSm} w-36`} />
                <RoleSelect small value={editGroup.minRole} onChange={v => setEditGroup({ ...editGroup, minRole: v })} />
                <button onClick={handleUpdateGroup} disabled={actionLoading}
                  className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded transition disabled:opacity-50">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => setEditGroup(null)} className="p-1.5 text-slate-400 hover:text-white rounded transition">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between px-5 py-4">
                <button onClick={() => toggleGroup(group.id)} className="flex items-center gap-4 flex-1 text-left">
                  <GripVertical className="w-4 h-4 text-slate-600 shrink-0" />
                  {expandedGroups.has(group.id)
                    ? <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                    : <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />}
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-base font-semibold text-white">{group.label}</span>
                      <span className="text-xs px-2 py-0.5 bg-slate-700/50 rounded text-slate-400">{group.code}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${ROLE_COLORS[group.minRole] ?? ''}`}>
                        {ROLE_LABELS[group.minRole] ?? group.minRole}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">{group.items.length}개 항목 · {group.section}</span>
                  </div>
                </button>
                {/* 그룹 액션 버튼 */}
                <div className="flex items-center gap-1 ml-4">
                  <button
                    onClick={() => setCreateItemGroupId(group.id)}
                    title="메뉴 항목 추가"
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition">
                    <Plus className="w-3.5 h-3.5" />항목 추가
                  </button>
                  <button
                    onClick={() => setEditGroup({ id: group.id, name: group.label, icon: group.icon, minRole: group.minRole })}
                    title="그룹 수정"
                    className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded transition">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteGroup(group)}
                    disabled={actionLoading}
                    title="그룹 삭제"
                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition disabled:opacity-40">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* 그룹 아이템 */}
            {expandedGroups.has(group.id) && (
              <div className="border-t border-slate-700/50">
                {group.items.length === 0 && (
                  <div className="px-5 py-4 text-xs text-slate-500 text-center">
                    항목이 없습니다. 오른쪽 상단 "항목 추가" 버튼으로 추가하세요.
                  </div>
                )}
                {group.items.map((item) => (
                  <div key={item.id}
                    className={`border-b border-slate-700/30 last:border-b-0 transition ${
                      !item.enabled ? 'opacity-50 bg-slate-900/30' : 'hover:bg-slate-700/10'
                    }`}>
                    {editItem?.id === item.id ? (
                      /* ── 인라인 항목 수정 모드 ── */
                      <div className="flex items-center gap-2 px-5 py-2.5 flex-wrap">
                        <input autoFocus value={editItem.name} onChange={e => setEditItem({ ...editItem, name: e.target.value })}
                          placeholder="메뉴 이름" className={`${inpSm} w-32`}
                          onKeyDown={e => { if (e.key === 'Enter') handleUpdateItem(); if (e.key === 'Escape') setEditItem(null); }} />
                        <input value={editItem.path} onChange={e => setEditItem({ ...editItem, path: e.target.value })}
                          placeholder="경로 (예: /dashboard)" className={`${inpSm} flex-1 min-w-0`} />
                        <input value={editItem.icon} onChange={e => setEditItem({ ...editItem, icon: e.target.value })}
                          placeholder="아이콘" className={`${inpSm} w-28`} />
                        <RoleSelect small value={editItem.minRole} onChange={v => setEditItem({ ...editItem, minRole: v })} />
                        <button onClick={handleUpdateItem} disabled={actionLoading}
                          className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded transition disabled:opacity-50">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditItem(null)} className="p-1.5 text-slate-400 hover:text-white rounded transition">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between px-5 py-3">
                        <div className="flex items-center gap-4 pl-12">
                          <GripVertical className="w-3.5 h-3.5 text-slate-700" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-white">{item.label}</span>
                              {item.badgeType && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  item.badgeType === 'new'  ? 'bg-cyan-500/20 text-cyan-400' :
                                  item.badgeType === 'ai'   ? 'bg-purple-500/20 text-purple-400' :
                                  item.badgeType === 'live' ? 'bg-emerald-500/20 text-emerald-400' :
                                  'bg-slate-500/20 text-slate-400'
                                }`}>{item.badgeType.toUpperCase()}</span>
                              )}
                              {item.featureRequired && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded">{item.featureRequired}</span>
                              )}
                            </div>
                            <span className="text-xs text-slate-500">{item.path || '경로 없음'}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* 역할 편집 (인라인 select) */}
                          {editingRole === item.id ? (
                            <select value={item.minRole}
                              onChange={e => { updateItemRole(group.id, item.id, e.target.value); setEditingRole(null); }}
                              onBlur={() => setEditingRole(null)} autoFocus
                              className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-white focus:outline-none focus:border-cyan-500">
                              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                            </select>
                          ) : (
                            <button onClick={() => setEditingRole(item.id)}
                              className={`text-xs px-2 py-1 rounded flex items-center gap-1 hover:opacity-80 transition ${ROLE_COLORS[item.minRole] ?? ''}`}>
                              <Shield className="w-3 h-3" />{ROLE_LABELS[item.minRole] ?? item.minRole}
                            </button>
                          )}

                          {/* 활성/비활성 토글 */}
                          <button onClick={() => toggleItemEnabled(group.id, item.id)}
                            className={`p-1.5 rounded transition ${item.enabled ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-slate-600 hover:bg-slate-700/50'}`}>
                            {item.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </button>

                          {/* 항목 수정 */}
                          <button
                            onClick={() => setEditItem({ id: item.id, name: item.label, path: item.path, icon: item.icon, minRole: item.minRole })}
                            title="항목 수정"
                            className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded transition">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {/* 항목 삭제 */}
                          <button
                            onClick={() => handleDeleteItem(item, group.label)}
                            disabled={actionLoading}
                            title="항목 삭제"
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition disabled:opacity-40">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {menuGroups.length === 0 && !isLoading && (
          <div className="bg-slate-800/30 border border-dashed border-slate-700 rounded-xl p-10 text-center">
            <LayoutGrid className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">메뉴 그룹이 없습니다.</p>
            <button onClick={() => setShowCreateGroup(true)}
              className="mt-3 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition">
              첫 번째 그룹 만들기
            </button>
          </div>
        )}
      </div>

      {/* ── 안내 ── */}
      <div className="bg-blue-900/20 border border-blue-600/30 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <Settings className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-blue-300 mb-1">메뉴 관리 안내</h3>
            <ul className="text-xs text-blue-200 space-y-1">
              <li>연필 아이콘: 그룹 또는 항목 인라인 수정 (이름, 경로, 아이콘, 역할)</li>
              <li>눈 아이콘: 항목 활성/비활성 전환 (저장 버튼으로 일괄 저장)</li>
              <li>역할 배지 클릭: 최소 접근 역할 변경 (저장 버튼으로 일괄 저장)</li>
              <li>그룹 삭제 시 하위 항목도 모두 삭제됩니다.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ══ 그룹 생성 모달 ══ */}
      {showCreateGroup && (
        <Modal title="새 메뉴 그룹 추가" onClose={() => setShowCreateGroup(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">코드 <span className="text-slate-500">(소문자, 숫자, _ - 만 허용)</span></label>
              <input value={cgForm.code} onChange={e => setCgForm({ ...cgForm, code: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                placeholder="예: my_group" className={inp} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">이름</label>
              <input value={cgForm.name} onChange={e => setCgForm({ ...cgForm, name: e.target.value })}
                placeholder="예: 내 메뉴 그룹" className={inp} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">아이콘</label>
                <input value={cgForm.icon} onChange={e => setCgForm({ ...cgForm, icon: e.target.value })}
                  placeholder="예: LayoutGrid" className={inp} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">정렬 순서</label>
                <input type="number" min="0" max="999" value={cgForm.sortOrder}
                  onChange={e => setCgForm({ ...cgForm, sortOrder: e.target.value })} className={inp} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">최소 역할</label>
              <RoleSelect value={cgForm.minRole} onChange={v => setCgForm({ ...cgForm, minRole: v })} />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowCreateGroup(false)}
                className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition">취소</button>
              <button onClick={handleCreateGroup} disabled={actionLoading}
                className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : '그룹 생성'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ══ 항목 생성 모달 ══ */}
      {createItemGroupId && (
        <Modal
          title={`메뉴 항목 추가 — ${menuGroups.find(g => g.id === createItemGroupId)?.label ?? ''}`}
          onClose={() => setCreateItemGroupId(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">코드 <span className="text-slate-500">(소문자, 숫자, _ - 만 허용)</span></label>
              <input value={ciForm.code} onChange={e => setCiForm({ ...ciForm, code: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                placeholder="예: my_menu_item" className={inp} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">이름</label>
              <input value={ciForm.name} onChange={e => setCiForm({ ...ciForm, name: e.target.value })}
                placeholder="예: 대시보드" className={inp} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">경로</label>
              <input value={ciForm.path} onChange={e => setCiForm({ ...ciForm, path: e.target.value })}
                placeholder="예: /dashboard" className={inp} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">아이콘</label>
                <input value={ciForm.icon} onChange={e => setCiForm({ ...ciForm, icon: e.target.value })}
                  placeholder="예: LayoutDashboard" className={inp} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">정렬 순서</label>
                <input type="number" min="0" max="999" value={ciForm.sortOrder}
                  onChange={e => setCiForm({ ...ciForm, sortOrder: e.target.value })} className={inp} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">최소 역할</label>
              <RoleSelect value={ciForm.minRole} onChange={v => setCiForm({ ...ciForm, minRole: v })} />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setCreateItemGroupId(null)}
                className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition">취소</button>
              <button onClick={handleCreateItem} disabled={actionLoading}
                className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : '항목 생성'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
