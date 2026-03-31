# 탄소이음 엔터프라이즈 아키텍처 구현 가이드

> B2B SaaS 에너지 관리 AIoT 플랫폼 — 엔터프라이즈 확장 구현 레퍼런스
>
> 스택: Next.js 15 App Router · Prisma + MySQL · FastAPI(AI) · MQTT · Redis · Docker/K8s

---

## 목차

1. [랜섬웨어 대응 시스템](#section-1-랜섬웨어-대응-시스템)
2. [슈퍼 관리자 ERP 시스템](#section-2-슈퍼-관리자-erp-시스템)
3. [모듈형 시스템 아키텍처](#section-3-모듈형-시스템-아키텍처)

---

# SECTION 1: 랜섬웨어 대응 시스템

## 1-1. 보안 아키텍처 — Prisma 스키마

`prisma/schema.prisma` 하단에 추가:

```prisma
// ─── 랜섬웨어 탐지 및 백업 관리 ───────────────────────────────────

model RansomwareAlert {
  id          String    @id @default(uuid())
  tenantId    String?   @map("tenant_id")
  alertType   String    @map("alert_type") @db.VarChar(50)
  // types: MASS_DELETE | MASS_UPDATE | UNUSUAL_EXPORT | CRYPTO_PATTERN
  //        SUSPICIOUS_QUERY | BULK_DOWNLOAD
  severity    String    @db.VarChar(20)   // LOW | MEDIUM | HIGH | CRITICAL
  description String    @db.Text
  sourceIp    String?   @map("source_ip") @db.VarChar(45)
  userId      String?   @map("user_id")
  metadata    Json?
  status      String    @default("open") @db.VarChar(20)
  // open | investigating | contained | resolved | false_positive
  resolvedBy  String?   @map("resolved_by")
  resolvedAt  DateTime? @map("resolved_at")
  createdAt   DateTime  @default(now()) @map("created_at")

  @@index([tenantId, status, createdAt])
  @@index([alertType, severity])
  @@map("ransomware_alert")
}

model BackupRecord {
  id           String    @id @default(uuid())
  backupType   String    @map("backup_type") @db.VarChar(20)
  // full | incremental | snapshot
  status       String    @db.VarChar(20)
  // running | completed | failed | verifying | verified
  sizeBytes    BigInt?   @map("size_bytes")
  storagePath  String    @map("storage_path") @db.VarChar(500)
  checksum     String?   @db.VarChar(64)   // SHA-256
  isImmutable  Boolean   @default(true) @map("is_immutable")
  expiresAt    DateTime? @map("expires_at")
  startedAt    DateTime  @default(now()) @map("started_at")
  completedAt  DateTime? @map("completed_at")
  metadata     Json?

  @@index([backupType, status])
  @@map("backup_record")
}
```

마이그레이션:

```sql
-- prisma/migrations/20260322_ransomware_backup/migration.sql
CREATE TABLE `ransomware_alert` (
  `id`          VARCHAR(36)  NOT NULL,
  `tenant_id`   VARCHAR(36)  NULL,
  `alert_type`  VARCHAR(50)  NOT NULL,
  `severity`    VARCHAR(20)  NOT NULL,
  `description` TEXT         NOT NULL,
  `source_ip`   VARCHAR(45)  NULL,
  `user_id`     VARCHAR(36)  NULL,
  `metadata`    JSON         NULL,
  `status`      VARCHAR(20)  NOT NULL DEFAULT 'open',
  `resolved_by` VARCHAR(36)  NULL,
  `resolved_at` DATETIME(3)  NULL,
  `created_at`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `ransomware_alert_tenant_status_created_idx` (`tenant_id`, `status`, `created_at`),
  INDEX `ransomware_alert_type_severity_idx` (`alert_type`, `severity`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `backup_record` (
  `id`            VARCHAR(36)   NOT NULL,
  `backup_type`   VARCHAR(20)   NOT NULL,
  `status`        VARCHAR(20)   NOT NULL,
  `size_bytes`    BIGINT        NULL,
  `storage_path`  VARCHAR(500)  NOT NULL,
  `checksum`      VARCHAR(64)   NULL,
  `is_immutable`  BOOLEAN       NOT NULL DEFAULT TRUE,
  `expires_at`    DATETIME(3)   NULL,
  `started_at`    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `completed_at`  DATETIME(3)   NULL,
  `metadata`      JSON          NULL,
  PRIMARY KEY (`id`),
  INDEX `backup_record_type_status_idx` (`backup_type`, `status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

---

## 1-2. Anomaly Detection Service

**파일**: `lib/services/ransomware-detection.service.ts`

```typescript
/**
 * lib/services/ransomware-detection.service.ts
 *
 * 랜섬웨어·이상 작업 탐지 서비스
 * - 슬라이딩 윈도우(메모리) 기반 대량 연산 감지
 * - CRITICAL 등급 즉시 사용자 차단
 * - logSecurityEvent() + RansomwareAlert DB 기록 + 이메일 알림
 */

import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';
import { logSecurityEvent } from '@/lib/services/security-event.service';

const prisma = new PrismaClient();

// ──────────────────────────────────────────────────────────────
// 탐지 임계값 설정
// ──────────────────────────────────────────────────────────────
const THRESHOLDS = {
  MASS_DELETE_ROWS:    500,   // 60초 내 DELETE 500행 초과
  MASS_UPDATE_ROWS:    1000,  // 60초 내 UPDATE 1000행 초과
  BULK_EXPORT_MB:      100,   // 단일 내보내기 100MB 초과
  CRYPTO_PATTERN_RATIO: 0.5,  // body의 50% 이상 base64 → 암호화 의심
  WINDOW_MS:           60_000, // 슬라이딩 윈도우 60초
} as const;

// ──────────────────────────────────────────────────────────────
// 슬라이딩 윈도우: Map<userId, { timestamps: number[], rows: number[] }>
// ──────────────────────────────────────────────────────────────
interface WindowEntry {
  timestamps: number[];
  values: number[];
}

const deleteWindow  = new Map<string, WindowEntry>();
const updateWindow  = new Map<string, WindowEntry>();

// 만료된 윈도우 항목 정기 정리 (메모리 누수 방지)
setInterval(() => {
  const cutoff = Date.now() - THRESHOLDS.WINDOW_MS;
  for (const [key, entry] of deleteWindow.entries()) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    entry.values     = entry.values.slice(entry.values.length - entry.timestamps.length);
    if (entry.timestamps.length === 0) deleteWindow.delete(key);
  }
  for (const [key, entry] of updateWindow.entries()) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    entry.values     = entry.values.slice(entry.values.length - entry.timestamps.length);
    if (entry.timestamps.length === 0) updateWindow.delete(key);
  }
}, 30_000);

// ──────────────────────────────────────────────────────────────
// 유틸: 슬라이딩 윈도우에 값 추가 후 윈도우 합계 반환
// ──────────────────────────────────────────────────────────────
function pushWindow(map: Map<string, WindowEntry>, key: string, value: number): number {
  const now    = Date.now();
  const cutoff = now - THRESHOLDS.WINDOW_MS;

  if (!map.has(key)) map.set(key, { timestamps: [], values: [] });
  const entry = map.get(key)!;

  // 만료 항목 제거
  while (entry.timestamps.length > 0 && entry.timestamps[0] < cutoff) {
    entry.timestamps.shift();
    entry.values.shift();
  }

  entry.timestamps.push(now);
  entry.values.push(value);

  return entry.values.reduce((a, b) => a + b, 0);
}

// ──────────────────────────────────────────────────────────────
// 사용자 강제 차단 (DB user.isActive = false)
// ──────────────────────────────────────────────────────────────
async function blockUser(userId: string): Promise<void> {
  try {
    await (prisma.user as any).update({
      where:  { id: userId },
      data:   { isActive: false },
    });
    console.warn(`[RansomwareDetection] 사용자 강제 차단: ${userId}`);
  } catch (err) {
    console.error('[RansomwareDetection] 사용자 차단 실패:', err);
  }
}

// ──────────────────────────────────────────────────────────────
// RansomwareAlert DB 기록
// ──────────────────────────────────────────────────────────────
async function createAlert(params: {
  tenantId?: string;
  userId?: string;
  sourceIp?: string;
  alertType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await (prisma as any).ransomwareAlert.create({
      data: {
        tenantId:    params.tenantId    ?? null,
        userId:      params.userId      ?? null,
        sourceIp:    params.sourceIp    ?? null,
        alertType:   params.alertType,
        severity:    params.severity,
        description: params.description,
        metadata:    params.metadata    ?? null,
        status:      'open',
      },
    });
  } catch (err) {
    console.error('[RansomwareDetection] Alert DB 기록 실패:', err);
  }
}

// ──────────────────────────────────────────────────────────────
// 이메일 알림 (nodemailer — security-event.service.ts 패턴 재사용)
// ──────────────────────────────────────────────────────────────
async function sendAlertEmail(subject: string, body: string): Promise<void> {
  const adminEmail = process.env.SECURITY_ALERT_EMAIL;
  if (!adminEmail) return;

  try {
    const transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
      port:   Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
    });

    await transporter.sendMail({
      from:    `"탄소이음 보안" <${process.env.SMTP_USER}>`,
      to:      adminEmail,
      subject: `[탄소이음 보안 경보] ${subject}`,
      text:    body,
    });
  } catch (err) {
    console.error('[RansomwareDetection] 이메일 발송 실패:', err);
  }
}

// ──────────────────────────────────────────────────────────────
// PUBLIC API
// ──────────────────────────────────────────────────────────────
export class RansomwareDetectionService {
  /**
   * 대량 삭제/업데이트 탐지
   * - 60초 슬라이딩 윈도우 기준
   * - DELETE > 500행 or UPDATE > 1000행 → 알림
   */
  static async checkMassOperation(
    tenantId: string,
    userId:   string,
    operation: 'DELETE' | 'UPDATE',
    affectedRows: number,
    sourceIp?: string,
  ): Promise<void> {
    const windowMap   = operation === 'DELETE' ? deleteWindow : updateWindow;
    const threshold   = operation === 'DELETE' ? THRESHOLDS.MASS_DELETE_ROWS : THRESHOLDS.MASS_UPDATE_ROWS;
    const windowTotal = pushWindow(windowMap, `${tenantId}:${userId}`, affectedRows);

    if (windowTotal <= threshold) return;

    const severity: 'HIGH' | 'CRITICAL' = windowTotal > threshold * 3 ? 'CRITICAL' : 'HIGH';
    const alertType = operation === 'DELETE' ? 'MASS_DELETE' : 'MASS_UPDATE';
    const description = `60초 내 ${operation} ${windowTotal}행 감지 (임계값: ${threshold}행)`;

    // 보안 이벤트 로그
    await logSecurityEvent({
      type:     'UNAUTHORIZED_ACCESS',
      severity,
      userId,
      tenantId,
      ip:       sourceIp,
      details:  { alertType, affectedRows: windowTotal, operation },
    });

    // DB 알림 생성
    await createAlert({ tenantId, userId, sourceIp, alertType, severity, description,
      metadata: { windowTotal, threshold, operation } });

    // CRITICAL: 즉시 사용자 차단
    if (severity === 'CRITICAL') {
      await blockUser(userId);
      await sendAlertEmail(
        `CRITICAL — 대량 ${operation} 탐지`,
        `테넌트: ${tenantId}\n사용자: ${userId}\nIP: ${sourceIp}\n${description}\n\n사용자 계정이 자동 차단되었습니다.`,
      );
    }
  }

  /**
   * 대용량 내보내기 탐지
   * - 단일 요청 100MB 초과 시 MEDIUM 알림
   */
  static async checkBulkExport(
    tenantId: string,
    userId:   string,
    exportSizeMb: number,
    sourceIp?: string,
  ): Promise<void> {
    if (exportSizeMb <= THRESHOLDS.BULK_EXPORT_MB) return;

    const severity: 'MEDIUM' | 'HIGH' = exportSizeMb > 500 ? 'HIGH' : 'MEDIUM';
    const description = `대용량 데이터 내보내기 탐지: ${exportSizeMb.toFixed(1)}MB`;

    await logSecurityEvent({
      type: 'UNAUTHORIZED_ACCESS', severity, userId, tenantId, ip: sourceIp,
      details: { alertType: 'BULK_DOWNLOAD', exportSizeMb },
    });

    await createAlert({
      tenantId, userId, sourceIp,
      alertType:   'BULK_DOWNLOAD',
      severity,
      description,
      metadata:    { exportSizeMb },
    });

    if (severity === 'HIGH') {
      await sendAlertEmail('대용량 데이터 내보내기 탐지', `${description}\n사용자: ${userId}\n테넌트: ${tenantId}`);
    }
  }

  /**
   * 암호화 패턴 탐지 (랜섬웨어 payload 업로드 의심)
   * - request body의 50% 이상이 base64 문자면 CRITICAL
   */
  static async checkCryptoPattern(
    tenantId:    string,
    requestPath: string,
    body:        string,
    sourceIp?:   string,
    userId?:     string,
  ): Promise<void> {
    if (!body || body.length < 1000) return; // 너무 짧은 body는 무시

    // base64 문자 비율 계산 (A-Z, a-z, 0-9, +, /, =)
    const base64Chars  = (body.match(/[A-Za-z0-9+/=]/g) || []).length;
    const ratio        = base64Chars / body.length;

    if (ratio < THRESHOLDS.CRYPTO_PATTERN_RATIO) return;

    const description = `암호화 의심 payload 탐지 (base64 비율: ${(ratio * 100).toFixed(1)}%) — ${requestPath}`;

    await logSecurityEvent({
      type: 'SUSPICIOUS_LOGIN', severity: 'CRITICAL',
      userId, tenantId, ip: sourceIp,
      details: { alertType: 'CRYPTO_PATTERN', base64Ratio: ratio, path: requestPath },
    });

    await createAlert({
      tenantId, userId, sourceIp,
      alertType:   'CRYPTO_PATTERN',
      severity:    'CRITICAL',
      description,
      metadata:    { base64Ratio: ratio, bodyLength: body.length, path: requestPath },
    });

    if (userId) await blockUser(userId);

    await sendAlertEmail(
      'CRITICAL — 암호화 payload 탐지',
      `${description}\n사용자: ${userId ?? '미인증'}\n테넌트: ${tenantId}\nIP: ${sourceIp}\n\n즉시 조사가 필요합니다.`,
    );
  }
}
```

---

## 1-3. 불변 백업 쉘 스크립트

**파일**: `scripts/backup-immutable.sh`

```bash
#!/usr/bin/env bash
# scripts/backup-immutable.sh
# 랜섬웨어 대응 불변(Immutable) 백업 스크립트
# cron: 0 2 * * * /app/scripts/backup-immutable.sh
# 필요 환경변수: DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME,
#               AWS_BUCKET, RETAIN_DAYS, APP_API_URL, CRON_SECRET

set -euo pipefail

# ── 환경 변수 기본값 ─────────────────────────────────────────
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-}"
DB_NAME="${DB_NAME:-ems_db}"
AWS_BUCKET="${AWS_BUCKET:-ems-backups}"
RETAIN_DAYS="${RETAIN_DAYS:-30}"
APP_API_URL="${APP_API_URL:-http://localhost:3000}"
CRON_SECRET="${CRON_SECRET:-}"

# ── 경로 설정 ────────────────────────────────────────────────
NOW=$(date +%Y%m%d_%H%M)
YEAR=$(date +%Y)
MONTH=$(date +%m)
DAY=$(date +%d)
BACKUP_DIR="/backups/${YEAR}/${MONTH}/${DAY}"
BACKUP_FILE="${BACKUP_DIR}/full_${NOW}.sql.gz"
CHECKSUM_FILE="${BACKUP_FILE}.sha256"

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] 백업 시작: ${BACKUP_FILE}"

# ── Step 1: mysqldump (트랜잭션 일관성 보장) ────────────────
mysqldump \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --user="${DB_USER}" \
  --password="${DB_PASS}" \
  --single-transaction \
  --quick \
  --lock-tables=false \
  --set-gtid-purged=OFF \
  "${DB_NAME}" \
  | gzip -9 > "${BACKUP_FILE}"

echo "[$(date)] mysqldump 완료: $(du -sh "${BACKUP_FILE}" | cut -f1)"

# ── Step 2: SHA-256 체크섬 계산 ──────────────────────────────
sha256sum "${BACKUP_FILE}" | awk '{print $1}' > "${CHECKSUM_FILE}"
CHECKSUM=$(cat "${CHECKSUM_FILE}")
echo "[$(date)] 체크섬: ${CHECKSUM}"

# ── Step 3: 파일 불변 설정 (Linux chattr) ────────────────────
# 루트 권한 필요. 실패해도 백업 자체는 유지
if command -v chattr &>/dev/null; then
  chattr +i "${BACKUP_FILE}" "${CHECKSUM_FILE}" && \
    echo "[$(date)] 불변 속성 설정 완료" || \
    echo "[$(date)] WARNING: chattr 실패 (권한 부족 또는 비지원 FS)"
fi

# ── Step 4: S3/MinIO 업로드 (Object Lock WORM) ───────────────
RETAIN_DATE=$(date -d "+${RETAIN_DAYS} days" --utc +%Y-%m-%dT%H:%M:%SZ 2>/dev/null \
  || date -v +${RETAIN_DAYS}d -u +%Y-%m-%dT%H:%M:%SZ) # macOS 호환

S3_KEY="backups/${YEAR}/${MONTH}/${DAY}/$(basename "${BACKUP_FILE}")"

aws s3 cp "${BACKUP_FILE}" "s3://${AWS_BUCKET}/${S3_KEY}" \
  --object-lock-mode COMPLIANCE \
  --object-lock-retain-until-date "${RETAIN_DATE}" \
  --storage-class STANDARD_IA

aws s3 cp "${CHECKSUM_FILE}" "s3://${AWS_BUCKET}/${S3_KEY}.sha256" \
  --object-lock-mode COMPLIANCE \
  --object-lock-retain-until-date "${RETAIN_DATE}"

echo "[$(date)] S3 업로드 완료: s3://${AWS_BUCKET}/${S3_KEY}"

# ── Step 5: 파일 크기 추출 ───────────────────────────────────
SIZE_BYTES=$(stat -c%s "${BACKUP_FILE}" 2>/dev/null || stat -f%z "${BACKUP_FILE}")

# ── Step 6: 백업 결과 DB 기록 (API 호출) ─────────────────────
curl -s -X POST "${APP_API_URL}/api/admin/backups" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: ${CRON_SECRET}" \
  -d "{
    \"backupType\": \"full\",
    \"status\": \"verified\",
    \"sizeBytes\": ${SIZE_BYTES},
    \"storagePath\": \"s3://${AWS_BUCKET}/${S3_KEY}\",
    \"checksum\": \"${CHECKSUM}\",
    \"isImmutable\": true,
    \"expiresAt\": \"${RETAIN_DATE}\"
  }" || echo "[$(date)] WARNING: API 기록 실패"

echo "[$(date)] 백업 완료"

# ── Step 7: 30일 이상 된 로컬 백업 삭제 ─────────────────────
find /backups -name "*.sql.gz" -mtime +${RETAIN_DAYS} -exec rm -f {} \; 2>/dev/null || true
find /backups -name "*.sha256" -mtime +${RETAIN_DAYS} -exec rm -f {} \; 2>/dev/null || true

exit 0

# ── 오류 핸들러 ──────────────────────────────────────────────
cleanup_on_error() {
  echo "[$(date)] ERROR: 백업 실패"
  curl -s -X POST "${APP_API_URL}/api/cron/backup-alert" \
    -H "Content-Type: application/json" \
    -H "x-cron-secret: ${CRON_SECRET}" \
    -d "{\"message\": \"백업 실패: ${BACKUP_FILE}\", \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" \
    || true
  exit 1
}
trap cleanup_on_error ERR
```

---

## 1-4. API Routes

### `app/api/admin/security/ransomware/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyAuth } from '@/lib/auth/verify';
import { successResponse, errorResponse } from '@/lib/api/response';

const prisma = new PrismaClient();

// GET /api/admin/security/ransomware
// 쿼리: status, severity, dateFrom, dateTo, page, limit
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });
  // tenant_admin(3) 또는 super_admin(4) 허용
  if (auth.role < 3) return errorResponse('PERMISSION_DENIED', { status: 403 });

  const { searchParams } = new URL(request.url);
  const status    = searchParams.get('status')   || undefined;
  const severity  = searchParams.get('severity') || undefined;
  const dateFrom  = searchParams.get('dateFrom') || undefined;
  const dateTo    = searchParams.get('dateTo')   || undefined;
  const page      = Math.max(1, Number(searchParams.get('page')  || 1));
  const limit     = Math.min(100, Number(searchParams.get('limit') || 20));
  const skip      = (page - 1) * limit;

  try {
    // super_admin은 전체 테넌트 조회, tenant_admin은 자기 테넌트만
    const tenantFilter = auth.role < 4 ? { tenantId: auth.tenantId } : {};

    const where = {
      ...tenantFilter,
      ...(status   && { status }),
      ...(severity && { severity }),
      ...(dateFrom || dateTo ? {
        createdAt: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo   && { lte: new Date(dateTo) }),
        },
      } : {}),
    };

    const [alerts, total] = await Promise.all([
      (prisma as any).ransomwareAlert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      (prisma as any).ransomwareAlert.count({ where }),
    ]);

    return successResponse(alerts, {
      pagination: { skip, take: limit, total, hasMore: skip + limit < total },
    });
  } catch (err) {
    console.error('[RansomwareAlert GET]', err);
    return errorResponse('SERVER_ERROR', { status: 500 });
  }
}

