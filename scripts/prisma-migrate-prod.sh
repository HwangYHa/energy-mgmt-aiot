#!/bin/bash
# ============================================================
# 프로덕션 Prisma 마이그레이션 전략
# ============================================================
# 1. 현재 DB 백업 (필수)
# 2. prisma migrate status 확인
# 3. prisma migrate deploy (배포용 — reset 없음)
# 4. 실패 시 롤백 안내
# ============================================================

set -euo pipefail

echo "=========================================="
echo " 탄소이음 EMS — 프로덕션 DB 마이그레이션"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="

# ── 0. 환경 확인 ─────────────────────────────────────────
if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ DATABASE_URL 환경변수가 설정되지 않았습니다"
  exit 1
fi

# ── 1. 현재 마이그레이션 상태 확인 ───────────────────────
echo ""
echo "📋 현재 마이그레이션 상태:"
npx prisma migrate status

# ── 2. 사용자 확인 ───────────────────────────────────────
read -p "계속 진행하시겠습니까? (yes/no) " -r REPLY
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
  echo "취소됨"
  exit 0
fi

# ── 3. 백업 실행 (선택적) ────────────────────────────────
if [ "${SKIP_BACKUP:-false}" != "true" ]; then
  echo ""
  echo "💾 마이그레이션 전 DB 백업 중..."
  bash "$(dirname "$0")/backup.sh"
fi

# ── 4. Prisma 마이그레이션 배포 ──────────────────────────
echo ""
echo "🚀 마이그레이션 실행:"
npx prisma migrate deploy

# ── 5. Prisma 클라이언트 재생성 ──────────────────────────
echo ""
echo "🔄 Prisma 클라이언트 재생성:"
npx prisma generate

echo ""
echo "✅ 마이그레이션 완료!"
echo "=========================================="

# ── 롤백 안내 ────────────────────────────────────────────
cat << 'EOF'

⚠️  롤백이 필요한 경우:
  1. 애플리케이션을 이전 버전으로 되돌림
  2. 백업에서 DB 복구:
     gunzip -c /opt/backups/ems-mysql/latest.sql.gz | \
       mysql -h $DB_HOST -u $DB_USER -p$DB_PASS $DB_NAME
  3. 마이그레이션 이력 수동 정리:
     DELETE FROM _prisma_migrations WHERE migration_name = 'failed_migration_name';

EOF
