import { ReactNode } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '인증 | 에너지 관리 플랫폼',
  description: '에너지 관리 시스템 로그인 및 회원가입',
};

export default function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
