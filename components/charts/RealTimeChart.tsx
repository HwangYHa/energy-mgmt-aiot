'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

interface ChartDataPoint {
  time: string;
  value: number;
}

interface SseMeasurement {
  sensorCode: string;
  value: number;
  time: string;
  quality: string;
}

interface RealTimeChartProps {
  /** MQTT 토픽의 sensorCode와 동일 — SSE 필터링 기준 */
  sensorCode: string;
  title?: string;
  unit?: string;
  maxDataPoints?: number;
}

export default function RealTimeChart({
  sensorCode,
  title = '실시간 데이터',
  unit = '',
  maxDataPoints = 20,
}: RealTimeChartProps) {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!sensorCode) return;

    // SSE 연결 — /api/realtime 에서 MQTT 측정값 스트리밍
    const es = new EventSource('/api/realtime');
    esRef.current = es;

    es.addEventListener('open', () => setIsConnected(true));
    es.addEventListener('error', () => setIsConnected(false));

    es.addEventListener('message', (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as SseMeasurement;
        if (payload.sensorCode !== sensorCode) return;

        const label = new Date(payload.time).toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });

        setData((prev) => {
          const next = [...prev, { time: label, value: payload.value }];
          return next.length > maxDataPoints ? next.slice(-maxDataPoints) : next;
        });
      } catch {
        // 파싱 실패 무시
      }
    });

    return () => {
      es.close();
      esRef.current = null;
      setIsConnected(false);
    };
  }, [sensorCode, maxDataPoints]);

  const latest = data[data.length - 1];

  return (
    <div className="w-full h-full bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
            }`}
          />
          <span className="text-sm text-slate-400">
            {isConnected ? 'SSE 연결됨' : '연결 끊김'}
          </span>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
          {isConnected ? `${sensorCode} 데이터를 기다리는 중...` : 'SSE 연결 중...'}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              stroke="#475569"
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              stroke="#475569"
              unit={unit ? ` ${unit}` : undefined}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#fff',
              }}
              formatter={(v) => [`${Number(v).toFixed(2)}${unit ? ` ${unit}` : ''}`, sensorCode]}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#06b6d4"
              strokeWidth={2}
              dot={false}
              animationDuration={200}
              isAnimationActive={data.length < 5}
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      <div className="mt-3 flex justify-between text-xs text-slate-400">
        <span>
          최신값:{' '}
          {latest ? `${latest.value.toFixed(2)}${unit ? ` ${unit}` : ''}` : 'N/A'}
        </span>
        <span>
          {data.length}/{maxDataPoints} 포인트
        </span>
      </div>
    </div>
  );
}
