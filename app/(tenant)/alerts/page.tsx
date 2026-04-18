'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { apiGet, ApiError } from '@/lib/api/client';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Bell,
  Settings,
  Loader2,
  Clock,
  Shield,
  ChevronDown,
  ChevronRight,
  Lightbulb,
} from 'lucide-react';

// ─── 조치 가이드 매핑 ────────────────────────────────────────────────────────

interface ActionGuide {
  title: string;
  steps: string[];
  urgency: 'immediate' | 'within_day' | 'within_week';
}

function getActionGuide(category: string, ruleName: string, severity: string): ActionGuide | null {
  const name = (ruleName ?? '').toLowerCase();
  const cat  = (category ?? '').toLowerCase();

  // 전력 피크 초과
  if (cat === 'energy' && (name.includes('피크') || name.includes('peak') || name.includes('500') || name.includes('초과'))) {
    return {
      title: '전력 피크 초과 조치',
      urgency: 'immediate',
      steps: [
        '즉시 비필수 전력 부하(에어컨, 조명 등)를 수동 차단하세요.',
        '압축기·히터 예열 작업은 경부하 시간대(22:00~08:00)로 지연 예약하세요.',
        '최대수요전력(디맨드) 초과 시 기본요금이 12개월간 상향 적용됩니다. DR 자동 부하차단 설정을 확인하세요.',
        '반복 발생 시 계약전력 상향 또는 ESS 방전 스케줄 조정을 검토하세요.',
      ],
    };
  }

  // 역률 저하
  if (cat === 'energy' && (name.includes('역률') || name.includes('pf') || name.includes('power factor'))) {
    return {
      title: '역률 저하 조치',
      urgency: 'within_day',
      steps: [
        '역률 개선 콘덴서(APFC) 작동 상태를 확인하세요.',
        '인버터 구동 설비(모터, 컴프레서)의 부하율을 점검하세요.',
        '역률이 85% 미만이면 전력 기본요금에 역률 할증이 부과됩니다.',
        '설비 담당자에게 콘덴서 용량 적정성 재검토를 요청하세요.',
      ],
    };
  }

  // 에너지 급증
  if (cat === 'energy' && (name.includes('급증') || name.includes('pct_change') || name.includes('30%'))) {
    return {
      title: '에너지 사용량 급증 조치',
      urgency: 'within_day',
      steps: [
        '어떤 설비/라인에서 증가했는지 에너지 분석 → 시간대별 부하 차트를 확인하세요.',
        '설비 이상(모터 베어링 마모, 냉각수 누수 등)으로 인한 전력 낭비 여부를 점검하세요.',
        '생산량 증가와 비례한 증가인지 확인하세요(정상 범위일 수 있습니다).',
        '원인 미확인 시 탄소이음 AI 이상탐지 결과를 함께 검토하세요.',
      ],
    };
  }

  // 게이트웨이 오프라인
  if (cat === 'device' && (name.includes('게이트웨이') || name.includes('gateway') || name.includes('연결') || name.includes('heartbeat'))) {
    return {
      title: '게이트웨이 오프라인 조치',
      urgency: 'immediate',
      steps: [
        '수집기(Collector) 설치 PC/서버의 전원 및 네트워크 연결을 확인하세요.',
        '수집기 프로세스가 실행 중인지 확인하세요 (작업 관리자 → TansoEum-Collector).',
        '방화벽/VPN 정책 변경 여부를 IT 팀에 확인하세요 (포트 443 아웃바운드 필요).',
        '수집기를 재시작해도 연결 불가 시 관리자에게 문의하세요.',
      ],
    };
  }

  // 탄소 목표
  if (cat === 'carbon' && (name.includes('탄소') || name.includes('co2') || name.includes('배출'))) {
    return {
      title: '탄소 배출 목표 초과 조치',
      urgency: 'within_week',
      steps: [
        '탄소 분석 → Scope별 배출량 화면에서 초과 원인 항목을 파악하세요.',
        '전기 사용량 절감(Scope2)이 가장 빠른 감축 수단입니다. 피크 부하 이전, 효율화를 검토하세요.',
        '잔여 기간 내 목표 달성이 어려울 경우 자발적 탄소크레딧 구매를 고려하세요.',
        'ESG 보고서에 초과 사유와 개선 계획을 문서화하세요.',
      ],
    };
  }

  // 기본 — 카테고리별 범용 가이드
  if (severity === 'critical') {
    return {
      title: '긴급 알림 조치',
      urgency: 'immediate',
      steps: [
        '해당 설비/시스템 현장을 즉시 확인하세요.',
        '이상이 확인되면 안전 절차에 따라 전원을 차단하고 담당자에게 보고하세요.',
        '조치 완료 후 알림 설정에서 임계값 적정성을 재검토하세요.',
      ],
    };
  }

  return null;
}

