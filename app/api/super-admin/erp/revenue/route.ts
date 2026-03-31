/**
 * GET /api/super-admin/erp/revenue
 * 플랫폼 수익 집계 — super_admin 전용
 */

import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { successResponse, errorResponse } from '@/lib/api/response';
import { isSuperAdmin } from '@/lib/auth/permissions';
import { ERPService } from '@/lib/services/erp.service';

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });
  if (!isSuperAdmin(auth.role)) return errorResponse('PERMISSION_DENIED', { status: 403 });

  const { searchParams } = new URL(request.url);
  const period    = searchParams.get('period') || new Date().toISOString().slice(0, 7);
  const breakdown = searchParams.get('breakdown') || 'by_month';

  try {
    const summary = await ERPService.getPlatformRevenueSummary(period);

    let breakdownData: unknown[] = [];
    if (breakdown === 'by_month') {
      const months: string[] = [];
      const base = new Date(period + '-01');
      for (let i = 11; i >= 0; i--) {
        const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
      breakdownData = await Promise.all(
        months.map(async (m) => {
          const s = await ERPService.getPlatformRevenueSummary(m);
          return { period: m, revenue: s.totalRevenue, mrr: s.mrr };
        }),
      );
    }

    return successResponse({ summary, breakdown: breakdownData });
  } catch (err) {
    console.error('[ERP Revenue]', err);
    return errorResponse('SERVER_ERROR', { status: 500 });
  }
}
