/**
 * features/carbon — 탄소 배출 Feature Slice 공개 API
 *
 * 외부에서는 이 배럴 파일을 통해서만 import합니다.
 * 내부 구현 상세는 캡슐화합니다.
 */

// 메인 컴포넌트
export { CarbonDashboard } from './components/CarbonDashboard';

// 독립 모달 (다른 화면에서 재사용 가능)
export { FuelModal } from './components/FuelModal';
export { TransportModal } from './components/TransportModal';

// 훅 (서버 컴포넌트 페이지에서 prefetch 등에 활용)
export { useCarbonData, useCarbonEmissions, useCarbonFootprint, useCarbonExport } from './hooks/use-carbon-data';
export type { MonthlyEmission, CarbonFootprint } from './hooks/use-carbon-data';