interface AlertItem {
  id: string;
  channel: string;
  subject: string;
  body: string;
  status: string;
  sentAt: string | null;
  createdAt: string;
  rule: {
    name: string;
    category: string;
    severity: string;
  };
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [expandedGuide, setExpandedGuide] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    setError(null);
    try {
      const res = await apiGet<AlertItem[]>('/api/alerts?days=30&take=100');
      setAlerts(res.data ?? []);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : '네트워크 오류가 발생했습니다.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // 통계 계산
  const stats = {
    total: alerts.length,
    critical: alerts.filter((a) => a.rule?.severity === 'critical').length,
    warning: alerts.filter((a) => a.rule?.severity === 'warning').length,
    info: alerts.filter((a) => a.rule?.severity === 'info').length,
  };

  const filteredAlerts =
    filter === 'all'
      ? alerts
      : alerts.filter((a) => a.rule?.severity === filter);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-400" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-amber-400" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-400" />;
      default:
        return <Bell className="w-5 h-5 text-slate-400" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const styles: Record<string, string> = {
      critical: 'bg-red-500/10 text-red-400 border-red-500/30',
      warning: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      info: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    };
    const labels: Record<string, string> = {
      critical: '긴급',
      warning: '경고',
      info: '정보',
    };

    return (
      <span
        className={`px-2 py-0.5 rounded border text-xs font-medium ${
          styles[severity] || 'bg-slate-500/10 text-slate-400 border-slate-500/30'
        }`}
      >
        {labels[severity] || severity}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      sent: 'text-emerald-400',
      failed: 'text-red-400',
      pending: 'text-amber-400',
    };
    const labels: Record<string, string> = {
      sent: '전송됨',
      failed: '실패',
      pending: '대기',
    };

    return (
      <span className={`text-xs ${styles[status] || 'text-slate-400'}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full bg-[#051225] text-white p-4 md:p-6">
      {/* 에러 배너 */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 flex items-center justify-between">
          <p className="text-sm text-red-300">알림 로드 실패: {error}</p>
          <button
            onClick={fetchAlerts}
            className="px-3 py-1.5 bg-red-500/20 text-red-300 rounded-lg text-sm hover:bg-red-500/30 transition"
          >
            재시도
          </button>
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Bell className="w-6 h-6 text-amber-400" />
            </div>
            알림 현황
          </h1>
          <p className="text-slate-400 mt-1">시스템 알림 및 알람 로그</p>
        </div>
        <Link href="/settings/notifications">
          <button className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 border border-slate-700 hover:border-cyan-500/30 rounded-lg text-sm transition">
            <Settings className="w-4 h-4 text-cyan-400" />
            알림 설정
          </button>
        </Link>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="전체"
          value={stats.total}
          icon={<Bell className="w-5 h-5 text-slate-400" />}
          bgColor="bg-slate-500/10"
          borderColor="border-slate-700/50"
          active={filter === 'all'}
          onClick={() => setFilter('all')}
        />
        <StatCard
          label="긴급"
          value={stats.critical}
          icon={<AlertTriangle className="w-5 h-5 text-red-400" />}
          bgColor="bg-red-500/10"
          borderColor="border-red-500/30"
          valueColor="text-red-400"
          active={filter === 'critical'}
          onClick={() => setFilter(filter === 'critical' ? 'all' : 'critical')}
        />
        <StatCard
          label="경고"
          value={stats.warning}
          icon={<AlertCircle className="w-5 h-5 text-amber-400" />}
          bgColor="bg-amber-500/10"
          borderColor="border-amber-500/30"
          valueColor="text-amber-400"
          active={filter === 'warning'}
          onClick={() => setFilter(filter === 'warning' ? 'all' : 'warning')}
        />
        <StatCard
          label="정보"
          value={stats.info}
          icon={<Info className="w-5 h-5 text-blue-400" />}
          bgColor="bg-blue-500/10"
          borderColor="border-blue-500/30"
          valueColor="text-blue-400"
          active={filter === 'info'}
          onClick={() => setFilter(filter === 'info' ? 'all' : 'info')}
        />
      </div>

      {/* 알림 목록 */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            최근 알림
            {filter !== 'all' && (
              <span className="text-xs text-slate-400 ml-2">
                ({filteredAlerts.length}건)
              </span>
            )}
          </h2>
        </div>

        {filteredAlerts.length > 0 ? (
          <div className="divide-y divide-slate-700/30">
            {filteredAlerts.map((alert) => {
              const guide = getActionGuide(alert.rule?.category, alert.rule?.name, alert.rule?.severity);
              const isExpanded = expandedGuide === alert.id;
              const urgencyColor = guide?.urgency === 'immediate' ? 'text-red-400' : guide?.urgency === 'within_day' ? 'text-amber-400' : 'text-blue-400';
              const urgencyLabel = guide?.urgency === 'immediate' ? '즉시 조치' : guide?.urgency === 'within_day' ? '당일 조치' : '주내 조치';
              return (
              <div key={alert.id} className="hover:bg-slate-700/20 transition">
                <div className="px-6 py-4">
                  <div className="flex items-start gap-4">
                    <div className="mt-0.5">
                      {getSeverityIcon(alert.rule?.severity)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {getSeverityBadge(alert.rule?.severity)}
                        <span className="text-xs text-slate-500">
                          {alert.rule?.name}
                        </span>
                        <span className="text-xs text-slate-600">|</span>
                        <span className="text-xs text-slate-500">
                          {alert.createdAt
                            ? new Date(alert.createdAt).toLocaleString('ko-KR')
                            : '-'}
                        </span>
                      </div>
                      <p className="text-sm text-white font-medium">
                        {alert.subject}
                      </p>
                      {alert.body && (
                        <p className="text-sm text-slate-400 mt-1 line-clamp-2">
                          {alert.body}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-slate-500 px-2 py-0.5 bg-slate-700/50 rounded">
                        {alert.channel}
                      </span>
                      {getStatusBadge(alert.status)}
                      {guide && (
                        <button
                          onClick={() => setExpandedGuide(isExpanded ? null : alert.id)}
                          className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-400 hover:bg-amber-500/20 transition"
                        >
                          <Lightbulb className="w-3 h-3" />
                          조치
                          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* 조치 가이드 패널 */}
                {guide && isExpanded && (
                  <div className="mx-6 mb-4 p-4 bg-slate-900/60 border border-amber-500/20 rounded-xl">
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb className="w-4 h-4 text-amber-400" />
                      <span className="text-sm font-semibold text-amber-300">{guide.title}</span>
                      <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded border border-current ${urgencyColor}`}>
                        {urgencyLabel}
                      </span>
                    </div>
                    <ol className="space-y-2">
                      {guide.steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center mt-0.5">
                            {i + 1}
                          </span>
                          <span className="text-slate-300 leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
              );
            })}
          </div>
        ) : (
          <div className="py-16 text-center">
            <Shield className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 mb-2">
              {filter === 'all'
                ? '알림 내역이 없습니다'
                : '해당 심각도의 알림이 없습니다'}
            </p>
            <p className="text-sm text-slate-500">
              알림 규칙을 설정하면 조건 충족 시 자동으로 알림이 발송됩니다
            </p>
            <Link href="/settings/notifications">
              <button className="mt-4 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg text-sm transition">
                알림 규칙 설정
              </button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  bgColor,
  borderColor,
  valueColor = 'text-white',
  active,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  bgColor: string;
  borderColor: string;
  valueColor?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`${bgColor} border ${
        active ? 'border-cyan-500/50 ring-1 ring-cyan-500/20' : borderColor
      } rounded-xl p-4 text-left hover:border-cyan-500/30 transition-all`}
    >
      <div className="flex items-center justify-between mb-2">
        {icon}
        <CheckCircle2
          className={`w-4 h-4 transition ${
            active ? 'text-cyan-400' : 'text-transparent'
          }`}
        />
      </div>
      <div className={`text-2xl font-bold ${valueColor}`}>{value}</div>
      <div className="text-xs text-slate-400 mt-0.5">{label}</div>
    </button>
  );
}
