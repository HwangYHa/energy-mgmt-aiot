#!/bin/bash
# ============================================================
# 수동 롤백 스크립트
# 사용: bash infra/ncp/03-rollback.sh [버전SHA]
#
# 인수 없이 실행 시: 이전 버전으로 자동 롤백
# 인수 있을 시: 지정 버전으로 롤백
# ============================================================

set -euo pipefail
cd /opt/ems-aiot

GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'
log() { echo -e "${GREEN}[INFO]${NC} $1"; }
err() { echo -e "${RED}[ERR ]${NC} $1"; exit 1; }

[ -f .env.production ] || err ".env.production 없음"
export $(grep -v '^#' .env.production | xargs)

TARGET_VERSION="${1:-}"
if [ -z "${TARGET_VERSION}" ]; then
  TARGET_VERSION=$(cat /opt/ems-aiot/.prev_version 2>/dev/null || echo "")
  [ -n "${TARGET_VERSION}" ] || err "이전 버전 정보 없음 (.prev_version 파일 없음)"
fi

log "롤백 대상 버전: ${TARGET_VERSION}"
log "현재 실행 버전: $(cat .current_version 2>/dev/null || echo 'unknown')"

read -p "롤백을 진행하시겠습니까? (yes/no): " CONFIRM
[ "${CONFIRM}" = "yes" ] || { log "취소됨"; exit 0; }

# 이미지 Pull
docker pull "${NCP_REGISTRY}/ems-app:${TARGET_VERSION}" || err "이미지 없음: ${TARGET_VERSION}"
docker pull "${NCP_REGISTRY}/ems-ai:${TARGET_VERSION}" || true

# Rolling rollback
NCP_REGISTRY="${NCP_REGISTRY}" APP_VERSION="${TARGET_VERSION}" \
  docker compose -f docker-compose.prod.yml --env-file .env.production \
  up -d --no-deps --pull never app1

sleep 10

NCP_REGISTRY="${NCP_REGISTRY}" APP_VERSION="${TARGET_VERSION}" \
  docker compose -f docker-compose.prod.yml --env-file .env.production \
  up -d --no-deps --pull never app2

NCP_REGISTRY="${NCP_REGISTRY}" APP_VERSION="${TARGET_VERSION}" \
  docker compose -f docker-compose.prod.yml --env-file .env.production \
  up -d --no-deps --pull never ai-engine

echo "${TARGET_VERSION}" > .current_version

# 헬스체크
sleep 20
HEALTH=$(curl -sf "http://localhost/api/health" \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))" \
  2>/dev/null || echo "failed")

log "헬스 상태: ${HEALTH}"
log "✅ 롤백 완료 — 버전: ${TARGET_VERSION}"
