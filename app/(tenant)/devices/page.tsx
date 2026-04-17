'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Zap, Plus, Search, RefreshCw, MoreVertical, Edit, Trash2, Eye,
  AlertCircle, Loader2, CheckCircle, XCircle, Clock, Settings,
  Activity, Thermometer, Gauge, Lightbulb, Cpu, Building2,
  Network, Server, ChevronRight, Info, Plug, Battery,
  Wind, Sun, Wrench, Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiGet, apiPost, apiDelete } from '@/lib/api/client';
import { toast } from '@/lib/toast';
import CollectorDownloadModal from '@/components/collector/CollectorDownloadModal';

// ── 타입 ─────────────────────────────────────────────────────────

interface Device {
  id: string;
  name: string;
  code: string | null;
  deviceType: string;
  protocol: string;
  manufacturer: string | null;
  model: string | null;
  status: 'online' | 'offline' | 'error' | 'maintenance';
  lastSeenAt: string | null;
  controlCapable: boolean;
  siteId: string;
  gatewayId: string | null;
  location: string | null;
  site?: { id: string; name: string };
  gateway?: { id: string; name: string | null; serialNumber: string } | null;
}

interface Gateway {
  id: string;
  name: string | null;
  serialNumber: string;
  ipAddress: string | null;
  status: string;
  siteId: string;
}

// ── 설비 유형 설정 (확장) ─────────────────────────────────────────

const DEVICE_TYPES: { value: string; label: string; icon: React.ElementType; color: string; bg: string; group: string }[] = [
  // 계측
  { value: 'METER',            label: '계량기 / 전력계',     icon: Gauge,       color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    group: '계측' },
  { value: 'SMART_METER',      label: '스마트 미터',          icon: Zap,         color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    group: '계측' },
  // 공조
  { value: 'HVAC',             label: 'HVAC / 냉난방',        icon: Thermometer, color: 'text-blue-400',    bg: 'bg-blue-500/10',    group: '공조' },
  { value: 'CHILLER',          label: '칠러',                 icon: Thermometer, color: 'text-blue-400',    bg: 'bg-blue-500/10',    group: '공조' },
  { value: 'AHU',              label: '공기조화기 (AHU)',     icon: Wind,        color: 'text-sky-400',     bg: 'bg-sky-500/10',     group: '공조' },
  // 전기
  { value: 'LIGHTING',         label: '조명 제어기',          icon: Lightbulb,   color: 'text-amber-400',   bg: 'bg-amber-500/10',   group: '전기' },
  { value: 'SMART_PLUG',       label: '스마트 플러그',        icon: Plug,        color: 'text-yellow-400',  bg: 'bg-yellow-500/10',  group: '전기' },
  { value: 'UPS',              label: 'UPS (무정전전원)',     icon: Zap,         color: 'text-orange-400',  bg: 'bg-orange-500/10',  group: '전기' },
  { value: 'ESS',              label: 'ESS / 배터리',         icon: Battery,     color: 'text-green-400',   bg: 'bg-green-500/10',   group: '전기' },
  { value: 'INVERTER',         label: '인버터',               icon: Zap,         color: 'text-purple-400',  bg: 'bg-purple-500/10',  group: '전기' },
  // 제어기
  { value: 'DDC',              label: 'DDC (디지털 제어기)',  icon: Cpu,         color: 'text-emerald-400', bg: 'bg-emerald-500/10', group: '제어기' },
  { value: 'PLC',              label: 'PLC (프로그래머블)',   icon: Cpu,         color: 'text-emerald-400', bg: 'bg-emerald-500/10', group: '제어기' },
  { value: 'RTU',              label: 'RTU (원격 단말)',      icon: Server,      color: 'text-teal-400',    bg: 'bg-teal-500/10',    group: '제어기' },
  { value: 'CONTROLLER',       label: '에너지 제어기',        icon: Settings,    color: 'text-teal-400',    bg: 'bg-teal-500/10',    group: '제어기' },
  // 공정
  { value: 'PRODUCTION_EQUIPMENT', label: '생산 설비',        icon: Wrench,      color: 'text-slate-400',   bg: 'bg-slate-500/10',   group: '공정' },
  { value: 'BOILER',           label: '보일러',               icon: Thermometer, color: 'text-red-400',     bg: 'bg-red-500/10',     group: '공정' },
  { value: 'COMPRESSOR',       label: '압축기',               icon: Activity,    color: 'text-orange-400',  bg: 'bg-orange-500/10',  group: '공정' },
  { value: 'PUMP',             label: '펌프',                 icon: Activity,    color: 'text-indigo-400',  bg: 'bg-indigo-500/10',  group: '공정' },
  // 신재생
  { value: 'SOLAR_INVERTER',   label: '태양광 인버터',        icon: Sun,         color: 'text-yellow-400',  bg: 'bg-yellow-500/10',  group: '신재생' },
  { value: 'WIND_TURBINE',     label: '풍력 터빈',            icon: Wind,        color: 'text-sky-400',     bg: 'bg-sky-500/10',     group: '신재생' },
  // 기타
  { value: 'TEMPERATURE_SENSOR', label: '온도 센서 허브',     icon: Thermometer, color: 'text-red-400',     bg: 'bg-red-500/10',     group: '기타' },
  { value: 'OTHER',            label: '기타',                 icon: Settings,    color: 'text-slate-400',   bg: 'bg-slate-500/10',   group: '기타' },
];

