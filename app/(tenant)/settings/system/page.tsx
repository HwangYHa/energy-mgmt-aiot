'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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
  Building2,
  MessageCircle,
  Mail,
  Info,
} from 'lucide-react';
import { apiGet, apiPut } from '@/lib/api/client';
import { toast } from '@/lib/toast';

// ─── 백업 이력 타입 ───────────────────────────────────────────────

interface BackupMetadata {
  trigger?: string;
  storageType?: string;
  backupPath?: string;
  backupStatus?: string;
  sizeBytes?: number;
  durationMs?: number;
  startedAt?: string;
  error?: string;
}

interface BackupHistoryEntry {
  backupId: string;
  metadata: BackupMetadata | null;
  createdAt: string;
}

// ─── 타입 ────────────────────────────────────────────────────────

interface SystemSettings {
  organization: {
    name: string;
    industryType: string;
    timezone: string;
    website: string;
  };
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
    kakaoNotifications: boolean;
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
    storageType: 'local' | 'ncp' | 's3' | 'gcs';
    storagePath?: string;
  };
}

const TABS = [
  { id: 'organization',   label: '조직 정보',   icon: Building2,   desc: '회사명·업종·시간대' },
  { id: 'general',        label: '일반',        icon: Globe,       desc: '언어·날짜·숫자 형식' },
  { id: 'energy',         label: '에너지',      icon: Zap,         desc: '요금·탄소계수·목표' },
  { id: 'alerts',         label: '알림',        icon: Bell,        desc: '임계값·채널·갱신 주기' },
  { id: 'dashboard',      label: '대시보드',    icon: BarChart3,   desc: '기본 뷰·차트·위젯' },
  { id: 'dataCollection', label: '데이터 수집', icon: Database,    desc: '수집 주기·보존 기간' },
  { id: 'logPolicy',      label: '로그 정책',   icon: FileText,    desc: '보관·압축·아카이브' },
  { id: 'backup',         label: '백업',        icon: HardDrive,   desc: '자동 백업·스토리지' },
] as const;

type TabId = typeof TABS[number]['id'];

const INDUSTRY_OPTIONS = [
  { value: 'manufacturing',      label: '제조업' },
  { value: 'building',           label: '빌딩/건물' },
  { value: 'industrial_complex', label: '산업단지' },
  { value: 'datacenter',         label: '데이터센터' },
  { value: 'other',              label: '기타' },
];

const TIMEZONE_OPTIONS = [
  { value: 'Asia/Seoul',     label: 'KST — 한국 표준시 (UTC+9)' },
  { value: 'UTC',            label: 'UTC — 세계 협정시 (UTC+0)' },
  { value: 'Asia/Tokyo',     label: 'JST — 일본 표준시 (UTC+9)' },
  { value: 'Asia/Shanghai',  label: 'CST — 중국 표준시 (UTC+8)' },
  { value: 'America/New_York', label: 'EST — 미국 동부 (UTC-5)' },
];

// ─── 메인 컴포넌트 ────────────────────────────────────────────────

