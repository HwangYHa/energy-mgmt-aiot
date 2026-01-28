// app/web/components/layout/Sidebar.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Activity, 
  Building2, 
  Sliders, 
  BarChart3, 
  Leaf,
  Shield,
  Bell,
  Zap,
  Settings,
  ChevronDown,
  Star,
  ShieldCheck,
} from 'lucide-react';

interface MenuItem {
  id: string;
  code: string;
  name: string;
  icon: string;
  path: string;
  isFavorite: boolean;
}

interface MenuGroup {
  id: string;
  code: string;
  name: string;
  icon: string;
  displayOrder: number;
  items: MenuItem[];
}

// 아이콘 매핑
const iconMap: Record<string, any> = {
  LayoutDashboard,
  Activity,
  Building2,
  Sliders,
  BarChart3,
  Leaf,
  Shield,
  Bell,
  Zap,
  Settings,
  ShieldCheck,
  Gauge: Activity,
  Building: Building2,
  Cpu: Activity,
  Hand: Sliders,
  Calendar: Activity,
  DollarSign: BarChart3,
  Calculator: BarChart3,
  Target: BarChart3,
  Database: Activity,
  Layers: BarChart3,
  FileText: Shield,
  CheckSquare: Shield,
  FileSearch: Shield,
  History: Activity,
  MessageSquare: Bell,
  User: Settings,
  Users: Settings,
  CreditCard: Settings,
  Plug: Settings,
};

export default function Sidebar() {
  const pathname = usePathname();
  const [menuGroups, setMenuGroups] = useState<MenuGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMenu();
  }, []);

  const fetchMenu = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://localhost:4000/api/menu', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMenuGroups(data);
        
        // 현재 경로가 속한 그룹 자동 확장
        const currentGroup = data.find((group: MenuGroup) =>
          group.items.some((item: MenuItem) => pathname.startsWith(item.path))
        );
        if (currentGroup) {
          setExpandedGroups(new Set([currentGroup.code]));
        }
      }
    } catch (error) {
      console.error('Failed to fetch menu:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleGroup = (groupCode: string) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupCode)) {
        newSet.delete(groupCode);
      } else {
        newSet.add(groupCode);
      }
      return newSet;
    });
  };

  const toggleFavorite = async (menuItemId: string, isFavorite: boolean) => {
    try {
      const token = localStorage.getItem('accessToken');
      const method = isFavorite ? 'DELETE' : 'POST';
      
      await fetch(`http://localhost:4000/api/menu/favorites/${menuItemId}`, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      // 메뉴 새로고침
      fetchMenu();
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const getIcon = (iconName: string) => {
    const Icon = iconMap[iconName] || Activity;
    return Icon;
  };

  if (isLoading) {
    return (
      <div className="w-64 bg-gray-900 text-white p-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-700 rounded mb-4"></div>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 bg-gray-900 text-white h-screen overflow-y-auto">
      {/* 로고 */}
      <div className="p-4 border-b border-gray-700">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Zap className="w-8 h-8 text-blue-500" />
          <span className="text-xl font-bold">EMS</span>
        </Link>
      </div>

      {/* 메뉴 그룹 */}
      <div className="p-4 space-y-2">
        {menuGroups.map((group) => {
          const isExpanded = expandedGroups.has(group.code);
          const GroupIcon = getIcon(group.icon);

          return (
            <div key={group.id}>
              {/* 그룹 헤더 */}
              <button
                onClick={() => toggleGroup(group.code)}
                className="w-full flex items-center justify-between p-2 rounded hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <GroupIcon className="w-5 h-5" />
                  <span className="font-medium">{group.name}</span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* 메뉴 아이템 */}
              {isExpanded && (
                <div className="ml-4 mt-1 space-y-1">
                  {group.items.map((item) => {
                    const isActive = pathname === item.path;
                    const ItemIcon = getIcon(item.icon);

                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-1"
                      >
                        <Link
                          href={item.path}
                          className={`flex-1 flex items-center gap-2 p-2 rounded text-sm transition-colors ${
                            isActive
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-300 hover:bg-gray-800'
                          }`}
                        >
                          <ItemIcon className="w-4 h-4" />
                          <span>{item.name}</span>
                        </Link>

                        {/* 즐겨찾기 버튼 */}
                        <button
                          onClick={() => toggleFavorite(item.id, item.isFavorite)}
                          className="p-1 rounded hover:bg-gray-800"
                        >
                          <Star
                            className={`w-4 h-4 ${
                              item.isFavorite
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-gray-500'
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}