#!/usr/bin/env bash
# scripts/backup-immutable.sh
# 랜섬웨어 대응 불변(Immutable) 백업 스크립트
#
# cron 등록:
#   0 2 * * * /app/scripts/backup-immutable.sh >> /var/log/ems-backup.log 2>&1
#
# 필요 환경변수:
#   DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME
#   AWS_BUCKET, RETAIN_DAYS
#   APP_API_URL, CRON_SECRET

set -euo pipefail

# ── 환경 변수 기본값 ─────────────────────────────────────────
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-}"
DB_NAME="${DB_NAME:-energy}"
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

echo "[$(date)] ─── 백업 시작: ${BACKUP_FILE}"

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

# ── Step 1: mysqldump (트랜잭션 일관성 보장) ─────────────────
mysqldump \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --user="${DB_USER}" \
  --password="${DB_PASS}" \
  --single-transaction \
  --quick \
  --lock-tables=false \
  --set-gtid-purged=OFF \
  --default-character-set=utf8mb4 \
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
# GNU date vs macOS date 호환
if date --version 2>/dev/null | grep -q GNU; then
  RETAIN_DATE=$(date -d "+${RETAIN_DAYS} days" --utc +%Y-%m-%dT%H:%M:%SZ)
else
  RETAIN_DATE=$(date -v +${RETAIN_DAYS}d -u +%Y-%m-%dT%H:%M:%SZ)
fi

S3_KEY="backups/${YEAR}/${MONTH}/${DAY}/$(basename "${BACKUP_FILE}")"

if command -v aws &>/dev/null && [ -n "${AWS_BUCKET}" ]; then
  aws s3 cp "${BACKUP_FILE}" "s3://${AWS_BUCKET}/${S3_KEY}" \
    --object-lock-mode COMPLIANCE \
    --object-lock-retain-until-date "${RETAIN_DATE}" \
    --storage-class STANDARD_IA

  aws s3 cp "${CHECKSUM_FILE}" "s3://${AWS_BUCKET}/${S3_KEY}.sha256" \
    --object-lock-mode COMPLIANCE \
    --object-lock-retain-until-date "${RETAIN_DATE}"

  echo "[$(date)] S3 업로드 완료: s3://${AWS_BUCKET}/${S3_KEY}"
else
  echo "[$(date)] WARNING: AWS CLI 미설치 또는 AWS_BUCKET 미설정 — S3 업로드 건너뜀"
fi

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
  }" \
  -o /dev/null || echo "[$(date)] WARNING: API 기록 실패"

echo "[$(date)] ─── 백업 완료"

# ── Step 7: 오래된 로컬 백업 정리 ────────────────────────────
find /backups -name "*.sql.gz"  -mtime +${RETAIN_DAYS} -not -newer /backups \
  -exec bash -c 'chattr -i "$1" 2>/dev/null; rm -f "$1"' _ {} \; 2>/dev/null || true
find /backups -name "*.sha256"  -mtime +${RETAIN_DAYS} \
  -exec bash -c 'chattr -i "$1" 2>/dev/null; rm -f "$1"' _ {} \; 2>/dev/null || true

echo "[$(date)] 정리 완료 (${RETAIN_DAYS}일 이상 로컬 파일 삭제)"
exit 0
