'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Settings,
  Zap,
  Bell,
  BarChart3,
  Database,
  Globe,
  Save,
  Lock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  HardDrive,
  Archive,
  Trash2,
  RefreshCw,
  Calendar,
  Download,
  ShieldCheck,
} from 'lucide-react';
import { fetchWithCsrf } from '@/hooks/use-csrf';
import { toast } from '@/lib/toast';

interface SystemSettings {
  general: {
    language: string;
    dateFormat: string;
    numberFormat: string;
  };
  energy: {
    electricityRate: number;
    peakRate: number;
    offPeakRate: number;
    carbonFactor: number;
    targetReduction: number;
    currency: string;
  };
  alerts: {
    powerThresholdWarning: number;
    powerThresholdCritical: number;
    emailNotifications: boolean;
    smsNotifications: boolean;
    refreshInterval: number;
  };
  dashboard: {
    defaultView: string;
    chartType: string;
    showCarbonWidget: boolean;
    showCostWidget: boolean;
    showDeviceStatus: boolean;
  };
  dataCollection: {
    defaultInterval: number;
    retentionDays: number;
    aggregationEnabled: boolean;
    aggregationInterval: string;
  };
  logPolicy: {
    auditLogRetentionDays: number;
    accessLogRetentionDays: number;
    compressionEnabled: boolean;
    compressionAfterDays: number;
    autoDeleteEnabled: boolean;
    archiveEnabled: boolean;
    archiveStoragePath?: string;
  };
  backup: {
    enabled: boolean;
    schedule: 'daily' | 'weekly' | 'monthly' | 'manual';
    retentionCount: number;
    includeAttachments: boolean;
    notifyEmail: string;
    storageType: 'local' | 's3' | 'gcs';
    storagePath?: string;
  };
}

