'use client';

import { useState, useCallback } from 'react';
import {
  Database,
  Search,
  Download,
  Loader2,
  Table2,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';

interface RawDataRow {
  id: string;
  timestamp: string;
  sensorId: string;
  sensorName: string;
  type: string;
  value: number;
  unit: string;
  quality: 'good' | 'uncertain' | 'bad';
}

const SENSOR_TYPES = [
  { value: '', label: '전체 타입' },
  { value: 'power_meter', label: '전력계' },
  { value: 'energy_meter', label: '전력량계' },
  { value: 'temperature', label: '온도' },
  { value: 'humidity', label: '습도' },
  { value: 'pressure', label: '압력' },
  { value: 'flow_meter', label: '유량' },
];

const QUALITY_COLORS = {
  good: 'text-emerald-400 bg-emerald-500/10',
  uncertain: 'text-amber-400 bg-amber-500/10',
  bad: 'text-red-400 bg-red-500/10',
};

const QUALITY_LABELS = {
  good: '정상',
  uncertain: '불확실',
  bad: '불량',
};

export default function RawDataExplorerPage() {
  const [data, setData] = useState<RawDataRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  // 필터
  const [sensorType, setSensorType] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() - 1);
    return d.toISOString().slice(0, 16);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [searchQuery, setSearchQuery] = useState('');

  // 페이지네이션
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSearched(true);
    try {
      const params = new URLSearchParams({
        start: new Date(startDate).toISOString(),
        end: new Date(endDate).toISOString(),
        page: String(page),
        pageSize: String(pageSize),
      });
      if (sensorType) params.set('type', sensorType);
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/analytics/raw-data?${params}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data || []);
      } else {
        loadSimulatedData();
      }
    } catch {
      loadSimulatedData();
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, sensorType, searchQuery, page]);

  function loadSimulatedData() {
    const types = ['power_meter', 'temperature', 'humidity', 'energy_meter', 'pressure'];
    const units = ['kW', '°C', '%', 'kWh', 'bar'];
    const names = ['본관 전력계 A', '2층 온도센서', '서버실 습도', '태양광 인버터', '보일러 압력'];

    const rows: RawDataRow[] = [];
    const baseTime = new Date(startDate).getTime();
    const endTime = new Date(endDate).getTime();
    const interval = Math.max((endTime - baseTime) / pageSize, 10000);

    for (let i = 0; i < pageSize; i++) {
      const idx = i % types.length;
      rows.push({
        id: `row-${i}`,
        timestamp: new Date(baseTime + interval * i).toISOString(),
        sensorId: `sensor-${String(idx + 1).padStart(3, '0')}`,
        sensorName: names[idx] as string,
        type: types[idx] as string,
        value: parseFloat((Math.random() * 100 + 10).toFixed(2)),
        unit: units[idx] as string,
        quality: Math.random() > 0.05 ? 'good' : Math.random() > 0.5 ? 'uncertain' : 'bad',
      });
    }
    setData(rows);
  }

  const handleSearch = () => {
    setPage(1);
    fetchData();
  };

  return (
    <div className="min-h-screen bg-[#051225] text-white p-4 md:p-6 space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <div className="p-2 bg-violet-500/10 rounded-lg">
            <Table2 className="w-6 h-6 text-violet-400" />
          </div>
          원시 데이터 탐색기
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          센서 수집 원본 데이터 조회 및 검색
          <span className="ml-2 text-amber-400 text-xs">(시뮬레이션 데이터)</span>
        </p>
      </div>

      {/* 필터 */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-400 font-medium">검색 조건</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">시작 시간</label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">종료 시간</label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">센서 타입</label>
            <select
              value={sensorType}
              onChange={(e) => setSensorType(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-cyan-500 focus:outline-none"
            >
              {SENSOR_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">센서 검색</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="센서 이름 또는 ID"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleSearch}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              조회
            </button>
          </div>
        </div>
      </div>

      {/* 에러 배너 */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* 결과 테이블 */}
      {searched && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-300">{data.length}건 조회됨</span>
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-lg hover:bg-cyan-500/20 transition">
              <Download className="w-3.5 h-3.5" />
              CSV 다운로드
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase">시간</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase">센서 ID</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase">센서명</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase">타입</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase text-right">측정값</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase text-center">품질</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition">
                    <td className="px-4 py-2.5 text-slate-300 whitespace-nowrap">
                      {new Date(row.timestamp).toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 font-mono text-xs">{row.sensorId}</td>
                    <td className="px-4 py-2.5 text-white">{row.sensorName}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs px-2 py-0.5 bg-slate-700/50 rounded text-slate-300">
                        {SENSOR_TYPES.find(t => t.value === row.type)?.label || row.type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-white">
                      {row.value} <span className="text-slate-500 text-xs">{row.unit}</span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded ${QUALITY_COLORS[row.quality]}`}>
                        {QUALITY_LABELS[row.quality]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Database className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>조건에 맞는 데이터가 없습니다.</p>
            </div>
          )}

          {/* 페이지네이션 */}
          {data.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700/50">
              <span className="text-xs text-slate-500">페이지 {page}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="p-1.5 bg-slate-700/50 rounded hover:bg-slate-700 disabled:opacity-30 transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setPage(page + 1); fetchData(); }}
                  disabled={data.length < pageSize}
                  className="p-1.5 bg-slate-700/50 rounded hover:bg-slate-700 disabled:opacity-30 transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 초기 안내 */}
      {!searched && (
        <div className="text-center py-20 text-slate-500">
          <Search className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg mb-2">검색 조건을 설정하고 조회를 시작하세요</p>
          <p className="text-sm">시간 범위와 센서 타입을 지정하여 원시 데이터를 탐색할 수 있습니다.</p>
        </div>
      )}
    </div>
  );
}
