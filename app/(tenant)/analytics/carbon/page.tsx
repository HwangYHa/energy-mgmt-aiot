// app/(tenant)/analytics/carbon/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Leaf,
  TrendingDown,
  TrendingUp,
  Target,
  Lightbulb,
  Calendar,
  Plus,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Settings,
} from 'lucide-react';

/**
 * 🌍 탄소 배출 분석 대시보드
 * 
 * 기능:
 * - Scope 1/2/3 배출량 계산 및 시각화
 * - 월별/연간 추이 분석
 * - 목표 대비 달성률
 * - 전년 대비 감축률
 * - AI 기반 감축 권장사항
 * - 배출원별 상세 분석
 * - 데이터 수동 입력 (연료, 운송)
 * - PDF/Excel 리포트 생성
 */

interface MonthlyEmission {
  month: number;
  monthName: string;
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
}

interface CarbonFootprint {
  emissions: {
    scope1: number;
    scope2: number;
    scope3: number;
    total: number;
    unit: string;
  };
  progress: {
    current: number;
    target: number;
    achievement: number;
    reduction: number;
    reductionRate: number;
  };
  breakdown: Array<{
    category: string;
    sourceType: string;
    amount: number;
    unit: string;
    emission: number;
    percentage: number;
  }>;
  recommendations: string[];
}