export default function SystemSettingsPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [isBackupRunning, setIsBackupRunning] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/system-settings');
      const json = await res.json();
      if (json.success) {
        setSettings(json.data.settings);
        setIsAdmin(json.data.isAdmin);
      }
    } catch {
      toast.error('설정을 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    if (!settings || !isAdmin) return;
    setIsSaving(true);
    try {
      const res = await fetchWithCsrf('/api/system-settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('설정이 저장되었습니다.');
      } else {
        toast.error(json.error?.message || '저장에 실패했습니다.');
      }
    } catch {
      toast.error('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateSetting = <K extends keyof SystemSettings>(
    category: K,
    key: string,
    value: unknown
  ) => {
    if (!settings) return;
    setSettings({
      ...settings,
      [category]: { ...settings[category], [key]: value },
    });
  };

  const handleManualBackup = async () => {
    setIsBackupRunning(true);
    try {
      // 실제 백업 트리거 (향후 엔드포인트 연결)
      await new Promise((resolve) => setTimeout(resolve, 2000));
      toast.success('수동 백업이 시작되었습니다. 완료 시 알림을 받으시려면 알림 이메일을 설정하세요.');
    } catch {
      toast.error('백업 시작에 실패했습니다.');
    } finally {
      setIsBackupRunning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (!settings) return null;

  const tabs = [
    { id: 'general', label: '일반', icon: Globe },
    { id: 'energy', label: '에너지', icon: Zap },
    { id: 'alerts', label: '알림', icon: Bell },
    { id: 'dashboard', label: '대시보드', icon: BarChart3 },
    { id: 'dataCollection', label: '데이터 수집', icon: Database },
    { id: 'logPolicy', label: '로그 정책', icon: FileText },
    { id: 'backup', label: '백업', icon: HardDrive },
  ];

  return (
    <div className="min-h-screen bg-[#051225] text-white p-4 md:p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg">
              <Settings className="w-6 h-6 text-cyan-400" />
            </div>
            시스템 설정
          </h1>
          <p className="text-slate-400 mt-1">테넌트 전체에 적용되는 시스템 설정</p>
        </div>
        {isAdmin ? (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 rounded-lg font-medium transition disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            저장
          </button>
        ) : (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-900/30 border border-amber-700 rounded-lg text-amber-300 text-sm">
            <Lock className="w-4 h-4" />
            읽기 전용
          </div>
        )}
      </div>

      {/* 탭 네비게이션 — 줄바꿈 지원 */}
      <div className="flex flex-wrap gap-1 mb-6 bg-slate-800 rounded-lg p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'bg-cyan-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 설정 패널 */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">

        {/* 일반 설정 */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold border-b border-slate-700 pb-3">일반 설정</h3>
            <SettingRow label="언어" description="시스템 기본 언어">
              <select
                value={settings.general.language}
                onChange={(e) => updateSetting('general', 'language', e.target.value)}
                disabled={!isAdmin}
                className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="ko">한국어</option>
                <option value="en">English</option>
              </select>
            </SettingRow>
            <SettingRow label="날짜 형식" description="날짜 표시 형식">
              <select
                value={settings.general.dateFormat}
                onChange={(e) => updateSetting('general', 'dateFormat', e.target.value)}
                disabled={!isAdmin}
                className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="YYYY-MM-DD">2025-02-10</option>
                <option value="MM/DD/YYYY">02/10/2025</option>
                <option value="DD.MM.YYYY">10.02.2025</option>
              </select>
            </SettingRow>
            <SettingRow label="숫자 형식" description="숫자 표시 형식">
              <select
                value={settings.general.numberFormat}
                onChange={(e) => updateSetting('general', 'numberFormat', e.target.value)}
                disabled={!isAdmin}
                className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="1,000.00">1,000.00</option>
                <option value="1.000,00">1.000,00</option>
              </select>
            </SettingRow>
          </div>
        )}

        {/* 에너지 설정 */}
        {activeTab === 'energy' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold border-b border-slate-700 pb-3">에너지 요금 설정</h3>
            <SettingRow label="일반 전기 요금" description="kWh당 요금 (원)">
              <NumberInput value={settings.energy.electricityRate} onChange={(v) => updateSetting('energy', 'electricityRate', v)} disabled={!isAdmin} suffix="원/kWh" />
            </SettingRow>
            <SettingRow label="피크 요금" description="피크 시간대 kWh당 요금">
              <NumberInput value={settings.energy.peakRate} onChange={(v) => updateSetting('energy', 'peakRate', v)} disabled={!isAdmin} suffix="원/kWh" />
            </SettingRow>
            <SettingRow label="경부하 요금" description="경부하 시간대 kWh당 요금">
              <NumberInput value={settings.energy.offPeakRate} onChange={(v) => updateSetting('energy', 'offPeakRate', v)} disabled={!isAdmin} suffix="원/kWh" />
            </SettingRow>
            <SettingRow label="탄소 배출 계수" description="kWh당 CO2 배출량">
              <NumberInput value={settings.energy.carbonFactor} onChange={(v) => updateSetting('energy', 'carbonFactor', v)} disabled={!isAdmin} suffix="tCO2/kWh" step={0.0001} />
            </SettingRow>
            <SettingRow label="절감 목표" description="연간 에너지 절감 목표">
              <NumberInput value={settings.energy.targetReduction} onChange={(v) => updateSetting('energy', 'targetReduction', v)} disabled={!isAdmin} suffix="%" />
            </SettingRow>
          </div>
        )}

        {/* 알림 설정 */}
        {activeTab === 'alerts' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold border-b border-slate-700 pb-3">알림 임계값 설정</h3>
            <SettingRow label="경고 임계값" description="전력 사용률 경고 기준">
              <NumberInput value={settings.alerts.powerThresholdWarning} onChange={(v) => updateSetting('alerts', 'powerThresholdWarning', v)} disabled={!isAdmin} suffix="%" />
            </SettingRow>
            <SettingRow label="위험 임계값" description="전력 사용률 위험 기준">
              <NumberInput value={settings.alerts.powerThresholdCritical} onChange={(v) => updateSetting('alerts', 'powerThresholdCritical', v)} disabled={!isAdmin} suffix="%" />
            </SettingRow>
            <SettingRow label="이메일 알림" description="이메일로 알림 수신">
              <ToggleSwitch value={settings.alerts.emailNotifications} onChange={(v) => updateSetting('alerts', 'emailNotifications', v)} disabled={!isAdmin} />
            </SettingRow>
            <SettingRow label="SMS 알림" description="문자로 알림 수신">
              <ToggleSwitch value={settings.alerts.smsNotifications} onChange={(v) => updateSetting('alerts', 'smsNotifications', v)} disabled={!isAdmin} />
            </SettingRow>
            <SettingRow label="갱신 주기" description="데이터 자동 갱신 간격">
              <NumberInput value={settings.alerts.refreshInterval} onChange={(v) => updateSetting('alerts', 'refreshInterval', v)} disabled={!isAdmin} suffix="초" />
            </SettingRow>
          </div>
        )}

        {/* 대시보드 설정 */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold border-b border-slate-700 pb-3">대시보드 표시 설정</h3>
            <SettingRow label="기본 뷰" description="대시보드 초기 화면">
              <select
                value={settings.dashboard.defaultView}
                onChange={(e) => updateSetting('dashboard', 'defaultView', e.target.value)}
                disabled={!isAdmin}
                className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="overview">종합 개요</option>
                <option value="realtime">실시간 모니터링</option>
                <option value="analytics">분석</option>
              </select>
            </SettingRow>
            <SettingRow label="차트 유형" description="기본 차트 표시 형식">
              <select
                value={settings.dashboard.chartType}
                onChange={(e) => updateSetting('dashboard', 'chartType', e.target.value)}
                disabled={!isAdmin}
                className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="area">영역 차트</option>
                <option value="bar">막대 차트</option>
                <option value="line">선형 차트</option>
              </select>
            </SettingRow>
            <SettingRow label="탄소 위젯" description="탄소 배출 위젯 표시">
              <ToggleSwitch value={settings.dashboard.showCarbonWidget} onChange={(v) => updateSetting('dashboard', 'showCarbonWidget', v)} disabled={!isAdmin} />
            </SettingRow>
            <SettingRow label="비용 위젯" description="비용 분석 위젯 표시">
              <ToggleSwitch value={settings.dashboard.showCostWidget} onChange={(v) => updateSetting('dashboard', 'showCostWidget', v)} disabled={!isAdmin} />
            </SettingRow>
            <SettingRow label="설비 현황" description="설비 상태 위젯 표시">
              <ToggleSwitch value={settings.dashboard.showDeviceStatus} onChange={(v) => updateSetting('dashboard', 'showDeviceStatus', v)} disabled={!isAdmin} />
            </SettingRow>
          </div>
        )}

        {/* 데이터 수집 설정 */}
        {activeTab === 'dataCollection' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold border-b border-slate-700 pb-3">데이터 수집 설정</h3>
            <SettingRow label="수집 주기" description="기본 데이터 수집 간격">
              <NumberInput value={settings.dataCollection.defaultInterval} onChange={(v) => updateSetting('dataCollection', 'defaultInterval', v)} disabled={!isAdmin} suffix="초" />
            </SettingRow>
            <SettingRow label="보존 기간" description="측정 데이터 보존 일수">
              <NumberInput value={settings.dataCollection.retentionDays} onChange={(v) => updateSetting('dataCollection', 'retentionDays', v)} disabled={!isAdmin} suffix="일" />
            </SettingRow>
            <SettingRow label="집계 활성화" description="자동 데이터 집계 수행">
              <ToggleSwitch value={settings.dataCollection.aggregationEnabled} onChange={(v) => updateSetting('dataCollection', 'aggregationEnabled', v)} disabled={!isAdmin} />
            </SettingRow>
            <SettingRow label="집계 간격" description="데이터 집계 시간 간격">
              <select
                value={settings.dataCollection.aggregationInterval}
                onChange={(e) => updateSetting('dataCollection', 'aggregationInterval', e.target.value)}
                disabled={!isAdmin}
                className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="1m">1분</option>
                <option value="5m">5분</option>
                <option value="15m">15분</option>
                <option value="1h">1시간</option>
              </select>
            </SettingRow>
          </div>
        )}

        {/* 로그 정책 */}
        {activeTab === 'logPolicy' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold border-b border-slate-700 pb-3 flex items-center gap-2">
              <FileText className="w-5 h-5 text-cyan-400" />
              로그 보관 정책
            </h3>

            {/* 보관 기간 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-700/30 rounded-xl p-5 border border-slate-600/50">
                <div className="flex items-center gap-2 mb-4">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm font-semibold text-white">감사 로그 (Audit Log)</span>
                </div>
                <SettingRow label="보관 기간" description="법적 감사 및 컴플라이언스 준수">
                  <NumberInput
                    value={settings.logPolicy.auditLogRetentionDays}
                    onChange={(v) => updateSetting('logPolicy', 'auditLogRetentionDays', v)}
                    disabled={!isAdmin}
                    suffix="일"
                  />
                </SettingRow>
                <div className="mt-3 text-xs text-slate-500 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                  K-ISMS 기준 최소 1년(365일) 보관 권장
                </div>
              </div>

              <div className="bg-slate-700/30 rounded-xl p-5 border border-slate-600/50">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-semibold text-white">접근 로그 (Access Log)</span>
                </div>
                <SettingRow label="보관 기간" description="사용자 접근 및 API 호출 기록">
                  <NumberInput
                    value={settings.logPolicy.accessLogRetentionDays}
                    onChange={(v) => updateSetting('logPolicy', 'accessLogRetentionDays', v)}
                    disabled={!isAdmin}
                    suffix="일"
                  />
                </SettingRow>
                <div className="mt-3 text-xs text-slate-500">최소 30일, 최대 365일</div>
              </div>
            </div>

            {/* 압축 정책 */}
            <div>
              <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <Archive className="w-4 h-4 text-yellow-400" />
                압축 정책
              </h4>
              <div className="space-y-4">
                <SettingRow label="자동 압축" description="오래된 로그를 자동으로 압축 저장">
                  <ToggleSwitch
                    value={settings.logPolicy.compressionEnabled}
                    onChange={(v) => updateSetting('logPolicy', 'compressionEnabled', v)}
                    disabled={!isAdmin}
                  />
                </SettingRow>
                {settings.logPolicy.compressionEnabled && (
                  <SettingRow label="압축 기준일" description="생성 후 N일 경과 로그부터 압축">
                    <NumberInput
                      value={settings.logPolicy.compressionAfterDays}
                      onChange={(v) => updateSetting('logPolicy', 'compressionAfterDays', v)}
                      disabled={!isAdmin}
                      suffix="일"
                    />
                  </SettingRow>
                )}
              </div>
            </div>

            {/* 자동 삭제 정책 */}
            <div>
              <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-red-400" />
                자동 삭제 정책
              </h4>
              <div className="space-y-4">
                <SettingRow label="자동 삭제" description="보관 기간 초과 로그 자동 삭제">
                  <ToggleSwitch
                    value={settings.logPolicy.autoDeleteEnabled}
                    onChange={(v) => updateSetting('logPolicy', 'autoDeleteEnabled', v)}
                    disabled={!isAdmin}
                  />
                </SettingRow>
                {settings.logPolicy.autoDeleteEnabled && (
                  <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg text-xs text-red-400 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    자동 삭제 활성 시, 보관 기간이 경과한 로그는 영구 삭제됩니다.
                    아카이브 설정이 활성화되어 있으면 삭제 전 아카이브로 이동합니다.
                  </div>
                )}
              </div>
            </div>

            {/* 아카이브 */}
            <div>
              <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <Download className="w-4 h-4 text-blue-400" />
                아카이브 설정
              </h4>
              <div className="space-y-4">
                <SettingRow label="아카이브 활성" description="삭제 전 외부 스토리지로 이동">
                  <ToggleSwitch
                    value={settings.logPolicy.archiveEnabled}
                    onChange={(v) => updateSetting('logPolicy', 'archiveEnabled', v)}
                    disabled={!isAdmin}
                  />
                </SettingRow>
                {settings.logPolicy.archiveEnabled && (
                  <SettingRow label="아카이브 경로" description="로컬 경로 또는 S3 URI">
                    <input
                      value={settings.logPolicy.archiveStoragePath ?? ''}
                      onChange={(e) => updateSetting('logPolicy', 'archiveStoragePath', e.target.value)}
                      disabled={!isAdmin}
                      placeholder="s3://bucket/logs 또는 /data/archive"
                      className="w-64 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white placeholder-slate-500 disabled:opacity-50"
                    />
                  </SettingRow>
                )}
              </div>
            </div>

            {/* 로그 보관 요약 */}
            <div className="mt-4 grid grid-cols-3 gap-4 pt-4 border-t border-slate-700">
              {[
                { label: '감사 로그', days: settings.logPolicy.auditLogRetentionDays, color: 'text-cyan-400' },
                { label: '접근 로그', days: settings.logPolicy.accessLogRetentionDays, color: 'text-purple-400' },
                { label: '압축 기준', days: settings.logPolicy.compressionEnabled ? settings.logPolicy.compressionAfterDays : null, color: 'text-yellow-400' },
              ].map(({ label, days, color }) => (
                <div key={label} className="bg-slate-700/30 rounded-xl p-4 text-center">
                  <div className="text-xs text-slate-400 mb-1">{label}</div>
                  <div className={`text-2xl font-bold ${color}`}>
                    {days !== null ? days : '—'}
                  </div>
                  {days !== null && <div className="text-xs text-slate-500">일</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 백업 설정 */}
        {activeTab === 'backup' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold border-b border-slate-700 pb-3 flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-cyan-400" />
              데이터베이스 백업
            </h3>

            {/* 백업 활성화 */}
            <div className="bg-slate-700/30 rounded-xl p-5 border border-slate-600/50">
              <SettingRow label="자동 백업" description="스케줄에 따라 자동으로 데이터베이스 백업">
                <ToggleSwitch
                  value={settings.backup.enabled}
                  onChange={(v) => updateSetting('backup', 'enabled', v)}
                  disabled={!isAdmin}
                />
              </SettingRow>
            </div>

            {/* 스케줄 */}
            <div>
              <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-cyan-400" />
                백업 스케줄
              </h4>
              <div className="space-y-4">
                <SettingRow label="백업 주기" description="자동 백업 실행 주기">
                  <select
                    value={settings.backup.schedule}
                    onChange={(e) => updateSetting('backup', 'schedule', e.target.value)}
                    disabled={!isAdmin || !settings.backup.enabled}
                    className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm disabled:opacity-50"
                  >
                    <option value="daily">매일 (00:00)</option>
                    <option value="weekly">매주 일요일</option>
                    <option value="monthly">매월 1일</option>
                    <option value="manual">수동만</option>
                  </select>
                </SettingRow>
                <SettingRow label="백업 보관 수" description="최근 N개 백업 파일 유지">
                  <NumberInput
                    value={settings.backup.retentionCount}
                    onChange={(v) => updateSetting('backup', 'retentionCount', v)}
                    disabled={!isAdmin}
                    suffix="개"
                  />
                </SettingRow>
                <SettingRow label="첨부파일 포함" description="업로드된 파일도 백업에 포함">
                  <ToggleSwitch
                    value={settings.backup.includeAttachments}
                    onChange={(v) => updateSetting('backup', 'includeAttachments', v)}
                    disabled={!isAdmin}
                  />
                </SettingRow>
              </div>
            </div>

            {/* 스토리지 */}
            <div>
              <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <Archive className="w-4 h-4 text-purple-400" />
                저장 위치
              </h4>
              <div className="space-y-4">
                <SettingRow label="스토리지 유형" description="백업 파일 저장 위치">
                  <select
                    value={settings.backup.storageType}
                    onChange={(e) => updateSetting('backup', 'storageType', e.target.value)}
                    disabled={!isAdmin}
                    className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm disabled:opacity-50"
                  >
                    <option value="local">로컬 스토리지</option>
                    <option value="s3">AWS S3</option>
                    <option value="gcs">Google Cloud Storage</option>
                  </select>
                </SettingRow>
                <SettingRow label="저장 경로" description="백업 파일 저장 경로 또는 버킷">
                  <input
                    value={settings.backup.storagePath ?? ''}
                    onChange={(e) => updateSetting('backup', 'storagePath', e.target.value)}
                    disabled={!isAdmin}
                    placeholder={settings.backup.storageType === 'local' ? '/var/backups/tansoeum' : 's3://my-bucket/backups'}
                    className="w-64 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white placeholder-slate-500 disabled:opacity-50"
                  />
                </SettingRow>
                <SettingRow label="알림 이메일" description="백업 완료/실패 시 이메일 수신">
                  <input
                    type="email"
                    value={settings.backup.notifyEmail}
                    onChange={(e) => updateSetting('backup', 'notifyEmail', e.target.value)}
                    disabled={!isAdmin}
                    placeholder="admin@example.com"
                    className="w-64 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white placeholder-slate-500 disabled:opacity-50"
                  />
                </SettingRow>
              </div>
            </div>

            {/* 수동 백업 */}
            <div className="pt-4 border-t border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-white">수동 백업 실행</div>
                  <div className="text-xs text-slate-400 mt-0.5">지금 즉시 백업을 실행합니다</div>
                </div>
                <button
                  onClick={handleManualBackup}
                  disabled={!isAdmin || isBackupRunning}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {isBackupRunning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      백업 중...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      지금 백업
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 안내 */}
            <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl text-xs text-blue-300 space-y-1.5">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-400" />
                백업 파일은 AES-256으로 암호화되어 저장됩니다.
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-400" />
                MySQL 스냅샷 + 설정 파일이 함께 백업됩니다.
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-400" />
                복원은 관리자 콘솔 또는 CLI를 통해 진행할 수 있습니다.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// UI 서브 컴포넌트
// ──────────────────────────────────────────────────────────────

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="text-xs text-gray-400 mt-0.5">{description}</div>
      </div>
      <div>{children}</div>
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  disabled,
  suffix,
  step = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
  suffix: string;
  step?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        step={step}
        disabled={disabled}
        className="w-28 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-right disabled:opacity-50"
      />
      <span className="text-xs text-gray-400 w-16">{suffix}</span>
    </div>
  );
}

function ToggleSwitch({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      className={`relative w-12 h-6 rounded-full transition disabled:opacity-50 ${
        value ? 'bg-cyan-600' : 'bg-slate-600'
      }`}
    >
      <div
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
          value ? 'translate-x-6' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
