// app/web/app/(tenant)/monitoring/page.tsx
'use client';

import { useState, useEffect } from 'react';
import RealTimeChart from '@/components/charts/RealTimeChart';

interface Device {
  id: string;
  name: string;
  type: string;
  status: string;
}

export default function MonitoringPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://localhost:4000/api/devices', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDevices(data.data || []);
        
        if (data.data && data.data.length > 0) {
          setSelectedDevice(data.data[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">실시간 모니터링</h1>

      {/* 디바이스 선택 */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">디바이스 선택</label>
        <select
          value={selectedDevice || ''}
          onChange={(e) => setSelectedDevice(e.target.value)}
          className="w-64 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {devices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.name} ({device.type})
            </option>
          ))}
        </select>
      </div>

      {/* 실시간 차트 그리드 */}
      {selectedDevice && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <RealTimeChart
            deviceId={selectedDevice}
            metricKey="power"
            title="전력 (kW)"
            maxDataPoints={30}
          />
          
          <RealTimeChart
            deviceId={selectedDevice}
            metricKey="voltage"
            title="전압 (V)"
            maxDataPoints={30}
          />
          
          <RealTimeChart
            deviceId={selectedDevice}
            metricKey="current"
            title="전류 (A)"
            maxDataPoints={30}
          />
          
          <RealTimeChart
            deviceId={selectedDevice}
            metricKey="temperature"
            title="온도 (°C)"
            maxDataPoints={30}
          />
        </div>
      )}

      {/* 디바이스 없음 */}
      {devices.length === 0 && (
        <div className="text-center text-gray-500 mt-20">
          등록된 디바이스가 없습니다.
        </div>
      )}
    </div>
  );
}