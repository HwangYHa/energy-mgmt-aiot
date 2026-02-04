import { ReactNode } from 'react';
import { Navigation } from '@/components/landing/Navigation';
import { Footer } from '@/components/landing/Footer';

/**
 * 공개 페이지 공통 레이아웃
 *
 * 랜딩, 가격, 솔루션 등 모든 공개 페이지에 적용
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <Navigation />
      <main className="pt-16">{children}</main>
      <Footer />
    </div>
  );
}
