/**
 * GET /api/cron/backup
 *
 * 스케줄 기반 자동 백업 크론 엔드포인트
 *
 * 처리 흐름:
 *   1. backup.enabled=true 인 테넌트를 DB에서 조회
 *   2. 각 테넌트의 backup.schedule(daily/weekly/monthly)과 마지막 백업 시각 비교
 *   3. 조건 충족 시 runTenantDataExport 실행
 *   4. 결과를 AuditLog에 기록 + 완료 이메일 발송
 *
 * 보안: CRON_SECRET 헤더 인증
 *
 * 권장 실행 주기 (vercel.json / 외부 스케줄러): 매일 00:10 KST (15:10 UTC)
 *   cron: "10 15 * * *"
 *
 * 호출 예:
 *   curl -H "Authorization: Bearer ${CRON_SECRET}" \
 *        https://your-domain.com/api/cron/backup
 */

import { NextRequest, NextResponse } from 'next/server';
import { unlinkSync } from 'fs';
import { prisma } from '@/lib/db/prisma';
import {
  runTenantDataExport,
  resolveBackupPath,
  uploadToObjectStorage,
  getNcpConfig,
  getAwsS3Config,
} from '@/lib/services/backup.service';
import { sendBackupNotificationEmail } from '@/lib/services/email.service';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5분 (대용량 테넌트 대응)

// ─── 인증 ─────────────────────────────────────────────────────────

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // 환경변수 미설정 시 차단

  const auth = request.headers.get('Authorization');
  if (auth === `Bearer ${secret}`) return true;

  // 로컬 개발 환경 허용
  const host = request.headers.get('host') ?? '';
  return host.startsWith('localhost') || host.startsWith('127.0.0.1');
}

// ─── 스케줄 충족 여부 판단 ────────────────────────────────────────

/**
 * 마지막 백업 시각과 스케줄 설정을 비교하여 지금 백업이 필요한지 판단.
 *
 * @param schedule  'daily' | 'weekly' | 'monthly' | 'manual'
 * @param lastBackupAt  마지막 성공 백업 시각 (없으면 항상 true)
 * @param now  현재 시각
 */
function shouldRunBackup(
  schedule: string,
  lastBackupAt: Date | null,
  now: Date,
): boolean {
  if (schedule === 'manual') return false;
  if (!lastBackupAt) return true; // 첫 백업

  const diffMs = now.getTime() - lastBackupAt.getTime();
  const diffH  = diffMs / (1000 * 60 * 60);

  if (schedule === 'daily')   return diffH >= 23;      // 23시간 이상 경과
  if (schedule === 'weekly')  return diffH >= 23 * 7;  // 7일 이상 경과
  if (schedule === 'monthly') return diffH >= 23 * 28; // 28일 이상 경과

  return false;
}

