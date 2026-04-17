// 이 페이지는 보안 모니터링으로 통합되었습니다.
// /admin/security → 랜섬웨어 대응 탭으로 이동
import { redirect } from 'next/navigation';

export default function RansomwareRedirectPage() {
  redirect('/admin/security');
}
