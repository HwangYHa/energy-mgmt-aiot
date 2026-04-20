/**
 * lib/services/backup.service.ts
 *
 * 멀티테넌트 데이터 백업 서비스
 *
 * ┌──────────────────────────────────────────────────────────────┐
 * │  백업 방식                                                    │
 * │  ① 테넌트 데이터 추출: Prisma → JSON Lines → gzip (.jsonl.gz) │
 * │     - 해당 tenantId의 모든 테이블 데이터만 선택적 추출          │
 * │     - 전체 DB 덤프 금지 (타 업체 데이터 포함 방지)              │
 * │  ② measurement 대용량 처리                                    │
 * │     - 50,000건 청크 단위 스트리밍 (OOM 방지)                   │
 * │  ③ 저장 위치                                                  │
 * │     - local: 서버 로컬 파일시스템                              │
 * │     - ncp:   네이버 클라우드 Object Storage (S3 호환 API)      │
 * │     - s3:    AWS S3 (동일 SDK, 엔드포인트만 다름)              │
 * └──────────────────────────────────────────────────────────────┘
 */

import { createWriteStream, mkdirSync, statSync, unlinkSync } from 'fs';
import { createGzip } from 'zlib';
import { PassThrough } from 'stream';
import path from 'path';
import { pipeline } from 'stream/promises';
import { prisma } from '@/lib/db/prisma';

// ─── 타입 ─────────────────────────────────────────────────────────

export interface BackupResult {
  status: 'success' | 'failed';
  backupPath: string;
  sizeBytes?: number;
  sizeMb?: string;
  durationMs: number;
  recordCount?: number;
  error?: string;
}

export interface NcpUploadConfig {
  accessKey: string;
  secretKey: string;
  bucket: string;
  endpoint: string;   // https://kr.object.ncloudstorage.com
  region: string;     // kr-standard
}

// ─── 경로 유틸 ────────────────────────────────────────────────────

export function getDefaultBackupDir(): string {
  return process.env.BACKUP_DIR ?? path.join(process.cwd(), 'backups');
}

export function resolveBackupPath(
  storagePath: string | undefined,
  backupId: string,
  ext = 'jsonl.gz',
): string {
  const base = storagePath?.trim() || getDefaultBackupDir();
  return path.join(base, `${backupId}.${ext}`);
}

// ─── 테넌트 테이블 목록 ───────────────────────────────────────────
// tenantId 컬럼이 있는 테이블만 포함.
// measurement는 대용량이므로 별도 청크 스트리밍 처리 (아래 참조).

const TENANT_TABLES: Array<{
  name: string;
  fetch: (tenantId: string) => Promise<unknown[]>;
}> = [
  { name: 'site',             fetch: (id) => prisma.site.findMany({ where: { tenantId: id } }) },
  { name: 'gateway',          fetch: (id) => (prisma as any).gateway.findMany({ where: { tenantId: id } }) },
  { name: 'device',           fetch: (id) => prisma.device.findMany({ where: { tenantId: id } }) },
  { name: 'metric',           fetch: (id) => (prisma as any).metric.findMany({ where: { tenantId: id } }) },
  { name: 'sensor',           fetch: (id) => (prisma as any).sensor.findMany({ where: { tenantId: id } }) },
  { name: 'alertRule',        fetch: (id) => (prisma as any).alertRule.findMany({ where: { tenantId: id } }) },
  { name: 'alertLog',         fetch: (id) => (prisma as any).alertLog.findMany({ where: { tenantId: id } }) },
  { name: 'user',             fetch: (id) => prisma.user.findMany({
    where: { tenantId: id },
    select: {
      id: true, tenantId: true, email: true, name: true, role: true,
      isActive: true, isEmailVerified: true, phone: true,
      createdAt: true, updatedAt: true,
      // passwordHash 제외 (보안)
    },
  }) },
  { name: 'emissionsData',    fetch: (id) => (prisma as any).emissionsData?.findMany({ where: { tenantId: id } }) ?? [] },
  { name: 'emissionsRecord',  fetch: (id) => (prisma as any).emissionsRecord?.findMany({ where: { tenantId: id } }) ?? [] },
  { name: 'emissionFactor',   fetch: (id) => (prisma as any).emissionFactor.findMany({ where: { tenantId: id } }) },
  { name: 'invoice',          fetch: (id) => (prisma as any).invoice?.findMany({ where: { tenantId: id } }) ?? [] },
  { name: 'drEvent',          fetch: (id) => (prisma as any).drEvent?.findMany({ where: { tenantId: id } }) ?? [] },
  { name: 'controlSchedule',  fetch: (id) => (prisma as any).controlSchedule?.findMany({ where: { tenantId: id } }) ?? [] },
  { name: 'controlLog',       fetch: (id) => (prisma as any).controlLog?.findMany({ where: { tenantId: id } }) ?? [] },
  { name: 'forecastResult',   fetch: (id) => (prisma as any).forecastResult?.findMany({ where: { tenantId: id } }) ?? [] },
  { name: 'notificationRule', fetch: (id) => (prisma as any).notificationRule?.findMany({ where: { tenantId: id } }) ?? [] },
  { name: 'notificationLog',  fetch: (id) => (prisma as any).notificationLog?.findMany({ where: { tenantId: id } }) ?? [] },
  { name: 'kpiSnapshot',      fetch: (id) => (prisma as any).kpiSnapshot?.findMany({ where: { tenantId: id } }) ?? [] },
  { name: 'report',           fetch: (id) => (prisma as any).report?.findMany({ where: { tenantId: id } }) ?? [] },
  { name: 'auditLog',         fetch: (id) => prisma.auditLog.findMany({ where: { tenantId: id } }) },
  { name: 'activityLog',      fetch: (id) => (prisma as any).activityLog?.findMany({ where: { tenantId: id } }) ?? [] },
  { name: 'subscription',     fetch: (id) => prisma.subscription.findMany({ where: { tenantId: id } }) },
  { name: 'apiKey',           fetch: (id) => (prisma as any).apiKey?.findMany({ where: { tenantId: id } }) ?? [] },
  { name: 'supportInquiry',   fetch: (id) => (prisma as any).supportInquiry?.findMany({ where: { tenantId: id } }) ?? [] },
];

