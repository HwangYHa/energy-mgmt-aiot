/**
 * lib/services/backup.service.ts
 *
 * MySQL 데이터베이스 백업 서비스
 *
 * - mysqldump + gzip 파이프라인으로 로컬 백업 실행
 * - DATABASE_URL 파싱으로 자동 접속 정보 추출
 * - 기본 경로: BACKUP_DIR 환경변수 또는 {cwd}/backups/
 * - S3/GCS는 SDK 설치 후 확장 가능 (현재 로컬 백업 후 업로드 구조)
 */

import { spawn } from 'child_process';
import { createWriteStream, mkdirSync, statSync } from 'fs';
import { createGzip } from 'zlib';
import path from 'path';

// ─── 타입 ─────────────────────────────────────────────────────────

export interface BackupResult {
  status: 'success' | 'failed';
  backupPath: string;
  sizeBytes?: number;
  sizeMb?: string;
  durationMs: number;
  error?: string;
}

export interface ParsedDbUrl {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
}

// ─── 경로 유틸 ────────────────────────────────────────────────────

/**
 * 기본 백업 디렉토리
 * - BACKUP_DIR 환경변수가 설정된 경우 우선 사용
 * - 미설정 시: {project_root}/backups/
 *   - 개발(Windows): G:\Dev\...\backups\
 *   - 운영(Linux): /app/backups/ 또는 BACKUP_DIR=/var/backups/tansoeum 설정 권장
 */
export function getDefaultBackupDir(): string {
  return process.env.BACKUP_DIR ?? path.join(process.cwd(), 'backups');
}

/**
 * 백업 파일 최종 경로 결정
 * storagePath가 비어있으면 getDefaultBackupDir() 사용
 */
export function resolveBackupPath(
  storagePath: string | undefined,
  backupId: string,
): string {
  const base = storagePath?.trim() || getDefaultBackupDir();
  return path.join(base, `${backupId}.sql.gz`);
}

// ─── DATABASE_URL 파싱 ────────────────────────────────────────────

export function parseDatabaseUrl(dbUrl: string): ParsedDbUrl {
  const parsed = new URL(dbUrl);
  return {
    host:     parsed.hostname || 'localhost',
    port:     parsed.port    || '3306',
    user:     decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.slice(1).split('?')[0] ?? '',
  };
}

// ─── 로컬 mysqldump 백업 ──────────────────────────────────────────

/**
 * mysqldump → gzip → 파일 파이프라인 실행
 *
 * - MYSQL_PWD 환경변수로 비밀번호 전달 (프로세스 목록 노출 방지)
 * - --single-transaction: InnoDB 무중단 백업
 * - 결과: { status, backupPath, sizeBytes, sizeMb, durationMs, error? }
 *
 * 오류 케이스:
 *  - mysqldump not in PATH → ENOENT 에러
 *  - DB 접속 실패 → stderr에 ERROR 1045 등
 *  - 디스크 공간 부족 → output.on('error')
 */
export async function runLocalBackup(backupPath: string): Promise<BackupResult> {
  const startedAt = Date.now();

  // DATABASE_URL 검증
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return {
      status: 'failed', backupPath,
      durationMs: Date.now() - startedAt,
      error: 'DATABASE_URL 환경변수가 설정되지 않았습니다.',
    };
  }

  let db: ParsedDbUrl;
  try {
    db = parseDatabaseUrl(dbUrl);
  } catch {
    return {
      status: 'failed', backupPath,
      durationMs: Date.now() - startedAt,
      error: 'DATABASE_URL 형식이 올바르지 않습니다. (mysql://user:pass@host:3306/dbname)',
    };
  }

  if (!db.database) {
    return {
      status: 'failed', backupPath,
      durationMs: Date.now() - startedAt,
      error: 'DATABASE_URL에서 데이터베이스명을 찾을 수 없습니다.',
    };
  }

  // 디렉토리 생성 (recursive)
  const dir = path.dirname(backupPath);
  try {
    mkdirSync(dir, { recursive: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      status: 'failed', backupPath,
      durationMs: Date.now() - startedAt,
      error: `백업 디렉토리 생성 실패 (${dir}): ${msg}`,
    };
  }

  // mysqldump 실행
  return new Promise((resolve) => {
    let settled = false;
    const done = (result: BackupResult) => {
      if (!settled) { settled = true; resolve(result); }
    };

    const mysqldump = spawn(
      'mysqldump',
      [
        `--host=${db.host}`,
        `--port=${db.port}`,
        `--user=${db.user}`,
        '--single-transaction',   // InnoDB 무중단 스냅샷
        '--routines',             // 스토어드 프로시저 포함
        '--triggers',             // 트리거 포함
        '--default-character-set=utf8mb4',
        db.database,
      ],
      {
        // MYSQL_PWD: 명령행 인수로 비밀번호 전달 시 ps 노출 방지
        env: { ...process.env, MYSQL_PWD: db.password },
      },
    );

    const gzip   = createGzip({ level: 6 });
    const output = createWriteStream(backupPath);

    // mysqldump stdout → gzip → 파일
    mysqldump.stdout.pipe(gzip).pipe(output);

    let stderrData = '';
    mysqldump.stderr.on('data', (d: Buffer) => { stderrData += d.toString(); });

    // mysqldump 자체 실행 오류 (ENOENT = 명령 없음)
    mysqldump.on('error', (err: NodeJS.ErrnoException) => {
      const isNotFound = err.code === 'ENOENT';
      done({
        status: 'failed', backupPath,
        durationMs: Date.now() - startedAt,
        error: isNotFound
          ? 'mysqldump 명령을 찾을 수 없습니다. MySQL 클라이언트 도구(mysql-client)가 서버 PATH에 설치되어 있는지 확인하세요.'
          : `mysqldump 실행 오류: ${err.message}`,
      });
    });

    // 파일 저장 오류 (디스크 풀, 권한 오류 등)
    output.on('error', (err) => {
      done({
        status: 'failed', backupPath,
        durationMs: Date.now() - startedAt,
        error: `백업 파일 저장 오류: ${err.message}`,
      });
    });

    // 파이프라인 완료 (mysqldump → gzip → 파일 모두 완료)
    output.on('finish', () => {
      const durationMs = Date.now() - startedAt;
      let sizeBytes = 0;
      try { sizeBytes = statSync(backupPath).size; } catch { /* ignore */ }

      // stderr에 ERROR 키워드 → 실패
      const hasError = /\bERROR\b/i.test(stderrData);
      if (hasError) {
        done({
          status: 'failed', backupPath, durationMs,
          error: stderrData.slice(0, 500),
        });
        return;
      }

      const sizeMb = sizeBytes > 0
        ? (sizeBytes / (1024 * 1024)).toFixed(2)
        : undefined;

      done({ status: 'success', backupPath, sizeBytes, sizeMb, durationMs });
    });
  });
}

// ─── 파일 크기 포맷 ───────────────────────────────────────────────

export function formatFileSize(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
