// app/(tenant)/devices/new/page.tsx
// /devices/new 접근 시 /devices 페이지로 리다이렉트 (디바이스 생성은 모달 방식)
import { redirect } from 'next/navigation';

export default function DeviceNewRedirect() {
  redirect('/devices');
}