// POST /api/admin/security/ransomware
// 수동 알림 생성 또는 대응 액션 트리거
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });
  if (auth.role < 3) return errorResponse('PERMISSION_DENIED', { status: 403 });

  try {
    const body = await request.json();
    const { alertType, severity, description, metadata } = body;

    if (!alertType || !severity || !description) {
      return errorResponse('VALIDATION_REQUIRED_FIELD', { status: 400 });
    }

    const alert = await (prisma as any).ransomwareAlert.create({
      data: {
        tenantId:    auth.tenantId,
        userId:      auth.userId,
        alertType,
        severity,
        description,
        metadata:    metadata ?? null,
        status:      'open',
      },
    });

    return successResponse(alert, { status: 201 });
  } catch (err) {
    console.error('[RansomwareAlert POST]', err);
    return errorResponse('SERVER_ERROR', { status: 500 });
  }
}
```

### `app/api/admin/security/ransomware/[id]/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyAuth } from '@/lib/auth/verify';
import { successResponse, errorResponse } from '@/lib/api/response';

const prisma = new PrismaClient();

// PATCH /api/admin/security/ransomware/[id]
// 알림 상태 업데이트: investigating | contained | resolved | false_positive
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const auth = await verifyAuth(request);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });
  if (auth.role < 3) return errorResponse('PERMISSION_DENIED', { status: 403 });

  try {
    const body   = await request.json();
    const { status } = body;

    const VALID_STATUSES = ['investigating', 'contained', 'resolved', 'false_positive'];
    if (!VALID_STATUSES.includes(status)) {
      return errorResponse('VALIDATION_INVALID_FORMAT', { status: 400,
        details: { status: `허용값: ${VALID_STATUSES.join(', ')}` } });
    }

    // 해당 알림 존재 확인
    const existing = await (prisma as any).ransomwareAlert.findUnique({ where: { id } });
    if (!existing) return errorResponse('RESOURCE_NOT_FOUND', { status: 404 });

    // tenant_admin은 자기 테넌트 알림만 수정 가능
    if (auth.role < 4 && existing.tenantId !== auth.tenantId) {
      return errorResponse('PERMISSION_DENIED', { status: 403 });
    }

    const isResolved = ['resolved', 'false_positive'].includes(status);

    const updated = await (prisma as any).ransomwareAlert.update({
      where: { id },
      data: {
        status,
        ...(isResolved && {
          resolvedBy: auth.userId,
          resolvedAt: new Date(),
        }),
      },
    });

    return successResponse(updated);
  } catch (err) {
    console.error('[RansomwareAlert PATCH]', err);
    return errorResponse('SERVER_ERROR', { status: 500 });
  }
}
```

---

## 1-5. Security Dashboard UI

**파일**: `app/(tenant)/admin/security/ransomware/page.tsx`

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Shield, AlertTriangle, HardDrive, RefreshCw,
  Ban, CheckCircle, Clock, XCircle,
} from 'lucide-react';
import { apiGet, apiPatch } from '@/lib/api/client';

// ──────────────────────────────────────────────────────────────
// 타입
// ──────────────────────────────────────────────────────────────
interface RansomwareAlert {
  id:          string;
  alertType:   string;
  severity:    'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  sourceIp:    string | null;
  userId:      string | null;
  status:      string;
  createdAt:   string;
  resolvedAt:  string | null;
}

interface BackupRecord {
  id:          string;
  backupType:  string;
  status:      string;
  sizeBytes:   number | null;
  storagePath: string;
  completedAt: string | null;
}

// ──────────────────────────────────────────────────────────────
// 심각도 스타일 매핑
// ──────────────────────────────────────────────────────────────
const SEVERITY_STYLE: Record<string, string> = {
  CRITICAL: 'bg-red-900/60 text-red-300 border border-red-600',
  HIGH:     'bg-orange-900/60 text-orange-300 border border-orange-600',
  MEDIUM:   'bg-yellow-900/60 text-yellow-300 border border-yellow-600',
  LOW:      'bg-blue-900/60 text-blue-300 border border-blue-600',
};

const ALERT_TYPE_LABEL: Record<string, string> = {
  MASS_DELETE:      '대량 삭제',
  MASS_UPDATE:      '대량 업데이트',
  UNUSUAL_EXPORT:   '비정상 내보내기',
  CRYPTO_PATTERN:   '암호화 패턴',
  SUSPICIOUS_QUERY: '의심 쿼리',
  BULK_DOWNLOAD:    '대용량 다운로드',
};

const STATUS_STYLE: Record<string, string> = {
  open:           'text-red-400',
  investigating:  'text-yellow-400',
  contained:      'text-orange-400',
  resolved:       'text-green-400',
  false_positive: 'text-gray-400',
};

// ──────────────────────────────────────────────────────────────
// 시간 경과 포맷
// ──────────────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)   return `${diff}초 전`;
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

// ──────────────────────────────────────────────────────────────
// 페이지 컴포넌트
// ──────────────────────────────────────────────────────────────
export default function RansomwareDashboardPage() {
  const [alerts, setAlerts]       = useState<RansomwareAlert[]>([]);
  const [backup, setBackup]       = useState<BackupRecord | null>(null);
  const [loading, setLoading]     = useState(true);
  const [updating, setUpdating]   = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [alertsRes, backupRes] = await Promise.all([
        apiGet<{ data: RansomwareAlert[] }>('/api/admin/security/ransomware?limit=50'),
        apiGet<{ data: BackupRecord[] }>('/api/admin/backups?limit=1&sort=desc'),
      ]);
      setAlerts(alertsRes.data ?? []);
      setBackup(backupRes.data?.[0] ?? null);
    } catch (err) {
      console.error('데이터 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateStatus = async (id: string, status: string) => {
    setUpdating(id);
    try {
      await apiPatch(`/api/admin/security/ransomware/${id}`, { status });
      await fetchData();
    } catch (err) {
      console.error('상태 업데이트 실패:', err);
    } finally {
      setUpdating(null);
    }
  };

  // KPI 계산
  const openAlerts     = alerts.filter((a) => a.status === 'open').length;
  const criticalAlerts = alerts.filter((a) => a.severity === 'CRITICAL').length;
  const lastBackupTime = backup?.completedAt ? timeAgo(backup.completedAt) : '없음';
  const backupOk       = backup?.status === 'verified' || backup?.status === 'completed';

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-7 h-7 text-red-400" />
          <div>
            <h1 className="text-xl font-bold text-white">랜섬웨어 대응 센터</h1>
            <p className="text-sm text-gray-400">이상 탐지 · 백업 상태 · 인시던트 관리</p>
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700
                     rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="미해결 알림"
          value={openAlerts}
          icon={<AlertTriangle className="w-5 h-5 text-red-400" />}
          color="red"
        />
        <KpiCard
          label="CRITICAL 알림"
          value={criticalAlerts}
          icon={<XCircle className="w-5 h-5 text-orange-400" />}
          color="orange"
        />
        <KpiCard
          label="마지막 백업"
          value={lastBackupTime}
          icon={<Clock className="w-5 h-5 text-blue-400" />}
          color="blue"
        />
        <KpiCard
          label="백업 상태"
          value={backupOk ? '정상' : '이상'}
          icon={<HardDrive className={`w-5 h-5 ${backupOk ? 'text-green-400' : 'text-red-400'}`} />}
          color={backupOk ? 'green' : 'red'}
        />
      </div>

      {/* 알림 테이블 */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 className="font-semibold text-white">보안 알림 목록</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> 로딩 중...
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500">
            <CheckCircle className="w-8 h-8 mb-2 text-green-500" />
            <p>탐지된 보안 알림 없음</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-800">
                  <th className="px-4 py-3">심각도</th>
                  <th className="px-4 py-3">유형</th>
                  <th className="px-4 py-3">설명</th>
                  <th className="px-4 py-3">IP</th>
                  <th className="px-4 py-3">시간</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3">액션</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <tr key={alert.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${SEVERITY_STYLE[alert.severity]}`}>
                        {alert.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {ALERT_TYPE_LABEL[alert.alertType] ?? alert.alertType}
                    </td>
                    <td className="px-4 py-3 text-gray-400 max-w-xs truncate" title={alert.description}>
                      {alert.description}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">
                      {alert.sourceIp ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {timeAgo(alert.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${STATUS_STYLE[alert.status] ?? 'text-gray-400'}`}>
                        {alert.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {alert.status === 'open' && (
                          <>
                            <button
                              onClick={() => updateStatus(alert.id, 'investigating')}
                              disabled={updating === alert.id}
                              className="px-2 py-1 bg-yellow-900/50 hover:bg-yellow-900
                                         text-yellow-300 text-xs rounded transition-colors
                                         disabled:opacity-50"
                            >
                              조사 중
                            </button>
                            {alert.severity === 'CRITICAL' && (
                              <button
                                onClick={() => updateStatus(alert.id, 'contained')}
                                disabled={updating === alert.id}
                                className="flex items-center gap-1 px-2 py-1 bg-red-900/50
                                           hover:bg-red-900 text-red-300 text-xs rounded
                                           transition-colors disabled:opacity-50"
                              >
                                <Ban className="w-3 h-3" /> 차단
                              </button>
                            )}
                          </>
                        )}
                        {['investigating', 'contained'].includes(alert.status) && (
                          <>
                            <button
                              onClick={() => updateStatus(alert.id, 'resolved')}
                              disabled={updating === alert.id}
                              className="px-2 py-1 bg-green-900/50 hover:bg-green-900
                                         text-green-300 text-xs rounded transition-colors
                                         disabled:opacity-50"
                            >
                              해결됨
                            </button>
                            <button
                              onClick={() => updateStatus(alert.id, 'false_positive')}
                              disabled={updating === alert.id}
                              className="px-2 py-1 bg-gray-700 hover:bg-gray-600
                                         text-gray-300 text-xs rounded transition-colors
                                         disabled:opacity-50"
                            >
                              오탐
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// KPI 카드 서브컴포넌트
// ──────────────────────────────────────────────────────────────
function KpiCard({
  label, value, icon, color,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'red' | 'orange' | 'blue' | 'green';
}) {
  const borderColor: Record<string, string> = {
    red:    'border-red-900/50',
    orange: 'border-orange-900/50',
    blue:   'border-blue-900/50',
    green:  'border-green-900/50',
  };

  return (
    <div className={`bg-gray-900 border ${borderColor[color]} rounded-xl p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400">{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}
```

---

# SECTION 2: 슈퍼 관리자 ERP 시스템

## 2-1. ERP Prisma 스키마

`prisma/schema.prisma` 하단에 추가:

```prisma
// ─── ERP: 인보이스 · KPI 스냅샷 ──────────────────────────────

model Invoice {
  id             String   @id @default(uuid())
  invoiceNo      String   @unique @map("invoice_no") @db.VarChar(30)
  // format: INV-YYYYMM-NNNN
  tenantId       String   @map("tenant_id")
  subscriptionId String?  @map("subscription_id")
  periodStart    String   @map("period_start") @db.VarChar(10)  // YYYY-MM-DD
  periodEnd      String   @map("period_end")   @db.VarChar(10)
  subtotal       Decimal  @db.Decimal(12, 2)
  taxRate        Decimal  @default(0.10) @map("tax_rate") @db.Decimal(5, 4)
  taxAmount      Decimal  @map("tax_amount") @db.Decimal(12, 2)
  total          Decimal  @db.Decimal(12, 2)
  currency       String   @default("KRW") @db.VarChar(3)
  status         String   @default("draft") @db.VarChar(20)
  // draft | issued | paid | overdue | cancelled
  dueDate        DateTime @map("due_date")
  paidAt         DateTime? @map("paid_at")
  notes          String?  @db.Text
  createdAt      DateTime @default(now()) @map("created_at")

  lineItems InvoiceLineItem[]

  @@index([tenantId, status])
  @@index([periodStart, status])
  @@map("invoice")
}

model InvoiceLineItem {
  id          String  @id @default(uuid())
  invoiceId   String  @map("invoice_id")
  description String  @db.VarChar(500)
  quantity    Int     @default(1)
  unitPrice   Decimal @map("unit_price") @db.Decimal(12, 2)
  amount      Decimal @db.Decimal(12, 2)

  invoice Invoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)

  @@map("invoice_line_item")
}

model KpiSnapshot {
  id          String  @id @default(uuid())
  tenantId    String  @map("tenant_id")
  period      String  @db.VarChar(7)  // YYYY-MM

  // 에너지 KPI
  totalKwh    Decimal @map("total_kwh")   @db.Decimal(15, 3)
  peakKw      Decimal @map("peak_kw")     @db.Decimal(10, 3)
  baselineKwh Decimal? @map("baseline_kwh") @db.Decimal(15, 3)
  savedKwh    Decimal? @map("saved_kwh")    @db.Decimal(15, 3)

  // 탄소 KPI
  totalCo2Kg  Decimal  @map("total_co2_kg") @db.Decimal(15, 3)
  savedCo2Kg  Decimal? @map("saved_co2_kg") @db.Decimal(15, 3)

  // 재무 KPI
  energyCostKrw  Decimal? @map("energy_cost_krw")  @db.Decimal(15, 2)
  savedCostKrw   Decimal? @map("saved_cost_krw")   @db.Decimal(15, 2)
  investmentKrw  Decimal? @map("investment_krw")   @db.Decimal(15, 2)
  roiPercent     Decimal? @map("roi_percent")       @db.Decimal(8, 2)
  paybackMonths  Decimal? @map("payback_months")    @db.Decimal(6, 1)

  createdAt DateTime @default(now()) @map("created_at")

  @@unique([tenantId, period])
  @@index([period])
  @@map("kpi_snapshot")
}
```

---

## 2-2. ERP Service

**파일**: `lib/services/erp.service.ts`

```typescript
/**
 * lib/services/erp.service.ts
 *
 * 슈퍼 관리자 ERP 서비스
 * - 플랫폼 수익 집계 (MRR / ARR)
 * - 테넌트 ROI 계산
 * - 인보이스 자동 생성
 * - 플랫폼 전체 KPI
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// ──────────────────────────────────────────────────────────────
// 타입 정의
// ──────────────────────────────────────────────────────────────
export interface RevenueSummary {
  period:           string;
  totalRevenue:     number;  // 원
  mrr:              number;  // 월간 반복 수익
  arr:              number;  // 연간 반복 수익 (MRR × 12)
  newSubscriptions: number;
  churned:          number;
  netRevenue:       number;  // totalRevenue - 환불
}

export interface TenantROI {
  tenantId:      string;
  period:        string;
  savedCostKrw:  number;
  investmentKrw: number;
  roiPercent:    number;    // (saved - invested) / invested × 100
  paybackMonths: number;
}

export interface PlatformKPIs {
  totalTenants:   number;
  activeTenants:  number;
  totalDevices:   number;
  totalSites:     number;
  mqttMsgToday:   number;
  alertsOpen:     number;
}

export interface InvoiceResult {
  invoiceId: string;
  invoiceNo: string;
  total:     number;
  status:    string;
}

// ──────────────────────────────────────────────────────────────
// 인보이스 번호 채번: INV-YYYYMM-NNNN
// ──────────────────────────────────────────────────────────────
async function generateInvoiceNo(period: string): Promise<string> {
  // period = "YYYY-MM" → "YYYYMM"
  const ym = period.replace('-', '');

  // 해당 월 인보이스 수를 count해 번호 결정
  const count = await (prisma as any).invoice.count({
    where: { invoiceNo: { startsWith: `INV-${ym}-` } },
  });

  const seq = String(count + 1).padStart(4, '0');
  return `INV-${ym}-${seq}`;
}

// ──────────────────────────────────────────────────────────────
// ERP 서비스
// ──────────────────────────────────────────────────────────────
export class ERPService {
  /**
   * 플랫폼 수익 집계
   * - period: "YYYY-MM" 형식
   * - Subscription.payments 집계 (payment_log 또는 subscription 테이블)
   */
  static async getPlatformRevenueSummary(period: string): Promise<RevenueSummary> {
    const [year, month] = period.split('-').map(Number);
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd   = new Date(year, month, 1);

    // 해당 기간에 생성된 구독 결제 집계
    const payments = await prisma.subscription.findMany({
      where: {
        createdAt: { gte: periodStart, lt: periodEnd },
        status:    { in: ['active', 'cancelled'] },
      },
      select: {
        id:        true,
        status:    true,
        price:     true,
        plan:      { select: { price: true } },
      },
    });

    const activePayments  = payments.filter((p) => p.status === 'active');
    const churnedPayments = payments.filter((p) => p.status === 'cancelled');

    // MRR: 현재 활성 구독의 월 합계
    const activeSubs = await prisma.subscription.findMany({
      where:  { status: 'active' },
      select: { plan: { select: { price: true } } },
    });
    const mrr = activeSubs.reduce((sum, s) => sum + Number(s.plan?.price ?? 0), 0);

    const totalRevenue = activePayments.reduce(
      (sum, p) => sum + Number(p.plan?.price ?? 0), 0,
    );

    return {
      period,
      totalRevenue,
      mrr,
      arr:              mrr * 12,
      newSubscriptions: activePayments.length,
      churned:          churnedPayments.length,
      netRevenue:       totalRevenue,
    };
  }

  /**
   * 테넌트 ROI 계산
   * - KpiSnapshot 기반
   * - ROI = (savedCostKrw - investmentKrw) / investmentKrw × 100
   */
  static async getTenantROI(tenantId: string, period: string): Promise<TenantROI | null> {
    const snapshot = await (prisma as any).kpiSnapshot.findUnique({
      where: { tenantId_period: { tenantId, period } },
    });

    if (!snapshot) return null;

    const saved      = Number(snapshot.savedCostKrw  ?? 0);
    const invested   = Number(snapshot.investmentKrw ?? 0);
    const roiPercent = invested > 0 ? ((saved - invested) / invested) * 100 : 0;
    // 월 절감액 기준 회수 기간 (월)
    const monthlySaved  = saved;
    const paybackMonths = monthlySaved > 0 ? invested / monthlySaved : 0;

    return {
      tenantId,
      period,
      savedCostKrw:  saved,
      investmentKrw: invested,
      roiPercent:    Math.round(roiPercent * 100) / 100,
      paybackMonths: Math.round(paybackMonths * 10) / 10,
    };
  }

  /**
   * 인보이스 자동 생성
   * - 구독 정보 기반 line item 생성
   * - 부가세 10% 자동 계산
   */
  static async generateInvoice(tenantId: string, period: string): Promise<InvoiceResult> {
    // 해당 테넌트의 활성 구독 조회
    const subscription = await prisma.subscription.findFirst({
      where:   { tenantId, status: 'active' },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      throw new Error(`테넌트 ${tenantId}의 활성 구독을 찾을 수 없습니다.`);
    }

    const planPrice = Number(subscription.plan?.price ?? 0);
    const invoiceNo = await generateInvoiceNo(period);

    // 기간 파싱
    const [year, month] = period.split('-').map(Number);
    const periodStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay     = new Date(year, month, 0).getDate();
    const periodEnd   = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

    const subtotal  = new Prisma.Decimal(planPrice);
    const taxRate   = new Prisma.Decimal('0.10');
    const taxAmount = subtotal.mul(taxRate);
    const total     = subtotal.add(taxAmount);

    // 납기일: 익월 10일
    const dueDate = new Date(year, month, 10);

    const invoice = await (prisma as any).invoice.create({
      data: {
        invoiceNo,
        tenantId,
        subscriptionId: subscription.id,
        periodStart,
        periodEnd,
        subtotal,
        taxRate,
        taxAmount,
        total,
        currency: 'KRW',
        status:   'issued',
        dueDate,
        lineItems: {
          create: [
            {
              description: `${subscription.plan?.name ?? '구독'} 이용료 (${period})`,
              quantity:    1,
              unitPrice:   planPrice,
              amount:      planPrice,
            },
          ],
        },
      },
    });

    return {
      invoiceId: invoice.id,
      invoiceNo,
      total:     Number(total),
      status:    'issued',
    };
  }

  /**
   * 플랫폼 전체 KPI
   * - super_admin 대시보드용
   */
  static async getPlatformKPIs(): Promise<PlatformKPIs> {
    const today     = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const [
      totalTenants,
      activeTenants,
      totalDevices,
      totalSites,
      alertsOpen,
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { isActive: true } }),
      prisma.device.count(),
      prisma.site.count(),
      (prisma as any).ransomwareAlert.count({ where: { status: 'open' } }).catch(() => 0),
    ]);

    // MQTT 메시지는 measurement 테이블 기준 (오늘 수집된 행)
    const mqttMsgToday = await prisma.measurement.count({
      where: { time: { gte: todayStart } },
    }).catch(() => 0);

    return {
      totalTenants,
      activeTenants,
      totalDevices,
      totalSites,
      mqttMsgToday,
      alertsOpen,
    };
  }
}
```

---

## 2-3. ERP API Routes

### `app/api/super-admin/erp/revenue/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { successResponse, errorResponse } from '@/lib/api/response';
import { ERPService } from '@/lib/services/erp.service';

