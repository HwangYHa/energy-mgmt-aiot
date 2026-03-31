'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** /super-admin/erp → /admin/erp 영구 리다이렉트 */
export default function SuperAdminErpRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/admin/erp'); }, [router]);
  return null;
}
