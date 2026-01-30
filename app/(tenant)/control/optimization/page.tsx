'use client';

import React, { useState, useEffect } from 'react';
import { TrendingDown, AlertCircle, Zap, Target } from 'lucide-react';

interface Recommendation {
  id: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  estimatedSavings: number;
  unit: string;
  estimatedCost: number;
  devices: string[];
  actions?: any[];
  schedule?: any;
  drProgram?: any;
}

export default function OptimizationPage() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRec, setSelectedRec] = useState<Recommendation | null>(null);

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    try {
      // Mock recommendations
      const mockRecs: Recommendation[] = [
        {
          id: 'peak-shaving-hvac',
          category: 'peak-shaving',
          priority: 'high',
          title: 'HVAC 피크 제어',
          description: '피크 시간(9-11AM, 6-8PM)에 HVAC 냉방 설정을 25°C에서 26°C로 상향 조정',
          estimatedSavings: 7.5,
          unit: 'kW',
          estimatedCost: 9000,
          devices: ['hvac-01', 'hvac-02'],
          actions: [
            {
              deviceType: 'hvac',
              parameter: 'setpoint',
              value: 26,
              condition: 'peak-hours',
            },
          ],
        },
        {
          id: 'lighting-optimization',
          category: 'lighting',
          priority: 'medium',
          title: '조명 자동 제어',
          description: '자동 조명 제어 시스템으로 주간 자연광 활용 시 조명 20% 감소',
          estimatedSavings: 5.2,
          unit: 'kW',
          estimatedCost: 0,
          devices: ['lighting-01', 'lighting-02', 'lighting-03'],
        },
        {
          id: 'ess-optimization',
          category: 'ess',
          priority: 'high',
          title: 'ESS 충방전 최적화',
          description:
            '피크 시간 이전 저가 시간대(23:00-07:00)에 충전하고 피크 시간에 방전',
          estimatedSavings: 12.5,
          unit: '₩M/월',
          estimatedCost: 0,
          devices: [],
          schedule: {
            charging: { start: '23:00', end: '07:00' },
            discharging: { start: '09:00', end: '11:00' },
            discharging2: { start: '18:00', end: '20:00' },
          },
        },
        {
          id: 'dr-program',
          category: 'dr',
          priority: 'high',
          title: '수요반응 프로그램 참여',
          description: 'K-PX 수요반응 프로그램에 참여하여 피크 시간에 부하를 감축',
          estimatedSavings: 9.2,
          unit: '₩M/월',
          estimatedCost: 0,
          devices: [],
          drProgram: {
            name: 'K-PX Demand Response',
            season: 'summer',
            daysPerMonth: 8,
            compensationPerDay: 1.15,
          },
        },
      ];

      setRecommendations(mockRecs);
    } catch (error) {
      console.error('Failed to fetch recommendations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-900 text-red-200 border-red-700';
      case 'medium':
        return 'bg-amber-900 text-amber-200 border-amber-700';
      case 'low':
        return 'bg-green-900 text-green-200 border-green-700';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high':
        return '높음';
      case 'medium':
        return '중간';
      case 'low':
        return '낮음';
      default:
        return priority;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'peak-shaving':
        return 'text-amber-400';
      case 'lighting':
        return 'text-yellow-400';
      case 'ess':
        return 'text-blue-400';
      case 'dr':
        return 'text-green-400';
      default:
        return 'text-slate-400';
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'peak-shaving':
        return '피크 제어';
      case 'lighting':
        return '조명 최적화';
      case 'ess':
        return 'ESS 최적화';
      case 'dr':
        return '수요반응';
      default:
        return category;
    }
  };

  const totalSavings = recommendations.reduce((sum, r) => {
    const value = r.estimatedSavings;
    return sum + (r.unit === 'kW' ? value * 1200 : value * 1000000);
  }, 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p>최적화 권장사항 로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold mb-2">최적화 권장사항</h1>
          <p className="text-slate-400">
            AI 기반 에너지 최적화 추천 및 구현 현황
          </p>
        </div>

        {/* Summary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">활성 권장사항</p>
                <p className="text-4xl font-bold text-emerald-400 mt-2">
                  {recommendations.length}
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-emerald-500 opacity-50" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">월간 절감액</p>
                <p className="text-4xl font-bold text-amber-400 mt-2">
                  ₩{(totalSavings / 1000000).toFixed(1)}M
                </p>
              </div>
              <TrendingDown className="w-8 h-8 text-amber-500 opacity-50" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">즉시 실행 가능</p>
                <p className="text-4xl font-bold text-blue-400 mt-2">
                  {recommendations.filter((r) => r.priority === 'high').length}
                </p>
              </div>
              <Zap className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
          </div>
        </div>

        {/* Recommendations Grid */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">권장사항 목록</h2>

          <div className="space-y-4">
            {recommendations.map((rec) => (
              <div
                key={rec.id}
                className="bg-slate-900 border border-slate-800 rounded-lg p-6 hover:border-slate-700 transition cursor-pointer"
                onClick={() => setSelectedRec(rec)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-white">
                        {rec.title}
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold border ${getPriorityColor(
                          rec.priority
                        )}`}
                      >
                        {getPriorityLabel(rec.priority)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400">{rec.description}</p>
                  </div>

                  <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-semibold transition whitespace-nowrap ml-4">
                    구현
                  </button>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-700">
                  <div>
                    <p className="text-xs text-slate-500 uppercase">카테고리</p>
                    <p className={`text-lg font-bold ${getCategoryColor(rec.category)} mt-2`}>
                      {getCategoryLabel(rec.category)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase">절감액</p>
                    <p className="text-lg font-bold text-emerald-400 mt-2">
                      {rec.estimatedSavings.toFixed(1)} {rec.unit}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase">구현 비용</p>
                    <p className="text-lg font-bold text-blue-400 mt-2">
                      {rec.estimatedCost > 0
                        ? `₩${Math.round(rec.estimatedCost / 1000)}K`
                        : '무비용'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase">ROI 기간</p>
                    <p className="text-lg font-bold text-amber-400 mt-2">
                      {rec.estimatedCost > 0
                        ? `${Math.round((rec.estimatedCost / (rec.estimatedSavings * 1200)) * 12)}개월`
                        : '즉시'}
                    </p>
                  </div>
                </div>

                {/* Devices or Schedule */}
                {rec.devices && rec.devices.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {rec.devices.map((device) => (
                      <span
                        key={device}
                        className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-300"
                      >
                        {device}
                      </span>
                    ))}
                  </div>
                )}

                {rec.schedule && (
                  <div className="mt-4 p-3 bg-slate-800 rounded border border-slate-700">
                    <p className="text-xs text-slate-400 uppercase mb-2">
                      ESS 운영 스케줄
                    </p>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <p className="text-slate-500">충전</p>
                        <p className="text-emerald-400 font-semibold">
                          {rec.schedule.charging.start} - {rec.schedule.charging.end}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">방전 1</p>
                        <p className="text-blue-400 font-semibold">
                          {rec.schedule.discharging.start} -{' '}
                          {rec.schedule.discharging.end}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">방전 2</p>
                        <p className="text-blue-400 font-semibold">
                          {rec.schedule.discharging2.start} -{' '}
                          {rec.schedule.discharging2.end}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {rec.drProgram && (
                  <div className="mt-4 p-3 bg-green-900/20 rounded border border-green-700/50">
                    <p className="text-xs text-green-400 uppercase mb-1">
                      수요반응 프로그램
                    </p>
                    <p className="text-sm text-green-300">
                      {rec.drProgram.name} • 월 {rec.drProgram.daysPerMonth}회 • ₩
                      {(rec.drProgram.compensationPerDay * 1000000).toFixed(0)}M/회
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Implementation Status */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-6">구현 현황</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* By Category */}
            <div>
              <h3 className="text-lg font-semibold mb-4">카테고리별 현황</h3>
              <div className="space-y-3">
                {[
                  { category: 'peak-shaving', count: 1, implemented: 0 },
                  { category: 'lighting', count: 1, implemented: 0 },
                  { category: 'ess', count: 1, implemented: 0 },
                  { category: 'dr', count: 1, implemented: 0 },
                ].map((item) => (
                  <div key={item.category} className="flex items-center justify-between p-3 bg-slate-800 rounded">
                    <span className="text-sm text-slate-300">
                      {getCategoryLabel(item.category)}
                    </span>
                    <div className="flex-1 mx-4 h-2 bg-slate-700 rounded">
                      <div
                        className="h-full bg-emerald-500 rounded"
                        style={{
                          width: `${(item.implemented / item.count) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm text-slate-300">
                      {item.implemented}/{item.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* By Priority */}
            <div>
              <h3 className="text-lg font-semibold mb-4">우선순위별 현황</h3>
              <div className="space-y-3">
                {['high', 'medium', 'low'].map((priority) => {
                  const count = recommendations.filter(
                    (r) => r.priority === priority
                  ).length;
                  return (
                    <div
                      key={priority}
                      className="flex items-center justify-between p-3 bg-slate-800 rounded"
                    >
                      <span className="text-sm text-slate-300">
                        {getPriorityLabel(priority)} 우선순위
                      </span>
                      <span className="font-semibold text-slate-200">
                        {count}개
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
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