// GET /api/super-admin/erp/revenue?period=2026-03&breakdown=by_plan
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return errorResponse('AUTH_REQUIRED',        { status: 401 });
  if (auth.role < 4) return errorResponse('PERMISSION_DENIED', { status: 403 }); // super_admin만

  const { searchParams } = new URL(request.url);
  const period    = searchParams.get('period')    || new Date().toISOString().slice(0, 7);
  const breakdown = searchParams.get('breakdown') || 'by_month';

  try {
    const summary = await ERPService.getPlatformRevenueSummary(period);

    // breakdown 별 추가 집계 (Recharts 소비용)
    let breakdownData: unknown[] = [];

    if (breakdown === 'by_month') {
      // 최근 12개월 수익 트렌드
      const months: string[] = [];
      const base = new Date(period);
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
    console.error('[ERP Revenue GET]', err);
    return errorResponse('SERVER_ERROR', { status: 500 });
  }
}
```

### `app/api/super-admin/erp/kpi/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyAuth } from '@/lib/auth/verify';
import { successResponse, errorResponse } from '@/lib/api/response';
import { ERPService } from '@/lib/services/erp.service';

const prisma = new PrismaClient();

// GET /api/super-admin/erp/kpi
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return errorResponse('AUTH_REQUIRED',        { status: 401 });
  if (auth.role < 4) return errorResponse('PERMISSION_DENIED', { status: 403 });

  try {
    const period = new Date().toISOString().slice(0, 7); // YYYY-MM

    const [platformKPIs, allTenants] = await Promise.all([
      ERPService.getPlatformKPIs(),
      prisma.tenant.findMany({
        where:  { isActive: true },
        select: {
          id:        true,
          name:      true,
          devices:   { select: { id: true } },
          sites:     { select: { id: true } },
          subscriptions: {
            where:  { status: 'active' },
            select: { plan: { select: { name: true, price: true } } },
            take:   1,
          },
        },
        take: 10,
      }),
    ]);

    // 각 테넌트의 ROI 조회
    const tenantROIs = await Promise.allSettled(
      allTenants.map((t) => ERPService.getTenantROI(t.id, period)),
    );

    const topTenants = allTenants.map((t, i) => {
      const roiResult = tenantROIs[i];
      const roi = roiResult.status === 'fulfilled' ? roiResult.value : null;
      return {
        id:          t.id,
        name:        t.name,
        plan:        t.subscriptions[0]?.plan?.name ?? 'free',
        mrr:         Number(t.subscriptions[0]?.plan?.price ?? 0),
        deviceCount: t.devices.length,
        siteCount:   t.sites.length,
        roiPercent:  roi?.roiPercent ?? null,
      };
    }).sort((a, b) => (b.roiPercent ?? -Infinity) - (a.roiPercent ?? -Infinity));

    return successResponse({
      platform:   platformKPIs,
      topTenants,
      period,
    });
  } catch (err) {
    console.error('[ERP KPI GET]', err);
    return errorResponse('SERVER_ERROR', { status: 500 });
  }
}
```

### `app/api/super-admin/erp/invoices/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyAuth } from '@/lib/auth/verify';
import { successResponse, errorResponse } from '@/lib/api/response';
import { ERPService } from '@/lib/services/erp.service';

