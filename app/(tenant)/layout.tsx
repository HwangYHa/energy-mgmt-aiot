/**
 * Tenant Layout - HMI Style
 *
 * 산업용 HMI + 현대적 SaaS UI/UX 결합
 * - 다크 테마 기반
 * - 접기/펴기 가능한 사이드바
 * - 반응형 레이아웃
 */
'use client';

import { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import ToastContainer from '@/components/ui/ToastContainer';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { cn } from '@/lib/utils';

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // h-screen + [height:100dvh]: iOS Safari 주소창 포함 viewport 높이 정확히 계산
  return (
    <div className="flex h-screen [height:100dvh] bg-slate-950 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Desktop */}
      {/* wrapper 너비는 collapsed 상태에 따라 고정 — hover 확장은 absolute 오버레이 */}
      <div
        className={cn(
          'hidden lg:block flex-shrink-0 transition-all duration-300',
          sidebarCollapsed ? 'w-16' : 'w-64'
        )}
      >
        <Sidebar
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        />
      </div>

      {/* Sidebar - Mobile */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 lg:hidden transition-transform duration-300',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <Sidebar
          collapsed={false}
          onCollapsedChange={() => setMobileMenuOpen(false)}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />

        {/* Page Content — ErrorBoundary로 페이지 오류가 레이아웃 전체를 crash하는 것 방지 */}
        <main className="flex-1 overflow-y-auto bg-slate-950">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>

      {/* 전역 Toast 알림 */}
      <ToastContainer />
    </div>
  );
}
