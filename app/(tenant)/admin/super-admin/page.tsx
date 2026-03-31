'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** /admin/super-admin → /admin/retention 영구 리다이렉트 */
export default function SuperAdminRetentionRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/admin/retention'); }, [router]);
  return null;
}