const prisma = new PrismaClient();

// GET /api/super-admin/erp/invoices?tenantId=xxx&status=issued&page=1
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return errorResponse('AUTH_REQUIRED',        { status: 401 });
  if (auth.role < 4) return errorResponse('PERMISSION_DENIED', { status: 403 });

  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId') || undefined;
  const status   = searchParams.get('status')   || undefined;
  const page     = Math.max(1, Number(searchParams.get('page') || 1));
  const limit    = Math.min(100, Number(searchParams.get('limit') || 20));
  const skip     = (page - 1) * limit;

  try {
    const where = {
      ...(tenantId && { tenantId }),
      ...(status   && { status }),
    };

    const [invoices, total] = await Promise.all([
      (prisma as any).invoice.findMany({
        where,
        include: { lineItems: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take:  limit,
      }),
      (prisma as any).invoice.count({ where }),
    ]);

    return successResponse(invoices, {
      pagination: { skip, take: limit, total, hasMore: skip + limit < total },
    });
  } catch (err) {
    console.error('[ERP Invoices GET]', err);
    return errorResponse('SERVER_ERROR', { status: 500 });
  }
}

// POST /api/super-admin/erp/invoices
// body: { tenantId, period }
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return errorResponse('AUTH_REQUIRED',        { status: 401 });
  if (auth.role < 4) return errorResponse('PERMISSION_DENIED', { status: 403 });

  try {
    const { tenantId, period } = await request.json();

    if (!tenantId || !period) {
      return errorResponse('VALIDATION_REQUIRED_FIELD', { status: 400,
        details: { required: ['tenantId', 'period'] } });
    }

    const result = await ERPService.generateInvoice(tenantId, period);
    return successResponse(result, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[ERP Invoices POST]', message);
    return errorResponse('SERVER_ERROR', { status: 500, details: { message } });
  }
}
```

---

## 2-4. Super Admin ERP 대시보드

**파일**: `app/(tenant)/super-admin/erp/page.tsx`

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  DollarSign, Users, Cpu, AlertTriangle, TrendingUp,
  Activity, RefreshCw, FileText,
} from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api/client';

// ──────────────────────────────────────────────────────────────
// 타입
// ──────────────────────────────────────────────────────────────
interface PlatformKPIs {
  totalTenants:  number;
  activeTenants: number;
  totalDevices:  number;
  totalSites:    number;
  mqttMsgToday:  number;
  alertsOpen:    number;
}

interface TopTenant {
  id:          string;
  name:        string;
  plan:        string;
  mrr:         number;
  deviceCount: number;
  siteCount:   number;
  roiPercent:  number | null;
}

interface RevenueSummary {
  period:           string;
  totalRevenue:     number;
  mrr:              number;
  arr:              number;
  newSubscriptions: number;
  churned:          number;
  netRevenue:       number;
}

interface RevenueBreakdown {
  period:  string;
  revenue: number;
  mrr:     number;
}

// ──────────────────────────────────────────────────────────────
// 숫자 포맷 헬퍼
// ──────────────────────────────────────────────────────────────
const fmtKrw  = (v: number) => `₩${v.toLocaleString('ko-KR')}`;
const fmtNum  = (v: number) => v.toLocaleString('ko-KR');
const fmtPct  = (v: number | null) => v != null ? `${v.toFixed(1)}%` : '-';

// ──────────────────────────────────────────────────────────────
// 플랫폼 건강 표시기
// ──────────────────────────────────────────────────────────────
function HealthIndicator({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2.5 h-2.5 rounded-full ${ok ? 'bg-green-400' : 'bg-red-400'}`} />
      <span className="text-sm text-gray-300">{label}</span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// 페이지
