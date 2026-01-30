// app/web/app/(tenant)/alerts/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  CheckCircle,
  Plus,
  Filter,
} from 'lucide-react';

interface AlertStats {
  total: number;
  bySeverity: {
    critical: number;
    warning: number;
    info: number;
  };
  recentAlerts: Alert[];
}

interface Alert {
  id: string;
  severity: string;
  message: string;
  createdAt: string;
  status: string;
  rule: {
    name: string;
  };
}

export default function AlertsPage() {
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAlertStats();
  }, []);

  const fetchAlertStats = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://localhost:4000/api/alert-rules/stats?days=7', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch alert stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-500" />;
      default:
        return <CheckCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const styles = {
      critical: 'bg-red-100 text-red-800',
      warning: 'bg-yellow-100 text-yellow-800',
      info: 'bg-blue-100 text-blue-800',
    };

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[severity] || 'bg-gray-100 text-gray-800'}`}>
        {severity.toUpperCase()}
      </span>
    );
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">알람 현황</h1>
          <p className="text-gray-600 mt-1">최근 7일간의 알람 통계</p>
        </div>
        <div className="flex gap-3">
          <Link href="/alerts/rules">
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              <Filter className="w-4 h-4" />
              <span>알람 규칙</span>
            </button>
          </Link>
          <Link href="/alerts/rules/create">
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" />
              <span>새 규칙</span>
            </button>
          </Link>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">전체 알람</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">
                {stats?.total || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">긴급</p>
              <p className="text-3xl font-bold text-red-600 mt-1">
                {stats?.bySeverity.critical || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">경고</p>
              <p className="text-3xl font-bold text-yellow-600 mt-1">
                {stats?.bySeverity.warning || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">정보</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">
                {stats?.bySeverity.info || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Info className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 최근 알람 */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold">최근 알람</h3>
          <Link href="/alerts/history">
            <button className="text-blue-600 hover:underline text-sm">
              전체 보기
            </button>
          </Link>
        </div>
        <div className="divide-y divide-gray-200">
          {stats?.recentAlerts && stats.recentAlerts.length > 0 ? (
            stats.recentAlerts.map((alert) => (
              <div key={alert.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start gap-3">
                  {getSeverityIcon(alert.severity)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getSeverityBadge(alert.severity)}
                      <span className="text-sm text-gray-500">
                        {new Date(alert.createdAt).toLocaleString('ko-KR')}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-800">
                      {alert.rule.name}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {alert.message}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">
                      {alert.status}
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-gray-500">
              최근 알람이 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}