/**
 * 이 페이지는 /admin/security (랜섬웨어 대응 탭)으로 통합되었습니다.
 */
import { redirect } from 'next/navigation';
export default function RansomwareRedirectPage() {
  redirect('/admin/security');
}