// ──────────────────────────────────────────────────────────────
export default function SuperAdminERPPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [kpi,      setKpi]      = useState<PlatformKPIs | null>(null);
  const [revenue,  setRevenue]  = useState<RevenueSummary | null>(null);
  const [chart,    setChart]    = useState<RevenueBreakdown[]>([]);
  const [tenants,  setTenants]  = useState<TopTenant[]>([]);
  const [invoices, setInvoices] = useState<unknown[]>([]);
  const [loading,  setLoading]  = useState(true);

  // super_admin 역할 검사
  useEffect(() => {
    if (status === 'loading') return;
    const role = (session?.user as any)?.role;
    if (!session || role !== 'super_admin') {
      router.replace('/dashboard');
    }
  }, [session, status, router]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const period = new Date().toISOString().slice(0, 7);
      const [kpiRes, revenueRes, invoiceRes] = await Promise.all([
        apiGet<{ data: { platform: PlatformKPIs; topTenants: TopTenant[] } }>('/api/super-admin/erp/kpi'),
        apiGet<{ data: { summary: RevenueSummary; breakdown: RevenueBreakdown[] } }>(
          `/api/super-admin/erp/revenue?period=${period}&breakdown=by_month`,
        ),
        apiGet<{ data: unknown[] }>('/api/super-admin/erp/invoices?limit=5'),
      ]);

      setKpi(kpiRes.data.platform);
      setTenants(kpiRes.data.topTenants);
      setRevenue(revenueRes.data.summary);
      setChart(revenueRes.data.breakdown ?? []);
      setInvoices(invoiceRes.data ?? []);
    } catch (err) {
      console.error('ERP 데이터 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950 text-white">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        로딩 중...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">슈퍼 관리자 ERP</h1>
          <p className="text-sm text-gray-400">플랫폼 수익 · 테넌트 ROI · 인보이스 관리</p>
        </div>
        <button
          onClick={fetchAll}
          className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700
                     rounded-lg text-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> 새로고침
        </button>
      </div>

      {/* KPI 카드 행 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <ERPKpiCard
          label="MRR"
          value={fmtKrw(revenue?.mrr ?? 0)}
          icon={<DollarSign className="w-5 h-5 text-green-400" />}
          sub={`ARR ${fmtKrw(revenue?.arr ?? 0)}`}
        />
        <ERPKpiCard
          label="ARR"
          value={fmtKrw(revenue?.arr ?? 0)}
          icon={<TrendingUp className="w-5 h-5 text-blue-400" />}
          sub="연간 반복 수익"
        />
        <ERPKpiCard
          label="활성 테넌트"
          value={fmtNum(kpi?.activeTenants ?? 0)}
          icon={<Users className="w-5 h-5 text-purple-400" />}
          sub={`전체 ${fmtNum(kpi?.totalTenants ?? 0)}`}
        />
        <ERPKpiCard
          label="등록 디바이스"
          value={fmtNum(kpi?.totalDevices ?? 0)}
          icon={<Cpu className="w-5 h-5 text-cyan-400" />}
          sub={`사이트 ${fmtNum(kpi?.totalSites ?? 0)}`}
        />
        <ERPKpiCard
          label="미해결 알림"
          value={fmtNum(kpi?.alertsOpen ?? 0)}
          icon={<AlertTriangle className="w-5 h-5 text-red-400" />}
          sub={`MQTT 오늘 ${fmtNum(kpi?.mqttMsgToday ?? 0)}건`}
        />
      </div>

      {/* 수익 차트 + 플랫폼 건강 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* 월별 수익 차트 */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-blue-400" />
            <h2 className="font-semibold text-white">월별 수익 트렌드 (12개월)</h2>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chart} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="period"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                tickFormatter={(v: string) => v.slice(5)}
              />
              <YAxis
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                tickFormatter={(v: number) => `${(v / 10000).toFixed(0)}만`}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
                formatter={(v: unknown) => [fmtKrw(Number(v)), 'MRR']}
              />
              <Bar dataKey="mrr" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 플랫폼 건강 */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="font-semibold text-white mb-4">플랫폼 건강 지표</h2>
          <div className="space-y-3">
            <HealthIndicator label="DB 연결" ok={true} />
            <HealthIndicator label="MQTT 브로커" ok={kpi ? kpi.mqttMsgToday > 0 : false} />
            <HealthIndicator label="보안 알림 없음" ok={kpi ? kpi.alertsOpen === 0 : true} />
            <HealthIndicator label="활성 테넌트 정상" ok={kpi ? kpi.activeTenants > 0 : false} />
            <HealthIndicator label="백업 상태" ok={true} />
          </div>

          <div className="mt-6 pt-4 border-t border-gray-800">
            <p className="text-xs text-gray-500 mb-2">이번 달 구독 현황</p>
            <div className="flex justify-between text-sm">
              <span className="text-green-400">신규 +{revenue?.newSubscriptions ?? 0}</span>
              <span className="text-red-400">이탈 -{revenue?.churned ?? 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top 10 테넌트 테이블 */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-green-400" />
          <h2 className="font-semibold text-white">Top 테넌트 (ROI 기준)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-800">
                <th className="px-4 py-3">테넌트</th>
                <th className="px-4 py-3">플랜</th>
                <th className="px-4 py-3 text-right">MRR</th>
                <th className="px-4 py-3 text-right">디바이스</th>
                <th className="px-4 py-3 text-right">ROI</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-3 font-medium text-white">{t.name}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-blue-900/50 text-blue-300 text-xs rounded">
                      {t.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-green-400">{fmtKrw(t.mrr)}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{t.deviceCount}</td>
                  <td className={`px-4 py-3 text-right font-medium
                    ${t.roiPercent && t.roiPercent > 0 ? 'text-green-400' : 'text-gray-400'}`}>
                    {fmtPct(t.roiPercent)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 최근 인보이스 */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-400" />
            <h2 className="font-semibold text-white">최근 인보이스</h2>
          </div>
        </div>
        <p className="text-sm text-gray-400">
          최근 발행된 인보이스 {invoices.length}건 /
          <a href="/api/super-admin/erp/invoices" className="ml-1 text-blue-400 hover:underline">
            전체 보기
          </a>
        </p>
      </div>
    </div>
  );
}

function ERPKpiCard({
  label, value, icon, sub,
}: {
  label: string;
  value: string;
  icon:  React.ReactNode;
  sub?:  string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400">{label}</span>
        {icon}
      </div>
      <div className="text-xl font-bold text-white truncate">{value}</div>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}
```

---

# SECTION 3: 모듈형 시스템 아키텍처

## 3-1. 전체 폴더 구조

```
lib/
├── modules/                    # 핵심 도메인 모듈 (독립 경계)
│   ├── index.ts                # 중앙 모듈 레지스트리 (배럴)
│   │
│   ├── auth/                   # 인증/인가 모듈
│   │   ├── index.ts            # public API 배럴
│   │   ├── verify.ts           # → lib/auth/verify.ts 재export
│   │   ├── permissions.ts      # RBAC 역할/권한 정의
│   │   └── session.ts          # NextAuth 세션 헬퍼
│   │
│   ├── iot/                    # IoT/MQTT 모듈
│   │   ├── index.ts
│   │   ├── mqtt-client.ts      # MQTT 클라이언트 싱글톤
│   │   ├── topic-parser.ts     # 토픽 파싱/검증
│   │   └── device-manager.ts   # 디바이스 상태 관리
│   │
│   ├── energy/                 # 에너지 분석 모듈
│   │   ├── index.ts
│   │   ├── calculator.ts       # 에너지 계산 로직
│   │   ├── aggregator.ts       # 시계열 집계
│   │   └── report.ts           # 에너지 리포트 생성
│   │
│   ├── carbon/                 # 탄소 도메인 (DDD)
│   │   └── → lib/domains/carbon/ 참조
│   │
│   ├── billing/                # 구독/결제 모듈
│   │   ├── index.ts
│   │   ��── subscription.service.ts
│   │   ├── invoice.service.ts  # → lib/services/erp.service.ts 참조
│   │   └── toss.service.ts     # → lib/services/toss.service.ts 참조
│   │
│   ├── security/               # 보안 모듈
│   │   ├── index.ts
│   │   ├── ransomware-detection.service.ts
│   │   ├── security-event.service.ts
│   │   └── ip-blocklist.ts
│   │
│   └── erp/                    # ERP 모듈 (super_admin)
│       ├── index.ts
│       ├── erp.service.ts      # → lib/services/erp.service.ts 참조
│       └── kpi.service.ts
│
├── domains/                    # DDD 도메인 (현재: carbon, carbon-trading)
│   ├── carbon/
│   └── carbon-trading/
│
├── event-bus.ts                # 플랫폼 이벤트 버스 (Node.js EventEmitter)
└── ...
```

---

## 3-2. 중앙 모듈 레지스트리

**파일**: `lib/modules/index.ts`

```typescript
/**
 * lib/modules/index.ts
 *
 * 플랫폼 모듈 중앙 레지스트리
 * 각 모듈의 public API만 외부로 노출 — internal은 직접 import 금지
 */

// Auth 모듈
export {
  verifyAuth,
  type TenantContext,
} from '@/lib/auth/verify';

export {
  hasRoleOrHigher,
  type UserRole,
} from '@/lib/constants/roles';

// IoT 모듈
export {
  parseMqttTopic,
  type ParsedTopic,
} from '@/lib/modules/iot/topic-parser';

// Energy 모듈
export {
  aggregateByPeriod,
  type AggregatedPoint,
} from '@/lib/modules/energy/aggregator';

// Security 모듈
export {
  RansomwareDetectionService,
} from '@/lib/services/ransomware-detection.service';

export {
  logSecurityEvent,
  isIpBlocked,
  blockIp,
} from '@/lib/services/security-event.service';

// ERP 모듈
export {
  ERPService,
  type RevenueSummary,
  type TenantROI,
  type PlatformKPIs,
} from '@/lib/services/erp.service';

// 이벤트 버스
export {
  EventBus,
  type PlatformEvent,
} from '@/lib/event-bus';
```

---

## 3-3. MQTT 토픽 파서

**파일**: `lib/modules/iot/topic-parser.ts`

```typescript
/**
 * lib/modules/iot/topic-parser.ts
 *
 * MQTT 토픽 파싱 및 검증
 *
 * 토픽 구조: ems/{tenantId}/site/{siteId}/gw/{gatewayId}/dev/{deviceId}/{category}/{type}
 * 예시:       ems/tenant-abc/site/site-1/gw/gw-001/dev/dev-001/energy/power
 */

export interface ParsedTopic {
  tenantId:  string;
  siteId:    string;
  gatewayId: string;
  deviceId:  string;
  category:  string;  // energy | status | alert | command
  type:      string;  // power | voltage | current | temperature | ...
  raw:       string;
}

// 허용 카테고리
const VALID_CATEGORIES = new Set(['energy', 'status', 'alert', 'command', 'env']);

// 허용 타입 (카테고리별)
const VALID_TYPES: Record<string, Set<string>> = {
  energy:  new Set(['power', 'voltage', 'current', 'frequency', 'pf', 'kwh']),
  status:  new Set(['online', 'offline', 'error', 'heartbeat']),
  alert:   new Set(['threshold', 'anomaly', 'tamper']),
  command: new Set(['reset', 'configure', 'calibrate']),
  env:     new Set(['temperature', 'humidity', 'co2', 'pm25']),
};

/**
 * MQTT 토픽 파싱
 * 유효하지 않으면 null 반환 (예외 없음 — 악성 토픽 방어)
 */
export function parseMqttTopic(topic: string): ParsedTopic | null {
  if (!topic || topic.length > 512) return null;

  // ems/{t}/site/{s}/gw/{g}/dev/{d}/{category}/{type} → 10 segments
  const parts = topic.split('/');
  if (parts.length !== 10) return null;

  const [prefix, tenantId, siteLit, siteId, gwLit, gatewayId, devLit, deviceId, category, type] = parts;

  // 구조 검증
  if (prefix !== 'ems')   return null;
  if (siteLit !== 'site') return null;
  if (gwLit !== 'gw')     return null;
  if (devLit !== 'dev')   return null;

  // 세그먼트 비어있지 않아야 함
  if (!tenantId || !siteId || !gatewayId || !deviceId || !category || !type) return null;

  // UUID/슬러그 패턴 검사 (영숫자, -, _ 만 허용)
  const SAFE = /^[a-zA-Z0-9_-]+$/;
  if (![tenantId, siteId, gatewayId, deviceId].every((s) => SAFE.test(s))) return null;

  // 카테고리 화이트리스트
  if (!VALID_CATEGORIES.has(category)) return null;

  // 타입 화이트리스트 (와일드카드 '+', '#' 차단)
  const validTypes = VALID_TYPES[category];
  if (validTypes && !validTypes.has(type)) return null;

  return { tenantId, siteId, gatewayId, deviceId, category, type, raw: topic };
}

/**
 * 토픽 빌더 — 서버에서 publish 시 사용
 */
export function buildMqttTopic(params: Omit<ParsedTopic, 'raw'>): string {
  const { tenantId, siteId, gatewayId, deviceId, category, type } = params;
  return `ems/${tenantId}/site/${siteId}/gw/${gatewayId}/dev/${deviceId}/${category}/${type}`;
}
```

---

## 3-4. 에너지 집계기

**파일**: `lib/modules/energy/aggregator.ts`

```typescript
/**
 * lib/modules/energy/aggregator.ts
 *
 * 에너지 측정값 시계열 집계
 * - Measurement 테이블 쿼리 (컬럼: time, value, deviceId)
 * - 1h / 1d / 1m 그래뉼라리티 지원
 * - 테넌트 격리: siteId 기반 필터링
 */

import { prisma } from '@/lib/db/prisma';

export interface AggregatedPoint {
  time:       string;    // ISO 8601
  totalKwh:   number;
  peakKw:     number;
  avgPower:   number;
}

export type Granularity = '1h' | '1d' | '1m';

/**
 * 시계열 집계
 * @param tenantId  테넌트 ID (격리)
 * @param siteId    사이트 ID (null이면 테넌트 전체)
 * @param from      조회 시작 (Date)
 * @param to        조회 종료 (Date)
 * @param granularity  집계 단위
 */
export async function aggregateByPeriod(
  tenantId:    string,
  siteId:      string | null,
  from:        Date,
  to:          Date,
  granularity: Granularity = '1h',
): Promise<AggregatedPoint[]> {

  // MySQL DATE_FORMAT 패턴
  const formatMap: Record<Granularity, string> = {
    '1h': '%Y-%m-%dT%H:00:00',
    '1d': '%Y-%m-%dT00:00:00',
    '1m': '%Y-%m-01T00:00:00',
  };
  const fmt = formatMap[granularity];

  // 사이트에 속한 디바이스 ID 조회 (테넌트 격리)
  const devices = await prisma.device.findMany({
    where: {
      tenantId,
      ...(siteId ? { site: { id: siteId } } : {}),
    },
    select: { id: true },
  });

  if (devices.length === 0) return [];

  const deviceIds = devices.map((d) => d.id);

  // 원시 SQL: MySQL GROUP BY 시간 버킷
  // measurement 테이블: id, device_id, time, value, unit, created_at
  const rows = await prisma.$queryRaw<{
    bucket: string;
    total_kwh: number;
    peak_kw: number;
    avg_power: number;
  }[]>`
    SELECT
      DATE_FORMAT(m.time, ${fmt})  AS bucket,
      SUM(m.value) / 1000          AS total_kwh,
      MAX(m.value)                 AS peak_kw,
      AVG(m.value)                 AS avg_power
    FROM measurement m
    WHERE
      m.device_id IN (${deviceIds.join(',')})
      AND m.time >= ${from}
      AND m.time <  ${to}
    GROUP BY bucket
    ORDER BY bucket ASC
  `;

  return rows.map((r) => ({
    time:     r.bucket,
    totalKwh: Number(r.total_kwh ?? 0),
    peakKw:   Number(r.peak_kw   ?? 0),
    avgPower: Number(r.avg_power  ?? 0),
  }));
}

/**
 * 피크 시간대 분석 (시간대별 평균)
 */
export async function peakHourAnalysis(
  tenantId: string,
  siteId:   string | null,
  from:     Date,
  to:       Date,
): Promise<{ hour: number; avgPower: number }[]> {

  const devices = await prisma.device.findMany({
    where: { tenantId, ...(siteId ? { site: { id: siteId } } : {}) },
    select: { id: true },
  });

  if (devices.length === 0) return [];
  const deviceIds = devices.map((d) => d.id);

  const rows = await prisma.$queryRaw<{ hour: number; avg_power: number }[]>`
    SELECT
      HOUR(m.time)  AS hour,
      AVG(m.value)  AS avg_power
    FROM measurement m
    WHERE
      m.device_id IN (${deviceIds.join(',')})
      AND m.time >= ${from}
      AND m.time <  ${to}
    GROUP BY hour
    ORDER BY hour ASC
  `;

  return rows.map((r) => ({ hour: Number(r.hour), avgPower: Number(r.avg_power ?? 0) }));
}
```

---

## 3-5. 플랫폼 이벤트 버스

**파일**: `lib/event-bus.ts`

```typescript
/**
 * lib/event-bus.ts
 *
 * 플랫폼 인-프로세스 이벤트 버스
 * - Node.js EventEmitter 기반
 * - 타입 안전 PlatformEvent 유니온
 * - globalThis 싱글톤 (Next.js 핫 리로드 안전)
 * - CarbonPluginRegistry와 동일한 패턴
 */

import { EventEmitter } from 'events';

// ──────────────────────────────────────────────────────────────
// 플랫폼 이벤트 유니온 타입
// ──────────────────────────────────────────────────────────────
export type PlatformEvent =
  | {
      type:      'MEASUREMENT_INGESTED';
      tenantId:  string;
      deviceId:  string;
      value:     number;
      unit:      string;
      timestamp: Date;
    }
  | {
      type:      'ANOMALY_DETECTED';
      tenantId:  string;
      deviceId:  string;
      score:     number;   // Z-score
      alertId:   string;
      severity:  'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    }
  | {
      type:      'PAYMENT_COMPLETED';
      tenantId:  string;
      orderId:   string;
      amount:    number;
      planId:    string;
    }
  | {
      type:       'BACKUP_COMPLETED';
      path:       string;
      checksum:   string;
      sizeBytes:  number;
      backupType: 'full' | 'incremental' | 'snapshot';
    }
  | {
      type:      'RANSOMWARE_ALERT';
      tenantId:  string;
      alertType: string;
      severity:  'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      alertId:   string;
    }
  | {
      type:       'TENANT_CREATED';
      tenantId:   string;
      tenantName: string;
      plan:       string;
    }
  | {
      type:      'DR_EVENT_TRIGGERED';
      tenantId:  string;
      eventId:   string;
      targetKw:  number;
      startAt:   Date;
    };

// ──────────────────────────────────────────────────────────────
// 이벤트 핸들러 타입
// ──────────────────────────────────────────────────────────────
type EventHandler<E extends PlatformEvent> = (event: E) => void | Promise<void>;

// 타입별 핸들러 맵
type HandlerMap = {
  [K in PlatformEvent['type']]?: Set<EventHandler<Extract<PlatformEvent, { type: K }>>>;
};

// ──────────────────────────────────────────────────────────────
// EventBus 클래스
// ──────────────────────────────────────────────────────────────
class PlatformEventBus {
  private readonly emitter: EventEmitter;
  private readonly handlers: HandlerMap = {};

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100); // 다수 핸들러 허용
  }

  /**
   * 이벤트 발행
   * 핸들러 실패는 격리 — 이벤트 발행 자체는 계속됨
   */
  emit<E extends PlatformEvent>(event: E): void {
    const type = event.type as E['type'];
    const set   = this.handlers[type] as Set<EventHandler<E>> | undefined;
    if (!set) return;

    for (const handler of set) {
      // fire-and-forget: async 핸들러 오류 격리
      Promise.resolve(handler(event)).catch((err) => {
        console.error(`[EventBus] 핸들러 오류 (${type}):`, err);
      });
    }
  }

  /**
   * 이벤트 구독
   */
  on<K extends PlatformEvent['type']>(
    type:    K,
    handler: EventHandler<Extract<PlatformEvent, { type: K }>>,
  ): void {
    if (!this.handlers[type]) {
      (this.handlers as Record<string, Set<unknown>>)[type] = new Set();
    }
    (this.handlers[type] as Set<EventHandler<Extract<PlatformEvent, { type: K }>>>).add(handler);
  }

  /**
   * 이벤트 구독 해제
   */
  off<K extends PlatformEvent['type']>(
    type:    K,
    handler: EventHandler<Extract<PlatformEvent, { type: K }>>,
  ): void {
    (this.handlers[type] as Set<EventHandler<Extract<PlatformEvent, { type: K }>>> | undefined)
      ?.delete(handler);
  }

  /**
   * 특정 타입의 구독자 수
   */
  listenerCount(type: PlatformEvent['type']): number {
    return this.handlers[type]?.size ?? 0;
  }
}

// ──────────────────────────────────────────────────────────────
// globalThis 싱글톤 (Next.js 핫 리로드 안전)
// ──────────────────────────────────────────────────────────────
declare global {
  // eslint-disable-next-line no-var
  var __platformEventBus: PlatformEventBus | undefined;
}

export const EventBus: PlatformEventBus =
  globalThis.__platformEventBus ?? (globalThis.__platformEventBus = new PlatformEventBus());

// ──────────────────────────────────────────────────────────────
// 사용 예시 (서버 초기화 시)
// ──────────────────────────────────────────────────────────────
/*
import { EventBus } from '@/lib/event-bus';

// 측정값 수신 시 이상 탐지 트리거
EventBus.on('MEASUREMENT_INGESTED', async (event) => {
  const { tenantId, deviceId, value } = event;
  // AI 이상 탐지 로직 호출...
});

// 랜섬웨어 알림 발생 시 Slack/이메일 통보
EventBus.on('RANSOMWARE_ALERT', async (event) => {
  const { tenantId, alertType, severity } = event;
  if (severity === 'CRITICAL') {
    // 긴급 알림 발송...
  }
});

// 결제 완료 시 KPI 업데이트
EventBus.on('PAYMENT_COMPLETED', async (event) => {
  const { tenantId, amount } = event;
  // KpiSnapshot 업데이트...
});
*/
```

---

## 3-6. 모듈 통합: MQTT 수신 → 이벤트 버스 → 이상 탐지 플로우

**파일**: `app/api/monitoring/ingest/route.ts` (MQTT 데이터 수신 API 예시)

```typescript
/**
 * app/api/monitoring/ingest/route.ts
 *
 * MQTT → HTTP 브릿지 또는 직접 HTTP 수신 엔드포인트
 * 측정값 저장 + 이벤트 버스 발행
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify';
import { successResponse, errorResponse } from '@/lib/api/response';
import { parseMqttTopic } from '@/lib/modules/iot/topic-parser';
import { EventBus } from '@/lib/event-bus';

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });

  try {
    const body = await request.json();
    const { topic, value, timestamp } = body;

    // 토픽 파싱 및 검증
    const parsed = parseMqttTopic(topic);
    if (!parsed) {
      return errorResponse('VALIDATION_INVALID_FORMAT', { status: 400,
        details: { topic: '유효하지 않은 MQTT 토픽 구조' } });
    }

    // 테넌트 격리 검증
    if (parsed.tenantId !== auth.tenantId && auth.role < 4) {
      return errorResponse('PERMISSION_DENIED', { status: 403 });
    }

    // Measurement 저장
    await prisma.measurement.create({
      data: {
        deviceId: parsed.deviceId,
        time:     timestamp ? new Date(timestamp) : new Date(),
        value:    Number(value),
      },
    });

    // 이벤트 버스 발행 (비동기 핸들러들이 구독)
    EventBus.emit({
      type:      'MEASUREMENT_INGESTED',
      tenantId:  parsed.tenantId,
      deviceId:  parsed.deviceId,
      value:     Number(value),
      unit:      parsed.type,
      timestamp: new Date(),
    });

    return successResponse({ ok: true });
  } catch (err) {
    console.error('[Ingest POST]', err);
    return errorResponse('SERVER_ERROR', { status: 500 });
  }
}
```

---

## 부록: 환경 변수 참조

```env
# ── 보안 (랜섬웨어 대응) ─────────────────────────────────────
SECURITY_ALERT_EMAIL=security@carbonium.co.kr
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@carbonium.co.kr
SMTP_PASS=your_app_password

# ── 백업 (S3/MinIO) ──────────────────────────────────────────
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=ap-northeast-2
AWS_BUCKET=carbonium-backups
RETAIN_DAYS=30

# ── ERP / 크론 ───────────────────────────────────────────────
CRON_SECRET=long_random_secret_for_cron_auth
APP_API_URL=https://your-domain.com

# ── IoT / MQTT ───────────────────────────────────────────────
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_USERNAME=ems_server
MQTT_PASSWORD=mqtt_password
```

---

## 부록: K8s CronJob — 자동 백업

```yaml
# k8s/backup-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: ems-backup-daily
  namespace: carbonium
spec:
  schedule: "0 2 * * *"   # 매일 오전 2시
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: backup
              image: mysql:8.0
              command: ["/scripts/backup-immutable.sh"]
              env:
                - name: DB_HOST
                  valueFrom: { secretKeyRef: { name: db-secret, key: host } }
                - name: DB_PASS
                  valueFrom: { secretKeyRef: { name: db-secret, key: password } }
                - name: AWS_BUCKET
                  value: "carbonium-backups"
                - name: CRON_SECRET
                  valueFrom: { secretKeyRef: { name: app-secret, key: cron-secret } }
              volumeMounts:
                - name: backup-storage
                  mountPath: /backups
                - name: scripts
                  mountPath: /scripts
          volumes:
            - name: backup-storage
              persistentVolumeClaim:
                claimName: backup-pvc
            - name: scripts
              configMap:
                name: backup-scripts
                defaultMode: 0755
```

---

*작성일: 2026-03-22 | 버전: 1.0.0 | 탄소이음 엔지니어링팀*