export default function SystemSettingsPage() {
  const [settings,        setSettings]        = useState<SystemSettings | null>(null);
  const [isAdmin,         setIsAdmin]         = useState(false);
  const [isLoading,       setIsLoading]       = useState(true);
  const [isSaving,        setIsSaving]        = useState(false);
  const [isDirty,         setIsDirty]         = useState(false);
  const [activeTab,       setActiveTab]       = useState<TabId>('organization');
  const [isBackupRunning, setIsBackupRunning] = useState(false);
  const [backupHistory,   setBackupHistory]   = useState<BackupHistoryEntry[]>([]);
  const [defaultBackupDir, setDefaultBackupDir] = useState<string>('');
  const [ncpConfigured,   setNcpConfigured]   = useState(false);
  const [s3Configured,    setS3Configured]    = useState(false);
  const [ncpBucket,       setNcpBucket]       = useState<string | null>(null);
  const savedRef = useRef<SystemSettings | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await apiGet<{ settings: SystemSettings; isAdmin: boolean }>('/api/system-settings');
      if (res.success && res.data) {
        setSettings(res.data.settings);
        savedRef.current = res.data.settings;
        setIsAdmin(res.data.isAdmin);
      }
    } catch {
      toast.error('설정을 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  // 백업 이력 조회
  const fetchBackupHistory = useCallback(async () => {
    try {
      const res = await apiGet<{
        config: SystemSettings['backup'];
        defaultDir: string;
        recentBackups: BackupHistoryEntry[];
        ncpConfigured: boolean;
        s3Configured: boolean;
        ncpBucket: string | null;
      }>('/api/admin/backup');
      if (res.success && res.data) {
        setBackupHistory(res.data.recentBackups);
        setDefaultBackupDir(res.data.defaultDir);
        setNcpConfigured(res.data.ncpConfigured);
        setS3Configured(res.data.s3Configured);
        setNcpBucket(res.data.ncpBucket);
      }
    } catch { /* ignore */ }
  }, []);

  // 백업 탭 진입 시 이력 로드
  useEffect(() => {
    if (activeTab === 'backup') fetchBackupHistory();
  }, [activeTab, fetchBackupHistory]);

  // 저장 (전체 설정 한 번에)
  const handleSave = async () => {
    if (!settings || !isAdmin) return;
    setIsSaving(true);
    try {
      const res = await apiPut<{ settings: SystemSettings; updated: boolean }>('/api/system-settings', settings);
      if (res.success) {
        savedRef.current = settings;
        setIsDirty(false);
        toast.success('설정이 저장되어 시스템 전체에 적용되었습니다.');
      } else {
        toast.error(res.error ?? '저장에 실패했습니다.');
      }
    } catch {
      toast.error('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 설정값 업데이트 (카테고리 + 키)
  const update = <K extends keyof SystemSettings>(
    category: K,
    key: keyof SystemSettings[K],
    value: unknown,
  ) => {
    if (!settings) return;
    setSettings((prev) => {
      if (!prev) return prev;
      return { ...prev, [category]: { ...prev[category], [key]: value } };
    });
    setIsDirty(true);
  };

  // 변경 취소 (원래 값으로 되돌리기)
  const handleDiscard = () => {
    if (savedRef.current) {
      setSettings(savedRef.current);
      setIsDirty(false);
    }
  };

  // 수동 백업
  const handleManualBackup = async () => {
    setIsBackupRunning(true);
    try {
      const res = await apiPut<{
        backupId: string;
        status: 'success' | 'failed';
        message: string;
        backupPath: string;
        sizeBytes?: number;
        sizeMb?: string;
        durationMs?: number;
        error?: string;
      }>('/api/admin/backup', { trigger: 'manual' });

      if (res.success && res.data) {
        const d = res.data;
        if (d.status === 'success') {
          const sizeStr = d.sizeMb ? ` · ${d.sizeMb} MB` : '';
          const secStr  = d.durationMs ? ` · ${(d.durationMs / 1000).toFixed(1)}초` : '';
          toast.success(`백업 완료${sizeStr}${secStr}\n${d.backupPath}`);
          // 이력 새로고침
          fetchBackupHistory();
        } else {
          toast.error(d.error ?? d.message ?? '백업 실패');
        }
      } else {
        toast.error(res.error ?? '백업 요청에 실패했습니다.');
      }
    } catch {
      toast.error('백업 서버에 연결할 수 없습니다. 서버 환경변수 설정을 확인하세요.');
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

  return (
    <div className="h-full bg-[#051225] text-white p-4 md:p-6 max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2.5">
            <div className="p-2 bg-cyan-500/10 rounded-lg">
              <Settings className="w-5 h-5 text-cyan-400" />
            </div>
            시스템 설정
          </h1>
          <p className="text-slate-400 text-sm mt-1">테넌트 전체에 적용되는 시스템 설정 — 저장 즉시 반영됩니다</p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin ? (
            <>
              {isDirty && (
                <button
                  onClick={handleDiscard}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-lg transition"
                >
                  취소
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={isSaving || !isDirty}
                className="flex items-center gap-2 px-5 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm font-semibold transition disabled:opacity-40"
              >
                {isSaving
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Save className="w-4 h-4" />}
                {isDirty ? '저장' : '저장됨'}
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-900/30 border border-amber-700/50 rounded-lg text-amber-300 text-sm">
              <Lock className="w-4 h-4" />
              읽기 전용 (관리자 전용)
            </div>
          )}
        </div>
      </div>

      {/* 미저장 변경 알림 배너 */}
      {isDirty && (
        <div className="mb-4 px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-2 text-xs text-amber-300">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          저장되지 않은 변경사항이 있습니다. 저장 버튼을 눌러 적용하세요.
        </div>
      )}

      <div className="flex gap-5">
        {/* 사이드 탭 네비게이션 */}
        <nav className="w-44 flex-shrink-0 space-y-0.5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-left transition ${
                  isActive
                    ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-xs font-medium">{tab.label}</div>
                  <div className="text-[10px] text-slate-500 leading-tight mt-0.5">{tab.desc}</div>
                </div>
              </button>
            );
          })}
        </nav>

        {/* 설정 패널 */}
        <div className="flex-1 bg-slate-800/40 rounded-xl p-6 border border-slate-700/50 min-h-[500px]">

          {/* ── 조직 정보 ───────────────────────────────────── */}
          {activeTab === 'organization' && (
            <Section title="조직 정보" icon={Building2} description="회사명, 업종, 시간대 등 조직 기본 정보를 설정합니다. 저장 시 시스템 전체에 즉시 반영됩니다.">
              <SettingRow label="회사명" description="대시보드·보고서·알림에 표시되는 조직명">
                <input
                  type="text"
                  value={settings.organization.name}
                  onChange={(e) => update('organization', 'name', e.target.value)}
                  disabled={!isAdmin}
                  placeholder="탄소이음 주식회사"
                  className="w-64 bg-slate-700/60 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                />
              </SettingRow>
              <SettingRow label="업종" description="에너지 통계·비교 분석에 사용되는 산업 분류">
                <select
                  value={settings.organization.industryType}
                  onChange={(e) => update('organization', 'industryType', e.target.value)}
                  disabled={!isAdmin}
                  className="w-48 bg-slate-700/60 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white disabled:opacity-50"
                >
                  {INDUSTRY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </SettingRow>
              <SettingRow label="시스템 시간대" description="날짜·시간 표시, 알림 스케줄에 적용되는 시간대">
                <select
                  value={settings.organization.timezone}
                  onChange={(e) => update('organization', 'timezone', e.target.value)}
                  disabled={!isAdmin}
                  className="w-64 bg-slate-700/60 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white disabled:opacity-50"
                >
                  {TIMEZONE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </SettingRow>
              <SettingRow label="웹사이트" description="선택사항 — 조직 공식 홈페이지 URL">
                <input
                  type="url"
                  value={settings.organization.website}
                  onChange={(e) => update('organization', 'website', e.target.value)}
                  disabled={!isAdmin}
                  placeholder="https://example.com"
                  className="w-64 bg-slate-700/60 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                />
              </SettingRow>
            </Section>
          )}

          {/* ── 일반 설정 ───────────────────────────────────── */}
          {activeTab === 'general' && (
            <Section title="일반 설정" icon={Globe} description="시스템 전반의 언어, 날짜, 숫자 표시 형식을 설정합니다.">
              <SettingRow label="시스템 언어" description="UI 전체에 적용되는 표시 언어">
                <select
                  value={settings.general.language}
                  onChange={(e) => update('general', 'language', e.target.value)}
                  disabled={!isAdmin}
                  className="SelectBase w-36"
                >
                  <option value="ko">한국어</option>
                  <option value="en">English</option>
                </select>
              </SettingRow>
              <SettingRow label="날짜 형식" description="날짜 표시 형식 — 보고서·로그 전체에 적용">
                <select
                  value={settings.general.dateFormat}
                  onChange={(e) => update('general', 'dateFormat', e.target.value)}
                  disabled={!isAdmin}
                  className="SelectBase w-44"
                >
                  <option value="YYYY-MM-DD">2026-03-02 (ISO)</option>
                  <option value="MM/DD/YYYY">03/02/2026 (미국)</option>
                  <option value="DD.MM.YYYY">02.03.2026 (유럽)</option>
                </select>
              </SettingRow>
              <SettingRow label="숫자 형식" description="천 단위 구분자 및 소수점 표시 형식">
                <select
                  value={settings.general.numberFormat}
                  onChange={(e) => update('general', 'numberFormat', e.target.value)}
                  disabled={!isAdmin}
                  className="SelectBase w-36"
                >
                  <option value="1,000.00">1,000.00 (한국/영미)</option>
                  <option value="1.000,00">1.000,00 (유럽)</option>
                </select>
              </SettingRow>
            </Section>
          )}

          {/* ── 에너지 설정 ─────────────────────────────────── */}
          {activeTab === 'energy' && (
            <Section title="에너지 요금 및 탄소 설정" icon={Zap} description="전기 요금 단가와 탄소 배출 계수를 설정합니다. 대시보드 비용 계산, 탄소 분석에 즉시 반영됩니다.">
              <div className="mb-4 flex items-start gap-2 text-xs text-cyan-300/70 bg-cyan-500/5 border border-cyan-500/20 rounded-lg px-3 py-2.5">
                <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>저장 즉시 대시보드 전력 비용·탄소 배출 계산에 반영됩니다. 한국전력 고압 A 기준 참고값을 기본으로 설정하였습니다.</span>
              </div>
              <SettingRow label="일반 전기 요금" description="기본 시간대 kWh당 요금">
                <NumberInput value={settings.energy.electricityRate} onChange={(v) => update('energy', 'electricityRate', v)} disabled={!isAdmin} suffix="원/kWh" />
              </SettingRow>
              <SettingRow label="피크 요금" description="최대 부하 시간대 (오전 10시~12시, 오후 1시~5시)">
                <NumberInput value={settings.energy.peakRate} onChange={(v) => update('energy', 'peakRate', v)} disabled={!isAdmin} suffix="원/kWh" />
              </SettingRow>
              <SettingRow label="경부하 요금" description="경부하 시간대 (오후 11시~오전 9시)">
                <NumberInput value={settings.energy.offPeakRate} onChange={(v) => update('energy', 'offPeakRate', v)} disabled={!isAdmin} suffix="원/kWh" />
              </SettingRow>
              <SettingRow label="전력 탄소 배출 계수" description="국가 전력 계통 평균 배출 계수 (환경부 고시 기준: 0.4567)">
                <NumberInput value={settings.energy.carbonFactor} onChange={(v) => update('energy', 'carbonFactor', v)} disabled={!isAdmin} suffix="tCO₂/kWh" step={0.0001} decimal={4} />
              </SettingRow>
              <SettingRow label="연간 에너지 절감 목표" description="대시보드 감축 목표 달성률 계산에 사용">
                <NumberInput value={settings.energy.targetReduction} onChange={(v) => update('energy', 'targetReduction', v)} disabled={!isAdmin} suffix="%" />
              </SettingRow>
            </Section>
          )}

          {/* ── 알림 설정 ───────────────────────────────────── */}
          {activeTab === 'alerts' && (
            <Section title="알림 임계값 및 채널 설정" icon={Bell} description="시스템 전역 알림 임계값과 기본 발송 채널을 설정합니다. 개인별 세부 설정은 알림 설정 페이지에서 조정 가능합니다.">
              <div className="mb-4 p-3 bg-slate-700/30 border border-slate-600/30 rounded-lg text-xs text-slate-400 flex items-start gap-2">
                <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-cyan-400" />
                <span>임계값은 실시간 전력 모니터링과 이상 탐지에 즉시 적용됩니다. 개인별 알림 채널 세부 설정은 <span className="text-cyan-400">알림 설정</span> 페이지에서 관리합니다.</span>
              </div>

              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">전력 임계값</h4>
              <SettingRow label="경고 임계값" description="전력 사용률이 이 값을 초과하면 경고 알림 발송">
                <NumberInput value={settings.alerts.powerThresholdWarning} onChange={(v) => update('alerts', 'powerThresholdWarning', v)} disabled={!isAdmin} suffix="%" />
              </SettingRow>
              <SettingRow label="위험 임계값" description="전력 사용률이 이 값을 초과하면 위험 알림 발송">
                <NumberInput value={settings.alerts.powerThresholdCritical} onChange={(v) => update('alerts', 'powerThresholdCritical', v)} disabled={!isAdmin} suffix="%" />
              </SettingRow>

              {settings.alerts.powerThresholdWarning >= settings.alerts.powerThresholdCritical && (
                <div className="mt-1 mb-3 text-xs text-red-400 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  경고 임계값이 위험 임계값보다 높습니다. 값을 확인해 주세요.
                </div>
              )}

              <div className="border-t border-slate-700/50 mt-4 pt-4">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">기본 알림 채널</h4>
                <SettingRow label={<span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-emerald-400" /> 이메일 알림</span>} description="시스템 알림을 이메일로 발송 (개인별 규칙으로 재설정 가능)">
                  <ToggleSwitch value={settings.alerts.emailNotifications} onChange={(v) => update('alerts', 'emailNotifications', v)} disabled={!isAdmin} />
                </SettingRow>
                <SettingRow label={<span className="flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5 text-yellow-400" /> 카카오 알림톡</span>} description="시스템 알림을 카카오 알림톡으로 발송 (전화번호 등록 필요)">
                  <ToggleSwitch value={settings.alerts.kakaoNotifications} onChange={(v) => update('alerts', 'kakaoNotifications', v)} disabled={!isAdmin} />
                </SettingRow>
              </div>

              <div className="border-t border-slate-700/50 mt-4 pt-4">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">대시보드 갱신</h4>
                <SettingRow label="자동 갱신 주기" description="실시간 대시보드 데이터 자동 갱신 간격 (5~300초)">
                  <NumberInput value={settings.alerts.refreshInterval} onChange={(v) => update('alerts', 'refreshInterval', v)} disabled={!isAdmin} suffix="초" min={5} max={300} />
                </SettingRow>
              </div>
            </Section>
          )}

          {/* ── 대시보드 설정 ────────────────────────────────── */}
          {activeTab === 'dashboard' && (
            <Section title="대시보드 표시 설정" icon={BarChart3} description="테넌트 전체의 대시보드 기본 레이아웃과 위젯 표시 여부를 설정합니다.">
              <SettingRow label="기본 뷰" description="대시보드 접속 시 처음 표시되는 화면">
                <select
                  value={settings.dashboard.defaultView}
                  onChange={(e) => update('dashboard', 'defaultView', e.target.value)}
                  disabled={!isAdmin}
                  className="SelectBase w-44"
                >
                  <option value="overview">종합 개요</option>
                  <option value="realtime">실시간 모니터링</option>
                  <option value="analytics">분석</option>
                </select>
              </SettingRow>
              <SettingRow label="기본 차트 유형" description="에너지 추이 차트의 기본 표시 형식">
                <select
                  value={settings.dashboard.chartType}
                  onChange={(e) => update('dashboard', 'chartType', e.target.value)}
                  disabled={!isAdmin}
                  className="SelectBase w-36"
                >
                  <option value="area">영역 차트 (Area)</option>
                  <option value="bar">막대 차트 (Bar)</option>
                  <option value="line">선형 차트 (Line)</option>
                </select>
              </SettingRow>

              <div className="border-t border-slate-700/50 mt-4 pt-4">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">위젯 표시</h4>
                <SettingRow label="탄소 배출 위젯" description="실시간 탄소 배출량 현황 위젯">
                  <ToggleSwitch value={settings.dashboard.showCarbonWidget} onChange={(v) => update('dashboard', 'showCarbonWidget', v)} disabled={!isAdmin} />
                </SettingRow>
                <SettingRow label="비용 분석 위젯" description="전력 비용 현황 및 예측 위젯">
                  <ToggleSwitch value={settings.dashboard.showCostWidget} onChange={(v) => update('dashboard', 'showCostWidget', v)} disabled={!isAdmin} />
                </SettingRow>
                <SettingRow label="설비 현황 위젯" description="등록된 설비·센서 상태 현황 위젯">
                  <ToggleSwitch value={settings.dashboard.showDeviceStatus} onChange={(v) => update('dashboard', 'showDeviceStatus', v)} disabled={!isAdmin} />
                </SettingRow>
              </div>
            </Section>
          )}

          {/* ── 데이터 수집 ──────────────────────────────────── */}
          {activeTab === 'dataCollection' && (
            <Section title="데이터 수집 설정" icon={Database} description="IoT 센서·게이트웨이의 기본 수집 주기와 측정 데이터 보존 정책을 설정합니다.">
              <div className="mb-4 flex items-start gap-2 text-xs text-cyan-300/70 bg-cyan-500/5 border border-cyan-500/20 rounded-lg px-3 py-2.5">
                <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>수집 주기 변경은 이후 신규 등록 센서에 적용됩니다. 기존 센서는 개별 설정을 우선합니다. 보존 기간은 다음 정리 사이클에 반영됩니다.</span>
              </div>
              <SettingRow label="기본 수집 주기" description="신규 센서/게이트웨이의 기본 측정 간격 (1~3600초)">
                <NumberInput value={settings.dataCollection.defaultInterval} onChange={(v) => update('dataCollection', 'defaultInterval', v)} disabled={!isAdmin} suffix="초" min={1} max={3600} />
              </SettingRow>
              <SettingRow label="데이터 보존 기간" description="측정 원본 데이터를 DB에 보존하는 기간">
                <NumberInput value={settings.dataCollection.retentionDays} onChange={(v) => update('dataCollection', 'retentionDays', v)} disabled={!isAdmin} suffix="일" min={30} max={3650} />
              </SettingRow>

              <div className="border-t border-slate-700/50 mt-4 pt-4">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">집계 설정</h4>
                <SettingRow label="자동 집계" description="원본 데이터를 주기적으로 집계·압축 (분석 성능 향상)">
                  <ToggleSwitch value={settings.dataCollection.aggregationEnabled} onChange={(v) => update('dataCollection', 'aggregationEnabled', v)} disabled={!isAdmin} />
                </SettingRow>
                <SettingRow label="집계 단위" description="자동 집계 시 그룹핑 시간 단위">
                  <select
                    value={settings.dataCollection.aggregationInterval}
                    onChange={(e) => update('dataCollection', 'aggregationInterval', e.target.value)}
                    disabled={!isAdmin || !settings.dataCollection.aggregationEnabled}
                    className="SelectBase w-32"
                  >
                    <option value="1m">1분</option>
                    <option value="5m">5분</option>
                    <option value="15m">15분</option>
                    <option value="1h">1시간</option>
                  </select>
                </SettingRow>
              </div>
            </Section>
          )}

          {/* ── 로그 정책 ────────────────────────────────────── */}
          {activeTab === 'logPolicy' && (
            <Section title="로그 보관 정책" icon={FileText} description="감사 로그·접근 로그 보관 기간, 압축, 자동 삭제 및 아카이브 정책을 설정합니다.">
              {/* 보관 기간 카드 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/50">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm font-semibold">감사 로그 (Audit Log)</span>
                  </div>
                  <SettingRow label="보관 기간" description="법적 감사·컴플라이언스 준수">
                    <NumberInput value={settings.logPolicy.auditLogRetentionDays} onChange={(v) => update('logPolicy', 'auditLogRetentionDays', v)} disabled={!isAdmin} suffix="일" min={30} max={3650} />
                  </SettingRow>
                  <p className="mt-2 text-[11px] text-amber-400/80 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    K-ISMS 기준 최소 365일 (1년) 권장
                  </p>
                </div>
                <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/50">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-semibold">접근 로그 (Access Log)</span>
                  </div>
                  <SettingRow label="보관 기간" description="사용자 접근·API 호출 기록">
                    <NumberInput value={settings.logPolicy.accessLogRetentionDays} onChange={(v) => update('logPolicy', 'accessLogRetentionDays', v)} disabled={!isAdmin} suffix="일" min={7} max={365} />
                  </SettingRow>
                  <p className="mt-2 text-[11px] text-slate-500">7일 ~ 365일 범위</p>
                </div>
              </div>

              {/* 압축 */}
              <div className="border-t border-slate-700/50 pt-4 mb-4">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Archive className="w-3.5 h-3.5 text-yellow-400" /> 압축 정책
                </h4>
                <SettingRow label="자동 압축" description="일정 기간 경과 로그 자동 압축 저장 (스토리지 절약)">
                  <ToggleSwitch value={settings.logPolicy.compressionEnabled} onChange={(v) => update('logPolicy', 'compressionEnabled', v)} disabled={!isAdmin} />
                </SettingRow>
                {settings.logPolicy.compressionEnabled && (
                  <SettingRow label="압축 기준일" description="생성 후 N일 경과 로그부터 압축 대상">
                    <NumberInput value={settings.logPolicy.compressionAfterDays} onChange={(v) => update('logPolicy', 'compressionAfterDays', v)} disabled={!isAdmin} suffix="일" min={7} max={365} />
                  </SettingRow>
                )}
              </div>

              {/* 자동 삭제 */}
              <div className="border-t border-slate-700/50 pt-4 mb-4">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Trash2 className="w-3.5 h-3.5 text-red-400" /> 자동 삭제 정책
                </h4>
                <SettingRow label="자동 삭제" description="보관 기간이 초과된 로그 자동 영구 삭제">
                  <ToggleSwitch value={settings.logPolicy.autoDeleteEnabled} onChange={(v) => update('logPolicy', 'autoDeleteEnabled', v)} disabled={!isAdmin} />
                </SettingRow>
                {settings.logPolicy.autoDeleteEnabled && (
                  <div className="mt-2 p-3 bg-red-500/5 border border-red-500/20 rounded-lg text-xs text-red-400 flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    보관 기간 초과 로그는 영구 삭제됩니다. 아카이브가 활성화된 경우 삭제 전 이동됩니다.
                  </div>
                )}
              </div>

              {/* 아카이브 */}
              <div className="border-t border-slate-700/50 pt-4 mb-4">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5 text-blue-400" /> 아카이브
                </h4>
                <SettingRow label="아카이브 활성" description="삭제 전 외부 스토리지로 자동 이동">
                  <ToggleSwitch value={settings.logPolicy.archiveEnabled} onChange={(v) => update('logPolicy', 'archiveEnabled', v)} disabled={!isAdmin} />
                </SettingRow>
                {settings.logPolicy.archiveEnabled && (
                  <SettingRow label="아카이브 경로" description="로컬 경로 또는 S3 URI">
                    <input
                      value={settings.logPolicy.archiveStoragePath ?? ''}
                      onChange={(e) => update('logPolicy', 'archiveStoragePath', e.target.value || undefined)}
                      disabled={!isAdmin}
                      placeholder="s3://bucket/logs 또는 /data/archive"
                      className="w-64 bg-slate-700/60 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 disabled:opacity-50"
                    />
                  </SettingRow>
                )}
              </div>

              {/* 현황 요약 */}
              <div className="mt-2 grid grid-cols-3 gap-3 pt-4 border-t border-slate-700/50">
                {[
                  { label: '감사 로그', days: settings.logPolicy.auditLogRetentionDays, color: 'text-cyan-400' },
                  { label: '접근 로그', days: settings.logPolicy.accessLogRetentionDays, color: 'text-purple-400' },
                  { label: '압축 기준', days: settings.logPolicy.compressionEnabled ? settings.logPolicy.compressionAfterDays : null, color: 'text-yellow-400' },
                ].map(({ label, days, color }) => (
                  <div key={label} className="bg-slate-700/30 rounded-xl p-3 text-center">
                    <div className="text-[11px] text-slate-400 mb-1">{label}</div>
                    <div className={`text-2xl font-bold ${color}`}>{days ?? '—'}</div>
                    {days !== null && <div className="text-[10px] text-slate-500">일</div>}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── 백업 설정 ────────────────────────────────────── */}
          {activeTab === 'backup' && (
            <Section title="데이터베이스 백업" icon={HardDrive} description="자동 백업 스케줄과 저장 위치를 설정합니다. 백업 파일은 AES-256으로 암호화됩니다.">
              <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/50 mb-5">
                <SettingRow label="자동 백업 활성화" description="스케줄에 따라 자동으로 DB 스냅샷 생성">
                  <ToggleSwitch value={settings.backup.enabled} onChange={(v) => update('backup', 'enabled', v)} disabled={!isAdmin} />
                </SettingRow>
              </div>

              {/* 스케줄 */}
              <div className="border-t border-slate-700/50 pt-4 mb-4">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-cyan-400" /> 백업 스케줄
                </h4>
                <SettingRow label="백업 주기" description="자동 백업 실행 주기">
                  <select
                    value={settings.backup.schedule}
                    onChange={(e) => update('backup', 'schedule', e.target.value)}
                    disabled={!isAdmin || !settings.backup.enabled}
                    className="SelectBase w-40"
                  >
                    <option value="daily">매일 (00:00 KST)</option>
                    <option value="weekly">매주 일요일</option>
                    <option value="monthly">매월 1일</option>
                    <option value="manual">수동만</option>
                  </select>
                </SettingRow>
                <SettingRow label="백업 보관 수" description="유지할 최근 백업 파일 수 (초과 시 자동 삭제)">
                  <NumberInput value={settings.backup.retentionCount} onChange={(v) => update('backup', 'retentionCount', v)} disabled={!isAdmin} suffix="개" min={1} max={30} />
                </SettingRow>
                <SettingRow label="첨부파일 포함" description="업로드된 문서·이미지를 백업에 포함">
                  <ToggleSwitch value={settings.backup.includeAttachments} onChange={(v) => update('backup', 'includeAttachments', v)} disabled={!isAdmin} />
                </SettingRow>
              </div>

              {/* 스토리지 */}
              <div className="border-t border-slate-700/50 pt-4 mb-4">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Archive className="w-3.5 h-3.5 text-purple-400" /> 저장 위치
                </h4>
                <SettingRow label="스토리지 유형" description="백업 파일 저장 위치">
                  <select
                    value={settings.backup.storageType}
                    onChange={(e) => update('backup', 'storageType', e.target.value)}
                    disabled={!isAdmin}
                    className="SelectBase w-52"
                  >
                    <option value="local">로컬 스토리지</option>
                    <option value="ncp">네이버 클라우드 (NCP)</option>
                    <option value="s3">AWS S3</option>
                    <option value="gcs">Google Cloud Storage</option>
                  </select>
                </SettingRow>
                <SettingRow
                  label="저장 경로"
                  description={
                    settings.backup.storageType === 'local'
                      ? `서버 내 백업 디렉토리 (기본: ${defaultBackupDir || 'BACKUP_DIR 환경변수 또는 ./backups/'})`
                      : settings.backup.storageType === 'ncp'
                      ? `버킷 내 경로 접두어 (기본: tansoeum-backups/{tenantId})${ncpBucket ? ` — 버킷: ${ncpBucket}` : ''}`
                      : '버킷 내 경로 접두어'
                  }
                >
                  <div className="flex flex-col gap-1">
                    <input
                      value={settings.backup.storagePath ?? ''}
                      onChange={(e) => update('backup', 'storagePath', e.target.value || undefined)}
                      disabled={!isAdmin}
                      placeholder={
                        settings.backup.storageType === 'local'
                          ? (defaultBackupDir || './backups/')
                          : settings.backup.storageType === 'ncp'
                          ? 'tansoeum-backups/backups'
                          : 'my-bucket/backups'
                      }
                      className="w-64 bg-slate-700/60 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 disabled:opacity-50"
                    />
                    {settings.backup.storageType === 'local' && !settings.backup.storagePath && defaultBackupDir && (
                      <span className="text-[10px] text-slate-500">현재 기본값: {defaultBackupDir}</span>
                    )}
                    {settings.backup.storageType === 'ncp' && ncpBucket && (
                      <span className="text-[10px] text-emerald-400">버킷 설정 확인됨: {ncpBucket}</span>
                    )}
                    {settings.backup.storageType === 'ncp' && !ncpConfigured && (
                      <span className="text-[10px] text-amber-400">NCP 환경변수 미설정 — 아래 안내 참고</span>
                    )}
                  </div>
                </SettingRow>
                <SettingRow label="완료 알림 이메일" description="백업 완료·실패 시 결과를 수신할 이메일">
                  <input
                    type="email"
                    value={settings.backup.notifyEmail}
                    onChange={(e) => update('backup', 'notifyEmail', e.target.value)}
                    disabled={!isAdmin}
                    placeholder="admin@example.com"
                    className="w-64 bg-slate-700/60 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 disabled:opacity-50"
                  />
                </SettingRow>
              </div>

              {/* 수동 백업 */}
              <div className="border-t border-slate-700/50 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">수동 백업 실행</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      이 업체 데이터만 선택 추출하여 .jsonl.gz 파일로 저장합니다
                    </div>
                  </div>
                  <button
                    onClick={handleManualBackup}
                    disabled={!isAdmin || isBackupRunning}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-700/80 hover:bg-emerald-600 rounded-lg text-sm font-medium transition disabled:opacity-50"
                  >
                    {isBackupRunning
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> 백업 중...</>
                      : <><RefreshCw className="w-4 h-4" /> 지금 백업</>}
                  </button>
                </div>

                {/* NCP 환경변수 안내 */}
                {settings.backup.storageType === 'ncp' && !ncpConfigured && (
                  <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300 space-y-1.5">
                    <div className="flex items-center gap-2 font-semibold">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      NCP Object Storage 환경변수가 설정되지 않았습니다
                    </div>
                    <div className="text-slate-300 font-mono bg-slate-900/60 rounded p-2 space-y-0.5">
                      <div>NCP_ACCESS_KEY=<span className="text-slate-500">발급받은 액세스 키</span></div>
                      <div>NCP_SECRET_KEY=<span className="text-slate-500">발급받은 시크릿 키</span></div>
                      <div>NCP_BUCKET_NAME=<span className="text-slate-500">버킷명</span></div>
                      <div className="text-slate-500"># 선택 (기본값 사용 가능)</div>
                      <div>NCP_STORAGE_ENDPOINT=https://kr.object.ncloudstorage.com</div>
                      <div>NCP_STORAGE_REGION=kr-standard</div>
                    </div>
                    <div className="text-slate-400">
                      NCP 콘솔 → Object Storage → 버킷 생성 후 API 인증키를 발급받아 .env.local에 추가하세요.
                    </div>
                  </div>
                )}
                {settings.backup.storageType === 'ncp' && ncpConfigured && (
                  <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    NCP Object Storage 연결 설정 확인됨{ncpBucket ? ` — 버킷: ${ncpBucket}` : ''}
                  </div>
                )}
                {/* S3: 지원됨 (환경변수 필요) */}
                {settings.backup.storageType === 's3' && !s3Configured && (
                  <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300 space-y-1.5">
                    <div className="flex items-center gap-2 font-semibold">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      AWS S3 환경변수가 설정되지 않았습니다
                    </div>
                    <div className="text-slate-300 font-mono bg-slate-900/60 rounded p-2 space-y-0.5">
                      <div>AWS_ACCESS_KEY_ID=<span className="text-slate-500">액세스 키</span></div>
                      <div>AWS_SECRET_ACCESS_KEY=<span className="text-slate-500">시크릿 키</span></div>
                      <div>AWS_S3_BUCKET=<span className="text-slate-500">버킷명</span></div>
                      <div>AWS_REGION=ap-northeast-2</div>
                    </div>
                  </div>
                )}
                {settings.backup.storageType === 's3' && s3Configured && (
                  <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    AWS S3 연결 설정 확인됨
                  </div>
                )}
                {/* GCS: 미지원 */}
                {settings.backup.storageType === 'gcs' && (
                  <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300 flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    Google Cloud Storage 백업은 현재 미지원입니다. 네이버 클라우드(NCP) 또는 로컬 스토리지를 사용하세요.
                  </div>
                )}
              </div>

              {/* 안내 */}
              <div className="mt-4 p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl text-xs text-blue-300 space-y-1.5">
                {[
                  '이 업체(테넌트)의 데이터만 선택 추출합니다 — 타 업체 데이터 미포함, 멀티테넌트 격리 보장.',
                  'JSON Lines + gzip 압축(.jsonl.gz) 형식으로 저장됩니다.',
                  '비밀번호 해시(passwordHash)는 보안상 백업에서 제외됩니다.',
                  '복원: PUT /api/admin/backup/restore API를 통해 가능합니다 (별도 지원 요청).',
                ].map((text) => (
                  <div key={text} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-400" />
                    {text}
                  </div>
                ))}
              </div>

              {/* 백업 이력 */}
              {backupHistory.length > 0 && (
                <div className="mt-5 border-t border-slate-700/50 pt-4">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-slate-400" /> 최근 백업 이력
                  </h4>
                  <div className="space-y-2">
                    {backupHistory.map((entry) => {
                      const meta = entry.metadata;
                      const isOk = meta?.backupStatus === 'success';
                      const sizeStr = meta?.sizeBytes
                        ? `${(meta.sizeBytes / (1024 * 1024)).toFixed(2)} MB`
                        : null;
                      const durStr = meta?.durationMs
                        ? `${(meta.durationMs / 1000).toFixed(1)}초`
                        : null;
                      return (
                        <div
                          key={entry.backupId}
                          className={`flex items-start gap-3 p-2.5 rounded-lg border text-xs ${
                            isOk
                              ? 'bg-emerald-500/5 border-emerald-500/20'
                              : 'bg-red-500/5 border-red-500/20'
                          }`}
                        >
                          {isOk
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            : <AlertCircle  className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={isOk ? 'text-emerald-300' : 'text-red-300'}>
                                {isOk ? '성공' : '실패'}
                              </span>
                              {sizeStr && <span className="text-slate-400">{sizeStr}</span>}
                              {durStr  && <span className="text-slate-500">{durStr}</span>}
                              <span className="text-slate-500 ml-auto">
                                {new Date(entry.createdAt).toLocaleString('ko-KR', {
                                  month: '2-digit', day: '2-digit',
                                  hour: '2-digit', minute: '2-digit',
                                })}
                              </span>
                            </div>
                            {meta?.backupPath && (
                              <div className="text-slate-500 mt-0.5 truncate" title={meta.backupPath}>
                                {meta.backupPath}
                              </div>
                            )}
                            {!isOk && meta?.error && (
                              <div className="text-red-400 mt-0.5 line-clamp-2">{meta.error}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Section>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── UI 서브 컴포넌트 ─────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  description,
  children,
}: {
  title: string;
  icon: React.ElementType;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-start gap-3 mb-5 pb-4 border-b border-slate-700/50">
        <div className="p-1.5 rounded-lg bg-cyan-500/10 mt-0.5">
          <Icon className="w-4 h-4 text-cyan-400" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-white">{title}</h3>
          {description && <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{description}</p>}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: React.ReactNode;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-700/20 last:border-0">
      <div className="pr-4">
        <div className="text-sm font-medium text-slate-200">{label}</div>
        <div className="text-xs text-slate-500 mt-0.5">{description}</div>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  disabled,
  suffix,
  step = 1,
  decimal,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
  suffix: string;
  step?: number;
  decimal?: number;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={decimal !== undefined ? value.toFixed(decimal) : value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange(v);
        }}
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        className="w-28 bg-slate-700/60 border border-slate-600 rounded-lg px-3 py-2 text-sm text-right text-white disabled:opacity-50 focus:outline-none focus:border-cyan-500"
      />
      <span className="text-xs text-slate-400 min-w-14">{suffix}</span>
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
      type="button"
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      aria-checked={value}
      role="switch"
      className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 focus:outline-none ${
        value ? 'bg-cyan-600' : 'bg-slate-600'
      }`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
          value ? 'translate-x-5.5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
