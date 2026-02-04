/**
 * 루트 페이지 - 에너지 관리 AIoT 랜딩 페이지 (최적화)
 *
 * SEO 최적화 + 초기 로딩 성능 최적화
 * - Server Component로 대부분 렌더링
 * - 인터랙션 필요 부분만 Client Component
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { UserRole } from '@prisma/client';

// 최적화된 랜딩 컴포넌트들
import { Navigation } from '@/components/landing/Navigation';
import { Hero } from '@/components/landing/Hero';
import { Features } from '@/components/landing/Features';
import { Metrics } from '@/components/landing/Metrics';
import { SocialProof } from '@/components/landing/SocialProof';
import { CTASection } from '@/components/landing/CTASection';
import { Footer } from '@/components/landing/Footer';

export default async function HomePage() {
  // 서버 사이드에서 세션 체크
  const session = await getServerSession(authOptions);

  // 로그인 상태면 역할에 따라 적절한 페이지로 이동
  if (session?.user) {
    const role = session.user.role as UserRole;

    // Viewer는 읽기 전용 대시보드로
    if (role === 'viewer') {
      redirect('/dashboard/viewer');
    }

    // 나머지 역할은 일반 대시보드로
    redirect('/dashboard');
  }

  // 미로그인 상태면 최적화된 랜딩 페이지 표시
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <Navigation />
      <Hero />
      <Features />
      <Metrics />
      <SocialProof />
      <CTASection />
      <Footer />
    </main>
  );
}
