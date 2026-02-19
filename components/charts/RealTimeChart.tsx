// app/web/components/charts/RealTimeChart.tsx
'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
// TODO: Install socket.io-client package
// import { io, Socket } from 'socket.io-client';

type Socket = any;

// TODO: Will be used when socket.io-client is installed
// interface MeasurementData {
//   timestamp: string;
//   deviceId: string;
//   metricKey: string;
//   value: number;
//   quality: string;
// }

interface ChartDataPoint {
  time: string;
  value: number;
}

interface RealTimeChartProps {
  deviceId: string;
  metricKey: string;
  title?: string;
  maxDataPoints?: number;
}

export default function RealTimeChart({
  deviceId,
  metricKey,
  title = '실시간 데이터',
  maxDataPoints = 20,
}: RealTimeChartProps) {
  const [data, _setData] = useState<ChartDataPoint[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [_socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // TODO: Implement socket.io connection when package is installed
    // Stub: Set disconnected state
    setIsConnected(false);
    setSocket(null);

    // WebSocket 연결 (commented out until socket.io-client is installed)
    /*
    const token = localStorage.getItem('accessToken');

    if (!token) {
      console.error('No access token found');
      return;
    }

    const newSocket = io('http://localhost:4000/realtime', {
      auth: {
        token,
      },
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      console.log('✅ Connected to WebSocket');
      setIsConnected(true);

      // 디바이스 구독
      newSocket.emit('subscribe', { deviceIds: [deviceId] });
    });

    newSocket.on('disconnect', () => {
      console.log('⚠️  Disconnected from WebSocket');
      setIsConnected(false);
    });

    newSocket.on('measurement', (measurement: MeasurementData) => {
      // 해당 디바이스 & 메트릭의 데이터만 필터링
      if (measurement.deviceId === deviceId && measurement.metricKey === metricKey) {
        const time = new Date(measurement.timestamp).toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });

        setData((prevData) => {
          const newData = [
            ...prevData,
            {
              time,
              value: measurement.value,
            },
          ];

          // 최대 데이터 포인트 제한
          if (newData.length > maxDataPoints) {
            newData.shift();
          }

          return newData;
        });
      }
    });

    setSocket(newSocket);

    // Cleanup
    return () => {
      newSocket.emit('unsubscribe', { deviceIds: [deviceId] });
      newSocket.disconnect();
    };
    */
  }, [deviceId, metricKey, maxDataPoints]);

  return (
    <div className="w-full h-full bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-emerald-500' : 'bg-red-500'
            }`}
          />
          <span className="text-sm text-slate-400">
            {isConnected ? '연결됨' : '연결 끊김'}
          </span>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-slate-500">
          데이터를 기다리는 중...
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 12, fill: '#94a3b8' }}
              stroke="#475569"
            />
            <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} stroke="#475569" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#fff',
              }}
            />
            <Legend wrapperStyle={{ color: '#94a3b8' }} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#06b6d4"
              strokeWidth={2}
              dot={false}
              animationDuration={300}
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      <div className="mt-4 flex justify-between text-sm text-slate-400">
        <span>최신 값: {data[data.length - 1]?.value.toFixed(2) || 'N/A'}</span>
        <span>데이터 포인트: {data.length}/{maxDataPoints}</span>
      </div>
    </div>
  );
}