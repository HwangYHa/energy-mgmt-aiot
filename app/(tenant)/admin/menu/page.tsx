'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  LayoutGrid, GripVertical, ChevronDown, ChevronRight,
  Eye, EyeOff, Shield, Loader2, Save, Settings,
  AlertCircle, Plus, Trash2, Pencil, Check, X,
  FolderPlus, RotateCcw,
} from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api/client';
import { toast } from '@/lib/toast';

// ── Types ─────────────────────────────────────────────────────────
interface LocalItem {
  id: string;        // '__new__item_N' or real UUID
  code: string;      // required for __new__
  label: string;
  path: string;
  icon: string;
  minRole: string;
  sortOrder: number;
  enabled: boolean;
  featureRequired: string | null;
  badgeType: string | null;
}

interface LocalGroup {
  id: string;        // '__new__group_N' or real UUID
  code: string;      // required for __new__
  label: string;
  icon: string;
  minRole: string;
  sortOrder: number;
  section: string;
  items: LocalItem[];
}

interface DragState {
  type: 'group' | 'item';
  groupId?: string;
  id: string;
  index: number;
}

const ROLES = ['viewer', 'operator', 'site_manager', 'tenant_admin', 'super_admin'] as const;
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

const inp = 'w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500';
const inpSm = 'bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500';

let newIdCounter = 0;
function newId(prefix: string) { return `__new__${prefix}_${++newIdCounter}`; }

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function RoleSelect({ value, onChange, small }: { value: string; onChange: (v: string) => void; small?: boolean }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className={small ? inpSm : inp}>
      {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
    </select>
  );
}

