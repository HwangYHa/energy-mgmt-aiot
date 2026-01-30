'use client';

import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Zap, Thermometer, Battery, TrendingDown, DollarSign, Loader2, AlertCircle } from 'lucide-react';

interface OptimizationResult {
  peakHours: number[];
  essSchedule: Array<{
    hour: number;
    operation: 'charge' | 'discharge' | 'standby';
    power: number;
    energy: number;
  }>;
  hvacSettings: {
    base_temperature: number;
    hourly_setpoints: Array<{
      hour: number;
      setpoint: number;
      adjustment: string;
    }>;
    estimated_load_reduction: number;
  };
  estimatedSaving: number;
  recommendations: string[];
  timestamp: string;
}

export default function OptimizationPage() {
  const [targetReduction, setTargetReduction] = useState(50);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'peak' | 'ess' | 'hvac'>('peak');

  const handleOptimize = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetReduction }),
      });

      if (!response.ok) throw new Error('최적화 계산 실패');

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  // 차트 데이터 생성
  const essChartData = result?.essSchedule.map((item) => ({
    hour: `${item.hour}시`,
    charge: item.operation === 'charge' ? item.power : 0,
    discharge: item.operation === 'discharge' ? item.power : 0,
  })) || [];

  const hvacChartData = result?.hvacSettings.hourly_setpoints.map((item) => ({
    hour: `${item.hour}시`,
    setpoint: item.setpoint,
    adjustment: item.adjustment,
  })) || [];

  const dailySavingsKwh = (result?.estimatedSaving || 0) * 24;
  const monthlyEarnings = dailySavingsKwh * 30 * 200; // ₩200/kWh 기준

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
          <TrendingDown className="w-10 h-10 text-green-400" />
          ⚙️ 에너지 최적화
        </h1>
        <p className="text-gray-400">AI 기반 피크 제어, ESS 스케줄링, HVAC 최적화</p>
      </div>

      {/* 제어판 */}
      <div className="bg-gray-800 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">목표 감축량 설정</h2>
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm text-gray-300 mb-2">감축 목표 (kW)</label>
            <input
              type="range"
              min="10"
              max="200"
              step="10"
              value={targetReduction}
              onChange={(e) => setTargetReduction(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-2">
              <span>10 kW</span>
              <span className="text-blue-400 font-bold">{targetReduction} kW</span>
              <span>200 kW</span>
            </div>
          </div>
          <button
            onClick={handleOptimize}
            disabled={isLoading}
            className="px-8 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg font-bold transition"
          >
            {isLoading ? '분석 중...' : '최적화 실행'}
          </button>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="mb-6 bg-red-900 border-l-4 border-red-500 p-4 rounded flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-bold text-red-300">오류 발생</h3>
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* 결과 */}
      {result && (
        <>
          {/* 예상 효과 */}
          <div className="mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-green-800 to-green-900 p-6 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-300">감축량</span>
                <TrendingDown className="w-5 h-5 text-green-400" />
              </div>
              <div className="text-3xl font-bold">{result.estimatedSaving.toFixed(1)} kW</div>
              <div className="text-sm text-gray-400 mt-2">{dailySavingsKwh.toFixed(0)} kWh/일</div>
            </div>

            <div className="bg-gradient-to-br from-blue-800 to-blue-900 p-6 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-300">월간 절감액</span>
                <DollarSign className="w-5 h-5 text-yellow-400" />
              </div>
              <div className="text-3xl font-bold">₩{(monthlyEarnings / 1000).toFixed(0)}K</div>
              <div className="text-sm text-gray-400 mt-2">약 {(monthlyEarnings / 1000000).toFixed(1)}백만원</div>
            </div>

            <div className="bg-gradient-to-br from-purple-800 to-purple-900 p-6 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-300">피크 시간대</span>
                <Zap className="w-5 h-5 text-orange-400" />
              </div>
              <div className="text-3xl font-bold">{result.peakHours.length}개</div>
              <div className="text-sm text-gray-400 mt-2">
                {Math.min(...result.peakHours)}~{Math.max(...result.peakHours)}시
              </div>
            </div>

            <div className="bg-gradient-to-br from-cyan-800 to-cyan-900 p-6 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-300">냉난방 절감</span>
                <Thermometer className="w-5 h-5 text-red-400" />
              </div>
              <div className="text-3xl font-bold">
                {(result.hvacSettings.estimated_load_reduction * 100).toFixed(0)}%
              </div>
              <div className="text-sm text-gray-400 mt-2">추정 부하 감소율</div>
            </div>
          </div>

          {/* 탭 네비게이션 */}
          <div className="mb-8 flex gap-4 border-b border-gray-700">
            {[
              { id: 'peak', label: '피크 분석', icon: '⚡' },
              { id: 'ess', label: 'ESS 스케줄', icon: '🔋' },
              { id: 'hvac', label: 'HVAC 설정', icon: '🌡️' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-3 font-bold transition border-b-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* 피크 분석 */}
          {activeTab === 'peak' && (
            <div className="bg-gray-800 rounded-lg p-6 mb-8">
              <h2 className="text-xl font-bold mb-4">⚡ 피크 시간대 분석</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-gray-300 mb-4">
                    주요 피크 시간대: <span className="text-orange-400 font-bold">{result.peakHours.join(', ')}시</span>
                  </p>
                  <div className="space-y-2">
                    {result.peakHours.map((hour) => (
                      <div key={hour} className="bg-gray-700 p-3 rounded flex items-center justify-between">
                        <span>{hour}시 (업무시간 {9 <= hour && hour < 18 ? 'O' : 'X'})</span>
                        <div className="w-24 h-2 bg-gray-600 rounded-full overflow-hidden">
                          <div className="h-full bg-orange-500" style={{ width: '85%' }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="font-bold mb-3">권장 조치</h3>
                  <ul className="space-y-2 text-sm text-gray-300">
                    <li>✓ ESS 방전으로 피크 부하 {(result.estimatedSaving * 0.4).toFixed(0)} kW 감소</li>
                    <li>✓ 온도 설정점 상향으로 냉방 부하 감소</li>
                    <li>✓ EV 충전 시간 심야로 이동</li>
                    <li>✓ 무관한 시설 전원 차단</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* ESS 스케줄 */}
          {activeTab === 'ess' && (
            <div className="bg-gray-800 rounded-lg p-6 mb-8">
              <h2 className="text-xl font-bold mb-4">🔋 ESS 충방전 스케줄</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={essChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="hour" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" label={{ value: 'kW', angle: -90, position: 'insideLeft' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                  />
                  <Legend />
                  <Bar dataKey="charge" fill="#10B981" name="충전" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="discharge" fill="#EF4444" name="방전" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>

              <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="bg-gray-700 p-3 rounded">
                  <div className="text-gray-400 mb-1">충전 시간</div>
                  <div className="font-bold">2~6시 (심야)</div>
                </div>
                <div className="bg-gray-700 p-3 rounded">
                  <div className="text-gray-400 mb-1">방전 시간</div>
                  <div className="font-bold">피크 시간대</div>
                </div>
                <div className="bg-gray-700 p-3 rounded">
                  <div className="text-gray-400 mb-1">용량</div>
                  <div className="font-bold">100 kWh</div>
                </div>
                <div className="bg-gray-700 p-3 rounded">
                  <div className="text-gray-400 mb-1">효율</div>
                  <div className="font-bold">90%</div>
                </div>
              </div>
            </div>
          )}

          {/* HVAC 설정 */}
          {activeTab === 'hvac' && (
            <div className="bg-gray-800 rounded-lg p-6 mb-8">
              <h2 className="text-xl font-bold mb-4">🌡️ HVAC 온도 설정</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={hvacChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="hour" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" domain={[20, 24]} />
                  <Tooltip contentStyle={{ backgroundColor: '#1F2937' }} />
                  <Legend />
                  <ReferenceLine
                    y={result.hvacSettings.base_temperature}
                    stroke="#9CA3AF"
                    strokeDasharray="5 5"
                    label="기본 설정"
                  />
                  <Line
                    type="monotone"
                    dataKey="setpoint"
                    stroke="#EF4444"
                    name="설정 온도 (°C)"
                    dot={{ fill: '#EF4444', r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>

              <div className="mt-6">
                <h3 className="font-bold mb-3">설정 전략</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="bg-gray-700 p-3 rounded">
                    <div className="text-orange-400 font-bold mb-1">피크 시간 (낮시간)</div>
                    <div className="text-gray-300">온도 상향: {result.hvacSettings.base_temperature + 1}°C</div>
                    <div className="text-gray-400 text-xs">냉방 부하 15% 감소</div>
                  </div>
                  <div className="bg-gray-700 p-3 rounded">
                    <div className="text-blue-400 font-bold mb-1">기본 시간</div>
                    <div className="text-gray-300">기본값 유지: {result.hvacSettings.base_temperature}°C</div>
                    <div className="text-gray-400 text-xs">쾌적한 환경 유지</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 추천사항 */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">💡 AI 추천사항</h2>
            <div className="space-y-3">
              {result.recommendations.map((rec, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 bg-gray-700 rounded-lg border-l-4 border-green-500"
                >
                  <span className="text-green-400 font-bold flex-shrink-0">✓</span>
                  <span className="text-gray-300">{rec}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* 로딩 상태 */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center rounded">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            <p className="text-gray-300">최적화 계산 중입니다...</p>
          </div>
        </div>
      )}
    </div>
  );
}
