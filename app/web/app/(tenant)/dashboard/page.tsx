// app/web/app/(tenant)/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { 
  Activity, 
  Zap, 
  TrendingUp, 
  AlertTriangle,
  Building2,
  Cpu,
} from 'lucide-react';

interface DashboardStats {
  sites: number;
  devices: {
    total: number;
    online: number;
    offline: number;
  };
  energy: {
    current: number;
    today: number;
    thisMonth: number;
  };
  alerts: {
    critical: number;
    warning: number;
    info: number;
  };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      // TODO: 실제 API 연동
      // 임시 데이터
      setStats({
        sites: 3,
        devices: {
          total: 25,
          online: 22,
          offline: 3,
        },
        energy: {
          current: 42.5,
          today: 856.3,
          thisMonth: 23456.7,
        },
        alerts: {
          critical: 2,
          warning: 5,
          info: 12,
        },
      });
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800">대시보드</h1>
        <p className="text-gray-600 mt-1">전체 시스템 현황을 한눈에 확인하세요</p>
      </div>

      {/* 통계 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* 사업장 */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">사업장</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">
                {stats?.sites}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* 설비 */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">설비</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">
                {stats?.devices.total}
              </p>
              <p className="text-xs text-green-600 mt-1">
                {stats?.devices.online}대 온라인
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <Cpu className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        {/* 현재 전력 */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">현재 전력</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">
                {stats?.energy.current} kW
              </p>
              <p className="text-xs text-gray-600 mt-1">
                금일: {stats?.energy.today} kWh
              </p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <Zap className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        {/* 알람 */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">알람</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">
                {stats && stats.alerts.critical + stats.alerts.warning}
              </p>
              <p className="text-xs text-red-600 mt-1">
                {stats?.alerts.critical}건 긴급
              </p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 차트 섹션 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 에너지 사용 추이 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">에너지 사용 추이</h3>
          <div className="h-64 flex items-center justify-center text-gray-400">
            차트 영역 (Recharts)
          </div>
        </div>

        {/* 설비 상태 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">설비 상태</h3>
          <div className="h-64 flex items-center justify-center text-gray-400">
            차트 영역 (Pie Chart)
          </div>
        </div>
      </div>

      {/* 최근 알람 */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold">최근 알람</h3>
        </div>
        <div className="p-6">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium">전력 사용량 초과</p>
                  <p className="text-xs text-gray-500">Device #001 - 2분 전</p>
                </div>
                <button className="text-sm text-blue-600 hover:underline">
                  확인
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}