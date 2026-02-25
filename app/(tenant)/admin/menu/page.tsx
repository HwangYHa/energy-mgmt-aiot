'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  LayoutGrid,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Shield,
  Loader2,
  Save,
  Settings,
  AlertCircle,
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

const ROLE_LABELS: Record<string, string> = {
  viewer: '뷰어',
  operator: '운영자',
  site_manager: '사이트 관리자',
  tenant_admin: '테넌트 관리자',
  super_admin: '슈퍼 관리자',
};

const ROLE_COLORS: Record<string, string> = {
  viewer: 'text-slate-400 bg-slate-500/10',
  operator: 'text-blue-400 bg-blue-500/10',
  site_manager: 'text-amber-400 bg-amber-500/10',
  tenant_admin: 'text-purple-400 bg-purple-500/10',
  super_admin: 'text-red-400 bg-red-500/10',
};

export default function MenuManagementPage() {
  const [menuGroups, setMenuGroups] = useState<MenuGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [editingItem, setEditingItem] = useState<string | null>(null);

  const fetchMenus = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiGet<MenuGroup[]>('/api/menus?all=true');
      if (res.success && res.data) {
        setMenuGroups(res.data);
        // 모든 그룹 기본 확장
        setExpandedGroups(new Set(res.data.map(g => g.id)));
      } else {
        loadSimulatedData();
      }
    } catch {
      loadSimulatedData();
    } finally {
      setIsLoading(false);
    }
  }, []);

  function loadSimulatedData() {
    const simGroups: MenuGroup[] = [
      {
        id: 'g1', code: 'dashboard', label: '대시보드', icon: 'LayoutDashboard', minRole: 'viewer', sortOrder: 0, section: 'monitoring',
        items: [
          { id: 'i1', code: 'dashboard-main', label: '메인 대시보드', path: '/dashboard', icon: 'LayoutDashboard', minRole: 'viewer', sortOrder: 0, enabled: true, featureRequired: null, badgeType: null },
          { id: 'i3', code: 'dashboard-viewer', label: '뷰어 전용', path: '/dashboard/viewer', icon: 'Eye', minRole: 'viewer', sortOrder: 2, enabled: true, featureRequired: null, badgeType: null },
        ],
      },
      {
        id: 'g2', code: 'monitoring', label: '모니터링', icon: 'Monitor', minRole: 'viewer', sortOrder: 1, section: 'monitoring',
        items: [
          { id: 'i4', code: 'monitoring-main', label: '종합 모니터링', path: '/monitoring', icon: 'Monitor', minRole: 'viewer', sortOrder: 0, enabled: true, featureRequired: null, badgeType: null },
          { id: 'i5', code: 'monitoring-pipeline', label: '데이터 수집 상태', path: '/monitoring/pipeline', icon: 'Activity', minRole: 'site_manager', sortOrder: 1, enabled: true, featureRequired: null, badgeType: 'new' },
          { id: 'i6', code: 'monitoring-sensors', label: '센서 관리', path: '/sensors', icon: 'Radio', minRole: 'operator', sortOrder: 2, enabled: true, featureRequired: null, badgeType: null },
        ],
      },
      {
        id: 'g3', code: 'analytics', label: '통계/분석', icon: 'BarChart3', minRole: 'viewer', sortOrder: 2, section: 'monitoring',
        items: [
          { id: 'i7', code: 'analytics-energy', label: '에너지 분석', path: '/analytics/energy', icon: 'Zap', minRole: 'viewer', sortOrder: 0, enabled: true, featureRequired: null, badgeType: null },
          { id: 'i8', code: 'analytics-cost', label: '비용 분석', path: '/analytics/cost', icon: 'DollarSign', minRole: 'viewer', sortOrder: 1, enabled: true, featureRequired: null, badgeType: null },
          { id: 'i9', code: 'analytics-anomaly', label: '이상 탐지', path: '/analytics/anomaly', icon: 'AlertTriangle', minRole: 'viewer', sortOrder: 2, enabled: true, featureRequired: null, badgeType: null },
          { id: 'i10', code: 'analytics-forecast', label: 'AI 예측', path: '/analytics/forecast', icon: 'TrendingUp', minRole: 'viewer', sortOrder: 3, enabled: true, featureRequired: 'ai_forecast', badgeType: 'ai' },
          { id: 'i11', code: 'analytics-simulator', label: '절감 시뮬레이터', path: '/analytics/simulator', icon: 'Calculator', minRole: 'viewer', sortOrder: 4, enabled: true, featureRequired: null, badgeType: 'new' },
          { id: 'i12', code: 'analytics-templates', label: '분석 템플릿', path: '/analytics/templates', icon: 'FileBarChart', minRole: 'viewer', sortOrder: 5, enabled: true, featureRequired: null, badgeType: null },
          { id: 'i13', code: 'analytics-raw-data', label: '원시 데이터', path: '/analytics/raw-data', icon: 'Database', minRole: 'site_manager', sortOrder: 6, enabled: true, featureRequired: null, badgeType: null },
          { id: 'i14', code: 'analytics-download', label: '데이터 다운로드', path: '/analytics/download', icon: 'Download', minRole: 'operator', sortOrder: 7, enabled: true, featureRequired: null, badgeType: null },
        ],
      },
      {
        id: 'g4', code: 'settings', label: '설정', icon: 'Settings', minRole: 'operator', sortOrder: 8, section: 'admin',
        items: [
          { id: 'i15', code: 'settings-system', label: '시스템 설정', path: '/settings/system', icon: 'Settings', minRole: 'tenant_admin', sortOrder: 0, enabled: true, featureRequired: null, badgeType: null },
          { id: 'i16', code: 'settings-notifications', label: '알림 설정', path: '/settings/notifications', icon: 'Bell', minRole: 'operator', sortOrder: 1, enabled: true, featureRequired: null, badgeType: null },
          { id: 'i17', code: 'settings-api', label: 'API 키 관리', path: '/settings/api', icon: 'Key', minRole: 'tenant_admin', sortOrder: 2, enabled: true, featureRequired: null, badgeType: null },
        ],
      },
      {
        id: 'g5', code: 'admin', label: '관리', icon: 'Shield', minRole: 'tenant_admin', sortOrder: 9, section: 'admin',
        items: [
          { id: 'i18', code: 'admin-users', label: '사용자 관리', path: '/admin/users', icon: 'Users', minRole: 'tenant_admin', sortOrder: 0, enabled: true, featureRequired: null, badgeType: null },
          { id: 'i19', code: 'admin-tenants', label: '테넌트 관리', path: '/admin/tenants', icon: 'Building2', minRole: 'super_admin', sortOrder: 1, enabled: true, featureRequired: null, badgeType: null },
          { id: 'i20', code: 'admin-menu', label: '메뉴 관리', path: '/admin/menu', icon: 'LayoutGrid', minRole: 'super_admin', sortOrder: 2, enabled: true, featureRequired: null, badgeType: null },
        ],
      },
    ];
    setMenuGroups(simGroups);
    setExpandedGroups(new Set(simGroups.map(g => g.id)));
  }

  useEffect(() => {
    fetchMenus();
  }, [fetchMenus]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(groupId) ? next.delete(groupId) : next.add(groupId);
      return next;
    });
  };

  const toggleItemEnabled = (groupId: string, itemId: string) => {
    setMenuGroups(prev =>
      prev.map(g =>
        g.id === groupId
          ? { ...g, items: g.items.map(i => i.id === itemId ? { ...i, enabled: !i.enabled } : i) }
          : g
      )
    );
    setHasChanges(true);
  };

  const updateItemRole = (groupId: string, itemId: string, newRole: string) => {
    setMenuGroups(prev =>
      prev.map(g =>
        g.id === groupId
          ? { ...g, items: g.items.map(i => i.id === itemId ? { ...i, minRole: newRole } : i) }
          : g
      )
    );
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiPost('/api/admin/menus', { groups: menuGroups });
      setHasChanges(false);
      toast.success('메뉴 설정이 저장되었습니다.');
    } catch {
      toast.error('저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

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
    <div className="min-h-screen bg-[#051225] text-white p-4 md:p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <LayoutGrid className="w-6 h-6 text-purple-400" />
            </div>
            메뉴 관리
          </h1>
          <p className="text-slate-400 text-sm mt-1">사이드바 메뉴 구성 및 권한 설정</p>
        </div>
        <div className="flex gap-3">
          {hasChanges && (
            <span className="flex items-center gap-1.5 text-sm text-amber-400">
              <AlertCircle className="w-4 h-4" />
              저장되지 않은 변경사항
            </span>
          )}
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

      {/* 에러 배너 */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center justify-between">
          <p className="text-sm text-red-300">{error}</p>
          <button onClick={fetchMenus} className="px-3 py-1.5 bg-red-500/20 text-red-300 rounded-lg text-sm hover:bg-red-500/30 transition">
            재시도
          </button>
        </div>
      )}

      {/* 통계 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="text-sm text-slate-400">메뉴 그룹</div>
          <div className="text-2xl font-bold text-white mt-1">{menuGroups.length}</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="text-sm text-slate-400">전체 메뉴 항목</div>
          <div className="text-2xl font-bold text-white mt-1">{menuGroups.reduce((sum, g) => sum + g.items.length, 0)}</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="text-sm text-slate-400">비활성 항목</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">
            {menuGroups.reduce((sum, g) => sum + g.items.filter(i => !i.enabled).length, 0)}
          </div>
        </div>
      </div>

      {/* 메뉴 그룹 목록 */}
      <div className="space-y-3">
        {menuGroups.map((group) => (
          <div key={group.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
            {/* 그룹 헤더 */}
            <button
              onClick={() => toggleGroup(group.id)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-700/20 transition"
            >
              <div className="flex items-center gap-4">
                <GripVertical className="w-4 h-4 text-slate-600" />
                {expandedGroups.has(group.id) ? (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                )}
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-base font-semibold text-white">{group.label}</span>
                    <span className="text-xs px-2 py-0.5 bg-slate-700/50 rounded text-slate-400">{group.code}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${ROLE_COLORS[group.minRole] || ''}`}>
                      {ROLE_LABELS[group.minRole] || group.minRole}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">{group.items.length}개 항목 · {group.section}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">정렬: {group.sortOrder}</span>
              </div>
            </button>

            {/* 그룹 아이템 */}
            {expandedGroups.has(group.id) && (
              <div className="border-t border-slate-700/50">
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between px-5 py-3 border-b border-slate-700/30 last:border-b-0 transition ${
                      !item.enabled ? 'opacity-50 bg-slate-900/30' : 'hover:bg-slate-700/10'
                    }`}
                  >
                    <div className="flex items-center gap-4 pl-12">
                      <GripVertical className="w-3.5 h-3.5 text-slate-700" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white">{item.label}</span>
                          {item.badgeType && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                              item.badgeType === 'new' ? 'bg-cyan-500/20 text-cyan-400' :
                              item.badgeType === 'ai' ? 'bg-purple-500/20 text-purple-400' :
                              item.badgeType === 'live' ? 'bg-emerald-500/20 text-emerald-400' :
                              'bg-slate-500/20 text-slate-400'
                            }`}>
                              {item.badgeType.toUpperCase()}
                            </span>
                          )}
                          {item.featureRequired && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded">
                              {item.featureRequired}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500">{item.path}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* 역할 선택 */}
                      {editingItem === item.id ? (
                        <select
                          value={item.minRole}
                          onChange={(e) => { updateItemRole(group.id, item.id, e.target.value); setEditingItem(null); }}
                          onBlur={() => setEditingItem(null)}
                          autoFocus
                          className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-white focus:outline-none focus:border-cyan-500"
                        >
                          {Object.entries(ROLE_LABELS).map(([val, label]) => (
                            <option key={val} value={val}>{label}</option>
                          ))}
                        </select>
                      ) : (
                        <button
                          onClick={() => setEditingItem(item.id)}
                          className={`text-xs px-2 py-1 rounded flex items-center gap-1 hover:opacity-80 transition ${ROLE_COLORS[item.minRole] || ''}`}
                        >
                          <Shield className="w-3 h-3" />
                          {ROLE_LABELS[item.minRole] || item.minRole}
                        </button>
                      )}

                      {/* 활성/비활성 토글 */}
                      <button
                        onClick={() => toggleItemEnabled(group.id, item.id)}
                        className={`p-1.5 rounded transition ${
                          item.enabled
                            ? 'text-emerald-400 hover:bg-emerald-500/10'
                            : 'text-slate-600 hover:bg-slate-700/50'
                        }`}
                      >
                        {item.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 안내 */}
      <div className="bg-blue-900/20 border border-blue-600/30 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <Settings className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-blue-300 mb-1">메뉴 관리 안내</h3>
            <ul className="text-xs text-blue-200 space-y-1">
              <li>각 메뉴 항목의 최소 역할을 클릭하여 접근 권한을 변경할 수 있습니다.</li>
              <li>눈 아이콘을 클릭하여 메뉴 항목을 활성/비활성화할 수 있습니다.</li>
              <li>변경사항은 저장 버튼을 눌러야 적용됩니다.</li>
              <li>테넌트별 메뉴 설정은 테넌트 관리 페이지에서 별도로 설정 가능합니다.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