export default function MenuManagementPage() {
  const [localGroups, setLocalGroups]   = useState<LocalGroup[]>([]);
  const [deletedGroupIds, setDeletedGroupIds] = useState<string[]>([]);
  const [deletedItemIds,  setDeletedItemIds]  = useState<string[]>([]);
  const [isLoading, setIsLoading]       = useState(true);
  const [saving,    setSaving]          = useState(false);
  const [isDirty,   setIsDirty]         = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Inline edit state
  const [editGroupId, setEditGroupId]   = useState<string | null>(null);
  const [editGroupForm, setEditGroupForm] = useState({ label: '', icon: '', minRole: 'viewer' });
  const [editItemId,  setEditItemId]    = useState<string | null>(null);
  const [editItemForm, setEditItemForm] = useState({ label: '', path: '', icon: '', minRole: 'viewer' });

  // Create modals
  const [showCreateGroup,    setShowCreateGroup]    = useState(false);
  const [createGroupForm,    setCreateGroupForm]    = useState({ code: '', label: '', icon: 'LayoutGrid', minRole: 'viewer' });
  const [createItemForGroup, setCreateItemForGroup] = useState<string | null>(null);
  const [createItemForm,     setCreateItemForm]     = useState({ code: '', label: '', path: '', icon: 'Circle', minRole: 'viewer' });

  // Drag state
  const dragRef = useRef<DragState | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // ── Load ──────────────────────────────────────────────────────
  const fetchMenus = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiGet<LocalGroup[]>('/api/menus?all=true');
      if (res.success && res.data) {
        setLocalGroups(res.data);
        setExpandedGroups(new Set(res.data.map(g => g.id)));
        setDeletedGroupIds([]);
        setDeletedItemIds([]);
        setIsDirty(false);
      }
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchMenus(); }, [fetchMenus]);

  const markDirty = () => setIsDirty(true);

  // ── Helpers ───────────────────────────────────────────────────
  const updateGroups = (fn: (g: LocalGroup[]) => LocalGroup[]) => {
    setLocalGroups(fn);
    markDirty();
  };

  // ── Toggle expand ─────────────────────────────────────────────
  const toggleExpand = (id: string) => {
    setExpandedGroups(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  // ── CRUD (local only) ─────────────────────────────────────────
  const addGroup = () => {
    if (!createGroupForm.code.trim() || !createGroupForm.label.trim()) { toast.error('코드와 이름을 입력하세요'); return; }
    const id = newId('group');
    updateGroups(g => [...g, {
      id, code: createGroupForm.code.trim(), label: createGroupForm.label.trim(),
      icon: createGroupForm.icon || 'LayoutGrid', minRole: createGroupForm.minRole,
      sortOrder: g.length * 10, section: 'general', items: [],
    }]);
    setExpandedGroups(p => new Set([...p, id]));
    setShowCreateGroup(false);
    setCreateGroupForm({ code: '', label: '', icon: 'LayoutGrid', minRole: 'viewer' });
  };

  const deleteGroup = (group: LocalGroup) => {
    if (!confirm(`"${group.label}" 그룹과 하위 ${group.items.length}개 항목을 삭제하시겠습니까?`)) return;
    if (!group.id.startsWith('__new__')) setDeletedGroupIds(p => [...p, group.id]);
    // Also mark all real items as deleted
    const realItems = group.items.filter(i => !i.id.startsWith('__new__')).map(i => i.id);
    if (realItems.length) setDeletedItemIds(p => [...p, ...realItems]);
    updateGroups(g => g.filter(g2 => g2.id !== group.id));
  };

  const commitGroupEdit = () => {
    if (!editGroupForm.label.trim()) { toast.error('이름을 입력하세요'); return; }
    updateGroups(g => g.map(grp => grp.id === editGroupId
      ? { ...grp, label: editGroupForm.label.trim(), icon: editGroupForm.icon, minRole: editGroupForm.minRole }
      : grp
    ));
    setEditGroupId(null);
  };

  const addItem = () => {
    if (!createItemForm.code.trim() || !createItemForm.label.trim()) { toast.error('코드와 이름을 입력하세요'); return; }
    const id = newId('item');
    updateGroups(g => g.map(grp => grp.id === createItemForGroup
      ? { ...grp, items: [...grp.items, {
          id, code: createItemForm.code.trim(), label: createItemForm.label.trim(),
          path: createItemForm.path.trim(), icon: createItemForm.icon || 'Circle',
          minRole: createItemForm.minRole, sortOrder: grp.items.length * 10,
          enabled: true, featureRequired: null, badgeType: null,
        }]}
      : grp
    ));
    setCreateItemForGroup(null);
    setCreateItemForm({ code: '', label: '', path: '', icon: 'Circle', minRole: 'viewer' });
  };

  const deleteItem = (groupId: string, item: LocalItem) => {
    if (!confirm(`"${item.label}" 항목을 삭제하시겠습니까?`)) return;
    if (!item.id.startsWith('__new__')) setDeletedItemIds(p => [...p, item.id]);
    updateGroups(g => g.map(grp => grp.id === groupId
      ? { ...grp, items: grp.items.filter(i => i.id !== item.id) } : grp
    ));
  };

  const commitItemEdit = () => {
    if (!editItemForm.label.trim()) { toast.error('이름을 입력하세요'); return; }
    updateGroups(g => g.map(grp => ({
      ...grp, items: grp.items.map(i => i.id === editItemId
        ? { ...i, label: editItemForm.label.trim(), path: editItemForm.path.trim(), icon: editItemForm.icon, minRole: editItemForm.minRole }
        : i)
    })));
    setEditItemId(null);
  };

  const toggleEnabled = (groupId: string, itemId: string) => {
    updateGroups(g => g.map(grp => grp.id === groupId
      ? { ...grp, items: grp.items.map(i => i.id === itemId ? { ...i, enabled: !i.enabled } : i) }
      : grp
    ));
  };

  const updateGroupRole = (groupId: string, role: string) => {
    updateGroups(g => g.map(grp => grp.id === groupId ? { ...grp, minRole: role } : grp));
  };

  const updateItemRole = (groupId: string, itemId: string, role: string) => {
    updateGroups(g => g.map(grp => grp.id === groupId
      ? { ...grp, items: grp.items.map(i => i.id === itemId ? { ...i, minRole: role } : i) }
      : grp
    ));
  };

  // Index input: move group to position (1-based)
  const moveGroupToIndex = (groupId: string, newIndex: number) => {
    updateGroups(groups => {
      const from = groups.findIndex(g => g.id === groupId);
      if (from < 0) return groups;
      const to = Math.max(0, Math.min(groups.length - 1, newIndex - 1));
      if (from === to) return groups;
      const result = [...groups];
      const [removed] = result.splice(from, 1);
      result.splice(to, 0, removed);
      return result;
    });
  };

  // Index input: move item to position (1-based) within its group
  const moveItemToIndex = (groupId: string, itemId: string, newIndex: number) => {
    updateGroups(groups => groups.map(grp => {
      if (grp.id !== groupId) return grp;
      const from = grp.items.findIndex(i => i.id === itemId);
      if (from < 0) return grp;
      const to = Math.max(0, Math.min(grp.items.length - 1, newIndex - 1));
      if (from === to) return grp;
      const items = [...grp.items];
      const [removed] = items.splice(from, 1);
      items.splice(to, 0, removed);
      return { ...grp, items };
    }));
  };

  // ── Drag-and-drop ─────────────────────────────────────────────
  const handleGroupDragStart = (e: React.DragEvent, group: LocalGroup, index: number) => {
    dragRef.current = { type: 'group', id: group.id, index };
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleGroupDragOver = (e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    if (dragRef.current?.type === 'group') setDragOverId(groupId);
  };

  const handleGroupDrop = (e: React.DragEvent, targetGroup: LocalGroup, targetIndex: number) => {
    e.preventDefault();
    setDragOverId(null);
    const drag = dragRef.current;
    if (!drag || drag.type !== 'group' || drag.id === targetGroup.id) { dragRef.current = null; return; }
    updateGroups(groups => {
      const result = [...groups];
      const from   = result.findIndex(g => g.id === drag.id);
      if (from < 0) return groups;
      const [removed] = result.splice(from, 1);
      result.splice(targetIndex, 0, removed);
      return result;
    });
    dragRef.current = null;
  };

  const handleItemDragStart = (e: React.DragEvent, groupId: string, item: LocalItem, index: number) => {
    dragRef.current = { type: 'item', groupId, id: item.id, index };
    e.dataTransfer.effectAllowed = 'move';
    e.stopPropagation();
  };

  const handleItemDragOver = (e: React.DragEvent, itemId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragRef.current?.type === 'item') setDragOverId(itemId);
  };

  const handleItemDrop = (e: React.DragEvent, groupId: string, targetItem: LocalItem, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverId(null);
    const drag = dragRef.current;
    if (!drag || drag.type !== 'item' || drag.id === targetItem.id) { dragRef.current = null; return; }
    updateGroups(groups => groups.map(grp => {
      if (grp.id !== groupId) return grp;
      const items  = [...grp.items];
      const from   = items.findIndex(i => i.id === drag.id);
      if (from < 0) return grp;
      const [removed] = items.splice(from, 1);
      items.splice(targetIndex, 0, removed);
      return { ...grp, items };
    }));
    dragRef.current = null;
  };

  const handleDragEnd = () => { setDragOverId(null); dragRef.current = null; };

  // ── Save ──────────────────────────────────────────────────────
  const handleSave = async () => {
    // Assign sortOrder from array index before saving
    const groupsToSave = localGroups.map((g, gi) => ({
      ...g,
      sortOrder: gi * 10,
      items: g.items.map((item, ii) => ({ ...item, sortOrder: ii * 10 })),
    }));

    setSaving(true);
    try {
      const res = await apiPost('/api/admin/menus', {
        groups:          groupsToSave,
        deletedGroupIds,
        deletedItemIds,
      });
      if (res.success) {
        toast.success('메뉴 설정이 저장되었습니다.');
        await fetchMenus(); // reload from server to get real IDs
      } else {
        const errRes = res as any;
        toast.error(errRes.message ?? '저장에 실패했습니다.');
      }
    } catch {
      toast.error('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (isDirty && !confirm('변경사항을 모두 되돌리시겠습니까?')) return;
    fetchMenus();
  };

  // ── Loading ───────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#051225] text-white">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="h-full bg-[#051225] text-white p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg"><LayoutGrid className="w-6 h-6 text-purple-400" /></div>
            메뉴 관리
          </h1>
          <p className="text-slate-400 text-sm mt-1">변경사항은 저장 버튼을 눌러야 적용됩니다 · 드래그&amp;드롭 또는 인덱스 번호로 순서 변경</p>
        </div>
        <div className="flex items-center gap-3">
          {isDirty && (
            <span className="flex items-center gap-1.5 text-sm text-amber-400">
              <AlertCircle className="w-4 h-4" />저장되지 않은 변경사항
            </span>
          )}
          <button onClick={handleReset} disabled={!isDirty || saving}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition disabled:opacity-40">
            <RotateCcw className="w-4 h-4" />되돌리기
          </button>
          <button onClick={() => setShowCreateGroup(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition">
            <FolderPlus className="w-4 h-4" />새 그룹
          </button>
          <button onClick={handleSave} disabled={!isDirty || saving}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium transition disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            저장
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="text-sm text-slate-400">메뉴 그룹</div>
          <div className="text-2xl font-bold text-white mt-1">{localGroups.length}</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="text-sm text-slate-400">전체 항목</div>
          <div className="text-2xl font-bold text-white mt-1">{localGroups.reduce((s, g) => s + g.items.length, 0)}</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="text-sm text-slate-400">비활성 항목</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">{localGroups.reduce((s, g) => s + g.items.filter(i => !i.enabled).length, 0)}</div>
        </div>
      </div>

      {/* Groups */}
      <div className="space-y-2">
        {localGroups.map((group, gi) => {
          const isNew      = group.id.startsWith('__new__');
          const isDragOver = dragOverId === group.id;

          return (
            <div
              key={group.id}
              onDragOver={e => handleGroupDragOver(e, group.id)}
              onDrop={e => handleGroupDrop(e, group, gi)}
              onDragEnd={handleDragEnd}
              className={`bg-slate-800/50 border rounded-xl overflow-hidden transition-all ${
                isDragOver ? 'border-cyan-400 shadow-lg shadow-cyan-400/10' : 'border-slate-700/50'
              } ${isNew ? 'border-l-2 border-l-purple-500' : ''}`}
            >
              {/* Group Header */}
              {editGroupId === group.id ? (
                /* Inline edit mode */
                <div className="flex items-center gap-2 px-4 py-3 flex-wrap bg-slate-700/30">
                  <input autoFocus value={editGroupForm.label}
                    onChange={e => setEditGroupForm(p => ({ ...p, label: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') commitGroupEdit(); if (e.key === 'Escape') setEditGroupId(null); }}
                    placeholder="그룹 이름" className={`${inpSm} w-36`} />
                  <input value={editGroupForm.icon}
                    onChange={e => setEditGroupForm(p => ({ ...p, icon: e.target.value }))}
                    placeholder="아이콘" className={`${inpSm} w-28`} />
                  <RoleSelect small value={editGroupForm.minRole} onChange={v => setEditGroupForm(p => ({ ...p, minRole: v }))} />
                  <button onClick={commitGroupEdit} className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded"><Check className="w-4 h-4" /></button>
                  <button onClick={() => setEditGroupId(null)} className="p-1.5 text-slate-400 hover:text-white rounded"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="flex items-center justify-between px-4 py-3">
                  {/* Drag handle + collapse */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span
                      draggable
                      onDragStart={e => handleGroupDragStart(e, group, gi)}
                      className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 transition"
                      title="드래그하여 순서 변경"
                    >
                      <GripVertical className="w-5 h-5" />
                    </span>
                    <button onClick={() => toggleExpand(group.id)} className="flex items-center gap-2 flex-1 text-left min-w-0">
                      {expandedGroups.has(group.id) ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                      <span className="font-semibold text-white truncate">{group.label}</span>
                      <span className="text-xs px-1.5 py-0.5 bg-slate-700/50 rounded text-slate-400 shrink-0">{group.code}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${ROLE_COLORS[group.minRole] ?? ''}`}>{ROLE_LABELS[group.minRole]}</span>
                      {isNew && <span className="text-xs px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded shrink-0">NEW</span>}
                    </button>
                    <span className="text-xs text-slate-500 shrink-0">{group.items.length}개</span>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    {/* Index input */}
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-500">#</span>
                      <input
                        type="number" min={1} max={localGroups.length}
                        defaultValue={gi + 1}
                        onBlur={e => { const v = parseInt(e.target.value); if (!isNaN(v)) moveGroupToIndex(group.id, v); e.target.value = String(localGroups.findIndex(g => g.id === group.id) + 1); }}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        className="w-10 text-center bg-slate-900 border border-slate-700 rounded text-xs text-slate-300 py-0.5 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <button onClick={() => setCreateItemForGroup(group.id)}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-cyan-400 hover:bg-cyan-500/10 rounded transition">
                      <Plus className="w-3.5 h-3.5" />항목
                    </button>
                    <button onClick={() => { setEditGroupId(group.id); setEditGroupForm({ label: group.label, icon: group.icon, minRole: group.minRole }); }}
                      className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded transition">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteGroup(group)}
                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Items */}
              {expandedGroups.has(group.id) && (
                <div className="border-t border-slate-700/50">
                  {group.items.length === 0 && (
                    <div className="px-4 py-3 text-xs text-slate-500 text-center">
                      항목 없음 — &quot;+ 항목&quot; 클릭하여 추가
                    </div>
                  )}
                  {group.items.map((item, ii) => {
                    const isNewItem   = item.id.startsWith('__new__');
                    const isItemDragOver = dragOverId === item.id;

                    return (
                      <div
                        key={item.id}
                        onDragOver={e => handleItemDragOver(e, item.id)}
                        onDrop={e => handleItemDrop(e, group.id, item, ii)}
                        onDragEnd={handleDragEnd}
                        className={`border-b border-slate-700/30 last:border-b-0 transition-all ${
                          isItemDragOver ? 'bg-cyan-500/10 border-l-2 border-l-cyan-400' : !item.enabled ? 'opacity-50 bg-slate-900/30' : 'hover:bg-slate-700/10'
                        } ${isNewItem ? 'border-l-2 border-l-purple-400' : ''}`}
                      >
                        {editItemId === item.id ? (
                          /* Inline item edit */
                          <div className="flex items-center gap-2 px-5 py-2.5 flex-wrap">
                            <input autoFocus value={editItemForm.label}
                              onChange={e => setEditItemForm(p => ({ ...p, label: e.target.value }))}
                              onKeyDown={e => { if (e.key === 'Enter') commitItemEdit(); if (e.key === 'Escape') setEditItemId(null); }}
                              placeholder="이름" className={`${inpSm} w-28`} />
                            <input value={editItemForm.path}
                              onChange={e => setEditItemForm(p => ({ ...p, path: e.target.value }))}
                              placeholder="경로" className={`${inpSm} flex-1 min-w-0`} />
                            <input value={editItemForm.icon}
                              onChange={e => setEditItemForm(p => ({ ...p, icon: e.target.value }))}
                              placeholder="아이콘" className={`${inpSm} w-24`} />
                            <RoleSelect small value={editItemForm.minRole} onChange={v => setEditItemForm(p => ({ ...p, minRole: v }))} />
                            <button onClick={commitItemEdit} className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded"><Check className="w-4 h-4" /></button>
                            <button onClick={() => setEditItemId(null)} className="p-1.5 text-slate-400 hover:text-white rounded"><X className="w-4 h-4" /></button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between px-4 py-2.5">
                            <div className="flex items-center gap-3 pl-8 flex-1 min-w-0">
                              <span
                                draggable
                                onDragStart={e => handleItemDragStart(e, group.id, item, ii)}
                                className="cursor-grab active:cursor-grabbing text-slate-700 hover:text-slate-500 shrink-0"
                              >
                                <GripVertical className="w-4 h-4" />
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-white truncate">{item.label}</span>
                                  {isNewItem && <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded shrink-0">NEW</span>}
                                  {item.badgeType && <span className="text-[10px] px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 rounded shrink-0">{item.badgeType.toUpperCase()}</span>}
                                </div>
                                <span className="text-xs text-slate-500">{item.path || '경로 없음'}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 ml-2 shrink-0">
                              {/* Role badge */}
                              <button
                                onClick={() => { const roles = [...ROLES]; const idx = (roles.indexOf(item.minRole as any) + 1) % roles.length; updateItemRole(group.id, item.id, roles[idx]!); }}
                                className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 hover:opacity-80 transition ${ROLE_COLORS[item.minRole] ?? ''}`}
                                title="클릭하여 역할 변경">
                                <Shield className="w-3 h-3" />{ROLE_LABELS[item.minRole]}
                              </button>
                              {/* Enable toggle */}
                              <button onClick={() => toggleEnabled(group.id, item.id)}
                                className={`p-1.5 rounded transition ${item.enabled ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-slate-600 hover:bg-slate-700/50'}`}>
                                {item.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                              </button>
                              {/* Index input */}
                              <div className="flex items-center gap-0.5">
                                <span className="text-xs text-slate-600">#</span>
                                <input
                                  type="number" min={1} max={group.items.length}
                                  defaultValue={ii + 1}
                                  onBlur={e => { const v = parseInt(e.target.value); if (!isNaN(v)) moveItemToIndex(group.id, item.id, v); e.target.value = String(group.items.findIndex(i => i.id === item.id) + 1); }}
                                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                  className="w-8 text-center bg-slate-900 border border-slate-700 rounded text-xs text-slate-300 py-0.5 focus:outline-none focus:border-cyan-500"
                                />
                              </div>
                              {/* Edit */}
                              <button onClick={() => { setEditItemId(item.id); setEditItemForm({ label: item.label, path: item.path, icon: item.icon, minRole: item.minRole }); }}
                                className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded transition">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              {/* Delete */}
                              <button onClick={() => deleteItem(group.id, item)}
                                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {localGroups.length === 0 && (
          <div className="bg-slate-800/30 border border-dashed border-slate-700 rounded-xl p-10 text-center">
            <LayoutGrid className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">메뉴 그룹이 없습니다.</p>
            <button onClick={() => setShowCreateGroup(true)} className="mt-3 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition">
              첫 번째 그룹 만들기
            </button>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-blue-900/20 border border-blue-600/30 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <Settings className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-blue-300 mb-1">메뉴 관리 안내</h3>
            <ul className="text-xs text-blue-200 space-y-1">
              <li>GripVertical(⣿) 아이콘을 드래그하여 그룹/항목 순서를 변경합니다.</li>
              <li># 인덱스 입력란에 숫자를 입력(Enter/포커스 해제)하면 해당 위치로 이동합니다.</li>
              <li>역할 배지를 클릭하면 순환 변경됩니다. 연필 아이콘으로 상세 편집도 가능합니다.</li>
              <li>모든 변경사항(생성·수정·삭제·순서)은 &quot;저장&quot; 버튼을 눌러야 DB에 반영됩니다.</li>
              <li>NEW 표시는 아직 저장되지 않은 새 항목입니다.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Create Group Modal */}
      {showCreateGroup && (
        <Modal title="새 메뉴 그룹 추가" onClose={() => setShowCreateGroup(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">코드 <span className="text-slate-500">(소문자·숫자·_-)</span></label>
              <input value={createGroupForm.code}
                onChange={e => setCreateGroupForm(p => ({ ...p, code: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') }))}
                placeholder="예: my_group" className={inp} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">이름</label>
              <input value={createGroupForm.label}
                onChange={e => setCreateGroupForm(p => ({ ...p, label: e.target.value }))}
                placeholder="예: 내 메뉴 그룹" className={inp}
                onKeyDown={e => { if (e.key === 'Enter') addGroup(); }} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">아이콘</label>
                <input value={createGroupForm.icon}
                  onChange={e => setCreateGroupForm(p => ({ ...p, icon: e.target.value }))}
                  placeholder="예: LayoutGrid" className={inp} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">최소 역할</label>
                <RoleSelect value={createGroupForm.minRole} onChange={v => setCreateGroupForm(p => ({ ...p, minRole: v }))} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowCreateGroup(false)} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm">취소</button>
              <button onClick={addGroup} className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium">추가</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Item Modal */}
      {createItemForGroup && (
        <Modal
          title={`항목 추가 — ${localGroups.find(g => g.id === createItemForGroup)?.label ?? ''}`}
          onClose={() => setCreateItemForGroup(null)}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">코드 <span className="text-slate-500">(소문자·숫자·_-)</span></label>
              <input value={createItemForm.code}
                onChange={e => setCreateItemForm(p => ({ ...p, code: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') }))}
                placeholder="예: my_menu" className={inp} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">이름</label>
              <input value={createItemForm.label}
                onChange={e => setCreateItemForm(p => ({ ...p, label: e.target.value }))}
                placeholder="예: 대시보드" className={inp} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">경로</label>
              <input value={createItemForm.path}
                onChange={e => setCreateItemForm(p => ({ ...p, path: e.target.value }))}
                placeholder="예: /dashboard" className={inp} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">아이콘</label>
                <input value={createItemForm.icon}
                  onChange={e => setCreateItemForm(p => ({ ...p, icon: e.target.value }))}
                  placeholder="예: LayoutDashboard" className={inp} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">최소 역할</label>
                <RoleSelect value={createItemForm.minRole} onChange={v => setCreateItemForm(p => ({ ...p, minRole: v }))} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setCreateItemForGroup(null)} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm">취소</button>
              <button onClick={addItem} className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium">추가</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
