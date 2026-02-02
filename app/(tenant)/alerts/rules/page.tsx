// app/web/app/(tenant)/alerts/rules/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Edit, Trash2, Power, PowerOff } from 'lucide-react';

interface AlertRule {
  id: string;
  name: string;
  description?: string;
  category: string;
  severity: string;
  isActive: boolean;
  condition: {
    operator: string;
    threshold: number;
  };
  metric?: {
    id: string;
    key: string;
    name: string;
    unit: string;
  };
  device?: {
    id: string;
    name: string;
  };
  site?: {
    id: string;
    name: string;
  };
  triggerCount: number;
  lastTriggeredAt?: string;
}

export default function AlertRulesPage() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://localhost:4000/api/alert-rules?page=1&pageSize=50', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setRules(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch alert rules:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRule = async (ruleId: string, currentStatus: boolean) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`http://localhost:4000/api/alert-rules/${ruleId}/toggle`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: !currentStatus,
        }),
      });

      if (response.ok) {
        // 목록 새로고침
        fetchRules();
      }
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!confirm('이 알람 규칙을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`http://localhost:4000/api/alert-rules/${ruleId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        fetchRules();
      }
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      critical: 'bg-red-100 text-red-800',
      warning: 'bg-yellow-100 text-yellow-800',
      info: 'bg-blue-100 text-blue-800',
    };
    return colors[severity] || 'bg-gray-100 text-gray-800';
  };

  const getOperatorLabel = (operator: string) => {
    const labels: Record<string, string> = {
      '>': '초과',
      '<': '미만',
      '>=': '이상',
      '<=': '이하',
      '==': '같음',
      '!=': '다름',
    };
    return labels[operator] || operator;
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
          <h1 className="text-3xl font-bold text-gray-800">알람 규칙</h1>
          <p className="text-gray-600 mt-1">알람 조건을 설정하고 관리합니다</p>
        </div>
        <Link href="/alerts/rules/create">
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" />
            <span>새 규칙</span>
          </button>
        </Link>
      </div>

      {/* 규칙 목록 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                상태
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                규칙명
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                심각도
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                조건
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                대상
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                트리거 횟수
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                작업
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rules.length > 0 ? (
              rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => toggleRule(rule.id, rule.isActive)}
                      className={`p-2 rounded ${
                        rule.isActive
                          ? 'text-green-600 hover:bg-green-50'
                          : 'text-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      {rule.isActive ? (
                        <Power className="w-5 h-5" />
                      ) : (
                        <PowerOff className="w-5 h-5" />
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{rule.name}</p>
                      {rule.description && (
                        <p className="text-sm text-gray-500">{rule.description}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(rule.severity)}`}>
                      {rule.severity.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">
                      {rule.metric?.name} {getOperatorLabel(rule.condition.operator)} {rule.condition.threshold}
                      {rule.metric?.unit && ` ${rule.metric.unit}`}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {rule.device?.name || rule.site?.name || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{rule.triggerCount}회</div>
                    {rule.lastTriggeredAt && (
                      <div className="text-xs text-gray-500">
                        {new Date(rule.lastTriggeredAt).toLocaleString('ko-KR')}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <Link href={`/alerts/rules/edit/${rule.id}`}>
                        <button className="text-blue-600 hover:text-blue-900">
                          <Edit className="w-4 h-4" />
                        </button>
                      </Link>
                      <button
                        onClick={() => deleteRule(rule.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  등록된 알람 규칙이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}