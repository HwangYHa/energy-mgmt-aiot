#!/bin/bash
# ============================================================
# 탄소이음 EMS — MySQL 자동 백업 스크립트
# crontab: 0 2 * * * /opt/ems-aiot/scripts/backup.sh >> /var/log/ems-backup.log 2>&1
# ============================================================

set -euo pipefail

# ── 설정 ─────────────────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-/opt/backups/ems-mysql}"
RETAIN_DAYS="${RETAIN_DAYS:-30}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-energy}"
DB_USER="${DB_USER:-ems}"
DB_PASS="${DB_PASS:-emspassword}"
S3_BUCKET="${S3_BUCKET:-}"   # 설정 시 S3 업로드
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/ems_${TIMESTAMP}.sql.gz"

# ── 디렉토리 생성 ─────────────────────────────────────────
mkdir -p "${BACKUP_DIR}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 백업 시작: ${BACKUP_FILE}"

# ── mysqldump ─────────────────────────────────────────────
mysqldump \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --user="${DB_USER}" \
  --password="${DB_PASS}" \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  --set-gtid-purged=OFF \
  --default-character-set=utf8mb4 \
  "${DB_NAME}" \
  | gzip -9 > "${BACKUP_FILE}"

SIZE=$(du -sh "${BACKUP_FILE}" | cut -f1)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 완료: ${SIZE}"

# ── SHA-256 체크섬 생성 ───────────────────────────────────
sha256sum "${BACKUP_FILE}" > "${BACKUP_FILE}.sha256"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 체크섬 생성 완료"

# ── S3 업로드 (선택적) ────────────────────────────────────
if [ -n "${S3_BUCKET}" ]; then
  aws s3 cp "${BACKUP_FILE}" "s3://${S3_BUCKET}/mysql/$(basename ${BACKUP_FILE})" \
    --storage-class STANDARD_IA
  aws s3 cp "${BACKUP_FILE}.sha256" "s3://${S3_BUCKET}/mysql/$(basename ${BACKUP_FILE}).sha256"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] S3 업로드 완료: s3://${S3_BUCKET}/mysql/"
fi

# ── 오래된 백업 삭제 ─────────────────────────────────────
find "${BACKUP_DIR}" -name "ems_*.sql.gz*" -mtime "+${RETAIN_DAYS}" -delete
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ${RETAIN_DAYS}일 이전 백업 삭제 완료"

# ── 최신 symlink ─────────────────────────────────────────
ln -sf "${BACKUP_FILE}" "${BACKUP_DIR}/latest.sql.gz"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 백업 완료 ✅"