export default function CarbonAnalyticsPage() {
  const { data: session } = useSession();
  const [year, setYear] = useState(new Date().getFullYear());
  const [monthlyData, setMonthlyData] = useState<MonthlyEmission[]>([]);
  const [footprint, setFootprint] = useState<CarbonFootprint | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 모달 상태
  const [showFuelModal, setShowFuelModal] = useState(false);
  const [showTransportModal, setShowTransportModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  useEffect(() => {
    if (session?.user) {
      fetchCarbonData();
    }
  }, [year, session]);

  const fetchCarbonData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // 월별 배출량
      const emissionsResponse = await fetch(
        `/api/analytics/carbon/emissions?year=${year}`,
        {
          headers: {
            'Authorization': `Bearer ${session?.user?.accessToken}`,
          },
        }
      );

      if (!emissionsResponse.ok) {
        throw new Error('배출량 데이터 조회 실패');
      }

      const emissionsData = await emissionsResponse.json();
      setMonthlyData(
        emissionsData.map((d: any) => ({
          ...d,
          monthName: `${d.month}월`,
        }))
      );

      // 탄소 발자국
      const footprintResponse = await fetch(
        `/api/analytics/carbon/footprint?year=${year}&target=500`,
        {
          headers: {
            'Authorization': `Bearer ${session?.user?.accessToken}`,
          },
        }
      );

      if (!footprintResponse.ok) {
        throw new Error('탄소 발자국 데이터 조회 실패');
      }

      const footprintData = await footprintResponse.json();
      setFootprint(footprintData);

    } catch (error) {
      console.error('Carbon analytics error:', error);
      setError(error instanceof Error ? error.message : '데이터 로딩 실패');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      const response = await fetch(
        `/api/analytics/carbon/export/pdf?year=${year}`,
        {
          headers: {
            'Authorization': `Bearer ${session?.user?.accessToken}`,
          },
        }
      );

      if (!response.ok) throw new Error('PDF 생성 실패');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `carbon-report-${year}.pdf`;
      a.click();
    } catch (error) {
      console.error('PDF export error:', error);
      alert('PDF 생성 중 오류가 발생했습니다.');
    }
  };

  const handleExportExcel = async () => {
    try {
      const response = await fetch(
        `/api/analytics/carbon/export/excel?year=${year}`,
        {
          headers: {
            'Authorization': `Bearer ${session?.user?.accessToken}`,
          },
        }
      );

      if (!response.ok) throw new Error('Excel 생성 실패');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `carbon-report-${year}.xlsx`;
      a.click();
    } catch (error) {
      console.error('Excel export error:', error);
      alert('Excel 생성 중 오류가 발생했습니다.');
    }
  };

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-green-400 mx-auto mb-4" />
          <p className="text-xl">탄소 배출 데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-xl mb-2">데이터 로딩 실패</p>
          <p className="text-gray-400 mb-4">{error}</p>
          <button
            onClick={fetchCarbonData}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  // Scope별 Pie Chart 데이터
  const scopeData = footprint
    ? [
        {
          name: 'Scope 1 (직접 배출)',
          value: footprint.emissions.scope1,
          color: '#EF4444',
        },
        {
          name: 'Scope 2 (간접 배출)',
          value: footprint.emissions.scope2,
          color: '#F59E0B',
        },
        {
          name: 'Scope 3 (기타)',
          value: footprint.emissions.scope3,
          color: '#10B981',
        },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Leaf className="w-8 h-8 text-green-400" />
            탄소 배출 분석
          </h1>
          <p className="text-gray-400 mt-1">
            온실가스 배출량 및 감축 현황 (ISO 14064, K-ETS 기준)
          </p>
        </div>

        {/* 액션 버튼 */}
        <div className="flex gap-2">
          {/* 연도 선택 */}
          <div className="flex gap-2">
            {[2024, 2025, 2026].map((y) => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={`px-4 py-2 rounded font-medium transition-colors ${
                  year === y
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {y}
              </button>
            ))}
          </div>

          {/* 리포트 생성 */}
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            PDF
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Excel
          </button>

          {/* 새로고침 */}
          <button
            onClick={fetchCarbonData}
            className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            title="새로고침"
          >
            <RefreshCw className="w-5 h-5" />
          </button>

          {/* 설정 */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            title="설정"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 주요 지표 (KPI Cards) */}
      {footprint && (
        <div className="grid grid-cols-4 gap-4">
          {/* 총 배출량 */}
          <div className="bg-gray-800 rounded-lg p-6 border-2 border-green-500 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full -mr-16 -mt-16" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <Leaf className="w-5 h-5 text-green-400" />
                <span className="text-sm text-gray-400">총 배출량</span>
              </div>
              <div className="text-4xl font-bold text-green-400 mb-1">
                {footprint.progress.current.toLocaleString('ko-KR', {
                  maximumFractionDigits: 1,
                })}
              </div>
              <div className="text-sm text-gray-400">tCO₂eq</div>
            </div>
          </div>

          {/* 목표 대비 */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-5 h-5 text-blue-400" />
              <span className="text-sm text-gray-400">목표 대비</span>
            </div>
            <div
              className={`text-4xl font-bold mb-1 ${
                footprint.progress.achievement <= 100
                  ? 'text-green-400'
                  : 'text-red-400'
              }`}
            >
              {footprint.progress.achievement.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-400">
              목표: {footprint.progress.target.toLocaleString('ko-KR')} tCO₂eq
            </div>
            {footprint.progress.achievement <= 100 ? (
              <div className="flex items-center gap-1 mt-2 text-green-400 text-xs">
                <CheckCircle className="w-3 h-3" />
                목표 달성
              </div>
            ) : (
              <div className="flex items-center gap-1 mt-2 text-red-400 text-xs">
                <AlertCircle className="w-3 h-3" />
                목표 초과
              </div>
            )}
          </div>

          {/* 전년 대비 감축 */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              {footprint.progress.reductionRate > 0 ? (
                <TrendingDown className="w-5 h-5 text-green-400" />
              ) : (
                <TrendingUp className="w-5 h-5 text-red-400" />
              )}
              <span className="text-sm text-gray-400">전년 대비</span>
            </div>
            <div
              className={`text-4xl font-bold mb-1 ${
                footprint.progress.reductionRate > 0
                  ? 'text-green-400'
                  : 'text-red-400'
              }`}
            >
              {Math.abs(footprint.progress.reductionRate).toFixed(1)}%
            </div>
            <div className="text-sm text-gray-400">
              {footprint.progress.reduction > 0 ? '감축' : '증가'}:{' '}
              {Math.abs(footprint.progress.reduction).toLocaleString('ko-KR', {
                maximumFractionDigits: 1,
              })}{' '}
              tCO₂eq
            </div>
          </div>

          {/* Scope 2 (주요 배출원) */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-5 h-5 text-yellow-400" />
              <span className="text-sm text-gray-400">Scope 2 (전력)</span>
            </div>
            <div className="text-4xl font-bold text-yellow-400 mb-1">
              {footprint.emissions.scope2.toLocaleString('ko-KR', {
                maximumFractionDigits: 1,
              })}
            </div>
            <div className="text-sm text-gray-400">
              {(
                (footprint.emissions.scope2 / footprint.emissions.total) *
                100
              ).toFixed(1)}
              % (전체 배출량 대비)
            </div>
          </div>
        </div>
      )}

      {/* 데이터 입력 버튼 */}
      <div className="flex gap-4">
        <button
          onClick={() => setShowFuelModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
        >
          <Plus className="w-5 h-5" />
          연료 사용량 등록
        </button>
        <button
          onClick={() => setShowTransportModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors"
        >
          <Plus className="w-5 h-5" />
          운송 거리 등록
        </button>
      </div>

      {/* 월별 배출량 추이 */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-xl font-bold mb-4">월별 배출량 추이</h2>

        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="monthName"
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF' }}
            />
            <YAxis
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF' }}
              label={{
                value: 'tCO₂eq',
                angle: -90,
                position: 'insideLeft',
                fill: '#9CA3AF',
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#fff',
              }}
              formatter={(value: any) =>
                `${value.toFixed(2)} tCO₂eq`
              }
            />
            <Legend />
            <Bar
              dataKey="scope1"
              name="Scope 1 (직접 배출)"
              stackId="a"
              fill="#EF4444"
            />
            <Bar
              dataKey="scope2"
              name="Scope 2 (간접 배출)"
              stackId="a"
              fill="#F59E0B"
            />
            <Bar
              dataKey="scope3"
              name="Scope 3 (기타)"
              stackId="a"
              fill="#10B981"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Scope 분석 */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-bold mb-4">Scope별 배출 비율</h2>

          {scopeData.length > 0 && footprint && (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={scopeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name.split(' ')[0]} ${(percent * 100).toFixed(1)}%`
                    }
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {scopeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                    formatter={(value: any) =>
                      `${value.toFixed(2)} tCO₂eq`
                    }
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* 범례 */}
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between p-2 bg-red-900/30 border border-red-700 rounded">
                  <span className="text-sm">Scope 1 (직접 배출)</span>
                  <span className="font-bold">
                    {footprint.emissions.scope1.toFixed(2)} tCO₂eq
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 bg-yellow-900/30 border border-yellow-700 rounded">
                  <span className="text-sm">Scope 2 (간접 배출)</span>
                  <span className="font-bold">
                    {footprint.emissions.scope2.toFixed(2)} tCO₂eq
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 bg-green-900/30 border border-green-700 rounded">
                  <span className="text-sm">Scope 3 (기타)</span>
                  <span className="font-bold">
                    {footprint.emissions.scope3.toFixed(2)} tCO₂eq
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 감축 권장사항 */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-400" />
            AI 감축 권장사항
          </h2>

          {footprint && footprint.recommendations.length > 0 ? (
            <div className="space-y-3">
              {footprint.recommendations.map((rec, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-4 bg-gray-700/50 rounded hover:bg-gray-700 transition-colors"
                >
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {index + 1}
                  </div>
                  <p className="text-sm text-gray-300 pt-1">{rec}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-400 py-8">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-2" />
              <p className="text-lg">훌륭합니다! 🎉</p>
              <p className="text-sm mt-2">목표를 달성하고 있습니다.</p>
              <p className="text-xs text-gray-500 mt-1">현재 수준을 유지하세요.</p>
            </div>
          )}
        </div>
      </div>

      {/* 배출원별 상세 */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-xl font-bold mb-4">배출원별 상세</h2>

        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-red-900/20 border border-red-700 rounded">
            <h3 className="font-bold mb-2 text-red-400">
              Scope 1 (직접 배출)
            </h3>
            <ul className="text-sm space-y-1 text-gray-300">
              <li>• 디젤 발전기</li>
              <li>• LNG 보일러</li>
              <li>• 차량 연료 (디젤, 가솔린)</li>
              <li>• 냉매 누출 (R-22, R-134a)</li>
            </ul>
          </div>

          <div className="p-4 bg-yellow-900/20 border border-yellow-700 rounded">
            <h3 className="font-bold mb-2 text-yellow-400">
              Scope 2 (간접 배출)
            </h3>
            <ul className="text-sm space-y-1 text-gray-300">
              <li>• 한국전력 (그리드 전력)</li>
              <li>• 배출계수: 0.4593 tCO₂/MWh</li>
              <li>• 재생에너지 (0 tCO₂/MWh)</li>
            </ul>
          </div>

          <div className="p-4 bg-green-900/20 border border-green-700 rounded">
            <h3 className="font-bold mb-2 text-green-400">
              Scope 3 (기타)
            </h3>
            <ul className="text-sm space-y-1 text-gray-300">
              <li>• 운송 (화물차, 선박)</li>
              <li>• 출장 (항공, 철도)</li>
              <li>• 폐기물 처리</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 배출원별 상세 데이터 (테이블) */}
      {footprint && footprint.breakdown.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-bold mb-4">배출원별 상세 데이터</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4">카테고리</th>
                  <th className="text-left py-3 px-4">배출원</th>
                  <th className="text-right py-3 px-4">사용량</th>
                  <th className="text-right py-3 px-4">배출량</th>
                  <th className="text-right py-3 px-4">비율</th>
                </tr>
              </thead>
              <tbody>
                {footprint.breakdown.map((item, index) => (
                  <tr key={index} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="py-3 px-4">{item.category}</td>
                    <td className="py-3 px-4">{item.sourceType}</td>
                    <td className="text-right py-3 px-4">
                      {item.amount.toFixed(2)} {item.unit}
                    </td>
                    <td className="text-right py-3 px-4 font-medium">
                      {item.emission.toFixed(2)} tCO₂eq
                    </td>
                    <td className="text-right py-3 px-4">
                      <span className="px-2 py-1 bg-green-600/20 text-green-400 rounded text-sm">
                        {item.percentage.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}