const deviceTypeMap = Object.fromEntries(DEVICE_TYPES.map(d => [d.value, d]));

// ── 프로토콜 설정 ────────────────────────────────────────────────

const PROTOCOLS = [
  { value: 'modbus_tcp',         label: 'Modbus TCP/IP',           desc: 'TCP 기반 Modbus (산업 표준)' },
  { value: 'modbus_rtu',         label: 'Modbus RTU',              desc: 'RS-232/485 직렬 통신' },
  { value: 'bacnet_ip',          label: 'BACnet/IP',               desc: '건물 자동화 네트워크 (UDP/IP)' },
  { value: 'bacnet_mstp',        label: 'BACnet MS/TP',            desc: 'RS-485 기반 BACnet (DDC)' },
  { value: 'opcua',              label: 'OPC-UA',                  desc: '산업 IoT 표준 (IEC 62541)' },
  { value: 'mqtt',               label: 'MQTT',                    desc: '경량 IoT 메시지 프로토콜' },
  { value: 'http',               label: 'HTTP/REST',               desc: 'REST API 폴링 방식' },
  { value: 'modbus_tcp_gateway', label: 'Modbus TCP (GW 경유)',    desc: 'TCP Wrapper → RTU 변환' },
];

const DEFAULT_PORTS: Record<string, number> = {
  modbus_tcp: 502, modbus_tcp_gateway: 502,
  bacnet_ip: 47808, opcua: 4840, http: 80,
};

// ── 상태 설정 ────────────────────────────────────────────────────

const statusConfig = {
  online:      { label: '온라인',  color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircle },
  offline:     { label: '오프라인', color: 'text-slate-400',  bg: 'bg-slate-500/10',   icon: XCircle },
  error:       { label: '오류',    color: 'text-red-400',     bg: 'bg-red-500/10',     icon: AlertCircle },
  maintenance: { label: '점검중',  color: 'text-amber-400',   bg: 'bg-amber-500/10',   icon: Clock },
};

// ── 프로토콜별 연결 설정 폼 ──────────────────────────────────────

type ConnConfig = Record<string, string | number | boolean | undefined>;

