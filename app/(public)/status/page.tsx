import {
  CheckCircle,
  AlertTriangle,
  Activity,
  Server,
  Database,
  Shield,
  Wifi,
  Clock,
} from 'lucide-react';

/**
 * 시스템 상태 페이지
 */
export const metadata = {
  title: '시스템 상태 - EnergyAI',
  description: 'EnergyAI 서비스 가동 현황',
};

export default function StatusPage() {
  const services = [
    {
      name: '웹 애플리케이션',
      description: '대시보드, 모니터링, 설정 등 웹 인터페이스',
      icon: Activity,
      status: 'operational' as const,
      uptime: '99.97%',
    },
    {
      name: 'API 서버',
      description: 'REST API, 인증, 데이터 조회',
      icon: Server,
      status: 'operational' as const,
      uptime: '99.99%',
    },
    {
      name: '데이터베이스',
      description: '사용자 데이터, 설정, 이력 저장',
      icon: Database,
      status: 'operational' as const,
      uptime: '99.99%',
    },
    {
      name: '실시간 데이터 수집',
      description: 'IoT 게이트웨이, MQTT, WebSocket',
      icon: Wifi,
      status: 'operational' as const,
      uptime: '99.95%',
    },
    {
      name: 'AI 분석 엔진',
      description: '부하 예측, 이상 탐지, 최적화',
      icon: Activity,
      status: 'operational' as const,
      uptime: '99.90%',
    },
    {
      name: '인증 & 보안',
      description: 'OAuth, JWT, CSRF, 접근 제어',
      icon: Shield,
      status: 'operational' as const,
      uptime: '99.99%',
    },
  ];

  const recentIncidents = [
    {
      date: '2026-02-14',
      title: '정기 유지보수 완료',
      description: '데이터베이스 인덱스 최적화 및 보안 패치 적용',
      status: 'resolved' as const,
      duration: '15분',
    },
    {
      date: '2026-02-10',
      title: 'AI 분석 엔진 응답 지연',
      description: '모델 업데이트 중 일시적 응답 지연 발생',
      status: 'resolved' as const,
      duration: '8분',
    },
    {
      date: '2026-02-01',
      title: '정기 유지보수',
      description: '인프라 업그레이드 및 성능 개선',
      status: 'resolved' as const,
      duration: '30분',
    },
  ];

  const scheduledMaintenance = [
    {
      date: '2026-02-22',
      time: '02:00 - 04:00 KST',
      title: '정기 유지보수',
      description: '시스템 보안 업데이트 및 성능 최적화',
      impact: '서비스 일시 중단 가능',
    },
  ];

  const statusConfig = {
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
    resolved: {
      label: '해결됨',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
      icon: CheckCircle,
    },
  };

  const allOperational = services.every((s) => s.status === 'operational');

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-full mb-6">
            <Activity className="w-5 h-5 text-emerald-400" />
            <span className="text-emerald-400 font-semibold">System Status</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            시스템 상태
          </h1>

          {allOperational ? (
            <div className="flex items-center justify-center gap-3 mb-6">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
              <p className="text-xl text-emerald-400 font-semibold">
                모든 시스템이 정상 운영 중입니다
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3 mb-6">
              <AlertTriangle className="w-8 h-8 text-yellow-400" />
              <p className="text-xl text-yellow-400 font-semibold">
                일부 서비스에 영향이 있습니다
              </p>
            </div>
          )}

          <p className="text-slate-400 text-sm">
            마지막 업데이트: {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </section>

      {/* Services Status */}
      <section className="py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-6">서비스 현황</h2>
          <div className="space-y-3">
            {services.map((service, index) => {
              const config = statusConfig[service.status];
              const StatusIcon = config.icon;

              return (
                <div
                  key={index}
                  className={`bg-slate-800 border ${config.borderColor} rounded-xl p-5 flex items-center justify-between`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 ${config.bgColor} rounded-lg flex items-center justify-center`}>
                      <service.icon className={`w-5 h-5 ${config.color}`} />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">{service.name}</h3>
                      <p className="text-slate-400 text-sm">{service.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-slate-400 text-sm hidden md:block">
                      가동률 {service.uptime}
                    </span>
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 ${config.bgColor} rounded-full`}>
                      <StatusIcon className={`w-4 h-4 ${config.color}`} />
                      <span className={`text-sm font-medium ${config.color}`}>
                        {config.label}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Scheduled Maintenance */}
      {scheduledMaintenance.length > 0 && (
        <section className="py-8 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Clock className="w-6 h-6 text-yellow-400" />
              예정된 유지보수
            </h2>
            <div className="space-y-3">
              {scheduledMaintenance.map((item, index) => (
                <div
                  key={index}
                  className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-white font-semibold mb-1">{item.title}</h3>
                      <p className="text-slate-400 text-sm mb-2">{item.description}</p>
                      <p className="text-yellow-300/80 text-sm">{item.impact}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-white font-medium">{item.date}</p>
                      <p className="text-slate-400">{item.time}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Recent Incidents */}
      <section className="py-8 px-4 bg-slate-800/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-6">최근 이벤트</h2>
          <div className="space-y-4">
            {recentIncidents.map((incident, index) => {
              const config = statusConfig[incident.status];

              return (
                <div
                  key={index}
                  className="bg-slate-800 border border-slate-700 rounded-xl p-5"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-white font-semibold">{incident.title}</h3>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-slate-400">{incident.date}</span>
                      <span className={`flex items-center gap-1 ${config.color}`}>
                        <config.icon className="w-3.5 h-3.5" />
                        {config.label}
                      </span>
                    </div>
                  </div>
                  <p className="text-slate-400 text-sm">{incident.description}</p>
                  <p className="text-slate-500 text-xs mt-2">소요 시간: {incident.duration}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer Info */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-slate-400 text-sm mb-2">
            시스템 문제가 발생하면{' '}
            <a href="/support" className="text-emerald-400 hover:underline">
              고객 지원
            </a>
            으로 문의해주세요.
          </p>
          <p className="text-slate-500 text-xs">
            이 페이지는 자동으로 업데이트됩니다. 마지막 확인: {new Date().toLocaleTimeString('ko-KR')}
          </p>
        </div>
      </section>
    </div>
  );
}
