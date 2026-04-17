/**
 * GET /api/admin/backups — 백업 레코드 목록
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

  // 1) Try backupRecord model (may not exist in generated client)
  try {
    const model = (prisma as any).backupRecord;
    if (model?.findMany) {
      const isSA = auth.role === 'super_admin';
      const records = await model.findMany({
        where:   isSA ? {} : { tenantId: auth.tenantId },
        orderBy: { createdAt: 'desc' },
        take:    limit,
      });
      return successResponse(records ?? []);
    }
  } catch {
    // backupRecord table not migrated yet — fall through
  }

  // 2) Fallback: audit_log BACKUP_TRIGGERED events
  try {
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
    console.error('[Backups GET] auditLog fallback error:', err);
    // Return empty array — do NOT 500, ransomware tab handles empty gracefully
    return successResponse([]);
  }
}