// measurement 청크 크기 (OOM 방지: 한 번에 50,000건씩 읽기)
const MEASUREMENT_CHUNK_SIZE = 50_000;

// ─── 테넌트 데이터 추출 (핵심 함수) ──────────────────────────────

/**
 * 해당 tenantId의 데이터만 JSON Lines 형식으로 추출하여 gzip 압축 파일 생성.
 *
 * - 소규모 테이블: 전체 fetch 후 스트림 기록
 * - measurement: 50,000건 단위 청크 페이징 (대용량 OOM 방지)
 * - 형식: 각 줄 = JSON 객체 (헤더 줄: {"_meta": {...}})
 * - 파일: {backupId}.jsonl.gz
 */
export async function runTenantDataExport(
  tenantId: string,
  backupPath: string,
): Promise<BackupResult> {
  const startedAt = Date.now();

  // 디렉토리 생성
  const dir = path.dirname(backupPath);
  try {
    mkdirSync(dir, { recursive: true });
  } catch (e) {
    return {
      status: 'failed', backupPath,
      durationMs: Date.now() - startedAt,
      error: `백업 디렉토리 생성 실패 (${dir}): ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  try {
    // 테넌트 기본 정보
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, domain: true, industryType: true, country: true },
    });
    if (!tenant) {
      return { status: 'failed', backupPath, durationMs: Date.now() - startedAt, error: '테넌트를 찾을 수 없습니다.' };
    }

    // ── 스트리밍 파이프라인 설정 ──────────────────────────────────
    // PassThrough → gzip → file 순으로 연결
    // 데이터를 passThrough에 점진적으로 write하면서 백프레셔 없이 처리

    const gzip        = createGzip({ level: 6 });
    const passThrough = new PassThrough();
    const output      = createWriteStream(backupPath);

    // 파이프라인은 비동기로 시작 (end 호출 시 완료)
    const pipelinePromise = pipeline(passThrough, gzip, output);

    const writeLine = (obj: unknown) => {
      passThrough.write(JSON.stringify(obj) + '\n');
    };

    // 헤더 메타데이터
    writeLine({
      _meta: {
        version:    '2.1',
        format:     'jsonl-gz',
        tenantId,
        tenantName:  tenant.name,
        domain:      tenant.domain,
        exportedAt:  new Date().toISOString(),
        tables:      [...TENANT_TABLES.map(t => t.name), 'measurement'],
      },
    });

    let totalRecords = 0;

    // ── 소규모 테이블 순차 추출 ──────────────────────────────────
    for (const table of TENANT_TABLES) {
      let rows: unknown[] = [];
      try {
        rows = await table.fetch(tenantId);
      } catch {
        rows = [];
      }

      if (rows.length > 0) {
        writeLine({ _table: table.name, _count: rows.length });
        for (const row of rows) {
          writeLine({ _t: table.name, d: row });
          totalRecords++;
        }
      }
    }

    // ── measurement 청크 스트리밍 ────────────────────────────────
    // 50,000건씩 페이징하여 메모리 사용량 제한
    {
      let offset          = 0;
      let measureCount    = 0;
      let headerWritten   = false;

      while (true) {
        let rows: { metricId: string; tenantId: string; time: Date; value: unknown; quality: unknown }[] = [];
        try {
          rows = await prisma.measurement.findMany({
            where:   { tenantId },
            skip:    offset,
            take:    MEASUREMENT_CHUNK_SIZE,
            orderBy: { time: 'asc' },
            select: {
              metricId: true, tenantId: true,
              time: true, value: true, quality: true,
            },
          });
        } catch {
          break;
        }

        if (rows.length === 0) break;

        if (!headerWritten) {
          // 실제 총 건수는 나중에 알 수 없으므로 '...' 으로 표시
          writeLine({ _table: 'measurement', _count: '(chunked)' });
          headerWritten = true;
        }

        for (const row of rows) {
          writeLine({ _t: 'measurement', d: row });
          measureCount++;
          totalRecords++;
        }

        offset += rows.length;
        if (rows.length < MEASUREMENT_CHUNK_SIZE) break;
      }

      if (headerWritten) {
        // 마커로 실제 건수 기록 (복원 시 참조용)
        writeLine({ _table_end: 'measurement', _count: measureCount });
      }
    }

    // 스트림 종료 → gzip flush → 파일 close
    passThrough.end();
    await pipelinePromise;

    const durationMs = Date.now() - startedAt;
    const sizeBytes  = statSync(backupPath).size;
    const sizeMb     = (sizeBytes / (1024 * 1024)).toFixed(2);

    return { status: 'success', backupPath, sizeBytes, sizeMb, durationMs, recordCount: totalRecords };

  } catch (e) {
    try { unlinkSync(backupPath); } catch { /* ignore */ }
    return {
      status: 'failed', backupPath,
      durationMs: Date.now() - startedAt,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

// ─── NCP / AWS S3 업로드 ─────────────────────────────────────────

/**
 * 로컬 파일을 NCP Object Storage 또는 AWS S3에 업로드
 *
 * NCP Object Storage 설정:
 *   endpoint: https://kr.object.ncloudstorage.com
 *   region:   kr-standard
 *   bucket:   NCP_BUCKET_NAME 환경변수
 */
export async function uploadToObjectStorage(
  localPath: string,
  remoteKey: string,
  config: NcpUploadConfig,
): Promise<{ url: string }> {
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const { createReadStream } = await import('fs');

  const client = new S3Client({
    region:   config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId:     config.accessKey,
      secretAccessKey: config.secretKey,
    },
    forcePathStyle: true,
  });

  const fileStream = createReadStream(localPath);
  const stat       = statSync(localPath);

  await client.send(new PutObjectCommand({
    Bucket:        config.bucket,
    Key:           remoteKey,
    Body:          fileStream,
    ContentLength: stat.size,
    ContentType:   'application/gzip',
    Metadata: { 'x-backup-format': 'jsonl-gz' },
  }));

  return { url: `${config.endpoint}/${config.bucket}/${remoteKey}` };
}

/**
 * 환경변수에서 NCP 설정 읽기
 * @throws Error 필수 환경변수 누락 시
 */
export function getNcpConfig(): NcpUploadConfig {
  const accessKey = process.env.NCP_ACCESS_KEY;
  const secretKey = process.env.NCP_SECRET_KEY;
  const bucket    = process.env.NCP_BUCKET_NAME;
  const endpoint  = process.env.NCP_STORAGE_ENDPOINT ?? 'https://kr.object.ncloudstorage.com';
  const region    = process.env.NCP_STORAGE_REGION   ?? 'kr-standard';

  if (!accessKey || !secretKey || !bucket) {
    throw new Error(
      'NCP Object Storage 환경변수가 설정되지 않았습니다. ' +
      '.env 파일에 NCP_ACCESS_KEY, NCP_SECRET_KEY, NCP_BUCKET_NAME을 추가하세요.'
    );
  }

  return { accessKey, secretKey, bucket, endpoint, region };
}

/**
 * 환경변수에서 AWS S3 설정 읽기
 */
export function getAwsS3Config(): NcpUploadConfig {
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const bucket    = process.env.AWS_S3_BUCKET;
  const region    = process.env.AWS_REGION ?? 'ap-northeast-2';

  if (!accessKey || !secretKey || !bucket) {
    throw new Error(
      'AWS S3 환경변수가 설정되지 않았습니다. ' +
      '.env 파일에 AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET을 추가하세요.'
    );
  }

  return {
    accessKey, secretKey, bucket, region,
    endpoint: `https://s3.${region}.amazonaws.com`,
  };
}

// ─── 파일 크기 포맷 ───────────────────────────────────────────────

export function formatFileSize(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export { };
