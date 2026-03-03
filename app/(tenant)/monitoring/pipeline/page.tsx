'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Database,
  Wifi,
  WifiOff,
  RefreshCw,
  Loader2,
  ArrowDownUp,
  Server,
} from 'lucide-react';

interface PipelineSource {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'inactive' | 'error' | 'maintenance';
  lastReceived: string | null;
  recordsToday: number;
  errorRate: number;
  latencyMs: number;
}

interface PipelineStats {
  totalSources: number;
  activeSources: number;
  errorSources: number;
  totalRecordsToday: number;
  avgLatencyMs: number;
  lastUpdated: string;
}

const STATUS_CONFIG = {
  active: { icon: CheckCircle2, label: '정상', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  inactive: { icon: WifiOff, label: '비활성', color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/30' },
  error: { icon: XCircle, label: '오류', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
  maintenance: { icon: Clock, label: '점검중', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
};

const TYPE_LABELS: Record<string, string> = {
  mqtt: 'MQTT',
  modbus: 'Modbus TCP',
  opcua: 'OPC-UA',
  rest_api: 'REST API',
  serial: 'Serial',
  bacnet: 'BACnet',
};

export default function PipelinePage() {
  const [sources, setSources] = useState<PipelineSource[]>([]);
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'error' | 'inactive'>('all');

  const fetchPipeline = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/monitoring/pipeline');
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json;
        setSources(data.sources || []);
        setStats(data.stats || null);
      } else {
        setError('파이프라인 상태를 불러올 수 없습니다.');
      }
    } catch {
      setError('네트워크 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPipeline();
  }, [fetchPipeline]);

  const filteredSources = sources.filter(s => {
    if (filter === 'all') return true;
    return s.status === filter;
  });

  const formatTime = (iso: string | null) => {
    if (!iso) return '-';
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return '방금 전';
    if (diffMin < 60) return `${diffMin}분 전`;
    const diffHour = Math.floor(diffMs / 3600000);
    if (diffHour < 24) return `${diffHour}시간 전`;
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#051225] text-white">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-cyan-400" />
          <p className="text-slate-400">데이터 수집 상태 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#051225] text-white p-4 md:p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg">
              <Activity className="w-6 h-6 text-cyan-400" />
            </div>
            데이터 수집 상태
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            센서 및 프로토콜 연결 상태 모니터링
            {/* <span className="ml-2 text-amber-400 text-xs">(시뮬레이션 데이터)</span> */}
          </p>
        </div>
        <button
          onClick={fetchPipeline}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-lg hover:bg-cyan-500/20 transition"
        >
          <RefreshCw className="w-4 h-4" />
          새로고침
        </button>
      </div>

      {/* 에러 배너 */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center justify-between">
          <p className="text-sm text-red-300">{error}</p>
          <button onClick={fetchPipeline} className="px-3 py-1.5 bg-red-500/20 text-red-300 rounded-lg text-sm hover:bg-red-500/30 transition">
            재시도
          </button>
        </div>
      )}

      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Server className="w-5 h-5 text-slate-400" />
              <span className="text-sm text-slate-400">전체 소스</span>
            </div>
            <div className="text-3xl font-bold text-white">{stats.totalSources}</div>
          </div>
          <div className="bg-slate-800/50 border border-emerald-500/30 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Wifi className="w-5 h-5 text-emerald-400" />
              <span className="text-sm text-slate-400">활성</span>
            </div>
            <div className="text-3xl font-bold text-emerald-400">{stats.activeSources}</div>
          </div>
          <div className="bg-slate-800/50 border border-red-500/30 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span className="text-sm text-slate-400">오류</span>
            </div>
            <div className="text-3xl font-bold text-red-400">{stats.errorSources}</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Database className="w-5 h-5 text-blue-400" />
              <span className="text-sm text-slate-400">금일 수집</span>
            </div>
            <div className="text-3xl font-bold text-blue-400">{stats.totalRecordsToday.toLocaleString()}</div>
            <div className="text-xs text-slate-500">records</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <ArrowDownUp className="w-5 h-5 text-amber-400" />
              <span className="text-sm text-slate-400">평균 지연</span>
            </div>
            <div className="text-3xl font-bold text-amber-400">{stats.avgLatencyMs}</div>
            <div className="text-xs text-slate-500">ms</div>
          </div>
        </div>
      )}

      {/* 필터 */}
      <div className="flex gap-2">
        {(['all', 'active', 'error', 'inactive'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === f
                ? 'bg-cyan-500 text-white'
                : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-white border border-slate-700/50'
            }`}
          >
            {{ all: '전체', active: '활성', error: '오류', inactive: '비활성' }[f]}
            {f !== 'all' && (
              <span className="ml-1.5 text-xs">
                ({sources.filter(s => s.status === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 소스 목록 */}
      <div className="space-y-3">
        {filteredSources.map((source) => {
          const statusConf = STATUS_CONFIG[source.status];
          const StatusIcon = statusConf.icon;

          return (
            <div
              key={source.id}
              className={`p-5 rounded-xl border transition-all ${statusConf.bg}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <StatusIcon className={`w-6 h-6 ${statusConf.color}`} />
                  <div>
                    <h3 className="text-base font-semibold text-white">{source.name}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs px-2 py-0.5 bg-slate-700/50 rounded text-slate-300">
                        {TYPE_LABELS[source.type] || source.type}
                      </span>
                      <span className={`text-xs ${statusConf.color}`}>{statusConf.label}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-8 text-right">
                  <div>
                    <div className="text-xs text-slate-500">마지막 수신</div>
                    <div className="text-sm text-slate-300">{formatTime(source.lastReceived)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">금일 레코드</div>
                    <div className="text-sm text-white font-medium">{source.recordsToday.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">에러율</div>
                    <div className={`text-sm font-medium ${
                      source.errorRate > 5 ? 'text-red-400' : source.errorRate > 1 ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {source.errorRate}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">지연</div>
                    <div className={`text-sm font-medium ${
                      source.latencyMs > 200 ? 'text-amber-400' : 'text-slate-300'
                    }`}>
                      {source.latencyMs > 0 ? `${source.latencyMs}ms` : '-'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {filteredSources.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <Database className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>해당 상태의 데이터 소스가 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
