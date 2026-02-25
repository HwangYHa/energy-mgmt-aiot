/**
 * app/(tenant)/dashboard/page.tsx — Server Component
 *
 * 서버에서 초기 데이터를 fetch → DashboardClient로 전달 (LCP 최적화)
 * DashboardClient는 SWR + Zustand SSE로 30초 자동 갱신 + 실시간 전력 오버레이
 */
import { cookies } from 'next/headers';
import DashboardClient from '@/components/dashboard/DashboardClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '대시보드 - 탄소이음',
  description: '에너지 소비 현황 및 탄소 배출량 실시간 모니터링',
};

async function fetchInitialStats(cookieHeader: string) {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    const res = await fetch(`${baseUrl}/api/dashboard/stats`, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    });

    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map(c => `${c.name}=${c.value}`)
    .join('; ');

  const initialData = await fetchInitialStats(cookieHeader);

  return <DashboardClient initialData={initialData} />;
}
