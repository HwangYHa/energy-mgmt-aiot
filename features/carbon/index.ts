// features/carbon — Feature Slice 공개 API
// 이 파일만 import해서 carbon 기능 전체에 접근

export { CarbonDashboard } from './components/CarbonDashboard';
export { FuelModal }       from './components/FuelModal';
export { TransportModal }  from './components/TransportModal';
export { useCarbonData, useCarbonExport } from './hooks/use-carbon-data';
export type { MonthlyEmission, CarbonFootprint } from './hooks/use-carbon-data';
