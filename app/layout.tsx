// app/layout.tsx
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '에너지 관리 플랫폼',
  description: '탄소 중립 에너지 관리 SaaS',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="bg-slate-900 text-white">
        {children}
      </body>
    </html>
  );
}
