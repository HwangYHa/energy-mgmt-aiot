import { redirect } from 'next/navigation';

/**
 * /monitoring/realtime → /dashboard/realtime 리다이렉트
 * 실시간 대시보드는 /dashboard/realtime에 통합
 */
export default function MonitoringRealtimePage() {
  redirect('/dashboard/realtime');
}
