// app/(tenant)/reports/page.tsx
'use client';

import { useState } from 'react';
import { FileText, Download, Calendar, Filter, CheckCircle } from 'lucide-react';

export default function ReportsPage() {
  const [reportType, setReportType] = useState('energy');
  const [period, setPeriod] = useState('monthly');
  const [format, setFormat] = useState('pdf');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);

    try {
      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({
          type: reportType,
          period,
          startDate,
          endDate,
          format,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // 파일 다운로드
        const link = document.createElement('a');
        link.href = data.fileUrl;
        link.download = `report-${data.reportId}.${format}`;
        link.click();

        alert('리포트가 생성되었습니다.');
      } else {
        alert('리포트 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('Report generation error:', error);
      alert('리포트 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileText className="w-8 h-8" />
          리포트 생성
        </h1>
        <p className="text-gray-400 mt-1">에너지 사용 리포트를 생성하고 다운로드합니다</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* 왼쪽: 설정 */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Filter className="w-5 h-5" />
            리포트 설정
          </h2>

          <div className="space-y-4">
            {/* 리포트 종류 */}
            <div>
              <label className="block text-sm font-medium mb-2">
                리포트 종류
              </label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 text-lg"
              >
                <option value="energy">에너지 사용량</option>
                <option value="cost">비용 분석</option>
                <option value="carbon">탄소 배출</option>
                <option value="comprehensive">종합 리포트</option>
              </select>
            </div>

            {/* 기간 */}
            <div>
              <label className="block text-sm font-medium mb-2">
                기간
              </label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 text-lg"
              >
                <option value="daily">일간</option>
                <option value="weekly">주간</option>
                <option value="monthly">월간</option>
                <option value="yearly">연간</option>
                <option value="custom">사용자 정의</option>
              </select>
            </div>

            {/* 날짜 범위 (사용자 정의 시) */}
            {period === 'custom' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    시작일
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    종료일
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
              </>
            )}

            {/* 포맷 */}
            <div>
              <label className="block text-sm font-medium mb-2">
                파일 형식
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="format"
                    value="pdf"
                    checked={format === 'pdf'}
                    onChange={(e) => setFormat(e.target.value)}
                    className="w-5 h-5"
                  />
                  <span>PDF</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="format"
                    value="excel"
                    checked={format === 'excel'}
                    onChange={(e) => setFormat(e.target.value)}
                    className="w-5 h-5"
                  />
                  <span>Excel</span>
                </label>
              </div>
            </div>

            {/* 생성 버튼 */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-bold text-lg transition-colors flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>생성 중...</span>
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5" />
                  <span>리포트 생성</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 오른쪽: 미리보기 */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-bold mb-4">리포트 미리보기</h2>

          <div className="bg-white text-black rounded-lg p-6 h-96 overflow-y-auto">
            <h1 className="text-2xl font-bold text-blue-600 mb-4">
              ⚡ {reportType === 'energy' ? '에너지 사용량' : '비용 분석'} 리포트
            </h1>
            
            <div className="mb-4">
              <p className="text-gray-600">
                <strong>기간:</strong> {period === 'custom' ? `${startDate} ~ ${endDate}` : period}
              </p>
              <p className="text-gray-600">
                <strong>형식:</strong> {format.toUpperCase()}
              </p>
            </div>

            <div className="bg-gray-100 p-4 rounded mb-4">
              <h2 className="font-bold mb-2">요약</h2>
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between">
                  <span>총 에너지 사용량</span>
                  <span className="font-bold">12,345 kWh</span>
                </li>
                <li className="flex justify-between">
                  <span>피크 전력</span>
                  <span className="font-bold">850 kW</span>
                </li>
                <li className="flex justify-between">
                  <span>예상 비용</span>
                  <span className="font-bold">₩1,480,000</span>
                </li>
              </ul>
            </div>

            <p className="text-xs text-gray-500 text-center mt-8">
              실제 데이터는 리포트 생성 시 반영됩니다
            </p>
          </div>
        </div>
      </div>

      {/* 규제 보고서 */}
      <div className="mt-6 bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-400" />
          규제 보고서
        </h2>

        <div className="grid grid-cols-3 gap-4">
          <button className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 p-4 rounded-lg transition-all">
            <div className="text-lg font-bold mb-1">온실가스 배출량</div>
            <div className="text-sm opacity-75">환경부 보고</div>
          </button>

          <button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 p-4 rounded-lg transition-all">
            <div className="text-lg font-bold mb-1">RE100</div>
            <div className="text-sm opacity-75">재생에너지 보고</div>
          </button>

          <button className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 p-4 rounded-lg transition-all">
            <div className="text-lg font-bold mb-1">에너지 사용량</div>
            <div className="text-sm opacity-75">에너지관리공단</div>
          </button>
        </div>
      </div>

      {/* 최근 리포트 */}
      <div className="mt-6 bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          최근 생성된 리포트
        </h2>

        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between p-4 bg-gray-700/50 rounded hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-blue-400" />
                <div>
                  <div className="font-medium">월간 에너지 리포트</div>
                  <div className="text-sm text-gray-400">2026-01-{i.toString().padStart(2, '0')}</div>
                </div>
              </div>
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors">
                <Download className="w-4 h-4" />
                <span>다운로드</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}