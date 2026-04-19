#!/bin/bash
# =============================================================================
# 탄소이음 EMS AIoT — 서버 직접 시딩 스크립트
#
# 이 스크립트는 서버에서 직접 실행됩니다 (이미지 빌드 불필요).
# 실행 중인 MySQL 컨테이너에 데이터를 주입합니다.
#
# 사용법:
#   chmod +x scripts/seed-server.sh
#   ./scripts/seed-server.sh [옵션]
#
# 옵션:
#   --sql-only        seed-data.sql만 실행 (빠름, 메뉴/플랜/배출계수 업데이트)
#   --full            전체 seed.ts 실행 (관리자·데모 계정 포함)
#   --force-reset     관리자 비밀번호 재설정
#   --demo-only       데모 데이터만 재시딩
#
# 서버 실행 예시 (서버 SSH 접속 후):
#   cd /opt/ems
#   git pull
#   ./scripts/seed-server.sh --sql-only      # 메뉴/플랜 업데이트만
#   ./scripts/seed-server.sh --full          # 전체 시딩 (최초 설치 또는 초기화)
# =============================================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'; BOLD='\033[1m'
log()    { echo -e "${GREEN}[✓]${NC} $*"; }
warn()   { echo -e "${YELLOW}[!]${NC} $*"; }
error()  { echo -e "${RED}[✗]${NC} $*" >&2; }
header() { echo -e "\n${BOLD}${CYAN}── $* ──${NC}"; }

SQL_ONLY=false
FULL_SEED=false
FORCE_RESET=false
DEMO_ONLY=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --sql-only)    SQL_ONLY=true ;;
    --full)        FULL_SEED=true ;;
    --force-reset) FORCE_RESET=true ;;
    --demo-only)   DEMO_ONLY=true ;;
    *) error "알 수 없는 옵션: $1"; exit 1 ;;
  esac
  shift
done

# 기본값: 옵션 없으면 sql-only
if [[ "$FULL_SEED" == false && "$DEMO_ONLY" == false ]]; then
  SQL_ONLY=true
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# 환경변수 로드
ENV_FILE=".env.production"
[[ ! -f "$ENV_FILE" ]] && ENV_FILE=".env.local"
[[ ! -f "$ENV_FILE" ]] && { error ".env.production 또는 .env.local 파일이 없습니다"; exit 1; }
set -a; source "$ENV_FILE"; set +a

MYSQL_CONTAINER="${MYSQL_CONTAINER:-ems_mysql}"
DB_USER="${MYSQL_USER:-ems}"
DB_PASS="${MYSQL_PASSWORD}"
DB_NAME="${MYSQL_DATABASE:-energy}"

header "탄소이음 EMS — DB 시딩"
echo "  컨테이너: ${CYAN}${MYSQL_CONTAINER}${NC}"
echo "  DB      : ${CYAN}${DB_NAME}${NC}"

# MySQL 컨테이너 실행 확인
if ! docker ps --format '{{.Names}}' | grep -q "^${MYSQL_CONTAINER}$"; then
  error "MySQL 컨테이너(${MYSQL_CONTAINER})가 실행 중이지 않습니다."
  echo "  docker ps 로 컨테이너 이름을 확인하세요."
  exit 1
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1: seed-data.sql — 항상 실행 (참조 데이터)
# ═══════════════════════════════════════════════════════════════════════════════
header "seed-data.sql 실행 (메뉴·플랜·배출계수·탄소가격)"
log "seed-data.sql → ${MYSQL_CONTAINER} 주입..."
docker exec -i "${MYSQL_CONTAINER}" \
  mysql -u "${DB_USER}" -p"${DB_PASS}" "${DB_NAME}" \
  < prisma/seed-data.sql
log "seed-data.sql 완료"

if [[ "$SQL_ONLY" == true ]]; then
  echo ""
  log "참조 데이터 업데이트 완료"
  echo "  업데이트 항목: feature, plan, emission_factor, carbon_market_price, menu_group, menu_item"
  exit 0
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2: 전체 seed.ts — Node.js 임시 컨테이너 사용
# ═══════════════════════════════════════════════════════════════════════════════
header "seed.ts 실행 (관리자·데모 계정 + 데모 데이터)"

# Docker 네트워크 이름 자동 감지
NETWORK_NAME="$(docker inspect "${MYSQL_CONTAINER}" \
  --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}' 2>/dev/null \
  | head -1)"

if [[ -z "$NETWORK_NAME" ]]; then
  error "MySQL 컨테이너의 Docker 네트워크를 감지하지 못했습니다."
  echo "  수동 지정: NETWORK_NAME=ems_net ./scripts/seed-server.sh --full"
  exit 1
fi

log "Docker 네트워크: ${CYAN}${NETWORK_NAME}${NC}"

# seeder 이미지 사용 (빌드된 경우) 또는 NCP registry 이미지
NCP_REGISTRY="${NCP_REGISTRY:-carbonieum-ems-aiot.kr.ncr.ntruss.com}"
APP_VERSION="${APP_VERSION:-latest}"
SEEDER_IMAGE="${NCP_REGISTRY}/ems-seeder:${APP_VERSION}"

# seeder 이미지가 없으면 로컬 빌드 시도
if ! docker image inspect "${SEEDER_IMAGE}" &>/dev/null; then
  warn "seeder 이미지(${SEEDER_IMAGE})가 없습니다. 로컬 빌드 시도..."
  if [[ -f "Dockerfile" ]]; then
    docker build --target seeder -t "${SEEDER_IMAGE}" .
    log "seeder 이미지 빌드 완료"
  else
    error "Dockerfile이 없습니다. 프로젝트 루트에서 실행하세요."
    exit 1
  fi
fi

SEED_ENV_ARGS=(
  -e "DATABASE_URL=mysql://${DB_USER}:${DB_PASS}@${MYSQL_CONTAINER}:3306/${DB_NAME}"
  -e "SEED_ADMIN_EMAIL=${SEED_ADMIN_EMAIL:-admin@carbonieum.co.kr}"
  -e "SEED_ADMIN_PASSWORD=${SEED_ADMIN_PASSWORD:-Carbonieum2026!}"
)
[[ "$FORCE_RESET" == true ]] && {
  SEED_ENV_ARGS+=(-e "SEED_FORCE_RESET=true")
  warn "SEED_FORCE_RESET=true — 관리자 비밀번호 초기화"
}

log "seeder 컨테이너 실행: ${SEEDER_IMAGE}"
docker run --rm \
  --network "${NETWORK_NAME}" \
  "${SEED_ENV_ARGS[@]}" \
  "${SEEDER_IMAGE}"

log "전체 시딩 완료"
echo ""
echo -e "  관리자 : ${CYAN}${SEED_ADMIN_EMAIL:-admin@carbonieum.co.kr}${NC}"
echo -e "  데모   : ${CYAN}demo@carbonieum.com / Demo1234!${NC}"
echo -e "  추가   : ${CYAN}manager@carbonieum.com / Password1!${NC}"
echo ""