// ─── GET 핸들러 ───────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  const now     = new Date();
  const results: Array<{
    tenantId: string;
    tenantName: string;
    status: 'success' | 'failed' | 'skipped';
    reason?: string;
    sizeBytes?: number;
    recordCount?: number;
    durationMs?: number;
  }> = [];

  try {
    // backup.enabled=true 인 테넌트 전체 조회
    // settings JSON에서 backup.enabled 를 직접 파싱
    const tenants = await prisma.tenant.findMany({
      select: { id: true, name: true, settings: true },
    });

    for (const tenant of tenants) {
      const settings = tenant.settings as Record<string, Record<string, unknown>> | null;
      const backup   = settings?.backup as {
        enabled?: boolean;
        schedule?: string;
        storageType?: string;
        storagePath?: string;
        retentionCount?: number;
        notifyEmail?: string;
      } | undefined;

      if (!backup?.enabled) {
        results.push({ tenantId: tenant.id, tenantName: tenant.name, status: 'skipped', reason: '백업 비활성화' });
        continue;
      }

      const schedule = backup.schedule ?? 'weekly';

      // 마지막 백업 시각 조회 (마지막 시도 기준으로 스케줄 판단)
      const lastLog = await prisma.auditLog.findFirst({
        where:   { tenantId: tenant.id, action: 'BACKUP_TRIGGERED' },
        orderBy: { createdAt: 'desc' },
        select:  { createdAt: true },
      });

      if (!shouldRunBackup(schedule, lastLog?.createdAt ?? null, now)) {
        results.push({ tenantId: tenant.id, tenantName: tenant.name, status: 'skipped', reason: `스케줄 미충족 (${schedule})` });
        continue;
      }

      // 백업 실행
      const backupId  = `backup_${tenant.id.slice(0, 8)}_${Date.now()}`;
      const localPath = resolveBackupPath(
        backup.storageType === 'local' ? backup.storagePath : undefined,
        backupId,
        'jsonl.gz',
      );

      const exportResult = await runTenantDataExport(tenant.id, localPath);

      let finalPath   = localPath;
      let resultStatus: 'success' | 'failed' = exportResult.status;
      let errorDetail: string | undefined     = exportResult.error;

      if (exportResult.status === 'success' && (backup.storageType === 'ncp' || backup.storageType === 's3')) {
        let uploadSucceeded = false;
        try {
          const cfg        = backup.storageType === 'ncp' ? getNcpConfig() : getAwsS3Config();
          const pathPrefix = backup.storagePath?.trim() || `tansoeum-backups/${tenant.id}`;
          const remoteKey  = `${pathPrefix}/${backupId}.jsonl.gz`;
          const uploadResult = await uploadToObjectStorage(localPath, remoteKey, cfg);
          finalPath        = uploadResult.url;
          uploadSucceeded  = true;
        } catch (uploadErr) {
          resultStatus = 'failed';
          errorDetail  = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
        } finally {
          if (uploadSucceeded) {
            try { unlinkSync(localPath); } catch { /* ignore */ }
          }
        }
      }

      // AuditLog 기록
      await prisma.auditLog.create({
        data: {
          userId:       'system',
          tenantId:     tenant.id,
          action:       'BACKUP_TRIGGERED',
          resourceType: 'backup',
          resourceId:   backupId,
          metadata: {
            trigger:      'scheduled',
            storageType:  backup.storageType ?? 'local',
            backupPath:   finalPath,
            backupStatus: resultStatus,
            sizeBytes:    exportResult.sizeBytes ?? null,
            recordCount:  exportResult.recordCount ?? null,
            durationMs:   exportResult.durationMs,
            startedAt:    now.toISOString(),
            error:        errorDetail ?? null,
          } as never,
        },
      }).catch(e => console.warn('[Cron/Backup] 감사 로그 기록 실패:', e));

      // 알림 이메일
      if (backup.notifyEmail) {
        sendBackupNotificationEmail({
          to:          backup.notifyEmail,
          tenantName:  tenant.name,
          status:      resultStatus,
          backupId,
          storageType: backup.storageType ?? 'local',
          backupPath:  finalPath,
          sizeBytes:   exportResult.sizeBytes,
          recordCount: exportResult.recordCount,
          durationMs:  exportResult.durationMs,
          error:       errorDetail,
          trigger:     'scheduled',
        }).catch(e => console.error('[Cron/Backup] 알림 이메일 실패:', e));
      }

      // retentionCount 초과 이력 삭제 + 실제 파일/오브젝트 삭제 (스토리지 비용 절감)
      const retentionCount = backup.retentionCount ?? 7;
      if (resultStatus === 'success' && retentionCount > 0) {
        const allLogs = await prisma.auditLog.findMany({
          where:   { tenantId: tenant.id, action: 'BACKUP_TRIGGERED' },
          orderBy: { createdAt: 'desc' },
          select:  { id: true, metadata: true },
        });
        const toDelete = allLogs.slice(retentionCount);
        if (toDelete.length > 0) {
          for (const old of toDelete) {
            const meta    = old.metadata as Record<string, unknown> | null;
            const oldPath = meta?.backupPath as string | undefined;
            const oldStat = meta?.backupStatus as string | undefined;
            if (oldStat === 'success' && oldPath) {
              if (oldPath.startsWith('https://') && (backup.storageType === 'ncp' || backup.storageType === 's3')) {
                try {
                  const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
                  const cfg = backup.storageType === 'ncp' ? getNcpConfig() : getAwsS3Config();
                  const client = new S3Client({
                    region: cfg.region, endpoint: cfg.endpoint,
                    credentials: { accessKeyId: cfg.accessKey, secretAccessKey: cfg.secretKey },
                    forcePathStyle: true,
                  });
                  const key = oldPath.replace(`${cfg.endpoint}/${cfg.bucket}/`, '');
                  await client.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }));
                } catch { /* ignore — 이미 삭제됐거나 접근 불가 */ }
              } else if (!oldPath.startsWith('https://')) {
                try { unlinkSync(oldPath); } catch { /* ignore */ }
              }
            }
          }
          await prisma.auditLog.deleteMany({
            where: { id: { in: toDelete.map(l => l.id) } },
          }).catch(() => { /* ignore */ });
        }
      }

      results.push({
        tenantId:    tenant.id,
        tenantName:  tenant.name,
        status:      resultStatus,
        reason:      errorDetail,
        sizeBytes:   exportResult.sizeBytes,
        recordCount: exportResult.recordCount,
        durationMs:  exportResult.durationMs,
      });
    }

    const succeeded = results.filter(r => r.status === 'success').length;
    const failed    = results.filter(r => r.status === 'failed').length;
    const skipped   = results.filter(r => r.status === 'skipped').length;

    console.info(`[Cron/Backup] 완료 — 성공:${succeeded} 실패:${failed} 건너뜀:${skipped}`);

    return NextResponse.json({
      ok: true,
      summary: { succeeded, failed, skipped, total: results.length },
      results,
      executedAt: now.toISOString(),
    });

  } catch (error) {
    console.error('[Cron/Backup] 크론 실행 오류:', error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
