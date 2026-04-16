'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Router,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  Wifi,
  WifiOff,
  AlertTriangle,
  Loader2,
  X,
  Save,
  ChevronDown,
  Activity,
  Server,
  Network,
  HardDrive,
  Download,
  Monitor,
  Container,
  Terminal,
  Copy,
  Check,
} from 'lucide-react';
import { apiPost, apiPut, apiDelete } from '@/lib/api/client';
import { toast } from '@/lib/toast';

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

interface Site {
  id: string;
  name: string;
  city: string | null;
}

interface Gateway {
  id: string;
  serialNumber: string;
  name: string | null;
  model: string | null;
  firmwareVersion: string | null;
  ipAddress: string | null;
  macAddress: string | null;
  vpnAddress: string | null;
  primaryConnection: 'ethernet' | 'lte' | 'wifi';
  fallbackConnection: 'lte' | 'wifi' | 'none';
  status: 'online' | 'offline' | 'warning' | 'error';
  lastSeenAt: string | null;
  lastHeartbeatAt: string | null;
  bufferSizeMb: number;
  bufferedRecords: number;
  ownership: 'company' | 'customer';
  installationDate: string | null;
  createdAt: string;
  site: Site;
  _count: { devices: number };
}

type GatewayFormData = {
  siteId: string;
  serialNumber: string;
  name: string;
  model: string;
  firmwareVersion: string;
  ipAddress: string;
  macAddress: string;
  vpnAddress: string;
  primaryConnection: 'ethernet' | 'lte' | 'wifi';
  fallbackConnection: 'lte' | 'wifi' | 'none';
  bufferSizeMb: number;
  ownership: 'company' | 'customer';
  installationDate: string;
};

const EMPTY_FORM: GatewayFormData = {
  siteId: '',
  serialNumber: '',
  name: '',
  model: '',
  firmwareVersion: '',
  ipAddress: '',
  macAddress: '',
  vpnAddress: '',
  primaryConnection: 'ethernet',
  fallbackConnection: 'lte',
  bufferSizeMb: 100,
  ownership: 'company',
  installationDate: '',
};

// ──────────────────────────────────────────────────────────────
// Status helpers
// ──────────────────────────────────────────────────────────────

