/**
 * HMI 사이트별 상태 테이블
 * 모든 사이트의 현황을 한눈에 표시
 */

'use client';

import type { SiteStatus } from '@/lib/types/hmi';
import { StatusIndicator } from './StatusIndicator';
import { AlertTriangle, XCircle } from 'lucide-react';

interface SiteStatusTableProps {
  sites: SiteStatus[];
}

export function SiteStatusTable({ sites }: SiteStatusTableProps) {
  if (sites.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-8">
        <div className="text-center text-slate-400">사이트 데이터가 없습니다</div>
      </div>
    );
  }

  // 상태별 정렬 (위험 > 경고 > 정상)
  const sortedSites = [...sites].sort((a, b) => {
    const statusOrder = { danger: 0, warning: 1, normal: 2 };
    return statusOrder[a.status] - statusOrder[b.status];
  });

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-800 border-b border-slate-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                상태
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                사이트명
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                현재 사용량
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                피크 사용률
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                이상 설비
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                메시지
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {sortedSites.map((site) => (
              <tr
                key={site.siteId}
                className={`hover:bg-slate-800/50 transition-colors ${
                  site.status === 'danger'
                    ? 'bg-red-900/10'
                    : site.status === 'warning'
                      ? 'bg-yellow-900/10'
                      : ''
                }`}
              >
                {/* 상태 */}
                <td className="px-4 py-3">
                  <StatusIndicator
                    status={site.status}
                    size="md"
                    pulse={site.status === 'danger'}
                  />
                </td>

                {/* 사이트명 */}
                <td className="px-4 py-3">
                  <div className="text-sm font-semibold text-white">{site.siteName}</div>
                </td>

                {/* 현재 사용량 */}
                <td className="px-4 py-3 text-right">
                  <div className="text-sm font-mono text-white">
                    {site.currentUsage.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                    <span className="text-slate-400 ml-1">kW</span>
                  </div>
                </td>

                {/* 피크 사용률 */}
                <td className="px-4 py-3 text-right">
                  <div
                    className={`text-sm font-mono font-bold ${
                      site.peakRate >= 95
                        ? 'text-red-400'
                        : site.peakRate >= 80
                          ? 'text-yellow-400'
                          : 'text-green-400'
                    }`}
                  >
                    {site.peakRate.toFixed(1)}%
                  </div>
                </td>

                {/* 이상 설비 */}
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-3">
                    {site.warningCount > 0 && (
                      <div className="flex items-center gap-1 text-yellow-400">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-sm font-bold">{site.warningCount}</span>
                      </div>
                    )}
                    {site.dangerCount > 0 && (
                      <div className="flex items-center gap-1 text-red-400">
                        <XCircle className="w-4 h-4" />
                        <span className="text-sm font-bold">{site.dangerCount}</span>
                      </div>
                    )}
                    {site.warningCount === 0 && site.dangerCount === 0 && (
                      <span className="text-sm text-slate-500">-</span>
                    )}
                  </div>
                </td>

                {/* 메시지 */}
                <td className="px-4 py-3">
                  {site.message ? (
                    <div className="text-sm text-slate-300">{site.message}</div>
                  ) : (
                    <div className="text-sm text-slate-500">정상 운영 중</div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
