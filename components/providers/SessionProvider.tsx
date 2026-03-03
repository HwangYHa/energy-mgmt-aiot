'use client';

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';
import { ReactNode } from 'react';

interface SessionProviderProps {
  children: ReactNode;
  /** 서버에서 미리 조회한 세션 (app/layout.tsx 서버 컴포넌트에서 전달).
   *  주입하면 클라이언트 측 GET /api/auth/session 재조회를 건너뛰어
   *  새로고침 직후에도 status가 즉시 'authenticated'로 시작함. */
  session?: Session | null;
}

export function SessionProvider({ children, session }: SessionProviderProps) {
  return (
    <NextAuthSessionProvider session={session}>
      {children}
    </NextAuthSessionProvider>
  );
}
