/**
 * GET    /api/admin/sandbox        - 규제 샌드박스 목록 (super_admin)
 * POST   /api/admin/sandbox        - 규제 샌드박스 신청
 * PATCH  /api/admin/sandbox/[id]   - 심사 상태 변경 (super_admin only)
 *
 * 규제 샌드박스 (regulatory sandbox):
 * 신기술·신서비스를 기존 규제에서 일시적으로 면제받아 실증할 수 있는 제도
 */

import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { verifyAuth, isSuperAdmin } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  serverErrorResponse,
} from '@/lib/api/response';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = ['pending','reviewing','approved','rejected','expired','withdrawn'] as const;
const VALID_TYPES = ['energy_trading','re100','demand_response','carbon_market','ems_new','p2p_energy','other'] as const;

function mapSandbox(row: any) {
  return {
    id:              row.id,
    tenantId:        row.tenant_id,
    tenantName:      row.tenant_name ?? null,
    title:           row.title,
    description:     row.description  ?? null,
    regulationType:  row.regulation_type,
    exemptionScope:  row.exemption_scope ?? null,
    status:          row.status,
    appliedAt:       row.applied_at,
    reviewStartedAt: row.review_started_at ?? null,
    reviewedAt:      row.reviewed_at  ?? null,
    reviewedBy:      row.reviewed_by  ?? null,
    expireDate:      row.expire_date  ?? null,
    reviewNote:      row.review_note  ?? null,
    conditions:      row.conditions   ?? null,
    applicantName:   row.applicant_name  ?? null,
    applicantEmail:  row.applicant_email ?? null,
    contactPhone:    row.contact_phone   ?? null,
    createdAt:       row.created_at,
    updatedAt:       row.updated_at,
  };
}

// ─── GET ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const status    = searchParams.get('status');
    const tenantId  = searchParams.get('tenantId');
    const regType   = searchParams.get('regulationType');
    const skip = parseInt(searchParams.get('skip') || '0');
    const take = Math.min(parseInt(searchParams.get('take') || '20'), 100);

    // super_admin: 전체 조회, 일반 테넌트: 본인 것만
    const effectiveTenantId = isSuperAdmin(auth) ? (tenantId ?? null) : auth.tenantId;

    const conditions: string[] = ['1=1'];
    const args: unknown[] = [];

    if (effectiveTenantId) { conditions.push('r.tenant_id = ?'); args.push(effectiveTenantId); }
    if (status)   { conditions.push('r.status = ?');           args.push(status); }
    if (regType)  { conditions.push('r.regulation_type = ?');  args.push(regType); }

    const where = conditions.join(' AND ');

    const [rows, countRows] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(
        `SELECT r.*, t.name AS tenant_name
         FROM regulatory_sandbox r
         LEFT JOIN tenant t ON r.tenant_id = t.id
         WHERE ${where}
         ORDER BY r.applied_at DESC
         LIMIT ? OFFSET ?`,
        ...args, take, skip,
      ),
      prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
        `SELECT COUNT(*) AS cnt FROM regulatory_sandbox r WHERE ${where}`,
        ...args,
      ),
    ]);

    const total = Number(countRows[0]?.cnt ?? 0);

    // 상태별 통계 (super_admin에게만)
    let stats = null;
    if (isSuperAdmin(auth)) {
      const statRows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT status, COUNT(*) AS cnt FROM regulatory_sandbox GROUP BY status`
      );
      stats = Object.fromEntries(statRows.map((r) => [r.status, Number(r.cnt)]));
    }

    return successResponse({
      items: rows.map(mapSandbox),
      pagination: { total, skip, take },
      stats,
    });
  } catch (error) {
    console.error('[sandbox] 목록 조회 오류:', error);
    return serverErrorResponse();
  }
}

// ─── POST ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const body = await request.json().catch(() => null);
    if (!body?.title || !body?.regulationType) {
      return errorResponse('VALIDATION_ERROR', {
        details: { message: 'title, regulationType 필수' },
      });
    }

    if (!VALID_TYPES.includes(body.regulationType)) {
      return errorResponse('VALIDATION_ERROR', {
        details: { message: `유효하지 않은 regulationType. 허용값: ${VALID_TYPES.join(', ')}` },
      });
    }

    const id  = randomUUID();
    const now = new Date();

    await prisma.$executeRawUnsafe(
      `INSERT INTO regulatory_sandbox
         (id, tenant_id, title, description, regulation_type, exemption_scope,
          status, applied_at, applicant_name, applicant_email, contact_phone,
          created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`,
      id,
      auth.tenantId,
      String(body.title).slice(0, 300),
      body.description ?? null,
      body.regulationType,
      body.exemptionScope ?? null,
      now,
      body.applicantName  ?? null,
      body.applicantEmail ?? null,
      body.contactPhone   ?? null,
      now,
      now,
    );

    console.info(`[sandbox] 신규 신청: ${id} (테넌트: ${auth.tenantId})`);
    return successResponse({ id, status: 'pending', createdAt: now }, { status: 201 });
  } catch (error) {
    console.error('[sandbox] 신청 오류:', error);
    return serverErrorResponse();
  }
}

// ─── PATCH ───────────────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!isSuperAdmin(auth)) {
      return forbiddenResponse({ message: '심사 권한이 없습니다' });
    }

    const body = await request.json().catch(() => null);
    const { id, status, reviewNote, expireDate } = body ?? {};

    if (!id || !status) {
      return errorResponse('VALIDATION_ERROR', { details: { message: 'id, status 필수' } });
    }
    if (!VALID_STATUSES.includes(status)) {
      return errorResponse('VALIDATION_ERROR', {
        details: { message: `유효하지 않은 status. 허용값: ${VALID_STATUSES.join(', ')}` },
      });
    }

    const existing = await prisma.$queryRawUnsafe<any[]>(
      'SELECT id, status FROM regulatory_sandbox WHERE id = ? LIMIT 1', id
    );
    if (existing.length === 0) {
      return errorResponse('RESOURCE_NOT_FOUND', { status: 404 });
    }

    const now = new Date();
    const isReviewAction = ['approved', 'rejected'].includes(status);

    await prisma.$executeRawUnsafe(
      `UPDATE regulatory_sandbox SET
         status = ?,
         review_note = ?,
         reviewed_at = ?,
         reviewed_by = ?,
         review_started_at = CASE WHEN review_started_at IS NULL AND ? = 'reviewing' THEN ? ELSE review_started_at END,
         expire_date = COALESCE(?, expire_date),
         updated_at = ?
       WHERE id = ?`,
      status,
      reviewNote ?? null,
      isReviewAction ? now : null,
      isReviewAction ? auth.userId : null,
      status, now,
      expireDate ? new Date(expireDate) : null,
      now,
      id,
    );

    console.info(`[sandbox] 상태 변경: ${id} → ${status} (by ${auth.userId})`);
    return successResponse({ id, status, updatedAt: now });
  } catch (error) {
    console.error('[sandbox] 상태 변경 오류:', error);
    return serverErrorResponse();
  }
}
