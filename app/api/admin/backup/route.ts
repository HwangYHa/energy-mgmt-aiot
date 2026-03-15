/**
 * PUT /api/admin/backup — 수동 백업 트리거 (실제 mysqldump 실행)
 * GET /api/admin/backup — 백업 설정 + 최근 이력 조회
 *
 * 스토리지 유형:
 *  - local: mysqldump → gzip → 로컬 파일 시스템 (즉시 실행)
 *  - s3:    mysqldump → 로컬 임시 → S3 업로드 (AWS SDK 필요)
 *  - gcs:   mysqldump → 로컬 임시 → GCS 업로드 (GCS SDK 필요)
 *
 * 권한: tenant_admin 이상
 */

import { NextRequest } from 'next/server';
import { verifyAuth, requireRoleOrHigher } from '@/lib/auth/verify';
import { getSystemSettings } from '@/lib/services/system-settings.service';
import {
  runLocalBackup,
  resolveBackupPath,
  getDefaultBackupDir,
  formatFileSize,
} from '@/lib/services/backup.service';
import { prisma } from '@/lib/db/prisma';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  serverErrorResponse,
} from '@/lib/api/response';
import { UserRole } from '@/lib/constants/roles';

export const dynamic = 'force-dynamic';

// ── PUT: 백업 실행 ────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!requireRoleOrHigher(auth, 'tenant_admin' as UserRole)) {
      return forbiddenResponse();
    }

    const body = await request.json().catch(() => ({}));
    const trigger = (body?.trigger as string) ?? 'manual';

    // 테넌트 백업 설정 조회
    const settings = await getSystemSettings(auth.tenantId);
    const backupCfg = settings.backup;

    const startedAt = new Date();
    const backupId  = `backup_${auth.tenantId.slice(0, 8)}_${Date.now()}`;

    let backupPath: string;
    let resultStatus: 'success' | 'failed' | 'not_supported';
    let message: string;
    let sizeBytes: number | undefined;
    let sizeMb: string | undefined;
    let durationMs = 0;
    let errorDetail: string | undefined;

    // ── 스토리지 유형별 백업 실행 ─────────────────────────────────

    if (backupCfg.storageType === 'local') {
      // 실제 mysqldump 실행
      backupPath = resolveBackupPath(backupCfg.storagePath, backupId);
      const result = await runLocalBackup(backupPath);

      resultStatus = result.status;
      durationMs   = result.durationMs;
      sizeBytes    = result.sizeBytes;
      sizeMb       = result.sizeMb;
      errorDetail  = result.error;

      if (result.status === 'success') {
        const sizeStr = sizeBytes ? ` (${formatFileSize(sizeBytes)})` : '';
        const secStr  = (durationMs / 1000).toFixed(1);
        message = `로컬 백업 완료${sizeStr} — ${secStr}초 소요. 저장 경로: ${backupPath}`;
      } else {
        message = `로컬 백업 실패: ${result.error}`;
      }

    } else if (backupCfg.storageType === 's3') {
      // S3: 로컬 덤프 후 업로드 (AWS SDK @aws-sdk/client-s3 필요)
      const s3Path = backupCfg.storagePath ?? `s3://tansoeum-backups/${auth.tenantId}`;
      backupPath   = `${s3Path}/${backupId}.sql.gz`;
      resultStatus = 'not_supported' as 'failed';
      message = `S3 백업은 @aws-sdk/client-s3 설치 후 지원됩니다. 현재 로컬(mysqldump) 백업으로 전환하거나, AWS SDK를 설치하세요.`;
      errorDetail = message;
      // Fallback: log queue intent
      console.info(`[Backup] S3 백업 미지원 (SDK 미설치): ${backupPath}`);

    } else {
      // GCS
      const gcsPath = backupCfg.storagePath ?? `gs://tansoeum-backups/${auth.tenantId}`;
      backupPath    = `${gcsPath}/${backupId}.sql.gz`;
      resultStatus  = 'not_supported' as 'failed';
      message = `GCS 백업은 @google-cloud/storage 설치 후 지원됩니다. 현재 로컬(mysqldump) 백업으로 전환하거나, GCS SDK를 설치하세요.`;
      errorDetail = message;
      console.info(`[Backup] GCS 백업 미지원 (SDK 미설치): ${backupPath}`);
    }

    // ── 감사 로그 기록 ────────────────────────────────────────────

    try {
      await prisma.auditLog.create({
        data: {
          userId:       auth.userId,
          tenantId:     auth.tenantId,
          action:       'BACKUP_TRIGGERED',
          resourceType: 'backup',
          resourceId:   backupId,
          metadata: {
            trigger,
            storageType:  backupCfg.storageType,
            backupPath,
            backupStatus: resultStatus,
            sizeBytes:    sizeBytes ?? null,
            durationMs,
            startedAt:    startedAt.toISOString(),
            error:        errorDetail ?? null,
          } as never,
        },
      });
    } catch (logErr) {
      console.warn('[Backup] 감사 로그 기록 실패:', logErr);
    }

    // ── 완료 알림 이메일 ──────────────────────────────────────────
    if (backupCfg.notifyEmail && resultStatus === 'success') {
      // notifyByEmail(backupCfg.notifyEmail, '백업 완료', message);
      console.info(`[Backup] 완료 알림 예정: ${backupCfg.notifyEmail}`);
    }

    const isSuccess = resultStatus === 'success';
    return successResponse(
      {
        backupId,
        status:              resultStatus,
        message,
        storageType:         backupCfg.storageType,
        backupPath,
        sizeBytes,
        sizeMb,
        durationMs,
        startedAt:           startedAt.toISOString(),
        includesAttachments: backupCfg.includeAttachments,
        error:               errorDetail,
      },
      isSuccess ? undefined : { status: 200 },   // 항상 200 (UI에서 status 필드로 판단)
    );

  } catch (error) {
    console.error('[Backup] 백업 트리거 오류:', error);
    return serverErrorResponse();
  }
}

// ── GET: 백업 설정 + 이력 조회 ────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!requireRoleOrHigher(auth, 'tenant_admin' as UserRole)) {
      return forbiddenResponse();
    }

    const settings = await getSystemSettings(auth.tenantId);

    // 최근 백업 이력 (감사 로그)
    const recentBackups = await prisma.auditLog.findMany({
      where:   { tenantId: auth.tenantId, action: 'BACKUP_TRIGGERED' },
      orderBy: { createdAt: 'desc' },
      take:    10,
      select:  { resourceId: true, metadata: true, createdAt: true },
    });

    return successResponse({
      config: settings.backup,
      defaultDir: getDefaultBackupDir(),
      recentBackups: recentBackups.map((b) => ({
        backupId:  b.resourceId,
        metadata:  b.metadata,
        createdAt: b.createdAt.toISOString(),
      })),
    });

  } catch (error) {
    console.error('[Backup] 조회 오류:', error);
    return serverErrorResponse();
  }
}
