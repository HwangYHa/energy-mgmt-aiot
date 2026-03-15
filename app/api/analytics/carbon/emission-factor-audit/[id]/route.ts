/**
 * GET /api/analytics/carbon/emission-factor-audit/[id]
 *   배출계수 변경 이력 조회 (Hash Chain 포함) — Big4 감사용
 *
 * GET /api/analytics/carbon/emission-factor-audit/[id]?action=verify
 *   Hash Chain 무결성 검증
 *
 * PATCH /api/analytics/carbon/emission-factor-audit/[id]
 *   배출계수 승인 또는 폐지
 *   body: { action: 'approve' | 'deprecate', reason?: string }
 */

import { type NextRequest } from 'next/server';
import { verifyAuth, requireRoleOrHigher } from '@/lib/auth/verify';
import { successResponse, errorResponse } from '@/lib/api/response';
import { EmissionFactorAuditService } from '@/lib/domains/carbon/services/emission-factor-audit.service';
import { EmissionFactorService } from '@/lib/domains/carbon/services/emission-factor.service';
import { UserRole } from '@/lib/constants/roles';

export const dynamic = 'force-dynamic';

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(req);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });

  const { id: factorId } = await params;
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  try {
    // ?action=verify → 무결성 검증
    if (action === 'verify') {
      const result = await EmissionFactorAuditService.verifyIntegrity(factorId);
      return successResponse(result);
    }

    // 기본: 변경 이력 조회
    const page     = parseInt(searchParams.get('page') ?? '1');
    const pageSize = parseInt(searchParams.get('pageSize') ?? '20');
    const changeType = searchParams.get('changeType') as any;

    const history = await EmissionFactorAuditService.getChangeHistory(factorId, {
      page,
      pageSize,
      changeType,
    });

    return successResponse(history);
  } catch (e) {
    console.error('[emission-factor-audit GET]', e);
    return errorResponse('SERVER_ERROR', { status: 500 });
  }
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(req);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });

  // tenant_admin 이상 권한 필요
  if (!requireRoleOrHigher(auth, 'tenant_admin' as UserRole)) {
    return errorResponse('AUTH_REQUIRED', { status: 403 });
  }

  const { id: factorId } = await params;

  let body: { action?: string; reason?: string };
  try { body = await req.json(); } catch {
    return errorResponse('VALIDATION_ERROR', { details: { message: 'JSON 파싱 오류' } });
  }

  if (!body.action || !['approve', 'deprecate'].includes(body.action)) {
    return errorResponse('VALIDATION_ERROR', {
      details: { message: 'action은 "approve" 또는 "deprecate"여야 합니다.' },
    });
  }

  try {
    if (body.action === 'approve') {
      await EmissionFactorService.approve({
        factorId,
        approvedBy: auth.userId,
        approvalReason: body.reason,
      });
      return successResponse({ message: '배출계수가 승인되었습니다.' });
    }

    if (body.action === 'deprecate') {
      if (!body.reason) {
        return errorResponse('VALIDATION_ERROR', {
          details: { message: '폐지 사유(reason)는 필수입니다.' },
        });
      }
      await EmissionFactorService.deprecate(factorId, body.reason, auth.userId);
      return successResponse({ message: '배출계수가 폐지되었습니다.' });
    }

    return errorResponse('VALIDATION_ERROR', { details: { message: '알 수 없는 action' } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '처리 실패';
    if (msg.includes('찾을 수 없') || msg.includes('존재')) {
      return errorResponse('RESOURCE_NOT_FOUND', { status: 404, details: { message: msg } });
    }
    if (msg.includes('이미 승인')) {
      return errorResponse('RESOURCE_CONFLICT', { details: { message: msg } });
    }
    console.error('[emission-factor-audit PATCH]', e);
    return errorResponse('SERVER_ERROR', { status: 500 });
  }
}
