'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  LayoutGrid, GripVertical, ChevronDown, ChevronRight,
  Eye, EyeOff, Shield, Loader2, Save, Settings,
  AlertCircle, Plus, Trash2, Pencil, Check, X,
  FolderPlus, RotateCcw,
  // Icon registry (used in picker)
  LayoutDashboard, Activity, Boxes, Monitor, Database,
  Zap, BarChart2, LineChart, PieChart, TrendingUp,
  Building2, Factory, MapPin, Cpu, Radio,
  Users, UserCheck, Bell, FileText, Download,
  Wrench, Sliders, Key, Lock, Globe,
  Leaf, Recycle, Wind, Sun, Battery,
  ShieldCheck, AlertTriangle, Info, HelpCircle, MessageSquare,
  Wallet, CreditCard, Receipt, Package, Archive,
  Network, Server, Wifi, Link, Share2,
  ClipboardList, Calendar, Clock, Search, Filter,
} from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api/client';
import { toast } from '@/lib/toast';
import type { LucideIcon } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────
interface LocalItem {
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

interface LocalGroup {
  id: string;
  code: string;
  label: string;
  icon: string;
  minRole: string;
  sortOrder: number;
  section: string;
  enabled: boolean;
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

// ── 아이콘 레지스트리 (카테고리별 시각화) ─────────────────────────────
interface IconDef { name: string; label: string; component: LucideIcon; category: string }

const ICON_REGISTRY: IconDef[] = [
  // 대시보드/분석
  { name: 'LayoutDashboard', label: '대시보드',    component: LayoutDashboard, category: '대시보드/분석' },
  { name: 'Activity',        label: '활동/현황',   component: Activity,        category: '대시보드/분석' },
  { name: 'BarChart2',       label: '막대 차트',   component: BarChart2,       category: '대시보드/분석' },
  { name: 'LineChart',       label: '라인 차트',   component: LineChart,       category: '대시보드/분석' },
  { name: 'PieChart',        label: '원형 차트',   component: PieChart,        category: '대시보드/분석' },
  { name: 'TrendingUp',      label: '추이/트렌드', component: TrendingUp,      category: '대시보드/분석' },
  // 에너지/설비
  { name: 'Zap',             label: '전력/에너지', component: Zap,             category: '에너지/설비' },
  { name: 'Battery',         label: '배터리/ESS',  component: Battery,         category: '에너지/설비' },
  { name: 'Sun',             label: '태양광',      component: Sun,             category: '에너지/설비' },
  { name: 'Wind',            label: '풍력',        component: Wind,            category: '에너지/설비' },
  { name: 'Cpu',             label: '장치/CPU',    component: Cpu,             category: '에너지/설비' },
  { name: 'Monitor',         label: '모니터',      component: Monitor,         category: '에너지/설비' },
  { name: 'Sliders',         label: '제어/조정',   component: Sliders,         category: '에너지/설비' },
  { name: 'Wrench',          label: '유지보수',    component: Wrench,          category: '에너지/설비' },
  // 시설/사이트
  { name: 'Building2',       label: '건물',        component: Building2,       category: '시설/사이트' },
  { name: 'Factory',         label: '공장',        component: Factory,         category: '시설/사이트' },
  { name: 'MapPin',          label: '위치/사이트', component: MapPin,          category: '시설/사이트' },
  { name: 'Boxes',           label: '설비/박스',   component: Boxes,           category: '시설/사이트' },
  // 네트워크/IoT
  { name: 'Network',         label: '네트워크',    component: Network,         category: '네트워크/IoT' },
  { name: 'Server',          label: '서버',        component: Server,          category: '네트워크/IoT' },
  { name: 'Wifi',            label: '무선/IoT',    component: Wifi,            category: '네트워크/IoT' },
  { name: 'Radio',           label: '무선통신',    component: Radio,           category: '네트워크/IoT' },
  { name: 'Database',        label: '데이터베이스',component: Database,        category: '네트워크/IoT' },
  { name: 'Link',            label: '링크/연결',   component: Link,            category: '네트워크/IoT' },
  { name: 'Share2',          label: '공유/연동',   component: Share2,          category: '네트워크/IoT' },
  // 탄소/환경
  { name: 'Leaf',            label: '탄소/환경',   component: Leaf,            category: '탄소/환경' },
  { name: 'Recycle',         label: '재활용',      component: Recycle,         category: '탄소/환경' },
  { name: 'Globe',           label: '글로벌',      component: Globe,           category: '탄소/환경' },
  // 관리/설정
  { name: 'Users',           label: '사용자',      component: Users,           category: '관리/설정' },
  { name: 'UserCheck',       label: '사용자 승인', component: UserCheck,       category: '관리/설정' },
  { name: 'Settings',        label: '설정',        component: Settings,        category: '관리/설정' },
  { name: 'Key',             label: 'API 키',      component: Key,             category: '관리/설정' },
  { name: 'Lock',            label: '보안/잠금',   component: Lock,            category: '관리/설정' },
  { name: 'ShieldCheck',     label: '보안 인증',   component: ShieldCheck,     category: '관리/설정' },
  { name: 'LayoutGrid',      label: '메뉴/그리드', component: LayoutGrid,      category: '관리/설정' },
  // 알림/보고
  { name: 'Bell',            label: '알림',        component: Bell,            category: '알림/보고' },
  { name: 'AlertTriangle',   label: '경고',        component: AlertTriangle,   category: '알림/보고' },
  { name: 'FileText',        label: '보고서',      component: FileText,        category: '알림/보고' },
  { name: 'ClipboardList',   label: '목록/감사',   component: ClipboardList,   category: '알림/보고' },
  { name: 'Download',        label: '다운로드',    component: Download,        category: '알림/보고' },
  // 결제/구독
  { name: 'Wallet',          label: '지갑/결제',   component: Wallet,          category: '결제/구독' },
  { name: 'CreditCard',      label: '신용카드',    component: CreditCard,      category: '결제/구독' },
  { name: 'Receipt',         label: '영수증',      component: Receipt,         category: '결제/구독' },
  { name: 'Package',         label: '패키지',      component: Package,         category: '결제/구독' },
  // 기타
  { name: 'Info',            label: '정보',        component: Info,            category: '기타' },
  { name: 'HelpCircle',      label: '도움말',      component: HelpCircle,      category: '기타' },
  { name: 'MessageSquare',   label: '메시지',      component: MessageSquare,   category: '기타' },
  { name: 'Calendar',        label: '일정',        component: Calendar,        category: '기타' },
  { name: 'Clock',           label: '시간',        component: Clock,           category: '기타' },
  { name: 'Search',          label: '검색',        component: Search,          category: '기타' },
  { name: 'Filter',          label: '필터',        component: Filter,          category: '기타' },
  { name: 'Archive',         label: '아카이브',    component: Archive,         category: '기타' },
];

const ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  ICON_REGISTRY.map(d => [d.name, d.component])
);

const ICON_CATEGORIES = [...new Set(ICON_REGISTRY.map(d => d.category))];

function getIconComponent(name: string): LucideIcon {
  return ICON_MAP[name] ?? Activity;
}

// ── 아이콘 피커 컴포넌트 ───────────────────────────────────────────
function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen]       = useState(false);
  const [search, setSearch]   = useState('');
  const [cat, setCat]         = useState('전체');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = ICON_REGISTRY.filter(d => {
    const matchCat = cat === '전체' || d.category === cat;
    const matchSearch = !search || d.label.includes(search) || d.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const IconComp = getIconComponent(value);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white hover:border-cyan-500 transition text-left"
      >
        <IconComp className="w-4 h-4 text-cyan-400 shrink-0" />
        <span className="flex-1 truncate">{value || '아이콘 선택'}</span>
        <span className="text-slate-500 text-xs shrink-0">
          {ICON_REGISTRY.find(d => d.name === value)?.label ?? ''}
        </span>
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 w-80 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl overflow-hidden">
          {/* Search + category */}
          <div className="p-3 border-b border-slate-700 space-y-2">
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="아이콘 검색 (예: 에너지, 차트)"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <div className="flex flex-wrap gap-1">
              {['전체', ...ICON_CATEGORIES].map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCat(c)}
                  className={`px-2 py-0.5 rounded text-[11px] transition ${
                    cat === c
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          {/* Icon grid */}
          <div className="grid grid-cols-5 gap-0.5 p-2 max-h-56 overflow-y-auto">
            {filtered.map(d => {
              const Ic = d.component;
              const selected = d.name === value;
              return (
                <button
                  key={d.name}
                  type="button"
                  onClick={() => { onChange(d.name); setOpen(false); setSearch(''); }}
                  title={`${d.label} (${d.name})`}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg transition group ${
                    selected
                      ? 'bg-cyan-600 text-white'
                      : 'hover:bg-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  <Ic className="w-4 h-4" />
                  <span className="text-[9px] leading-tight text-center truncate w-full">{d.label}</span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="col-span-5 py-6 text-center text-slate-500 text-xs">
                검색 결과 없음
              </div>
            )}
          </div>
          <div className="px-3 py-2 border-t border-slate-700 text-[11px] text-slate-500">
            총 {filtered.length}개 · 선택됨: <span className="text-cyan-400">{value}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 인라인 아이콘 피커 (소형, 편집 행) ────────────────────────────
function InlineIconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const IconComp = getIconComponent(value);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        title={`${value} — 클릭하여 변경`}
        className="flex items-center gap-1.5 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white hover:border-cyan-500 transition"
      >
        <IconComp className="w-3.5 h-3.5 text-cyan-400" />
        <span className="max-w-[60px] truncate">{value}</span>
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 w-72 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl overflow-hidden">
          <div className="grid grid-cols-6 gap-0.5 p-2 max-h-44 overflow-y-auto">
            {ICON_REGISTRY.map(d => {
              const Ic = d.component;
              const selected = d.name === value;
              return (
                <button
                  key={d.name}
                  type="button"
                  onClick={() => { onChange(d.name); setOpen(false); }}
                  title={`${d.label} (${d.name})`}
                  className={`flex flex-col items-center gap-0.5 p-1.5 rounded transition ${
                    selected ? 'bg-cyan-600 text-white' : 'hover:bg-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  <Ic className="w-3.5 h-3.5" />
                  <span className="text-[8px] truncate w-full text-center">{d.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const inp   = 'w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500';
const inpSm = 'bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500';

let newIdCounter = 0;
function newId(prefix: string) { return `__new__${prefix}_${++newIdCounter}`; }

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
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
  const [localGroups, setLocalGroups]         = useState<LocalGroup[]>([]);
  const [deletedGroupIds, setDeletedGroupIds] = useState<string[]>([]);
  const [deletedItemIds,  setDeletedItemIds]  = useState<string[]>([]);
  const [isLoading, setIsLoading]             = useState(true);
  const [saving,    setSaving]                = useState(false);
  const [isDirty,   setIsDirty]               = useState(false);
  const [expandedGroups, setExpandedGroups]   = useState<Set<string>>(new Set());

  const [editGroupId,   setEditGroupId]   = useState<string | null>(null);
  const [editGroupForm, setEditGroupForm] = useState({ label: '', icon: 'LayoutGrid', minRole: 'viewer' });
  const [editItemId,    setEditItemId]    = useState<string | null>(null);
  const [editItemForm,  setEditItemForm]  = useState({ label: '', path: '', icon: 'Circle', minRole: 'viewer' });

  const [showCreateGroup,    setShowCreateGroup]    = useState(false);
  const [createGroupForm,    setCreateGroupForm]    = useState({ code: '', label: '', icon: 'LayoutGrid', minRole: 'viewer' });
  const [createItemForGroup, setCreateItemForGroup] = useState<string | null>(null);
  const [createItemForm,     setCreateItemForm]     = useState({ code: '', label: '', path: '', icon: 'Activity', minRole: 'viewer' });

  const dragRef    = useRef<DragState | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // ── Load ──────────────────────────────────────────────────────
  const fetchMenus = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiGet<Array<LocalGroup & { isActive?: boolean }>>('/api/menus?all=true');
      if (res.success && res.data) {
        // isActive → enabled 매핑 (그룹)
        const mapped = res.data.map(g => ({ ...g, enabled: g.isActive ?? true }));
        setLocalGroups(mapped);
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
  const updateGroups = (fn: (g: LocalGroup[]) => LocalGroup[]) => { setLocalGroups(fn); markDirty(); };
  const toggleExpand = (id: string) => {
    setExpandedGroups(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  // ── CRUD ──────────────────────────────────────────────────────
  const addGroup = () => {
    if (!createGroupForm.code.trim() || !createGroupForm.label.trim()) { toast.error('코드와 이름을 입력하세요'); return; }
    const id = newId('group');
    updateGroups(g => [...g, {
      id, code: createGroupForm.code.trim(), label: createGroupForm.label.trim(),
      icon: createGroupForm.icon || 'LayoutGrid', minRole: createGroupForm.minRole,
      sortOrder: g.length * 10, section: 'general', enabled: true, items: [],
    }]);
    setExpandedGroups(p => new Set([...p, id]));
    setShowCreateGroup(false);
    setCreateGroupForm({ code: '', label: '', icon: 'LayoutGrid', minRole: 'viewer' });
  };

  const deleteGroup = (group: LocalGroup) => {
    if (!confirm(`"${group.label}" 그룹과 하위 ${group.items.length}개 항목을 삭제하시겠습니까?`)) return;
    if (!group.id.startsWith('__new__')) setDeletedGroupIds(p => [...p, group.id]);
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
          path: createItemForm.path.trim(), icon: createItemForm.icon || 'Activity',
          minRole: createItemForm.minRole, sortOrder: grp.items.length * 10,
          enabled: true, featureRequired: null, badgeType: null,
        }]}
      : grp
    ));
    setCreateItemForGroup(null);
    setCreateItemForm({ code: '', label: '', path: '', icon: 'Activity', minRole: 'viewer' });
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

  const toggleGroupEnabled = (groupId: string) => {
    updateGroups(g => g.map(grp => grp.id === groupId ? { ...grp, enabled: !grp.enabled } : grp));
  };

  const toggleEnabled = (groupId: string, itemId: string) => {
    updateGroups(g => g.map(grp => grp.id === groupId
      ? { ...grp, items: grp.items.map(i => i.id === itemId ? { ...i, enabled: !i.enabled } : i) }
      : grp
    ));
  };

  const updateItemRole = (groupId: string, itemId: string, role: string) => {
    updateGroups(g => g.map(grp => grp.id === groupId
      ? { ...grp, items: grp.items.map(i => i.id === itemId ? { ...i, minRole: role } : i) }
      : grp
    ));
  };

  const moveGroupToIndex = (groupId: string, newIndex: number) => {
    updateGroups(groups => {
      const from = groups.findIndex(g => g.id === groupId);
      if (from < 0) return groups;
      const to = Math.max(0, Math.min(groups.length - 1, newIndex - 1));
      if (from === to) return groups;
      const result = [...groups];
      const [removed] = result.splice(from, 1);
      if (!removed) return groups;
      result.splice(to, 0, removed);
      return result;
    });
  };

  const moveItemToIndex = (groupId: string, itemId: string, newIndex: number) => {
    updateGroups(groups => groups.map(grp => {
      if (grp.id !== groupId) return grp;
      const from = grp.items.findIndex(i => i.id === itemId);
      if (from < 0) return grp;
      const to = Math.max(0, Math.min(grp.items.length - 1, newIndex - 1));
      if (from === to) return grp;
      const items = [...grp.items];
      const [removed] = items.splice(from, 1);
      if (!removed) return grp;
      items.splice(to, 0, removed);
      return { ...grp, items };
    }));
  };

  // ── Drag ──────────────────────────────────────────────────────
  const handleGroupDragStart = (e: React.DragEvent, group: LocalGroup, index: number) => {
    dragRef.current = { type: 'group', id: group.id, index };
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleGroupDragOver = (e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    if (dragRef.current?.type === 'group') setDragOverId(groupId);
  };
  const handleGroupDrop = (e: React.DragEvent, targetGroup: LocalGroup, targetIndex: number) => {
    e.preventDefault(); setDragOverId(null);
    const drag = dragRef.current;
    if (!drag || drag.type !== 'group' || drag.id === targetGroup.id) { dragRef.current = null; return; }
    updateGroups(groups => {
      const result = [...groups];
      const from   = result.findIndex(g => g.id === drag.id);
      if (from < 0) return groups;
      const [removed] = result.splice(from, 1);
      if (!removed) return groups;
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
    e.preventDefault(); e.stopPropagation();
    if (dragRef.current?.type === 'item') setDragOverId(itemId);
  };
  const handleItemDrop = (e: React.DragEvent, groupId: string, targetItem: LocalItem, targetIndex: number) => {
    e.preventDefault(); e.stopPropagation(); setDragOverId(null);
    const drag = dragRef.current;
    if (!drag || drag.type !== 'item' || drag.id === targetItem.id) { dragRef.current = null; return; }
    updateGroups(groups => groups.map(grp => {
      if (grp.id !== groupId) return grp;
      const items  = [...grp.items];
      const from   = items.findIndex(i => i.id === drag.id);
      if (from < 0) return grp;
      const [removed] = items.splice(from, 1);
      if (!removed) return grp;
      items.splice(targetIndex, 0, removed);
      return { ...grp, items };
    }));
    dragRef.current = null;
  };
  const handleDragEnd = () => { setDragOverId(null); dragRef.current = null; };

  // ── Save ── label → name 변환 필수 (API schema: name) ─────────
  const handleSave = async () => {
    const groupsToSave = localGroups.map((g, gi) => ({
      id:        g.id,
      code:      g.code,
      name:      g.label,          // LocalGroup.label → API.name
      icon:      g.icon,
      minRole:   g.minRole,
      sortOrder: gi * 10,
      enabled:   g.enabled,
      items:     g.items.map((item, ii) => ({
        id:        item.id,
        code:      item.code,
        name:      item.label,     // LocalItem.label → API.name
        path:      item.path,
        icon:      item.icon,
        minRole:   item.minRole,
        sortOrder: ii * 10,
        enabled:   item.enabled,
      })),
    }));

    setSaving(true);
    try {
      const res = await apiPost('/api/admin/menus', {
        groups: groupsToSave,
        deletedGroupIds,
        deletedItemIds,
      });
      if (res.success) {
        toast.success('메뉴 설정이 저장되었습니다.');
        await fetchMenus();
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
          <p className="text-slate-400 text-sm mt-1">저장 버튼을 눌러야 DB에 반영됩니다 · 드래그 또는 # 번호로 순서 변경</p>
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
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="text-sm text-slate-400">메뉴 그룹</div>
          <div className="text-2xl font-bold text-white mt-1">{localGroups.length}</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="text-sm text-slate-400">전체 항목</div>
          <div className="text-2xl font-bold text-white mt-1">{localGroups.reduce((s, g) => s + g.items.length, 0)}</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="text-sm text-slate-400">비활성 그룹</div>
          <div className="text-2xl font-bold text-orange-400 mt-1">{localGroups.filter(g => !g.enabled).length}</div>
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
          const GroupIcon  = getIconComponent(group.icon);

          return (
            <div
              key={group.id}
              onDragOver={e => handleGroupDragOver(e, group.id)}
              onDrop={e => handleGroupDrop(e, group, gi)}
              onDragEnd={handleDragEnd}
              className={`border rounded-xl overflow-hidden transition-all ${
                isDragOver ? 'border-cyan-400 shadow-lg shadow-cyan-400/10' : 'border-slate-700/50'
              } ${isNew ? 'border-l-2 border-l-purple-500' : ''} ${
                group.enabled ? 'bg-slate-800/50' : 'bg-slate-900/60 opacity-60'
              }`}
            >
              {/* Group Header */}
              {editGroupId === group.id ? (
                <div className="flex items-center gap-2 px-4 py-3 flex-wrap bg-slate-700/30">
                  <input autoFocus value={editGroupForm.label}
                    onChange={e => setEditGroupForm(p => ({ ...p, label: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') commitGroupEdit(); if (e.key === 'Escape') setEditGroupId(null); }}
                    placeholder="그룹 이름" className={`${inpSm} w-36`} />
                  <InlineIconPicker value={editGroupForm.icon} onChange={v => setEditGroupForm(p => ({ ...p, icon: v }))} />
                  <RoleSelect small value={editGroupForm.minRole} onChange={v => setEditGroupForm(p => ({ ...p, minRole: v }))} />
                  <button onClick={commitGroupEdit} className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded"><Check className="w-4 h-4" /></button>
                  <button onClick={() => setEditGroupId(null)} className="p-1.5 text-slate-400 hover:text-white rounded"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="flex items-center justify-between px-4 py-3">
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
                      {/* 아이콘 미리보기 */}
                      <GroupIcon className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span className="font-semibold text-white truncate">{group.label}</span>
                      <span className="text-xs px-1.5 py-0.5 bg-slate-700/50 rounded text-slate-400 shrink-0">{group.code}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${ROLE_COLORS[group.minRole] ?? ''}`}>{ROLE_LABELS[group.minRole]}</span>
                      {isNew && <span className="text-xs px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded shrink-0">NEW</span>}
                    </button>
                    <span className="text-xs text-slate-500 shrink-0">{group.items.length}개</span>
                  </div>
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-500">#</span>
                      <input
                        key={`${group.id}-order-${gi}`}
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
                    {/* 그룹 활성/비활성 토글 */}
                    <button
                      onClick={() => toggleGroupEnabled(group.id)}
                      title={group.enabled ? '그룹 비활성화' : '그룹 활성화'}
                      className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition font-medium ${
                        group.enabled
                          ? 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20'
                          : 'text-slate-500 bg-slate-700/50 hover:bg-slate-700'
                      }`}
                    >
                      {group.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      {group.enabled ? '활성' : '비활성'}
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
                    const isNewItem     = item.id.startsWith('__new__');
                    const isItemDragOver = dragOverId === item.id;
                    const ItemIcon      = getIconComponent(item.icon);

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
                          <div className="flex items-center gap-2 px-5 py-2.5 flex-wrap">
                            <input autoFocus value={editItemForm.label}
                              onChange={e => setEditItemForm(p => ({ ...p, label: e.target.value }))}
                              onKeyDown={e => { if (e.key === 'Enter') commitItemEdit(); if (e.key === 'Escape') setEditItemId(null); }}
                              placeholder="이름" className={`${inpSm} w-28`} />
                            <input value={editItemForm.path}
                              onChange={e => setEditItemForm(p => ({ ...p, path: e.target.value }))}
                              placeholder="경로 (/path)" className={`${inpSm} flex-1 min-w-0`} />
                            <InlineIconPicker value={editItemForm.icon} onChange={v => setEditItemForm(p => ({ ...p, icon: v }))} />
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
                              {/* 아이콘 미리보기 */}
                              <ItemIcon className="w-4 h-4 text-slate-400 shrink-0" />
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
                              <button
                                onClick={() => { const roles = [...ROLES]; const idx = (roles.indexOf(item.minRole as any) + 1) % roles.length; updateItemRole(group.id, item.id, roles[idx]!); }}
                                className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 hover:opacity-80 transition ${ROLE_COLORS[item.minRole] ?? ''}`}
                                title="클릭하여 역할 변경">
                                <Shield className="w-3 h-3" />{ROLE_LABELS[item.minRole]}
                              </button>
                              <button
                                onClick={() => toggleEnabled(group.id, item.id)}
                                title={item.enabled ? '비활성화' : '활성화'}
                                className={`flex items-center gap-1 px-1.5 py-1 text-[11px] rounded transition font-medium ${
                                  item.enabled
                                    ? 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20'
                                    : 'text-slate-500 bg-slate-700/50 hover:bg-slate-700'
                                }`}
                              >
                                {item.enabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                {item.enabled ? '활성' : '비활성'}
                              </button>
                              <div className="flex items-center gap-0.5">
                                <span className="text-xs text-slate-600">#</span>
                                <input
                                  key={`${item.id}-order-${ii}`}
                                  type="number" min={1} max={group.items.length}
                                  defaultValue={ii + 1}
                                  onBlur={e => { const v = parseInt(e.target.value); if (!isNaN(v)) moveItemToIndex(group.id, item.id, v); e.target.value = String(group.items.findIndex(i => i.id === item.id) + 1); }}
                                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                  className="w-8 text-center bg-slate-900 border border-slate-700 rounded text-xs text-slate-300 py-0.5 focus:outline-none focus:border-cyan-500"
                                />
                              </div>
                              <button onClick={() => { setEditItemId(item.id); setEditItemForm({ label: item.label, path: item.path, icon: item.icon, minRole: item.minRole }); }}
                                className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded transition">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
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
              <li>⣿ 아이콘을 드래그하거나 # 숫자를 입력(Enter/포커스 해제)하여 순서를 변경합니다.</li>
              <li>아이콘 버튼을 클릭하면 카테고리별 시각적 아이콘 선택기가 열립니다.</li>
              <li>역할 배지를 클릭하면 순환 변경됩니다. 연필 아이콘으로 상세 편집 가능합니다.</li>
              <li>모든 변경사항(생성·수정·삭제·순서)은 &quot;저장&quot; 버튼을 눌러야 DB에 반영됩니다.</li>
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
                <IconPicker value={createGroupForm.icon} onChange={v => setCreateGroupForm(p => ({ ...p, icon: v }))} />
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
                <IconPicker value={createItemForm.icon} onChange={v => setCreateItemForm(p => ({ ...p, icon: v }))} />
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
