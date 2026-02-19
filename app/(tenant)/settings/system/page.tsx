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
} from 'lucide-react';
import { fetchWithCsrf } from '@/hooks/use-csrf';

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
}

export default function SystemSettingsPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('general');

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/system-settings');
      const json = await res.json();
      if (json.success) {
        setSettings(json.data.settings);
        setIsAdmin(json.data.isAdmin);
      }
    } catch {
      // error handled
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
    setSaveMessage(null);

    try {
      const res = await fetchWithCsrf('/api/system-settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (json.success) {
        setSaveMessage('설정이 저장되었습니다.');
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveMessage('저장 실패: ' + (json.error?.message || '알 수 없는 오류'));
      }
    } catch {
      setSaveMessage('저장 중 오류가 발생했습니다.');
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

      {saveMessage && (
        <div className={`mb-6 p-3 rounded-lg text-sm flex items-center gap-2 ${
          saveMessage.includes('실패') || saveMessage.includes('오류')
            ? 'bg-red-500/10 border border-red-500/30 text-red-400'
            : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
        }`}>
          {saveMessage.includes('실패') || saveMessage.includes('오류')
            ? <AlertCircle className="w-4 h-4 shrink-0" />
            : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          {saveMessage}
        </div>
      )}

      {/* 탭 네비게이션 */}
      <div className="flex gap-1 mb-6 bg-slate-800 rounded-lg p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition flex-1 justify-center ${
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
              <NumberInput
                value={settings.energy.electricityRate}
                onChange={(v) => updateSetting('energy', 'electricityRate', v)}
                disabled={!isAdmin}
                suffix="원/kWh"
              />
            </SettingRow>
            <SettingRow label="피크 요금" description="피크 시간대 kWh당 요금">
              <NumberInput
                value={settings.energy.peakRate}
                onChange={(v) => updateSetting('energy', 'peakRate', v)}
                disabled={!isAdmin}
                suffix="원/kWh"
              />
            </SettingRow>
            <SettingRow label="경부하 요금" description="경부하 시간대 kWh당 요금">
              <NumberInput
                value={settings.energy.offPeakRate}
                onChange={(v) => updateSetting('energy', 'offPeakRate', v)}
                disabled={!isAdmin}
                suffix="원/kWh"
              />
            </SettingRow>
            <SettingRow label="탄소 배출 계수" description="kWh당 CO2 배출량">
              <NumberInput
                value={settings.energy.carbonFactor}
                onChange={(v) => updateSetting('energy', 'carbonFactor', v)}
                disabled={!isAdmin}
                suffix="tCO2/kWh"
                step={0.0001}
              />
            </SettingRow>
            <SettingRow label="절감 목표" description="연간 에너지 절감 목표">
              <NumberInput
                value={settings.energy.targetReduction}
                onChange={(v) => updateSetting('energy', 'targetReduction', v)}
                disabled={!isAdmin}
                suffix="%"
              />
            </SettingRow>
          </div>
        )}

        {/* 알림 설정 */}
        {activeTab === 'alerts' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold border-b border-slate-700 pb-3">알림 임계값 설정</h3>
            <SettingRow label="경고 임계값" description="전력 사용률 경고 기준">
              <NumberInput
                value={settings.alerts.powerThresholdWarning}
                onChange={(v) => updateSetting('alerts', 'powerThresholdWarning', v)}
                disabled={!isAdmin}
                suffix="%"
              />
            </SettingRow>
            <SettingRow label="위험 임계값" description="전력 사용률 위험 기준">
              <NumberInput
                value={settings.alerts.powerThresholdCritical}
                onChange={(v) => updateSetting('alerts', 'powerThresholdCritical', v)}
                disabled={!isAdmin}
                suffix="%"
              />
            </SettingRow>
            <SettingRow label="이메일 알림" description="이메일로 알림 수신">
              <ToggleSwitch
                value={settings.alerts.emailNotifications}
                onChange={(v) => updateSetting('alerts', 'emailNotifications', v)}
                disabled={!isAdmin}
              />
            </SettingRow>
            <SettingRow label="SMS 알림" description="문자로 알림 수신">
              <ToggleSwitch
                value={settings.alerts.smsNotifications}
                onChange={(v) => updateSetting('alerts', 'smsNotifications', v)}
                disabled={!isAdmin}
              />
            </SettingRow>
            <SettingRow label="갱신 주기" description="데이터 자동 갱신 간격">
              <NumberInput
                value={settings.alerts.refreshInterval}
                onChange={(v) => updateSetting('alerts', 'refreshInterval', v)}
                disabled={!isAdmin}
                suffix="초"
              />
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
              <ToggleSwitch
                value={settings.dashboard.showCarbonWidget}
                onChange={(v) => updateSetting('dashboard', 'showCarbonWidget', v)}
                disabled={!isAdmin}
              />
            </SettingRow>
            <SettingRow label="비용 위젯" description="비용 분석 위젯 표시">
              <ToggleSwitch
                value={settings.dashboard.showCostWidget}
                onChange={(v) => updateSetting('dashboard', 'showCostWidget', v)}
                disabled={!isAdmin}
              />
            </SettingRow>
            <SettingRow label="설비 현황" description="설비 상태 위젯 표시">
              <ToggleSwitch
                value={settings.dashboard.showDeviceStatus}
                onChange={(v) => updateSetting('dashboard', 'showDeviceStatus', v)}
                disabled={!isAdmin}
              />
            </SettingRow>
          </div>
        )}

        {/* 데이터 수집 설정 */}
        {activeTab === 'dataCollection' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold border-b border-slate-700 pb-3">데이터 수집 설정</h3>
            <SettingRow label="수집 주기" description="기본 데이터 수집 간격">
              <NumberInput
                value={settings.dataCollection.defaultInterval}
                onChange={(v) => updateSetting('dataCollection', 'defaultInterval', v)}
                disabled={!isAdmin}
                suffix="초"
              />
            </SettingRow>
            <SettingRow label="보존 기간" description="측정 데이터 보존 일수">
              <NumberInput
                value={settings.dataCollection.retentionDays}
                onChange={(v) => updateSetting('dataCollection', 'retentionDays', v)}
                disabled={!isAdmin}
                suffix="일"
              />
            </SettingRow>
            <SettingRow label="집계 활성화" description="자동 데이터 집계 수행">
              <ToggleSwitch
                value={settings.dataCollection.aggregationEnabled}
                onChange={(v) => updateSetting('dataCollection', 'aggregationEnabled', v)}
                disabled={!isAdmin}
              />
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
      </div>
    </div>
  );
}

// 설정 행 컴포넌트
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

// 숫자 입력 컴포넌트
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

// 토글 스위치 컴포넌트
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
