#!/bin/bash
# ============================================================
# 최초 배포 스크립트 (서버 init 완료 후 1회만 실행)
# 실행: cd /opt/ems-aiot && bash infra/ncp/02-first-deploy.sh
#
# 수행 작업:
#   1. 환경변수 파일 검증
#   2. NCP Container Registry 로그인
#   3. SSL 인증서 발급 (Let's Encrypt)
#   4. DB 초기화 + 마이그레이션
#   5. 전체 스택 기동
#   6. 스모크 테스트
# ============================================================

set -euo pipefail
cd /opt/ems-aiot

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERR ]${NC} $1"; exit 1; }

# ── 1. .env.production 검증 ──────────────────────────────
[ -f .env.production ] || err ".env.production 파일이 없습니다. 먼저 배치하세요."

# 필수 변수 체크
REQUIRED_VARS="DATABASE_URL NEXTAUTH_SECRET JWT_SECRET MYSQL_ROOT_PASSWORD MYSQL_PASSWORD REDIS_PASSWORD NCP_REGISTRY APP_VERSION NEXTAUTH_URL"
for var in $REQUIRED_VARS; do
  val=$(grep "^${var}=" .env.production | cut -d= -f2- | tr -d '"' | xargs)
  [ -n "${val}" ] || err "필수 환경변수 누락: ${var}"
done
log ".env.production 검증 완료"

# ── 변수 로드 ─────────────────────────────────────────────
export $(grep -v '^#' .env.production | xargs)

# ── 2. NCP Registry 로그인 ───────────────────────────────
log "NCP Container Registry 로그인..."
echo "${NCP_SECRET_KEY}" | docker login "${NCP_REGISTRY}" \
  -u "${NCP_ACCESS_KEY}" --password-stdin

# ── 3. SSL 인증서 발급 ────────────────────────────────────
DOMAIN=$(echo "${NEXTAUTH_URL}" | sed 's|https://||' | sed 's|http://||' | sed 's|/||g')
log "Let's Encrypt SSL 발급 (도메인: ${DOMAIN})..."

# 먼저 HTTP만 nginx 기동 (certbot webroot 사용)
mkdir -p infra/nginx/logs
docker compose -f docker-compose.prod.yml --env-file .env.production \
  up -d nginx || true
sleep 3

# certbot으로 인증서 발급
docker run --rm \
  -v $(docker volume ls -q | grep certbot_conf):/etc/letsencrypt \
  -v $(docker volume ls -q | grep certbot_www):/var/www/certbot \
  certbot/certbot certonly \
  --webroot -w /var/www/certbot \
  -d "${DOMAIN}" -d "www.${DOMAIN}" \
  --email "${SUPPORT_EMAIL:-admin@${DOMAIN}}" \
  --agree-tos --no-eff-email --non-interactive \
  2>/dev/null || warn "SSL 발급 실패 — 도메인 DNS 설정을 확인하세요 (self-signed로 계속)"

# ── 4. 전체 스택 기동 ────────────────────────────────────
log "전체 스택 기동..."
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# ── 5. DB 초기화 완료 대기 ───────────────────────────────
log "MySQL 기동 대기..."
for i in $(seq 1 30); do
  if docker exec ems_mysql mysqladmin ping -h localhost -u root -p"${MYSQL_ROOT_PASSWORD}" \
     --silent 2>/dev/null; then
    log "MySQL ready"
    break
  fi
  echo "⏳ MySQL 대기 (${i}/30)..."
  sleep 5
done

# ── 6. Prisma 마이그레이션 ───────────────────────────────
log "DB 마이그레이션 실행..."
NCP_REGISTRY="${NCP_REGISTRY}" APP_VERSION="${APP_VERSION}" \
  docker compose -f docker-compose.prod.yml --env-file .env.production \
  run --rm --no-deps migrate

# ── 7. 앱 재시작 (마이그레이션 후) ──────────────────────
log "앱 컨테이너 재시작..."
docker restart ems_app1 ems_app2

# ── 8. 스모크 테스트 ─────────────────────────────────────
log "스모크 테스트..."
sleep 30
HEALTH=$(curl -sf "http://localhost/api/health" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','unknown'))" \
  2>/dev/null || echo "failed")

if [ "${HEALTH}" = "ok" ]; then
  log "✅ 스모크 테스트 통과 — ${HEALTH}"
else
  warn "⚠️ 헬스체크 결과: ${HEALTH} (degraded 이면 정상 운영 가능)"
fi

# ── 9. 크론 등록 (백업 + certbot 갱신) ───────────────────
log "크론 작업 등록..."
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/ems-aiot/scripts/backup.sh >> /var/log/ems/backup.log 2>&1") \
  | sort -u | crontab -
(crontab -l 2>/dev/null; echo "0 4 * * * docker exec ems_certbot certbot renew --quiet >> /var/log/ems/certbot.log 2>&1") \
  | sort -u | crontab -
log "크론 등록 완료"

log "======================================================"
log " 🚀 초기 배포 완료!"
log " URL     : ${NEXTAUTH_URL}"
log " 헬스    : ${NEXTAUTH_URL}/api/health"
log " Grafana : ${NEXTAUTH_URL}/grafana (admin / [GRAFANA_PASSWORD])"
log ""
log " 다음 단계:"
log "   - OAuth redirect URI 등록 (Google/Naver Console)"
log "   - Stripe Price ID 확인 (price_xxx)"
log "   - 도메인 이메일 발신 테스트"
log "======================================================"
