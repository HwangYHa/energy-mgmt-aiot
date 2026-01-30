// app/web/app/(tenant)/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { 
  Zap, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Leaf,
  Target,
  Activity,
} from 'lucide-react';

interface DashboardData {
  realtime: {
    power: number;           // 현재 전력 (kW)
    powerTrend: 'up' | 'down' | 'stable';
    status: 'normal' | 'warning' | 'critical';
    utilization: number;     // 목표 대비 사용률 (%)
  };
  today: {
    energy: number;          // 금일 누적 (kWh)
    target: number;          // 금일 목표 (kWh)
    cost: number;            // 금일 비용 (원)
    comparison: number;      // 전일 대비 (%)
  };
  carbon: {
    emission: number;        // 금일 배출량 (tCO2)
    target: number;          // 목표 배출량 (tCO2)
    reduction: number;       // 절감량 (%)
  };
  alerts: {
    critical: number;
    warning: number;
    info: number;
  };
  devices: {
    total: number;
    online: number;
    offline: number;
    error: number;
  };
}

export default function HMIDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(() => {
      setCurrentTime(new Date());
      fetchDashboardData();
    }, 5000); // 5초마다 갱신

    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    // TODO: API 연동
    setData({
      realtime: {
        power: 847.3,
        powerTrend: 'up',
        status: 'warning',
        utilization: 84.7,
      },
      today: {
        energy: 18543.2,
        target: 20000,
        cost: 2781480,
        comparison: -5.3,
      },
      carbon: {
        emission: 8.2,
        target: 10.0,
        reduction: 18.0,
      },
      alerts: {
        critical: 2,
        warning: 5,
        info: 12,
      },
      devices: {
        total: 25,
        online: 22,
        offline: 2,
        error: 1,
      },
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical':
        return 'bg-red-600';
      case 'warning':
        return 'bg-yellow-500';
      default:
        return 'bg-green-600';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'critical':
        return '위험';
      case 'warning':
        return '주의';
      default:
        return '정상';
    }
  };

  if (!data) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-white text-xl">시스템 로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-4">
      {/* 상태 배너 (L1 - 최우선) */}
      <div className={`${getStatusColor(data.realtime.status)} rounded-lg p-4 flex items-center justify-between shadow-lg`}>
        <div className="flex items-center gap-4">
          <AlertTriangle className="w-8 h-8" />
          <div>
            <div className="text-2xl font-bold">{getStatusText(data.realtime.status)}</div>
            <div className="text-sm opacity-90">
              {data.alerts.critical > 0 && `긴급 ${data.alerts.critical}건`}
              {data.alerts.warning > 0 && ` / 경고 ${data.alerts.warning}건`}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm opacity-75">마지막 업데이트</div>
          <div className="text-lg font-mono">
            {currentTime.toLocaleTimeString('ko-KR')}
          </div>
        </div>
      </div>

      {/* 핵심 지표 (L1 - 최우선) */}
      <div className="grid grid-cols-3 gap-4">
        {/* 실시간 전력 */}
        <div className="bg-gray-800 rounded-lg p-6 border-2 border-yellow-500 shadow-lg">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap className="w-6 h-6 text-yellow-400" />
              <span className="text-sm text-gray-400">실시간 전력</span>
            </div>
            {data.realtime.powerTrend === 'up' ? (
              <TrendingUp className="w-5 h-5 text-red-400" />
            ) : (
              <TrendingDown className="w-5 h-5 text-green-400" />
            )}
          </div>
          <div className="text-6xl font-bold text-yellow-400 mb-2">
            {data.realtime.power.toLocaleString()}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl text-gray-400">kW</span>
            <span className={`text-sm ${data.realtime.utilization > 90 ? 'text-red-400' : 'text-gray-400'}`}>
              (목표 대비 {data.realtime.utilization}%)
            </span>
          </div>
          
          {/* 진행 바 */}
          <div className="mt-4 h-3 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className={`h-full ${data.realtime.utilization > 90 ? 'bg-red-500' : 'bg-yellow-400'} transition-all duration-500`}
              style={{ width: `${Math.min(data.realtime.utilization, 100)}%` }}
            />
          </div>
        </div>

        {/* 금일 사용량 */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 shadow-lg">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-6 h-6 text-blue-400" />
            <span className="text-sm text-gray-400">금일 사용량</span>
          </div>
          <div className="text-5xl font-bold text-blue-400 mb-2">
            {(data.today.energy / 1000).toFixed(1)}
          </div>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-xl text-gray-400">MWh</span>
            <span className="text-sm text-gray-500">
              / 목표 {(data.today.target / 1000).toFixed(1)} MWh
            </span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">전일 대비</span>
            <span className={`font-bold ${data.today.comparison < 0 ? 'text-green-400' : 'text-red-400'}`}>
              {data.today.comparison > 0 ? '+' : ''}{data.today.comparison}%
            </span>
          </div>
          
          {/* 비용 */}
          <div className="mt-3 pt-3 border-t border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">금일 전력비</span>
              <span className="text-lg font-bold text-white">
                ₩{(data.today.cost / 1000000).toFixed(2)}M
              </span>
            </div>
          </div>
        </div>

        {/* 탄소 배출 */}
        <div className="bg-gray-800 rounded-lg p-6 border border-green-700 shadow-lg">
          <div className="flex items-center gap-2 mb-4">
            <Leaf className="w-6 h-6 text-green-400" />
            <span className="text-sm text-gray-400">탄소 배출</span>
          </div>
          <div className="text-5xl font-bold text-green-400 mb-2">
            {data.carbon.emission.toFixed(1)}
          </div>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-xl text-gray-400">tCO₂</span>
            <span className="text-sm text-gray-500">
              / 목표 {data.carbon.target.toFixed(1)} tCO₂
            </span>
          </div>
          
          <div className="flex items-center gap-2 p-3 bg-green-900/30 rounded border border-green-700">
            <Target className="w-5 h-5 text-green-400" />
            <div>
              <div className="text-xs text-gray-400">절감률</div>
              <div className="text-2xl font-bold text-green-400">
                {data.carbon.reduction}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 설비 상태 (L2) */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold mb-4">설비 현황</h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-white mb-1">
              {data.devices.total}
            </div>
            <div className="text-sm text-gray-400">전체</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-400 mb-1">
              {data.devices.online}
            </div>
            <div className="text-sm text-gray-400">운전 중</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-500 mb-1">
              {data.devices.offline}
            </div>
            <div className="text-sm text-gray-400">정지</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-red-400 mb-1">
              {data.devices.error}
            </div>
            <div className="text-sm text-gray-400">이상</div>
          </div>
        </div>
      </div>

      {/* 빠른 액션 (L1 - 긴급 제어) */}
      <div className="grid grid-cols-4 gap-4">
        <button className="bg-red-600 hover:bg-red-700 p-4 rounded-lg font-bold text-lg transition-colors">
          ⚠️ 긴급 정지
        </button>
        <button className="bg-blue-600 hover:bg-blue-700 p-4 rounded-lg font-bold text-lg transition-colors">
          🎛️ 수동 제어
        </button>
        <button className="bg-green-600 hover:bg-green-700 p-4 rounded-lg font-bold text-lg transition-colors">
          📊 상세 분석
        </button>
        <button className="bg-gray-700 hover:bg-gray-600 p-4 rounded-lg font-bold text-lg transition-colors">
          📄 보고서
        </button>
      </div>
    </div>
  );
}