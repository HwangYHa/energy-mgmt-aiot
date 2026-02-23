'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Activity,
  Server,
  Database,
  Shield,
  Wifi,
  Loader2,
  RefreshCw,
  Clock,
} from 'lucide-react';

type ServiceStatus = 'operational' | 'degraded' | 'down';

interface ServiceInfo {
  name: string;
  description: string;
  status: ServiceStatus;
}

interface StatusData {
  services: ServiceInfo[];
  overall: ServiceStatus;
  checkedAt: string;
}

const SERVICE_ICONS: Record<string, React.ElementType> = {
  '웹 애플리케이션': Activity,
  'API 서버': Server,
  '데이터베이스': Database,
  '실시간 데이터 수집': Wifi,
  'AI 분석 엔진': Activity,
  '인증 & 보안': Shield,
};

const STATUS_CONFIG: Record<
  ServiceStatus,
  { label: string; color: string; bgColor: string; borderColor: string; icon: React.ElementType }
> = {
  operational: {
    label: '정상',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    icon: CheckCircle,
  },
  degraded: {
    label: '성능 저하',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    icon: AlertTriangle,
  },
  down: {
    label: '중단',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    icon: XCircle,
  },
};

export default function StatusPage() {
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchStatus = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/status', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json() as StatusData;
        setStatusData(data);
        setLastRefreshed(new Date());
      }
    } catch {
      // 네트워크 오류 시 전체 서비스 다운으로 표시
      setStatusData({
        services: [
          { name: '웹 애플리케이션', description: '연결 실패', status: 'down' },
        ],
        overall: 'down',
        checkedAt: new Date().toISOString(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // 30초마다 자동 갱신
    const id = setInterval(fetchStatus, 30_000);
    return () => clearInterval(id);
  }, []);

  const overall = statusData?.overall ?? 'operational';
  const overallConfig = STATUS_CONFIG[overall];
  const OverallIcon = overall === 'operational' ? CheckCircle : AlertTriangle;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-full mb-6">
            <Activity className="w-5 h-5 text-emerald-400" />
            <span className="text-emerald-400 font-semibold">System Status</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">시스템 상태</h1>

          {isLoading && !statusData ? (
            <div className="flex items-center justify-center gap-3 mb-6">
              <Loader2 className="w-7 h-7 text-slate-400 animate-spin" />
              <p className="text-xl text-slate-400">상태 확인 중...</p>
            </div>
          ) : overall === 'operational' ? (
            <div className="flex items-center justify-center gap-3 mb-6">
              <OverallIcon className="w-8 h-8 text-emerald-400" />
              <p className="text-xl text-emerald-400 font-semibold">모든 시스템이 정상 운영 중입니다</p>
            </div>
          ) : overall === 'degraded' ? (
            <div className="flex items-center justify-center gap-3 mb-6">
              <AlertTriangle className="w-8 h-8 text-yellow-400" />
              <p className="text-xl text-yellow-400 font-semibold">일부 서비스에 영향이 있습니다</p>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3 mb-6">
              <XCircle className="w-8 h-8 text-red-400" />
              <p className="text-xl text-red-400 font-semibold">서비스 장애가 발생했습니다</p>
            </div>
          )}

          <div className="flex items-center justify-center gap-4">
            <p className="text-slate-400 text-sm">
              {lastRefreshed
                ? `마지막 업데이트: ${lastRefreshed.toLocaleTimeString('ko-KR')}`
                : '확인 중...'}
            </p>
            <button
              onClick={fetchStatus}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              새로고침
            </button>
          </div>
        </div>
      </section>

      {/* Services Status */}
      <section className="py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-6">서비스 현황</h2>
          {isLoading && !statusData ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-5 animate-pulse">
                  <div className="h-5 bg-slate-700 rounded w-1/3 mb-2" />
                  <div className="h-4 bg-slate-700/50 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {(statusData?.services ?? []).map((service) => {
                const config = STATUS_CONFIG[service.status];
                const StatusIcon = config.icon;
                const ServiceIcon = SERVICE_ICONS[service.name] ?? Activity;
                return (
                  <div
                    key={service.name}
                    className={`bg-slate-800 border ${config.borderColor} rounded-xl p-5 flex items-center justify-between`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 ${config.bgColor} rounded-lg flex items-center justify-center`}>
                        <ServiceIcon className={`w-5 h-5 ${config.color}`} />
                      </div>
                      <div>
                        <h3 className="text-white font-semibold">{service.name}</h3>
                        <p className="text-slate-400 text-sm">{service.description}</p>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 ${config.bgColor} rounded-full`}>
                      <StatusIcon className={`w-4 h-4 ${config.color}`} />
                      <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 전체 요약 */}
      {statusData && overall !== 'operational' && (
        <section className="py-8 px-4">
          <div className="max-w-4xl mx-auto">
            <div className={`${overallConfig.bgColor} border ${overallConfig.borderColor} rounded-xl p-5`}>
              <div className="flex items-start gap-3">
                <overallConfig.icon className={`w-5 h-5 ${overallConfig.color} flex-shrink-0 mt-0.5`} />
                <div>
                  <h3 className={`font-semibold ${overallConfig.color} mb-1`}>
                    {overall === 'degraded' ? '성능 저하 감지' : '서비스 중단 감지'}
                  </h3>
                  <p className="text-slate-400 text-sm">
                    일부 서비스가 정상 동작하지 않습니다. 엔지니어링 팀이 조사 중입니다.
                    환경변수(MQTT_BROKER_URL, AI_ENGINE_URL 등) 설정을 확인하세요.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Footer Info */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 text-slate-400 text-sm mb-2">
            <Clock className="w-4 h-4" />
            <span>이 페이지는 30초마다 자동으로 갱신됩니다</span>
          </div>
          <p className="text-slate-400 text-sm">
            시스템 문제가 발생하면{' '}
            <a href="/support" className="text-emerald-400 hover:underline">
              고객 지원
            </a>
            으로 문의해주세요.
          </p>
        </div>
      </section>
    </div>
  );
}
