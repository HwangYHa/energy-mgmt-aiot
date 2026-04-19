#!/bin/bash
# =============================================================================
# 탄소이음 EMS AIoT — 프로덕션 배포 스크립트
#
# 사용법:
#   ./scripts/deploy.sh [옵션]
#
#   --migrate-only   마이그레이션만 실행 (앱 재시작 없음)
#   --seed-only      시딩만 실행 (빌드/배포 없음)
#   --sql-only       seed-data.sql만 MySQL에 직접 주입 (빠른 참조 데이터 업데이트)
#   --force-reset    시딩 시 관리자 비밀번호 재설정 포함
#   --no-seed        배포 후 시딩 건너뜀
#   --version VER    배포할 이미지 버전 (기본: 최신 git short SHA)
#
# 사전 준비:
#   1. .env.production 파일 준비 (NCP_REGISTRY, MYSQL_PASSWORD 등)
#   2. NCP Container Registry 로그인: docker login ${NCP_REGISTRY}
#   3. /opt/ems-data/mysql, /opt/ems-data/redis 디렉터리 생성 (최초 1회)
#
# 예시:
#   ./scripts/deploy.sh                        # 전체 배포 + 시딩
#   ./scripts/deploy.sh --version abc1234      # 특정 버전 배포
#   ./scripts/deploy.sh --seed-only            # 시딩만 재실행
#   ./scripts/deploy.sh --sql-only             # 메뉴/플랜 데이터만 업데이트
#   ./scripts/deploy.sh --force-reset          # 배포 + 관리자 비밀번호 초기화
# =============================================================================

set -euo pipefail

# ── 색상 출력 ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; NC='\033[0m'; BOLD='\033[1m'

log()    { echo -e "${GREEN}[✓]${NC} $*"; }
warn()   { echo -e "${YELLOW}[!]${NC} $*"; }
error()  { echo -e "${RED}[✗]${NC} $*" >&2; }
header() { echo -e "\n${BOLD}${CYAN}══════════════════════════════════════${NC}"; echo -e "${BOLD}${CYAN}  $*${NC}"; echo -e "${BOLD}${CYAN}══════════════════════════════════════${NC}"; }

# ── 옵션 파싱 ─────────────────────────────────────────────────────────────────
MIGRATE_ONLY=false
SEED_ONLY=false
SQL_ONLY=false
NO_SEED=false
FORCE_RESET=false
VERSION=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --migrate-only)  MIGRATE_ONLY=true ;;
    --seed-only)     SEED_ONLY=true ;;
    --sql-only)      SQL_ONLY=true ;;
    --no-seed)       NO_SEED=true ;;
    --force-reset)   FORCE_RESET=true ;;
    --version)       VERSION="$2"; shift ;;
    *) error "알 수 없는 옵션: $1"; exit 1 ;;
  esac
  shift
done

# ── 환경 설정 ─────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

ENV_FILE=".env.production"
if [[ ! -f "$ENV_FILE" ]]; then
  error ".env.production 파일이 없습니다."
  echo "  참고: .env.production.example을 복사해서 작성하세요."
  exit 1
fi

# shellcheck source=/dev/null
set -a; source "$ENV_FILE"; set +a

NCP_REGISTRY="${NCP_REGISTRY:-carbonieum-ems-aiot.kr.ncr.ntruss.com}"
COMPOSE_FILE="docker-compose.prod.yml"

if [[ -z "$VERSION" ]]; then
  VERSION="$(git rev-parse --short HEAD 2>/dev/null || echo 'latest')"
fi
export APP_VERSION="$VERSION"

header "탄소이음 EMS AIoT 배포 시작"
echo "  버전     : ${CYAN}${VERSION}${NC}"
echo "  레지스트리: ${CYAN}${NCP_REGISTRY}${NC}"
echo "  DB       : ${CYAN}${MYSQL_DATABASE:-energy}${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# MODE: --sql-only — seed-data.sql을 MySQL 컨테이너에 직접 주입
# ═══════════════════════════════════════════════════════════════════════════════
if [[ "$SQL_ONLY" == true ]]; then
  header "참조 데이터 업데이트 (seed-data.sql)"
  if ! docker ps --format '{{.Names}}' | grep -q '^ems_mysql$'; then
    error "MySQL 컨테이너(ems_mysql)가 실행 중이지 않습니다."
    exit 1
  fi
  log "seed-data.sql → MySQL 주입 중..."
  docker exec -i ems_mysql mysql \
    -u "${MYSQL_USER:-ems}" \
    -p"${MYSQL_PASSWORD}" \
    "${MYSQL_DATABASE:-energy}" \
    < prisma/seed-data.sql
  log "참조 데이터 업데이트 완료 (메뉴, 플랜, 배출계수, 탄소가격)"
  exit 0
fi

# ═══════════════════════════════════════════════════════════════════════════════
# MODE: --seed-only — 시딩만 실행
# ═══════════════════════════════════════════════════════════════════════════════
if [[ "$SEED_ONLY" == true ]]; then
  header "DB 시딩"
  run_seeder
  exit 0
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 헬퍼 함수
# ═══════════════════════════════════════════════════════════════════════════════
run_seeder() {
  log "seeder 컨테이너 실행..."
  local seed_env=()
  seed_env+=(-e "DATABASE_URL=mysql://${MYSQL_USER:-ems}:${MYSQL_PASSWORD}@mysql:3306/${MYSQL_DATABASE:-energy}")
  seed_env+=(-e "SEED_ADMIN_EMAIL=${SEED_ADMIN_EMAIL:-admin@carbonieum.co.kr}")
  seed_env+=(-e "SEED_ADMIN_PASSWORD=${SEED_ADMIN_PASSWORD:-Carbonieum2026!}")
  if [[ "$FORCE_RESET" == true ]]; then
    seed_env+=(-e "SEED_FORCE_RESET=true")
    warn "SEED_FORCE_RESET=true — 관리자 비밀번호가 초기화됩니다"
  fi
  docker compose -f "$COMPOSE_FILE" run --rm "${seed_env[@]/#/-e}" seeder \
    || { error "시딩 실패"; exit 1; }
  log "시딩 완료"
}

