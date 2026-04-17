import { Metadata } from 'next';
import { DigitalTwinDashboard } from '@/components/digital-twin/DigitalTwinDashboard';

/**
 * 시설 현황 맵 페이지
 * 공간 계층(사이트→건물→층→구역) + 설비 노드 실시간 모니터링
 */
export const metadata: Metadata = {
  title: '시설 현황 맵 | 탄소이음',
  description: '사이트·건물·층별 설비 실시간 현황 및 이상 탐지',
};

export default function DigitalTwinPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
          시설 현황 맵
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          사이트·건물·층별 설비 상태를 한눈에 확인하고 이상 징후를 즉시 파악하세요
        </p>
      </div>

      <DigitalTwinDashboard />
    </div>
  );
}