function ConnectionConfigForm({ protocol, config, onChange }: {
  protocol: string;
  config: ConnConfig;
  onChange: (cfg: ConnConfig) => void;
}) {
  const cls = {
    label: 'block text-xs font-medium text-slate-400 mb-1',
    input: 'w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500/50',
    select: 'w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500/50',
  };
  const set = (key: string, val: string | number | boolean) => onChange({ ...config, [key]: val });

  if (protocol === 'modbus_tcp' || protocol === 'modbus_tcp_gateway') return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className={cls.label}>Host / IP 주소 <span className="text-red-400">*</span></label>
          <input className={cls.input} value={String(config.host ?? '')} onChange={e => set('host', e.target.value)} placeholder="192.168.1.100" required />
        </div>
        <div>
          <label className={cls.label}>Port</label>
          <input type="number" className={cls.input} value={Number(config.port ?? 502)} onChange={e => set('port', parseInt(e.target.value) || 502)} min={1} max={65535} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={cls.label}>Unit ID (Slave ID, 1-247) <span className="text-red-400">*</span></label>
          <input type="number" className={cls.input} value={Number(config.unitId ?? 1)} onChange={e => set('unitId', parseInt(e.target.value) || 1)} min={1} max={247} />
        </div>
        <div>
          <label className={cls.label}>Timeout (ms)</label>
          <input type="number" className={cls.input} value={Number(config.timeout ?? 5000)} onChange={e => set('timeout', parseInt(e.target.value) || 5000)} step={500} />
        </div>
      </div>
      {protocol === 'modbus_tcp_gateway' && (
        <p className="text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded px-3 py-2">
          TCP 게이트웨이 경유 모드: 게이트웨이의 IP/Port를 입력하고, Unit ID는 RS-485 슬레이브 주소를 사용합니다.
        </p>
      )}
    </div>
  );

  if (protocol === 'modbus_rtu') return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={cls.label}>COM 포트 <span className="text-red-400">*</span></label>
          <input className={cls.input} value={String(config.serialPort ?? '')} onChange={e => set('serialPort', e.target.value)} placeholder="COM1 또는 /dev/ttyS0" required />
        </div>
        <div>
          <label className={cls.label}>Baud Rate</label>
          <select className={cls.select} value={Number(config.baudRate ?? 9600)} onChange={e => set('baudRate', parseInt(e.target.value))}>
            {[2400, 4800, 9600, 19200, 38400, 57600, 115200].map(b => <option key={b} value={b}>{b.toLocaleString()}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={cls.label}>Parity</label>
          <select className={cls.select} value={String(config.parity ?? 'none')} onChange={e => set('parity', e.target.value)}>
            <option value="none">None</option>
            <option value="even">Even</option>
            <option value="odd">Odd</option>
          </select>
        </div>
        <div>
          <label className={cls.label}>Stop Bits</label>
          <select className={cls.select} value={Number(config.stopBits ?? 1)} onChange={e => set('stopBits', parseInt(e.target.value))}>
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
        </div>
        <div>
          <label className={cls.label}>Unit ID <span className="text-red-400">*</span></label>
          <input type="number" className={cls.input} value={Number(config.unitId ?? 1)} onChange={e => set('unitId', parseInt(e.target.value) || 1)} min={1} max={247} />
        </div>
      </div>
    </div>
  );

  if (protocol === 'bacnet_ip') return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className={cls.label}>IP 주소 <span className="text-red-400">*</span></label>
          <input className={cls.input} value={String(config.host ?? '')} onChange={e => set('host', e.target.value)} placeholder="192.168.1.100" required />
        </div>
        <div>
          <label className={cls.label}>Port (UDP)</label>
          <input type="number" className={cls.input} value={Number(config.port ?? 47808)} onChange={e => set('port', parseInt(e.target.value) || 47808)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={cls.label}>Device Instance <span className="text-red-400">*</span></label>
          <input type="number" className={cls.input} value={Number(config.deviceInstance ?? 1000)} onChange={e => set('deviceInstance', parseInt(e.target.value) || 0)} placeholder="1000" min={0} max={4194303} />
        </div>
        <div>
          <label className={cls.label}>Network Number</label>
          <input type="number" className={cls.input} value={Number(config.networkNumber ?? 0)} onChange={e => set('networkNumber', parseInt(e.target.value) || 0)} placeholder="0" min={0} />
        </div>
      </div>
    </div>
  );

  if (protocol === 'bacnet_mstp') return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={cls.label}>COM 포트 <span className="text-red-400">*</span></label>
          <input className={cls.input} value={String(config.serialPort ?? '')} onChange={e => set('serialPort', e.target.value)} placeholder="COM2 또는 /dev/ttyS1" required />
        </div>
        <div>
          <label className={cls.label}>Baud Rate</label>
          <select className={cls.select} value={Number(config.baudRate ?? 76800)} onChange={e => set('baudRate', parseInt(e.target.value))}>
            {[9600, 19200, 38400, 57600, 76800].map(b => <option key={b} value={b}>{b.toLocaleString()}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={cls.label}>MAC Address (0-127) <span className="text-red-400">*</span></label>
          <input type="number" className={cls.input} value={Number(config.macAddress ?? 1)} onChange={e => set('macAddress', parseInt(e.target.value) || 0)} min={0} max={127} />
        </div>
        <div>
          <label className={cls.label}>Max Masters</label>
          <input type="number" className={cls.input} value={Number(config.maxMasters ?? 127)} onChange={e => set('maxMasters', parseInt(e.target.value) || 127)} min={0} max={127} />
        </div>
        <div>
          <label className={cls.label}>Network Number</label>
          <input type="number" className={cls.input} value={Number(config.networkNumber ?? 0)} onChange={e => set('networkNumber', parseInt(e.target.value) || 0)} min={0} />
        </div>
      </div>
    </div>
  );

  if (protocol === 'opcua') return (
    <div className="space-y-3">
      <div>
        <label className={cls.label}>Endpoint URL <span className="text-red-400">*</span></label>
        <input className={cls.input} value={String(config.endpointUrl ?? '')} onChange={e => set('endpointUrl', e.target.value)} placeholder="opc.tcp://192.168.1.100:4840" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={cls.label}>Security Policy</label>
          <select className={cls.select} value={String(config.securityPolicy ?? 'None')} onChange={e => set('securityPolicy', e.target.value)}>
            <option value="None">None (개발/테스트)</option>
            <option value="Basic128Rsa15">Basic128Rsa15</option>
            <option value="Basic256">Basic256</option>
            <option value="Basic256Sha256">Basic256Sha256 (권장)</option>
          </select>
        </div>
        <div>
          <label className={cls.label}>Namespace Index</label>
          <input type="number" className={cls.input} value={Number(config.namespaceIndex ?? 2)} onChange={e => set('namespaceIndex', parseInt(e.target.value) || 2)} min={0} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={cls.label}>사용자명 (선택)</label>
          <input className={cls.input} value={String(config.username ?? '')} onChange={e => set('username', e.target.value)} placeholder="admin" autoComplete="off" />
        </div>
        <div>
          <label className={cls.label}>비밀번호 (선택)</label>
          <input type="password" className={cls.input} value={String(config.password ?? '')} onChange={e => set('password', e.target.value)} placeholder="••••••••" autoComplete="new-password" />
        </div>
      </div>
    </div>
  );

  if (protocol === 'mqtt') return (
    <div className="space-y-3">
      <div>
        <label className={cls.label}>Topic Prefix <span className="text-red-400">*</span></label>
        <input className={cls.input} value={String(config.topicPrefix ?? '')} onChange={e => set('topicPrefix', e.target.value)} placeholder="ems/site01/device001" required />
        <p className="text-xs text-slate-500 mt-1">브로커 연결은 게이트웨이 또는 시스템 설정 → MQTT에서 구성</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={cls.label}>QoS</label>
          <select className={cls.select} value={Number(config.qos ?? 1)} onChange={e => set('qos', parseInt(e.target.value))}>
            <option value={0}>0 — At most once</option>
            <option value={1}>1 — At least once (권장)</option>
            <option value={2}>2 — Exactly once</option>
          </select>
        </div>
        <div>
          <label className={cls.label}>Poll Interval (ms)</label>
          <input type="number" className={cls.input} value={Number(config.pollInterval ?? 5000)} onChange={e => set('pollInterval', parseInt(e.target.value) || 5000)} step={500} />
        </div>
      </div>
    </div>
  );

  if (protocol === 'http') return (
    <div className="space-y-3">
      <div>
        <label className={cls.label}>Base URL <span className="text-red-400">*</span></label>
        <input className={cls.input} value={String(config.baseUrl ?? '')} onChange={e => set('baseUrl', e.target.value)} placeholder="http://192.168.1.100/api/v1" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={cls.label}>인증 방식</label>
          <select className={cls.select} value={String(config.authType ?? 'none')} onChange={e => set('authType', e.target.value)}>
            <option value="none">인증 없음</option>
            <option value="api_key">API Key (Header)</option>
            <option value="basic">Basic Auth</option>
            <option value="bearer">Bearer Token</option>
          </select>
        </div>
        <div>
          <label className={cls.label}>Poll Interval (ms)</label>
          <input type="number" className={cls.input} value={Number(config.pollInterval ?? 10000)} onChange={e => set('pollInterval', parseInt(e.target.value) || 10000)} step={1000} />
        </div>
      </div>
      {config.authType && config.authType !== 'none' && (
        <div>
          <label className={cls.label}>인증 키 / 토큰 <span className="text-red-400">*</span></label>
          <input type="password" className={cls.input} value={String(config.apiKey ?? '')} onChange={e => set('apiKey', e.target.value)} placeholder="인증 값 입력" autoComplete="new-password" />
        </div>
      )}
    </div>
  );

  return (
    <p className="text-sm text-slate-400 py-2">위에서 프로토콜을 선택하면 연결 설정 항목이 표시됩니다.</p>
  );
}

// ── 설비 등록 모달 ───────────────────────────────────────────────

const TABS = ['기본 정보', '연결 설정', '상세 정보'] as const;
type Tab = typeof TABS[number];

function DeviceCreateModal({ sites, gateways, defaultSiteId, onClose, onCreated }: {
  sites: { id: string; name: string }[];
  gateways: Gateway[];
  defaultSiteId: string | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [activeTab, setActiveTab] = useState<Tab>('기본 정보');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    deviceType: 'METER',
    protocol: 'modbus_tcp',
    siteId: defaultSiteId ?? '',
    gatewayId: '',
    manufacturer: '',
    model: '',
    location: '',
    controlCapable: false,
    pollIntervalMs: 5000,
    installationDate: '',
  });

  const [connConfig, setConnConfig] = useState<ConnConfig>({ host: '', port: 502, unitId: 1, timeout: 5000 });

  // 프로토콜 변경 시 기본 포트 업데이트
  const handleProtocolChange = (protocol: string) => {
    setForm(f => ({ ...f, protocol }));
    setConnConfig({ port: DEFAULT_PORTS[protocol] ?? undefined });
  };

  // 사이트별 게이트웨이 필터
  const siteGateways = form.siteId
    ? gateways.filter(g => g.siteId === form.siteId)
    : gateways;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('설비명을 입력해주세요.'); setActiveTab('기본 정보'); return; }
    if (!form.siteId) { setError('사이트를 선택해주세요.'); setActiveTab('기본 정보'); return; }

    setIsSubmitting(true);
    setError(null);
    try {
      const body = {
        ...form,
        gatewayId: form.gatewayId || undefined,
        manufacturer: form.manufacturer || undefined,
        model: form.model || undefined,
        location: form.location || undefined,
        installationDate: form.installationDate || undefined,
        connectionConfig: connConfig,
      };
      const res = await apiPost('/api/devices', body);
      if (!res.success) throw new Error(res.error ?? '설비 등록에 실패했습니다.');
      toast.success('설비가 등록되었습니다.');
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : '설비 등록에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const cls = {
    label: 'block text-sm font-medium text-slate-300 mb-1.5',
    input: 'w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50',
    select: 'w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50',
  };

  // 설비 유형 그룹화
  const typeGroups = DEVICE_TYPES.reduce<Record<string, typeof DEVICE_TYPES>>((acc, t) => {
    (acc[t.group] ??= []).push(t);
    return acc;
  }, {});

  const selectedProtocol = PROTOCOLS.find(p => p.value === form.protocol);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">새 설비 등록</h2>
            <p className="text-xs text-slate-400 mt-0.5">IoT 기기·계량기·제어기·센서 허브를 등록합니다.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700 px-6 shrink-0">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                'py-3 px-4 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2',
                activeTab === tab
                  ? 'text-cyan-400 border-cyan-400'
                  : 'text-slate-400 border-transparent hover:text-slate-300'
              )}
            >
              <span className={cn(
                'w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold',
                activeTab === tab ? 'bg-cyan-500 text-white' : 'bg-slate-700 text-slate-400'
              )}>{i + 1}</span>
              {tab}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-4">
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {/* ── 탭 1: 기본 정보 ── */}
            {activeTab === '기본 정보' && (
              <div className="space-y-4">
                {/* 설비명 */}
                <div>
                  <label className={cls.label}>설비명 <span className="text-red-400">*</span></label>
                  <input className={cls.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="예: 1공장 수전반 #1" required />
                </div>

                {/* 사이트 + 게이트웨이 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={cls.label}>사이트 <span className="text-red-400">*</span></label>
                    <select className={cls.select} value={form.siteId} onChange={e => setForm(f => ({ ...f, siteId: e.target.value, gatewayId: '' }))} required>
                      <option value="">사이트 선택</option>
                      {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={cls.label}>게이트웨이 (선택)</label>
                    <select className={cls.select} value={form.gatewayId} onChange={e => setForm(f => ({ ...f, gatewayId: e.target.value }))} disabled={!form.siteId}>
                      <option value="">직접 연결 (게이트웨이 없음)</option>
                      {siteGateways.map(g => (
                        <option key={g.id} value={g.id}>
                          {g.name ?? g.serialNumber} {g.ipAddress ? `(${g.ipAddress})` : ''}
                        </option>
                      ))}
                    </select>
                    {form.siteId && siteGateways.length === 0 && (
                      <p className="text-xs text-amber-400 mt-1">이 사이트에 등록된 게이트웨이가 없습니다.</p>
                    )}
                  </div>
                </div>

                {/* 설비 유형 */}
                <div>
                  <label className={cls.label}>설비 유형 <span className="text-red-400">*</span></label>
                  <select className={cls.select} value={form.deviceType} onChange={e => setForm(f => ({ ...f, deviceType: e.target.value }))}>
                    {Object.entries(typeGroups).map(([group, types]) => (
                      <optgroup key={group} label={`── ${group}`}>
                        {types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>

                {/* 제조사 / 모델 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={cls.label}>제조사</label>
                    <input className={cls.input} value={form.manufacturer} onChange={e => setForm(f => ({ ...f, manufacturer: e.target.value }))} placeholder="예: LS ELECTRIC" />
                  </div>
                  <div>
                    <label className={cls.label}>모델명</label>
                    <input className={cls.input} value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} placeholder="예: IM5G-100" />
                  </div>
                </div>

                {/* 설치 위치 */}
                <div>
                  <label className={cls.label}>설치 위치</label>
                  <input className={cls.input} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="예: 1층 전기실 2판넬" />
                </div>
              </div>
            )}

            {/* ── 탭 2: 연결 설정 ── */}
            {activeTab === '연결 설정' && (
              <div className="space-y-4">
                {/* 프로토콜 선택 */}
                <div>
                  <label className={cls.label}>통신 프로토콜 <span className="text-red-400">*</span></label>
                  <div className="grid grid-cols-2 gap-2">
                    {PROTOCOLS.map(p => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => handleProtocolChange(p.value)}
                        className={cn(
                          'text-left px-3 py-2.5 rounded-lg border text-sm transition-colors',
                          form.protocol === p.value
                            ? 'border-cyan-500 bg-cyan-500/10 text-white'
                            : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                        )}
                      >
                        <div className="font-medium">{p.label}</div>
                        <div className="text-xs opacity-70 mt-0.5">{p.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 프로토콜 설명 */}
                {selectedProtocol && (
                  <div className="flex items-start gap-2 p-3 bg-slate-900/50 border border-slate-600/50 rounded-lg">
                    <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-slate-400">
                      <span className="text-cyan-400 font-medium">{selectedProtocol.label}</span> — {selectedProtocol.desc}
                    </div>
                  </div>
                )}

                {/* 동적 연결 설정 */}
                <div className="border border-slate-700/50 rounded-lg p-4 bg-slate-900/30">
                  <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                    <Network className="w-4 h-4 text-cyan-400" />
                    접속 정보
                  </h4>
                  <ConnectionConfigForm
                    protocol={form.protocol}
                    config={connConfig}
                    onChange={setConnConfig}
                  />
                </div>
              </div>
            )}

            {/* ── 탭 3: 상세 정보 ── */}
            {activeTab === '상세 정보' && (
              <div className="space-y-4">
                {/* 폴링 주기 */}
                <div>
                  <label className={cls.label}>폴링 주기 (ms)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={500} max={60000} step={500}
                      value={form.pollIntervalMs}
                      onChange={e => setForm(f => ({ ...f, pollIntervalMs: parseInt(e.target.value) }))}
                      className="flex-1 accent-cyan-500"
                    />
                    <span className="text-white text-sm w-20 text-right">
                      {form.pollIntervalMs >= 1000 ? `${form.pollIntervalMs / 1000}초` : `${form.pollIntervalMs}ms`}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">데이터 수집 주기. 기본값 5초. 너무 짧으면 네트워크 부하 증가.</p>
                </div>

                {/* 설치일 */}
                <div>
                  <label className={cls.label}>설치일</label>
                  <input type="date" className={cls.input} value={form.installationDate} onChange={e => setForm(f => ({ ...f, installationDate: e.target.value }))} />
                </div>

                {/* 제어 가능 여부 */}
                <div className="flex items-start gap-3 p-3 bg-slate-900/50 border border-slate-700/50 rounded-lg">
                  <input
                    type="checkbox"
                    id="controlCapable"
                    checked={form.controlCapable}
                    onChange={e => setForm(f => ({ ...f, controlCapable: e.target.checked }))}
                    className="w-4 h-4 mt-0.5 rounded border-slate-600 bg-slate-900 accent-cyan-500"
                  />
                  <div>
                    <label htmlFor="controlCapable" className="text-sm font-medium text-white cursor-pointer">제어 가능 설비</label>
                    <p className="text-xs text-slate-400 mt-0.5">원격 제어(ON/OFF, 설정값 변경)가 가능한 기기에 체크하세요. 설비 제어 메뉴에서 사용됩니다.</p>
                  </div>
                </div>

                {/* 요약 정보 */}
                <div className="p-4 bg-slate-900/50 border border-slate-700/30 rounded-lg space-y-2 text-sm">
                  <h4 className="text-slate-300 font-medium mb-3">등록 요약</h4>
                  {[
                    ['설비명', form.name || '-'],
                    ['사이트', sites.find(s => s.id === form.siteId)?.name || '-'],
                    ['유형', DEVICE_TYPES.find(d => d.value === form.deviceType)?.label || '-'],
                    ['프로토콜', PROTOCOLS.find(p => p.value === form.protocol)?.label || '-'],
                    ['게이트웨이', siteGateways.find(g => g.id === form.gatewayId)?.name ?? (form.gatewayId ? '선택됨' : '직접 연결')],
                    ['제어 가능', form.controlCapable ? '예' : '아니오'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2">
                      <span className="text-slate-500 w-24 shrink-0">{k}</span>
                      <span className="text-slate-300">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 flex items-center justify-between gap-3 shrink-0">
            <div className="flex gap-2">
              {activeTab !== '기본 정보' && (
                <button type="button" onClick={() => { const p = TABS[TABS.indexOf(activeTab) - 1]; if (p) setActiveTab(p); }}
                  className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors text-sm">
                  이전
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors text-sm">
                취소
              </button>
              {activeTab !== '상세 정보' ? (
                <button type="button"
                  onClick={() => { const next = TABS[TABS.indexOf(activeTab) + 1]; if (next) setActiveTab(next); }}
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors text-sm">
                  다음 <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button type="submit" disabled={isSubmitting || !form.name || !form.siteId}
                  className="flex items-center gap-2 px-6 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium">
                  {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> 등록 중...</> : '설비 등록'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── 메인 페이지 ──────────────────────────────────────────────────

// role level 비교 (viewer=0, operator=1, site_manager=2, tenant_admin=3, super_admin=4)
const ROLE_LEVELS: Record<string, number> = {
  viewer: 0, operator: 1, site_manager: 2, tenant_admin: 3, super_admin: 4,
};
function hasMinRole(userRole: string | undefined | null, minRole: string): boolean {
  return (ROLE_LEVELS[userRole ?? ''] ?? -1) >= (ROLE_LEVELS[minRole] ?? 99);
}

function DevicesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSiteId = searchParams.get('siteId');
  const { data: session } = useSession();
  const canInstallCollector = hasMinRole(session?.user?.role as string, 'site_manager');

  const [devices, setDevices] = useState<Device[]>([]);
  const [sites, setSites] = useState<{ id: string; name: string }[]>([]);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterSiteId, setFilterSiteId] = useState<string | null>(initialSiteId);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  // 수집기 다운로드 모달
  const [dlGateway, setDlGateway] = useState<Gateway | null>(null);
  const [showGwPicker, setShowGwPicker] = useState(false);

  const fetchSites = useCallback(async () => {
    try {
      // /api/sites → successResponse(sites[]) → apiGet returns res.data = Site[]
      const res = await apiGet<{ id: string; name: string }[]>('/api/sites?take=100');
      if (res.success) setSites(Array.isArray(res.data) ? res.data : []);
    } catch { setSites([]); }
  }, []);

  const fetchGateways = useCallback(async () => {
    try {
      // /api/gateways → successResponse({ gateways }) → res.data = { gateways: Gateway[] }
      const res = await apiGet<{ gateways: Gateway[] }>('/api/gateways?take=100');
      if (res.success && res.data) setGateways(res.data.gateways ?? []);
    } catch { setGateways([]); }
  }, []);

  const fetchDevices = useCallback(async (cursor?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ take: '20' });
      if (cursor) params.set('cursor', cursor);
      if (filterSiteId) params.set('siteId', filterSiteId);
      // /api/devices → successResponse(devices[], { meta: { nextCursor, pageSize } })
      // apiRequest spreads the JSON body → res.data = Device[], res.meta = { nextCursor, pageSize }
      const res = await apiGet<Device[]>(`/api/devices?${params}`);
      if (!res.success) throw new Error(res.error ?? '설비 목록을 불러올 수 없습니다.');
      const devices = Array.isArray(res.data) ? res.data : [];
      const nc = (res.meta?.nextCursor as string | null) ?? null;
      setDevices(prev => cursor ? [...prev, ...devices] : devices);
      setNextCursor(nc);
    } catch (err) {
      setError(err instanceof Error ? err.message : '설비 목록을 불러올 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [filterSiteId]);

  useEffect(() => { fetchSites(); fetchGateways(); }, [fetchSites, fetchGateways]);
  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  const handleDelete = async (device: Device) => {
    const res = await apiDelete(`/api/devices/${device.id}`);
    if (!res.success) { toast.error(res.error ?? '삭제에 실패했습니다.'); return; }
    toast.success('설비가 삭제되었습니다.');
    setShowDeleteConfirm(false);
    setSelectedDevice(null);
    fetchDevices();
  };

  const filteredDevices = devices.filter(d => {
    if (searchQuery && !d.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterStatus && d.status !== filterStatus) return false;
    if (filterType && d.deviceType !== filterType) return false;
    return true;
  });

  const stats = {
    total: devices.length,
    online: devices.filter(d => d.status === 'online').length,
    offline: devices.filter(d => d.status === 'offline').length,
    error: devices.filter(d => d.status === 'error').length,
  };

  // Group device types for filter dropdown
  const typeGroups = DEVICE_TYPES.reduce<Record<string, typeof DEVICE_TYPES>>((acc, t) => {
    (acc[t.group] ??= []).push(t);
    return acc;
  }, {});

  return (
    <div className="h-full bg-[#051225] p-4 md:p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg"><Zap className="w-6 h-6 text-cyan-400" /></div>
            설비 관리
          </h1>
          <p className="text-slate-400 text-sm mt-1">IoT 기기·계량기·제어기를 등록하고 모니터링합니다.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/settings/gateways" className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors">
            <Server className="w-4 h-4" /> 게이트웨이 관리
          </Link>
          {canInstallCollector && (
            <button
              onClick={() => {
                if (gateways.length === 0) { toast.error('게이트웨이를 먼저 등록하세요.'); return; }
                if (gateways.length === 1) { setDlGateway(gateways[0] ?? null); return; }
                setShowGwPicker(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm transition-colors font-medium"
              title="수집기를 설치하면 플랫폼에 등록된 설비 설정이 자동으로 내려갑니다 (OTA)">
              <Download className="w-4 h-4" /> 수집기 설치
            </button>
          )}
          <button onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium transition-colors">
            <Plus className="w-5 h-5" /> 설비 등록
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: '총 설비', value: stats.total, color: 'text-white' },
          { label: '온라인', value: stats.online, color: 'text-emerald-400' },
          { label: '오프라인', value: stats.offline, color: 'text-slate-400' },
          { label: '오류', value: stats.error, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
            <p className="text-slate-400 text-sm mb-1">{s.label}</p>
            <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="설비명 검색..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50" />
        </div>
        <select value={filterSiteId ?? ''} onChange={e => setFilterSiteId(e.target.value || null)}
          className="px-3 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50">
          <option value="">전체 사이트</option>
          {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filterStatus ?? ''} onChange={e => setFilterStatus(e.target.value || null)}
          className="px-3 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50">
          <option value="">전체 상태</option>
          {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterType ?? ''} onChange={e => setFilterType(e.target.value || null)}
          className="px-3 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50">
          <option value="">전체 유형</option>
          {Object.entries(typeGroups).map(([group, types]) => (
            <optgroup key={group} label={group}>
              {types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </optgroup>
          ))}
        </select>
        <button onClick={() => fetchDevices()} disabled={isLoading}
          className="p-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors disabled:opacity-50">
          <RefreshCw className={cn('w-5 h-5', isLoading && 'animate-spin')} />
        </button>
      </div>

      {/* Content */}
      {isLoading && devices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
          <p className="text-slate-400">설비 목록을 불러오는 중...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20">
          <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={() => fetchDevices()} className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors">다시 시도</button>
        </div>
      ) : filteredDevices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Zap className="w-16 h-16 text-slate-600 mb-4" />
          <h3 className="text-xl font-semibold text-slate-300 mb-2">
            {searchQuery || filterStatus || filterType || filterSiteId ? '검색 결과가 없습니다' : '등록된 설비가 없습니다'}
          </h3>
          <p className="text-slate-400 mb-6 text-center">
            {searchQuery || filterStatus || filterType || filterSiteId
              ? '다른 검색어나 필터를 사용해 보세요.'
              : '설비 등록 버튼을 클릭하여 IoT 기기·계량기·제어기를 등록하세요.'}
          </p>
          {!searchQuery && !filterStatus && !filterType && (
            <button onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium transition-colors">
              <Plus className="w-5 h-5" /> 첫 번째 설비 등록
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">설비명</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">유형 / 프로토콜</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">상태</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase hidden lg:table-cell">마지막 통신</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDevices.map(device => {
                    const typeConf = deviceTypeMap[device.deviceType] ?? { label: '기타', icon: Settings, color: 'text-slate-400', bg: 'bg-slate-500/10' };
                    const TypeIcon = typeConf.icon;
                    const sc = statusConfig[device.status as keyof typeof statusConfig] ?? { label: '알 수 없음', color: 'text-slate-400', bg: 'bg-slate-500/10', icon: AlertCircle };
                    const StatusIcon = sc.icon;
                    const proto = PROTOCOLS.find(p => p.value === device.protocol);

                    return (
                      <tr key={device.id} className="border-b border-slate-700/30 hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-4">
                          <Link href={`/devices/${device.id}`} className="flex items-center gap-3 group">
                            <div className={cn('p-2 rounded-lg shrink-0', typeConf.bg)}>
                              <TypeIcon className={cn('w-4 h-4', typeConf.color)} />
                            </div>
                            <div>
                              <p className="text-white font-medium text-sm group-hover:text-cyan-400 transition-colors">{device.name}</p>
                              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                                {device.site && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{device.site.name}</span>}
                                {device.location && <span>· {device.location}</span>}
                              </div>
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-4">
                          <div>
                            <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', typeConf.bg, typeConf.color)}>
                              {typeConf.label}
                            </span>
                            {proto && <p className="text-xs text-slate-500 mt-1">{proto.label}</p>}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={cn('inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium', sc.bg, sc.color)}>
                            <StatusIcon className="w-3.5 h-3.5" />
                            {sc.label}
                          </span>
                          {device.controlCapable && (
                            <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 bg-purple-500/10 text-purple-400 rounded text-xs">제어</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-400 hidden lg:table-cell">
                          {device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString('ko-KR') : '-'}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="relative inline-block">
                            <button onClick={() => setActionMenuId(actionMenuId === device.id ? null : device.id)}
                              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            {actionMenuId === device.id && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setActionMenuId(null)} />
                                <div className="absolute right-0 mt-1 w-44 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
                                  <Link href={`/devices/${device.id}`} onClick={() => setActionMenuId(null)}
                                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 transition-colors">
                                    <Eye className="w-4 h-4" /> 상세 보기
                                  </Link>
                                  <Link href={`/monitoring?deviceId=${device.id}`} onClick={() => setActionMenuId(null)}
                                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 transition-colors">
                                    <Activity className="w-4 h-4" /> 모니터링
                                  </Link>
                                  <button onClick={() => { router.push(`/devices/${device.id}`); setActionMenuId(null); }}
                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 transition-colors">
                                    <Edit className="w-4 h-4" /> 수정
                                  </button>
                                  {canInstallCollector && device.gatewayId && device.gateway && (
                                    <button
                                      onClick={() => {
                                        setDlGateway(device.gateway as Gateway);
                                        setActionMenuId(null);
                                      }}
                                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-emerald-400 hover:bg-emerald-500/10 transition-colors">
                                      <Download className="w-4 h-4" /> 수집기 설치
                                    </button>
                                  )}
                                  <button onClick={() => { setSelectedDevice(device); setShowDeleteConfirm(true); setActionMenuId(null); }}
                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors">
                                    <Trash2 className="w-4 h-4" /> 삭제
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {nextCursor && (
            <div className="flex justify-center mt-6">
              <button onClick={() => fetchDevices(nextCursor)} disabled={isLoading}
                className="px-6 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50">
                {isLoading ? '불러오는 중...' : '더 보기'}
              </button>
            </div>
          )}
        </>
      )}

      {/* 등록 모달 */}
      {showCreateModal && (
        <DeviceCreateModal
          sites={sites}
          gateways={gateways}
          defaultSiteId={filterSiteId}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); fetchDevices(); }}
        />
      )}

      {/* 수집기 다운로드 — 게이트웨이 선택 (여러 개인 경우) */}
      {showGwPicker && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-sm w-full p-6">
            <h3 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
              <Download className="w-4 h-4 text-emerald-400" /> 게이트웨이 선택
            </h3>
            <p className="text-slate-400 text-sm mb-4">설치 파일을 생성할 게이트웨이를 선택하세요.</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {gateways.map(gw => (
                <button key={gw.id} onClick={() => { setDlGateway(gw); setShowGwPicker(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-slate-700 hover:bg-emerald-600/20 border border-slate-600 hover:border-emerald-500 text-left rounded-lg transition-colors group">
                  <Server className="w-4 h-4 text-slate-400 group-hover:text-emerald-400" />
                  <div>
                    <div className="text-sm font-medium text-white">{gw.name ?? gw.serialNumber}</div>
                    <div className="text-xs text-slate-500 font-mono">{gw.id}</div>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setShowGwPicker(false)}
              className="mt-4 w-full px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-600 rounded-lg hover:border-slate-500 transition">
              취소
            </button>
          </div>
        </div>
      )}

      {/* 수집기 다운로드 모달 */}
      {dlGateway && (
        <CollectorDownloadModal gateway={dlGateway} onClose={() => setDlGateway(null)} />
      )}

      {/* 삭제 확인 */}
      {showDeleteConfirm && selectedDevice && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-white mb-2">설비 삭제</h3>
            <p className="text-slate-400 mb-6">
              <span className="text-white font-medium">{selectedDevice.name}</span> 설비를 삭제하시겠습니까?
              <br /><span className="text-sm text-red-400 mt-1 block">연결된 센서·메트릭 데이터도 함께 삭제됩니다.</span>
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowDeleteConfirm(false); setSelectedDevice(null); }}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors">취소</button>
              <button onClick={() => handleDelete(selectedDevice)}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DevicesPageLoading() {
  return (
    <div className="h-full bg-[#051225] flex items-center justify-center">
      <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
    </div>
  );
}

export default function DevicesPage() {
  return (
    <Suspense fallback={<DevicesPageLoading />}>
      <DevicesPageContent />
    </Suspense>
  );
}
