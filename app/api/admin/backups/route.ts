/**
 * GET /api/admin/backups — 백업 레코드 목록
 * backup_record 테이블이 생성되기 전까지 audit_log 기반 폴백 사용
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify';
import { successResponse, errorResponse } from '@/lib/api/response';
import { hasMinRole } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });
  if (!hasMinRole(auth.role, 'tenant_admin')) return errorResponse('PERMISSION_DENIED', { status: 403 });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(50, Number(searchParams.get('limit') || 10));

  try {
    // backup_record 모델이 생성된 경우 직접 조회
    const model = (prisma as any).backupRecord;
    if (model) {
      const isSA = auth.role === 'super_admin';
      const records = await model.findMany({
        where:   isSA ? {} : { tenantId: auth.tenantId },
        orderBy: { createdAt: 'desc' },
        take:    limit,
      });
      return successResponse(records);
    }

    // 폴백: audit_log의 BACKUP_TRIGGERED 이벤트에서 형태 변환
    const logs = await prisma.auditLog.findMany({
      where:   { tenantId: auth.tenantId, action: 'BACKUP_TRIGGERED' },
      orderBy: { createdAt: 'desc' },
      take:    limit,
      select:  { resourceId: true, metadata: true, createdAt: true },
    });

    const records = logs.map((log) => {
      const meta = (log.metadata as Record<string, unknown>) ?? {};
      return {
        id:          log.resourceId ?? '',
        backupType:  String(meta.storageType ?? 'local'),
        status:      String(meta.backupStatus ?? 'completed'),
        sizeBytes:   meta.sizeBytes ? Number(meta.sizeBytes) : null,
        storagePath: String(meta.backupPath ?? ''),
        completedAt: log.createdAt.toISOString(),
      };
    });

    return successResponse(records);
  } catch (err) {
    console.error('[Backups GET]', err);
    return errorResponse('SERVER_ERROR', { status: 500 });
  }
}
