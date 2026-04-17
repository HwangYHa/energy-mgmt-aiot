/**
 * POST /api/admin/run-migration
 *
 * super_admin 전용 일회성 DB 마이그레이션 실행 엔드포인트.
 * 메뉴명 리네이밍 적용:
 *   - admin 그룹: Super Admin → 플랫폼 관리
 *   - dashboard_realtime: 실시간 현황 → 실시간 모니터링
 *   - dashboard_viewer: 뷰어 대시보드 → 에너지 현황판
 *   - dashboard_digital_twin: 디지털 트윈 → 시설 현황 맵
 *   - management_subscription: 구독 관리 → 구독 · 요금제
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth, requireRoleOrHigher } from '@/lib/auth/verify';
import { successResponse, unauthorizedResponse, forbiddenResponse, serverErrorResponse } from '@/lib/api/response';
import { UserRole } from '@/lib/constants/roles';

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!requireRoleOrHigher(auth, 'super_admin' as UserRole)) return forbiddenResponse();

    const results: string[] = [];

    // 1. 메뉴 그룹 리네이밍
    const groupResult = await prisma.menuGroup.updateMany({
      where: { code: 'admin', name: 'Super Admin' },
      data: { name: '플랫폼 관리' },
    });
    results.push(`menuGroup admin: ${groupResult.count}건 업데이트`);

    // 2. 메뉴 아이템 리네이밍
    const itemRenames = [
      { code: 'dashboard_realtime',    from: '실시간 현황',   to: '실시간 모니터링' },
      { code: 'dashboard_viewer',      from: '뷰어 대시보드', to: '에너지 현황판' },
      { code: 'dashboard_digital_twin',from: '디지털 트윈',   to: '시설 현황 맵' },
      { code: 'management_subscription',from: '구독 관리',    to: '구독 · 요금제' },
    ];

    for (const { code, to } of itemRenames) {
      const r = await prisma.menuItem.updateMany({
        where: { code },
        data: { name: to },
      });
      results.push(`menuItem ${code}: ${r.count}건 업데이트 → "${to}"`);
    }

    return successResponse({ results, message: '메뉴명 마이그레이션 완료' });
  } catch (error) {
    console.error('[Migration] 메뉴명 업데이트 오류:', error);
    return serverErrorResponse();
  }
}
