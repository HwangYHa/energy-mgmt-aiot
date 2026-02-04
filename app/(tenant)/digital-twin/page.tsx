import { Metadata } from 'next';
import { DigitalTwinDashboard } from '@/components/digital-twin/DigitalTwinDashboard';

/**
 * 디지털 트윈 대시보드 페이지
 * 실시간 에너지 시설 모니터링 및 즉시 상태 판단
 */
export const metadata: Metadata = {
  title: '디지털 트윈 - EnergyAI',
  description: '실시간 에너지 시설 디지털 트윈 모니터링',
};

export default function DigitalTwinPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
          디지털 트윈 대시보드
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          실시간 시설 상태를 한눈에 확인하고 이상 징후를 즉시 파악하세요
        </p>
      </div>

      <DigitalTwinDashboard />
    </div>
  );
}
