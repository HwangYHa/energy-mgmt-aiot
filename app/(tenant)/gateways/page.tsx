// app/(tenant)/gateways/page.tsx
// 게이트웨이 관리는 /settings/gateways 에 구현되어 있음
import { redirect } from 'next/navigation';

export default function GatewaysRedirect() {
  redirect('/settings/gateways');
}