const statusConfig = {
  online: { label: '온라인', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', dot: 'bg-emerald-400', Icon: Wifi },
  warning: { label: '경고', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', dot: 'bg-yellow-400', Icon: AlertTriangle },
  offline: { label: '오프라인', color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/30', dot: 'bg-slate-400', Icon: WifiOff },
  error: { label: '오류', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', dot: 'bg-red-400', Icon: AlertTriangle },
};

const connLabel: Record<string, string> = {
  ethernet: '유선',
  lte: 'LTE',
  wifi: 'Wi-Fi',
  none: '없음',
};

// ──────────────────────────────────────────────────────────────
// Modal
// ──────────────────────────────────────────────────────────────

function GatewayModal({
  mode,
  gateway,
  sites,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit';
  gateway?: Gateway;
  sites: Site[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<GatewayFormData>(() => {
    if (mode === 'edit' && gateway) {
      const init: GatewayFormData = {
        siteId: gateway.site.id,
        serialNumber: gateway.serialNumber,
        name: gateway.name ?? '',
        model: gateway.model ?? '',
        firmwareVersion: gateway.firmwareVersion ?? '',
        ipAddress: gateway.ipAddress ?? '',
        macAddress: gateway.macAddress ?? '',
        vpnAddress: gateway.vpnAddress ?? '',
        primaryConnection: gateway.primaryConnection,
        fallbackConnection: gateway.fallbackConnection,
        bufferSizeMb: gateway.bufferSizeMb,
        ownership: gateway.ownership,
        installationDate: gateway.installationDate
          ? gateway.installationDate.split('T')[0]!
          : '',
      };
      return init;
    }
    return { ...EMPTY_FORM, siteId: sites[0]?.id ?? '' };
  });
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showProtocol, setShowProtocol] = useState(false);

  // ── 프로토콜 설정 (Gateway.config JSON) ─────────────────────
  type ProtocolType = 'none' | 'modbus_tcp' | 'modbus_rtu' | 'bacnet' | 'opcua' | 'mqtt' | 'http';
  const [protocol, setProtocol] = useState<ProtocolType>(() => {
    if (mode === 'edit' && gateway) {
      const cfg = gateway as unknown as { config?: { protocol?: string } };
      return (cfg.config?.protocol as ProtocolType) ?? 'none';
    }
    return 'none';
  });

  const initProtoConfig = () => {
    if (mode === 'edit' && gateway) {
      const cfg = gateway as unknown as { config?: Record<string, unknown> };
      return cfg.config ?? {};
    }
    return {};
  };
  const [protoCfg, setProtoCfg] = useState<Record<string, unknown>>(initProtoConfig);
  const setP = (k: string, v: unknown) => setProtoCfg((p) => ({ ...p, [k]: v }));

  const set = (k: keyof GatewayFormData, v: unknown) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.siteId) { toast.error('사이트를 선택하세요.'); return; }
    if (!form.serialNumber) { toast.error('시리얼 번호를 입력하세요.'); return; }

    setSaving(true);
    try {
      const url = mode === 'edit' ? `/api/gateways/${gateway!.id}` : '/api/gateways';
      const configPayload = protocol !== 'none'
        ? { ...protoCfg, protocol }
        : null;

      const payload = {
        ...form,
        name: form.name || undefined,
        model: form.model || undefined,
        firmwareVersion: form.firmwareVersion || undefined,
        ipAddress: form.ipAddress || undefined,
        macAddress: form.macAddress || undefined,
        vpnAddress: form.vpnAddress || undefined,
        installationDate: form.installationDate || undefined,
        config: configPayload,
      };
      const res = mode === 'edit'
        ? await apiPut(url, payload)
        : await apiPost(url, payload);
      if (res.success) {
        toast.success(mode === 'create' ? '게이트웨이가 등록되었습니다.' : '게이트웨이가 수정되었습니다.');
        onSaved();
        onClose();
      } else {
        toast.error('저장에 실패했습니다.');
      }
    } catch {
      toast.error('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Router className="w-5 h-5 text-cyan-400" />
            {mode === 'create' ? '게이트웨이 등록' : '게이트웨이 수정'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* 기본 정보 */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">기본 정보</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">사이트 <span className="text-red-400">*</span></label>
                <select
                  value={form.siteId}
                  onChange={(e) => set('siteId', e.target.value)}
                  disabled={mode === 'edit'}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white disabled:opacity-50"
                >
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} {s.city ? `(${s.city})` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">시리얼 번호 <span className="text-red-400">*</span></label>
                <input
                  value={form.serialNumber}
                  onChange={(e) => set('serialNumber', e.target.value)}
                  disabled={mode === 'edit'}
                  placeholder="GW-2024-001"
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">이름</label>
                <input
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="1층 로비 게이트웨이"
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">모델명</label>
                <input
                  value={form.model}
                  onChange={(e) => set('model', e.target.value)}
                  placeholder="TI-GW-4000"
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500"
                />
              </div>
            </div>
          </div>

          {/* 통신 설정 */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">통신 설정</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">주 통신</label>
                <select
                  value={form.primaryConnection}
                  onChange={(e) => set('primaryConnection', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value="ethernet">유선 (이더넷)</option>
                  <option value="wifi">Wi-Fi</option>
                  <option value="lte">LTE</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">보조 통신</label>
                <select
                  value={form.fallbackConnection}
                  onChange={(e) => set('fallbackConnection', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value="lte">LTE</option>
                  <option value="wifi">Wi-Fi</option>
                  <option value="none">없음</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">버퍼 크기 (MB)</label>
                <input
                  type="number"
                  value={form.bufferSizeMb}
                  onChange={(e) => set('bufferSizeMb', parseInt(e.target.value) || 100)}
                  min={1}
                  max={10240}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>
            </div>
          </div>

          {/* 데이터 수집 프로토콜 (접기/펼치기) */}
          <div>
            <button
              type="button"
              onClick={() => setShowProtocol(!showProtocol)}
              className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-emerald-400 transition"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${showProtocol ? 'rotate-180' : ''}`} />
              데이터 수집 프로토콜
              {protocol !== 'none' && (
                <span className="ml-1 px-2 py-0.5 text-[10px] rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {protocol.toUpperCase().replace('_', ' ')}
                </span>
              )}
            </button>
            {showProtocol && (
              <div className="mt-3 space-y-4">
                {/* 프로토콜 선택 */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">프로토콜</label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { v: 'none',       label: '미설정',      desc: '프로토콜 없음' },
                      { v: 'modbus_tcp', label: 'Modbus TCP',  desc: '산업용 PLC (이더넷)' },
                      { v: 'modbus_rtu', label: 'Modbus RTU',  desc: '산업용 PLC (RS-485)' },
                      { v: 'bacnet',     label: 'BACnet/IP',   desc: '빌딩 자동화' },
                      { v: 'opcua',      label: 'OPC-UA',      desc: '스마트 팩토리' },
                      { v: 'mqtt',       label: 'MQTT',        desc: 'IoT 메시지 브로커' },
                      { v: 'http',       label: 'HTTP REST',   desc: 'REST API 폴링' },
                    ] as const).map((p) => (
                      <button
                        key={p.v}
                        type="button"
                        onClick={() => setProtocol(p.v as ProtocolType)}
                        className={`text-left px-3 py-2 rounded-lg border text-xs transition ${
                          protocol === p.v
                            ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                            : 'border-slate-600 text-slate-400 hover:border-slate-500'
                        }`}
                      >
                        <div className="font-semibold">{p.label}</div>
                        <div className="text-[10px] opacity-70">{p.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Modbus TCP 설정 */}
                {protocol === 'modbus_tcp' && (
                  <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg space-y-3">
                    <div className="text-xs font-semibold text-blue-400 mb-2">Modbus TCP 설정</div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">PLC IP 주소</label>
                        <input
                          value={(protoCfg.host as string) ?? ''}
                          onChange={(e) => setP('host', e.target.value)}
                          placeholder="192.168.1.100"
                          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white placeholder-slate-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">포트</label>
                        <input
                          type="number"
                          value={(protoCfg.port as number) ?? 502}
                          onChange={(e) => setP('port', parseInt(e.target.value) || 502)}
                          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Unit ID (Slave)</label>
                        <input
                          type="number"
                          value={(protoCfg.unitId as number) ?? 1}
                          onChange={(e) => setP('unitId', parseInt(e.target.value) || 1)}
                          min={1} max={247}
                          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">수집 주기 (ms)</label>
                        <input
                          type="number"
                          value={(protoCfg.pollIntervalMs as number) ?? 5000}
                          onChange={(e) => setP('pollIntervalMs', parseInt(e.target.value) || 5000)}
                          min={500}
                          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">타임아웃 (ms)</label>
                        <input
                          type="number"
                          value={(protoCfg.timeout as number) ?? 3000}
                          onChange={(e) => setP('timeout', parseInt(e.target.value) || 3000)}
                          min={500}
                          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Modbus RTU 설정 */}
                {protocol === 'modbus_rtu' && (
                  <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg space-y-3">
                    <div className="text-xs font-semibold text-blue-400 mb-2">Modbus RTU 설정 (RS-485)</div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">시리얼 포트</label>
                        <input
                          value={(protoCfg.serialPort as string) ?? ''}
                          onChange={(e) => setP('serialPort', e.target.value)}
                          placeholder="/dev/ttyS0 or COM3"
                          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white placeholder-slate-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">보드레이트</label>
                        <select
                          value={(protoCfg.baudRate as number) ?? 9600}
                          onChange={(e) => setP('baudRate', parseInt(e.target.value))}
                          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white"
                        >
                          {[9600, 19200, 38400, 57600, 115200].map((b) => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">패리티</label>
                        <select
                          value={(protoCfg.parity as string) ?? 'none'}
                          onChange={(e) => setP('parity', e.target.value)}
                          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white"
                        >
                          <option value="none">None</option>
                          <option value="even">Even</option>
                          <option value="odd">Odd</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Unit ID</label>
                        <input
                          type="number"
                          value={(protoCfg.unitId as number) ?? 1}
                          onChange={(e) => setP('unitId', parseInt(e.target.value) || 1)}
                          min={1} max={247}
                          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">수집 주기 (ms)</label>
                        <input
                          type="number"
                          value={(protoCfg.pollIntervalMs as number) ?? 5000}
                          onChange={(e) => setP('pollIntervalMs', parseInt(e.target.value) || 5000)}
                          min={500}
                          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* BACnet/IP 설정 */}
                {protocol === 'bacnet' && (
                  <div className="p-3 bg-purple-500/5 border border-purple-500/20 rounded-lg space-y-3">
                    <div className="text-xs font-semibold text-purple-400 mb-2">BACnet/IP 설정</div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">장치 IP</label>
                        <input
                          value={(protoCfg.deviceAddress as string) ?? ''}
                          onChange={(e) => setP('deviceAddress', e.target.value)}
                          placeholder="192.168.1.200"
                          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white placeholder-slate-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Device ID</label>
                        <input
                          type="number"
                          value={(protoCfg.deviceId as number) ?? 1}
                          onChange={(e) => setP('deviceId', parseInt(e.target.value) || 1)}
                          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">포트</label>
                        <input
                          type="number"
                          value={(protoCfg.port as number) ?? 47808}
                          onChange={(e) => setP('port', parseInt(e.target.value) || 47808)}
                          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">수집 주기 (ms)</label>
                        <input
                          type="number"
                          value={(protoCfg.pollIntervalMs as number) ?? 10000}
                          onChange={(e) => setP('pollIntervalMs', parseInt(e.target.value) || 10000)}
                          min={1000}
                          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* OPC-UA 설정 */}
                {protocol === 'opcua' && (
                  <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg space-y-3">
                    <div className="text-xs font-semibold text-emerald-400 mb-2">OPC-UA 설정</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="block text-xs text-slate-400 mb-1">엔드포인트 URL</label>
                        <input
                          value={(protoCfg.endpoint as string) ?? ''}
                          onChange={(e) => setP('endpoint', e.target.value)}
                          placeholder="opc.tcp://192.168.1.100:4840"
                          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white placeholder-slate-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">보안 모드</label>
                        <select
                          value={(protoCfg.securityMode as string) ?? 'None'}
                          onChange={(e) => setP('securityMode', e.target.value)}
                          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white"
                        >
                          <option value="None">None</option>
                          <option value="Sign">Sign</option>
                          <option value="SignAndEncrypt">Sign + Encrypt</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">구독 주기 (ms)</label>
                        <input
                          type="number"
                          value={(protoCfg.subscriptionIntervalMs as number) ?? 1000}
                          onChange={(e) => setP('subscriptionIntervalMs', parseInt(e.target.value) || 1000)}
                          min={100}
                          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">사용자명 (선택)</label>
                        <input
                          value={(protoCfg.username as string) ?? ''}
                          onChange={(e) => setP('username', e.target.value)}
                          placeholder="admin"
                          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white placeholder-slate-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">비밀번호 (선택)</label>
                        <input
                          type="password"
                          value={(protoCfg.password as string) ?? ''}
                          onChange={(e) => setP('password', e.target.value)}
                          placeholder="••••••"
                          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white placeholder-slate-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* MQTT 설정 */}
                {protocol === 'mqtt' && (
                  <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg space-y-3">
                    <div className="text-xs font-semibold text-amber-400 mb-2">MQTT 설정</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="block text-xs text-slate-400 mb-1">브로커 URL</label>
                        <input
                          value={(protoCfg.brokerUrl as string) ?? ''}
                          onChange={(e) => setP('brokerUrl', e.target.value)}
                          placeholder="mqtt://broker.example.com:1883"
                          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white placeholder-slate-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">토픽 패턴</label>
                        <input
                          value={(protoCfg.topicPattern as string) ?? 'ems/{tenantId}/{sensorCode}/data'}
                          onChange={(e) => setP('topicPattern', e.target.value)}
                          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">QoS</label>
                        <select
                          value={(protoCfg.qos as number) ?? 1}
                          onChange={(e) => setP('qos', parseInt(e.target.value))}
                          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white"
                        >
                          <option value={0}>QoS 0 — 최대 1회</option>
                          <option value={1}>QoS 1 — 최소 1회 (권장)</option>
                          <option value={2}>QoS 2 — 정확히 1회</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">발행 주기 (ms)</label>
                        <input
                          type="number"
                          value={(protoCfg.publishIntervalMs as number) ?? 5000}
                          onChange={(e) => setP('publishIntervalMs', parseInt(e.target.value) || 5000)}
                          min={500}
                          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* HTTP REST 설정 */}
                {protocol === 'http' && (
                  <div className="p-3 bg-slate-500/5 border border-slate-500/20 rounded-lg space-y-3">
                    <div className="text-xs font-semibold text-slate-300 mb-2">HTTP REST 설정</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="block text-xs text-slate-400 mb-1">현장 서버 URL</label>
                        <input
                          value={(protoCfg.baseUrl as string) ?? ''}
                          onChange={(e) => setP('baseUrl', e.target.value)}
                          placeholder="http://192.168.1.100:8080"
                          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white placeholder-slate-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">수집 주기 (ms)</label>
                        <input
                          type="number"
                          value={(protoCfg.pollIntervalMs as number) ?? 30000}
                          onChange={(e) => setP('pollIntervalMs', parseInt(e.target.value) || 30000)}
                          min={5000}
                          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">타임아웃 (ms)</label>
                        <input
                          type="number"
                          value={(protoCfg.timeout as number) ?? 5000}
                          onChange={(e) => setP('timeout', parseInt(e.target.value) || 5000)}
                          min={1000}
                          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 고급 설정 (접기/펼치기) */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-cyan-400 transition"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
              고급 설정
            </button>
            {showAdvanced && (
              <div className="mt-3 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">IP 주소</label>
                  <input
                    value={form.ipAddress}
                    onChange={(e) => set('ipAddress', e.target.value)}
                    placeholder="192.168.1.100"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">MAC 주소</label>
                  <input
                    value={form.macAddress}
                    onChange={(e) => set('macAddress', e.target.value)}
                    placeholder="AA:BB:CC:DD:EE:FF"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">VPN 주소</label>
                  <input
                    value={form.vpnAddress}
                    onChange={(e) => set('vpnAddress', e.target.value)}
                    placeholder="10.0.0.100"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">펌웨어 버전</label>
                  <input
                    value={form.firmwareVersion}
                    onChange={(e) => set('firmwareVersion', e.target.value)}
                    placeholder="v2.4.1"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">소유 구분</label>
                  <select
                    value={form.ownership}
                    onChange={(e) => set('ownership', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="company">자사</option>
                    <option value="customer">고객사</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">설치일</label>
                  <input
                    type="date"
                    value={form.installationDate}
                    onChange={(e) => set('installationDate', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-300 hover:text-white border border-slate-600 rounded-lg hover:border-slate-500 transition"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-sm bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {mode === 'create' ? '등록' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Collector Download Modal
// ──────────────────────────────────────────────────────────────

function CollectorDownloadModal({ gateway, onClose }: { gateway: Gateway; onClose: () => void }) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const gwName = gateway.name ?? gateway.serialNumber;

  const handleDownload = async (type: 'windows' | 'docker' | 'linux') => {
    setDownloading(type);
    try {
      const res = await fetch(`/api/gateways/${gateway.id}/installer-config?type=${type}`);
      if (!res.ok) { toast.error('다운로드 실패'); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const cd   = res.headers.get('content-disposition') ?? '';
      const name = cd.match(/filename="(.+?)"/)?.[1]
        ?? (type === 'windows' ? `collector-config-${gateway.id}.yaml`
          : type === 'docker'  ? `docker-compose-${gateway.id}.yml`
          : `install-${gateway.id}.sh`);
      a.href = url; a.download = name; a.click();
      URL.revokeObjectURL(url);
      toast.success('다운로드 완료');
    } catch {
      toast.error('다운로드 중 오류가 발생했습니다.');
    } finally {
      setDownloading(null);
    }
  };

  const linuxOneLiner = `curl -sSL "${window.location.origin}/api/gateways/${gateway.id}/installer-config?type=linux" | bash`;

  const copyOneLiner = () => {
    navigator.clipboard.writeText(linuxOneLiner);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Download className="w-5 h-5 text-cyan-400" />
              수집기 다운로드
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{gwName} · {gateway.id}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-3">
          <p className="text-sm text-slate-300 mb-4">
            아래에서 환경에 맞는 방법을 선택하세요. 인증 정보가 자동으로 포함된 파일이 다운로드됩니다.
          </p>

          {/* Windows EXE */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Monitor className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">Windows (현장 PC)</div>
                  <div className="text-xs text-slate-400 mt-0.5">config.yaml 다운로드 → EXE와 같은 폴더에 배치 후 실행</div>
                </div>
              </div>
              <button
                onClick={() => handleDownload('windows')}
                disabled={!!downloading}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg font-medium transition disabled:opacity-50"
              >
                {downloading === 'windows' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                config.yaml
              </button>
            </div>
            <div className="mt-3 bg-slate-900/60 rounded-lg px-3 py-2 text-xs text-slate-400">
              <span className="text-slate-500">1.</span> <a href="https://github.com/tansoeum/collector/releases/latest" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">GitHub Releases</a>에서 EXE 다운로드
              <br /><span className="text-slate-500">2.</span> config.yaml 같은 폴더에 배치
              <br /><span className="text-slate-500">3.</span> TansoEum-Collector.exe 실행
            </div>
          </div>

          {/* Docker */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-500/10 rounded-lg">
                  <Container className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">Docker (Linux 서버)</div>
                  <div className="text-xs text-slate-400 mt-0.5">docker-compose.yml 다운로드 → docker compose up -d</div>
                </div>
              </div>
              <button
                onClick={() => handleDownload('docker')}
                disabled={!!downloading}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs rounded-lg font-medium transition disabled:opacity-50"
              >
                {downloading === 'docker' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                compose.yml
              </button>
            </div>
            <div className="mt-3 bg-slate-900/60 rounded-lg px-3 py-2 font-mono text-xs text-emerald-400">
              docker compose up -d
            </div>
          </div>

          {/* Linux 원클릭 */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Terminal className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">Linux 원클릭 설치</div>
                <div className="text-xs text-slate-400 mt-0.5">서버 터미널에서 아래 명령어 실행 (Docker 자동 설치 포함)</div>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-slate-900/80 rounded-lg px-3 py-2.5">
              <code className="flex-1 text-xs text-emerald-400 font-mono break-all">
                curl -sSL &quot;…/installer-config?type=linux&quot; | bash
              </code>
              <button
                onClick={copyOneLiner}
                className="shrink-0 p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-700 transition"
                title="복사"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <p className="text-xs text-amber-400/70 flex items-center gap-1.5 pt-1">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            다운로드 파일에는 인증 토큰이 포함됩니다. 외부 공유하지 마세요.
          </p>
        </div>

        <div className="px-6 py-4 border-t border-slate-700 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-300 hover:text-white border border-slate-600 rounded-lg hover:border-slate-500 transition">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────────

export default function GatewaysPage() {
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; gateway?: Gateway } | null>(null);
  const [downloadGw, setDownloadGw] = useState<Gateway | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const LIMIT = 20;

  const fetchGateways = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        ...(search ? { search } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      });
      const res = await fetch(`/api/gateways?${params}`);
      const json = await res.json();
      if (json.success) {
        setGateways(json.data.gateways);
        setTotal(json.pagination?.total ?? 0);
      }
    } catch {
      toast.error('게이트웨이 목록을 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [page, search, statusFilter]);

  const fetchSites = useCallback(async () => {
    try {
      const res = await fetch('/api/sites');
      const json = await res.json();
      if (json.success) setSites(Array.isArray(json.data) ? json.data : (json.data?.sites ?? []));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchGateways();
  }, [fetchGateways]);

  useEffect(() => {
    fetchSites();
  }, [fetchSites]);

  const handleDelete = async (gw: Gateway) => {
    if (!confirm(`"${gw.name ?? gw.serialNumber}" 게이트웨이를 삭제하시겠습니까?\n연결된 ${gw._count.devices}개 장치의 게이트웨이 연결이 해제됩니다.`)) return;
    setDeleting(gw.id);
    try {
      const res = await apiDelete(`/api/gateways/${gw.id}`);
      if (res.success) {
        toast.success('게이트웨이가 삭제되었습니다.');
        fetchGateways();
      } else {
        toast.error('삭제에 실패했습니다.');
      }
    } catch {
      toast.error('삭제 중 오류가 발생했습니다.');
    } finally {
      setDeleting(null);
    }
  };

  const onlineCount = gateways.filter((g) => g.status === 'online').length;

  return (
    <div className="h-full bg-[#051225] text-white p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg">
              <Router className="w-6 h-6 text-cyan-400" />
            </div>
            게이트웨이 관리
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            현장 IoT 게이트웨이 등록 및 상태 모니터링
          </p>
        </div>
        <button
          onClick={() => setModal({ mode: 'create' })}
          className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 rounded-lg text-sm font-medium transition"
        >
          <Plus className="w-4 h-4" />
          게이트웨이 등록
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: '전체', value: total, icon: Server, color: 'text-cyan-400' },
          { label: '온라인', value: gateways.filter(g => g.status === 'online').length, icon: Activity, color: 'text-emerald-400' },
          { label: '오프라인', value: gateways.filter(g => g.status === 'offline').length, icon: WifiOff, color: 'text-slate-400' },
          { label: '연결 장치', value: gateways.reduce((s, g) => s + g._count.devices, 0), icon: Network, color: 'text-purple-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <Icon className={`w-4 h-4 ${color}`} />
              {label}
            </div>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="시리얼, 이름, IP로 검색..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white"
        >
          <option value="">전체 상태</option>
          <option value="online">온라인</option>
          <option value="offline">오프라인</option>
          <option value="warning">경고</option>
          <option value="error">오류</option>
        </select>
        <button
          onClick={fetchGateways}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </div>

      {/* Table */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>
        ) : gateways.length === 0 ? (
          <div className="text-center py-20">
            <Router className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">등록된 게이트웨이가 없습니다.</p>
            <button
              onClick={() => setModal({ mode: 'create' })}
              className="mt-4 text-sm text-cyan-400 hover:text-cyan-300"
            >
              첫 게이트웨이 등록하기
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-xs text-slate-400">
                  <th className="text-left px-4 py-3 font-medium">상태</th>
                  <th className="text-left px-4 py-3 font-medium">게이트웨이</th>
                  <th className="text-left px-4 py-3 font-medium">사이트</th>
                  <th className="text-left px-4 py-3 font-medium">통신</th>
                  <th className="text-left px-4 py-3 font-medium">네트워크</th>
                  <th className="text-left px-4 py-3 font-medium">장치</th>
                  <th className="text-left px-4 py-3 font-medium">버퍼</th>
                  <th className="text-left px-4 py-3 font-medium">최근 연결</th>
                  <th className="text-right px-4 py-3 font-medium">작업</th>
                </tr>
              </thead>
              <tbody>
                {gateways.map((gw) => {
                  const s = statusConfig[gw.status] ?? statusConfig.offline;
                  return (
                    <tr key={gw.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border ${s.bg} ${s.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                          {s.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{gw.name ?? gw.serialNumber}</div>
                        <div className="text-xs text-slate-400">{gw.serialNumber} {gw.model ? `· ${gw.model}` : ''}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {gw.site.name}
                        {gw.site.city && <span className="text-xs text-slate-500 ml-1">({gw.site.city})</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-300">{connLabel[gw.primaryConnection]}</div>
                        <div className="text-xs text-slate-500">폴백: {connLabel[gw.fallbackConnection]}</div>
                      </td>
                      <td className="px-4 py-3">
                        {gw.ipAddress ? (
                          <div className="text-slate-300 font-mono text-xs">{gw.ipAddress}</div>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-300">{gw._count.devices}대</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <HardDrive className="w-3.5 h-3.5 text-slate-500" />
                          <span className="text-slate-300 text-xs">{gw.bufferedRecords > 0 ? `${gw.bufferedRecords.toLocaleString()}건` : '0'}</span>
                        </div>
                        <div className="text-xs text-slate-500">{gw.bufferSizeMb} MB</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {gw.lastSeenAt
                          ? new Date(gw.lastSeenAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setDownloadGw(gw)}
                            className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition"
                            title="수집기 다운로드"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setModal({ mode: 'edit', gateway: gw })}
                            className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition"
                            title="수정"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(gw)}
                            disabled={deleting === gw.id}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition disabled:opacity-50"
                            title="삭제"
                          >
                            {deleting === gw.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > LIMIT && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-slate-400">전체 {total}개</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg disabled:opacity-50 transition"
            >
              이전
            </button>
            <span className="px-3 py-1.5 text-slate-300">
              {page} / {Math.ceil(total / LIMIT)}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page * LIMIT >= total}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg disabled:opacity-50 transition"
            >
              다음
            </button>
          </div>
        </div>
      )}

      {/* Gateway Edit Modal */}
      {modal && (
        <GatewayModal
          mode={modal.mode}
          gateway={modal.gateway}
          sites={sites}
          onClose={() => setModal(null)}
          onSaved={fetchGateways}
        />
      )}

      {/* Collector Download Modal */}
      {downloadGw && (
        <CollectorDownloadModal
          gateway={downloadGw}
          onClose={() => setDownloadGw(null)}
        />
      )}

      {/* Online ratio */}
      {gateways.length > 0 && (
        <div className="mt-4 p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl flex items-center gap-4">
          <div className="text-sm text-slate-400">온라인 비율</div>
          <div className="flex-1 bg-slate-700 rounded-full h-2">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${gateways.length > 0 ? (onlineCount / gateways.length) * 100 : 0}%` }}
            />
          </div>
          <div className="text-sm font-medium text-emerald-400">
            {gateways.length > 0 ? Math.round((onlineCount / gateways.length) * 100) : 0}%
          </div>
        </div>
      )}
    </div>
  );
}
