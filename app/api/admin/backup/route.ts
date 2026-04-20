/**
 * PUT /api/admin/backup — 수동 백업 트리거 (테넌트별 데이터 추출)
 * GET /api/admin/backup — 백업 설정 + 최근 이력 조회
 *
 * ┌──────────────────────────────────────────────────────────────────┐
 * │  백업 방식: 테넌트별 선택적 추출 (전체 DB 덤프 X)                 │
 * │  - Prisma로 해당 tenantId 데이터만 추출 → JSON Lines → gzip      │
 * │  - 타 업체 데이터 절대 포함 안 됨 (멀티테넌트 격리 보장)           │
 * │                                                                  │
 * │  스토리지 유형:                                                   │
 * │  - local: 서버 로컬 파일시스템 저장                               │
 * │  - ncp:   네이버 클라우드 Object Storage (S3 호환 API) — 권장     │
 * │  - s3:    AWS S3                                                 │
 * │  - gcs:   미지원                                                 │
 * └──────────────────────────────────────────────────────────────────┘
 *
 * 권한: tenant_admin 이상
 */

import { NextRequest } from 'next/server';
import { unlinkSync } from 'fs';
import { verifyAuth, requireRoleOrHigher } from '@/lib/auth/verify';
import { getSystemSettings } from '@/lib/services/system-settings.service';
import {
  runTenantDataExport,
  resolveBackupPath,
  getDefaultBackupDir,
  formatFileSize,
  uploadToObjectStorage,
  getNcpConfig,
  getAwsS3Config,
} from '@/lib/services/backup.service';
import { sendBackupNotificationEmail } from '@/lib/services/email.service';
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

    const body    = await request.json().catch(() => ({}));
    const trigger = (body?.trigger as string) ?? 'manual';

    const settings  = await getSystemSettings(auth.tenantId);
    const backupCfg = settings.backup;

    const startedAt = new Date();
    const backupId  = `backup_${auth.tenantId.slice(0, 8)}_${Date.now()}`;

    let backupPath: string;
    let resultStatus: 'success' | 'failed';
    let message: string;
    let sizeBytes: number | undefined;
    let sizeMb: string | undefined;
    let durationMs  = 0;
    let recordCount: number | undefined;
    let errorDetail: string | undefined;

    // ─── 1단계: 로컬에 테넌트 데이터 추출 ───────────────────────

    // local 저장소는 최종 경로로, ncp/s3는 임시 경로로 먼저 로컬 생성
    const localPath = resolveBackupPath(
      backupCfg.storageType === 'local' ? backupCfg.storagePath : undefined,
      backupId,
      'jsonl.gz',
    );

    const exportResult = await runTenantDataExport(auth.tenantId, localPath);

    if (exportResult.status === 'failed') {
      backupPath  = localPath;
      resultStatus = 'failed';
      message     = `테넌트 데이터 추출 실패: ${exportResult.error}`;
      durationMs  = exportResult.durationMs;
      errorDetail = exportResult.error;

    } else {
      // 추출 성공
      sizeBytes   = exportResult.sizeBytes;
      sizeMb      = exportResult.sizeMb;
      durationMs  = exportResult.durationMs;
      recordCount = exportResult.recordCount;

      // ─── 2단계: 스토리지별 처리 ────────────────────────────────

      if (backupCfg.storageType === 'local') {
        backupPath   = localPath;
        resultStatus = 'success';
        const sizeStr = sizeBytes ? ` (${formatFileSize(sizeBytes)})` : '';
        const secStr  = (durationMs / 1000).toFixed(1);
        const recStr  = recordCount ? `, 레코드 ${recordCount.toLocaleString()}건` : '';
        message = `로컬 백업 완료${sizeStr}${recStr} — ${secStr}초 소요\n저장 경로: ${localPath}`;

      } else if (backupCfg.storageType === 'ncp' || backupCfg.storageType === 's3') {
        let uploadSucceeded = false;
        try {
          const cfg        = backupCfg.storageType === 'ncp' ? getNcpConfig() : getAwsS3Config();
          // 원격 키: {storagePath접두어}/{tenantId}/{backupId}.jsonl.gz
          const pathPrefix = backupCfg.storagePath?.trim() || `tansoeum-backups/${auth.tenantId}`;
          const remoteKey  = `${pathPrefix}/${backupId}.jsonl.gz`;

          const uploadResult = await uploadToObjectStorage(localPath, remoteKey, cfg);
          backupPath       = uploadResult.url;
          resultStatus     = 'success';
          uploadSucceeded  = true;

          const sizeStr = sizeBytes ? ` (${formatFileSize(sizeBytes)})` : '';
          const secStr  = (durationMs / 1000).toFixed(1);
          const recStr  = recordCount ? `, 레코드 ${recordCount.toLocaleString()}건` : '';
          const typeLbl = backupCfg.storageType === 'ncp' ? 'NCP Object Storage' : 'AWS S3';
          message = `${typeLbl} 백업 완료${sizeStr}${recStr} — ${secStr}초 소요\n저장 경로: ${remoteKey}`;

        } catch (uploadErr) {
          // 업로드 실패 시 로컬 파일은 백업으로 유지
          backupPath   = localPath;
          resultStatus = 'failed';
          errorDetail  = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
          message      = `클라우드 업로드 실패 (로컬 파일 보존): ${errorDetail}`;
        } finally {
          // 업로드 성공 시 임시 로컬 파일 정리
          if (uploadSucceeded) {
            try { unlinkSync(localPath); } catch { /* ignore */ }
          }
        }

      } else {
        // gcs — 미지원
        backupPath   = localPath;
        resultStatus = 'failed';
        errorDetail  = 'Google Cloud Storage 백업은 현재 미지원입니다. NCP Object Storage를 사용하세요.';
        message      = errorDetail;
        try { unlinkSync(localPath); } catch { /* ignore */ }
      }
    }

    // ── 감사 로그 기록 ─────────────────────────────────────────

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
            recordCount:  recordCount ?? null,
            durationMs,
            startedAt:    startedAt.toISOString(),
            error:        errorDetail ?? null,
          } as never,
        },
      });
    } catch (logErr) {
      console.warn('[Backup] 감사 로그 기록 실패:', logErr);
    }

    // ── 완료/실패 알림 이메일 ──────────────────────────────────
    if (backupCfg.notifyEmail) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: auth.tenantId },
        select: { name: true },
      });
      sendBackupNotificationEmail({
        to:          backupCfg.notifyEmail,
        tenantName:  tenant?.name ?? auth.tenantId,
        status:      resultStatus,
        backupId,
        storageType: backupCfg.storageType,
        backupPath,
        sizeBytes,
        recordCount,
        durationMs,
        error:       errorDetail,
        trigger,
      }).catch(e => console.error('[Backup] 알림 이메일 실패:', e));
    }

    // ── 오래된 백업 정리 (retentionCount 초과분 삭제) ─────────
    if (resultStatus === 'success' && backupCfg.retentionCount > 0) {
      try {
        const allBackups = await prisma.auditLog.findMany({
          where:   { tenantId: auth.tenantId, action: 'BACKUP_TRIGGERED' },
          orderBy: { createdAt: 'desc' },
          select:  { id: true, metadata: true },
        });
        const toDelete = allBackups.slice(backupCfg.retentionCount);
        if (toDelete.length > 0) {
          // Object Storage 파일 실제 삭제 (스토리지 비용 절감)
          for (const old of toDelete) {
            const meta = old.metadata as Record<string, unknown> | null;
            const oldPath   = meta?.backupPath as string | undefined;
            const oldStatus = meta?.backupStatus as string | undefined;
            if (oldStatus === 'success' && oldPath) {
              if (oldPath.startsWith('https://') && (backupCfg.storageType === 'ncp' || backupCfg.storageType === 's3')) {
                // Object Storage 파일 삭제
                try {
                  const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
                  const cfg = backupCfg.storageType === 'ncp' ? getNcpConfig() : getAwsS3Config();
                  const client = new S3Client({
                    region: cfg.region, endpoint: cfg.endpoint,
                    credentials: { accessKeyId: cfg.accessKey, secretAccessKey: cfg.secretKey },
                    forcePathStyle: true,
                  });
                  // URL에서 key 추출: endpoint/bucket/key → key 부분
                  const urlParts = oldPath.replace(`${cfg.endpoint}/${cfg.bucket}/`, '');
                  await client.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: urlParts }));
                } catch (delErr) {
                  console.warn('[Backup] 오래된 Object Storage 파일 삭제 실패:', delErr);
                }
              } else if (!oldPath.startsWith('https://') && backupCfg.storageType === 'local') {
                // 로컬 파일 삭제
                try { unlinkSync(oldPath); } catch { /* ignore */ }
              }
            }
          }
          await prisma.auditLog.deleteMany({
            where: { id: { in: toDelete.map(b => b.id) } },
          });
        }
      } catch (e) {
        console.warn('[Backup] 오래된 백업 이력 정리 실패:', e);
      }
    }

    return successResponse({
      backupId,
      status:     resultStatus,
      message,
      storageType: backupCfg.storageType,
      backupPath,
      sizeBytes,
      sizeMb,
      durationMs,
      recordCount,
      startedAt:  startedAt.toISOString(),
      error:      errorDetail,
    });

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

    const recentBackups = await prisma.auditLog.findMany({
      where:   { tenantId: auth.tenantId, action: 'BACKUP_TRIGGERED' },
      orderBy: { createdAt: 'desc' },
      take:    15,
      select:  { resourceId: true, metadata: true, createdAt: true },
    });

    // NCP 설정 상태 (환경변수 있는지만 확인, 키값 노출 X)
    const ncpConfigured = !!(
      process.env.NCP_ACCESS_KEY &&
      process.env.NCP_SECRET_KEY &&
      process.env.NCP_BUCKET_NAME
    );
    const s3Configured = !!(
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_S3_BUCKET
    );

    return successResponse({
      config:     settings.backup,
      defaultDir: getDefaultBackupDir(),
      ncpConfigured,
      s3Configured,
      ncpBucket:  process.env.NCP_BUCKET_NAME ?? null,
      ncpEndpoint: process.env.NCP_STORAGE_ENDPOINT ?? 'https://kr.object.ncloudstorage.com',
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