# ═══════════════════════════════════════════════════════════════════════════════
# 1. 이미지 빌드 & 푸시
# ═══════════════════════════════════════════════════════════════════════════════
if [[ "$SEED_ONLY" != true && "$MIGRATE_ONLY" != true ]]; then
  header "1/5 이미지 빌드"

  log "앱 이미지 빌드: ${NCP_REGISTRY}/ems-app:${VERSION}"
  docker build \
    --target runner \
    --build-arg NEXT_PUBLIC_TOSS_CLIENT_KEY="${NEXT_PUBLIC_TOSS_CLIENT_KEY:-}" \
    --build-arg NEXT_PUBLIC_COMMIT_SHA="${VERSION}" \
    -t "${NCP_REGISTRY}/ems-app:${VERSION}" \
    -t "${NCP_REGISTRY}/ems-app:latest" \
    .

  log "시더 이미지 빌드: ${NCP_REGISTRY}/ems-seeder:${VERSION}"
  docker build \
    --target seeder \
    -t "${NCP_REGISTRY}/ems-seeder:${VERSION}" \
    -t "${NCP_REGISTRY}/ems-seeder:latest" \
    .

  header "2/5 이미지 푸시"
  docker push "${NCP_REGISTRY}/ems-app:${VERSION}"
  docker push "${NCP_REGISTRY}/ems-app:latest"
  docker push "${NCP_REGISTRY}/ems-seeder:${VERSION}"
  docker push "${NCP_REGISTRY}/ems-seeder:latest"
  log "이미지 푸시 완료"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 2. 서버 배포 (SSH) — SERVER_HOST 환경변수가 있으면 원격 실행
# ═══════════════════════════════════════════════════════════════════════════════
if [[ -n "${SERVER_HOST:-}" ]]; then
  header "3/5 서버 배포 (SSH: ${SERVER_HOST})"

  SSH_USER="${SERVER_USER:-root}"
  REMOTE_DIR="${SERVER_PROJECT_DIR:-/opt/ems}"

  log "서버에서 최신 compose 파일 동기화..."
  scp "$COMPOSE_FILE" "${SSH_USER}@${SERVER_HOST}:${REMOTE_DIR}/${COMPOSE_FILE}"
  scp "$ENV_FILE"     "${SSH_USER}@${SERVER_HOST}:${REMOTE_DIR}/.env.production" 2>/dev/null || true

  log "서버에서 이미지 pull + 재시작..."
  # shellcheck disable=SC2087
  ssh "${SSH_USER}@${SERVER_HOST}" bash <<REMOTE
set -e
cd "${REMOTE_DIR}"
export APP_VERSION="${VERSION}"
source .env.production

echo "  [1] 이미지 pull..."
docker compose -f ${COMPOSE_FILE} --env-file .env.production pull seeder app1 app2 migrate

echo "  [2] 마이그레이션..."
docker compose -f ${COMPOSE_FILE} --env-file .env.production run --rm migrate

echo "  [3] 앱 재시작 (rolling update)..."
docker compose -f ${COMPOSE_FILE} --env-file .env.production up -d --no-deps app1
sleep 10
docker compose -f ${COMPOSE_FILE} --env-file .env.production up -d --no-deps app2

echo "  [4] 시딩..."
SEED_FORCE_RESET=${FORCE_RESET} \
docker compose -f ${COMPOSE_FILE} --env-file .env.production run --rm seeder

echo "  [✓] 서버 배포 완료"
REMOTE

  log "원격 배포 완료"

else
  # ─── 로컬/단일 서버 모드 ───────────────────────────────────────────────────
  header "3/5 마이그레이션"
  log "prisma migrate deploy..."
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm migrate
  log "마이그레이션 완료"

  if [[ "$MIGRATE_ONLY" == false ]]; then
    header "4/5 앱 재시작"
    log "ems_app1 재시작..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-deps app1
    sleep 10
    log "ems_app2 재시작..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-deps app2
    log "앱 재시작 완료"
  fi

  if [[ "$NO_SEED" == false && "$MIGRATE_ONLY" == false ]]; then
    header "5/5 DB 시딩"
    SEED_FORCE_RESET_ENV=""
    [[ "$FORCE_RESET" == true ]] && SEED_FORCE_RESET_ENV="-e SEED_FORCE_RESET=true"
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" \
      run --rm $SEED_FORCE_RESET_ENV seeder
    log "시딩 완료"
  fi
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 완료 요약
# ═══════════════════════════════════════════════════════════════════════════════
header "배포 완료"
echo -e "  버전    : ${CYAN}${VERSION}${NC}"
echo -e "  URL     : ${CYAN}${NEXTAUTH_URL:-http://49.50.130.189}${NC}"
echo -e "  관리자  : ${CYAN}${SEED_ADMIN_EMAIL:-admin@carbonieum.co.kr}${NC}"
echo -e "  데모    : ${CYAN}demo@carbonieum.com${NC}"
echo ""
echo -e "  컨테이너 상태 확인:"
echo -e "    docker compose -f ${COMPOSE_FILE} ps"
echo ""
