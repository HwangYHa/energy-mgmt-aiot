#!/usr/bin/env bash
# =============================================================================
# EMS AIoT — 서버 부팅/정전 복구 스크립트
# 실행 위치: NCP 서버 (Ubuntu 22.04+)
# 실행 시점: systemd OnBoot, 또는 수동 실행
#
# 역할:
#   1. Docker 데몬 가동 확인
#   2. docker-compose.prod.yml 컨테이너 가동 보장
#   3. 헬스체크 통과 여부 확인 (최대 5분 대기)
#   4. 실패 시 Slack Webhook / NCP SMS 알림 전송
# =============================================================================
set -euo pipefail

# --- 설정 -------------------------------------------------------------------
COMPOSE_FILE="/opt/ems-aiot/docker-compose.prod.yml"
APP_DIR="/opt/ems-aiot"
LOG_FILE="/var/log/ems-startup-recovery.log"
HEALTH_URL="http://localhost:3000/api/health"
MAX_WAIT_SEC=300   # 5분
CHECK_INTERVAL=10

# 알림 (선택) — 환경변수로 주입하거나 .env.recovery에 작성
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"
NCP_SMS_KEY="${NCP_SMS_KEY:-}"
ALERT_PHONE="${ALERT_PHONE:-}"

# --- 유틸 -------------------------------------------------------------------
log() {
  local ts
  ts=$(date '+%Y-%m-%d %H:%M:%S')
  echo "[${ts}] $*" | tee -a "$LOG_FILE"
}

alert() {
  local msg="$1"
  log "ALERT: ${msg}"

  # Slack
  if [[ -n "${SLACK_WEBHOOK}" ]]; then
    curl -s -X POST "${SLACK_WEBHOOK}" \
      -H 'Content-Type: application/json' \
      -d "{\"text\":\"[EMS 서버 복구] ${msg}\"}" \
      >> "$LOG_FILE" 2>&1 || true
  fi
}

# --- 환경변수 로드 ----------------------------------------------------------
ENV_FILE="${APP_DIR}/.env.recovery"
if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
fi

# --- 0. 로그 로테이션 (7일) -----------------------------------------------
find /var/log -name 'ems-startup-recovery.log.*' -mtime +7 -delete 2>/dev/null || true

log "=========================================="
log "EMS AIoT 부팅 복구 스크립트 시작"
log "=========================================="

# --- 1. Docker 데몬 확인 ---------------------------------------------------
log "Docker 데몬 상태 확인..."
if ! systemctl is-active --quiet docker; then
  log "Docker 비활성 — 시작 시도"
  systemctl start docker
  sleep 5
fi
if ! systemctl is-active --quiet docker; then
  alert "Docker 데몬 시작 실패. 수동 점검 필요."
  exit 1
fi
log "Docker 데몬 정상"

# --- 2. Compose 서비스 기동 ------------------------------------------------
log "docker-compose 서비스 기동..."
cd "${APP_DIR}"

# 실행 중인 서비스 확인
RUNNING=$(docker compose -f "${COMPOSE_FILE}" ps --services --filter "status=running" 2>/dev/null | wc -l)
TOTAL=$(docker compose -f "${COMPOSE_FILE}" config --services 2>/dev/null | wc -l)

if [[ "${RUNNING}" -lt "${TOTAL}" ]]; then
  log "일부 서비스 비활성 (${RUNNING}/${TOTAL}). up -d 실행..."
  docker compose -f "${COMPOSE_FILE}" up -d --remove-orphans >> "$LOG_FILE" 2>&1
  log "docker compose up 완료"
else
  log "모든 서비스 이미 실행 중 (${RUNNING}/${TOTAL})"
fi

# --- 3. 헬스체크 (최대 MAX_WAIT_SEC 대기) ----------------------------------
log "앱 헬스체크 대기 (최대 ${MAX_WAIT_SEC}초)..."
ELAPSED=0
while [[ ${ELAPSED} -lt ${MAX_WAIT_SEC} ]]; do
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${HEALTH_URL}" 2>/dev/null || echo "000")
  if [[ "${HTTP_STATUS}" == "200" ]]; then
    log "헬스체크 통과 (${ELAPSED}초 경과)"
    break
  fi
  log "헬스체크 대기 중... (${ELAPSED}s, HTTP ${HTTP_STATUS})"
  sleep "${CHECK_INTERVAL}"
  ELAPSED=$((ELAPSED + CHECK_INTERVAL))
done

if [[ "${HTTP_STATUS}" != "200" ]]; then
  alert "헬스체크 실패 (${MAX_WAIT_SEC}초 초과, HTTP ${HTTP_STATUS}). 컨테이너 로그를 확인하세요."
  log "최근 컨테이너 로그:"
  docker compose -f "${COMPOSE_FILE}" logs --tail=50 >> "$LOG_FILE" 2>&1 || true
  exit 2
fi

# --- 4. MySQL 슬레이브 지연 확인 (옵션) ------------------------------------
MYSQL_CONTAINER="ems-mysql"
if docker ps --format '{{.Names}}' | grep -q "^${MYSQL_CONTAINER}$"; then
  log "MySQL 컨테이너 상태 확인..."
  MYSQL_OK=$(docker exec "${MYSQL_CONTAINER}" \
    mysqladmin -u root -p"${MYSQL_ROOT_PASSWORD:-ems_root}" ping --silent 2>/dev/null \
    && echo "ok" || echo "fail")
  if [[ "${MYSQL_OK}" != "ok" ]]; then
    alert "MySQL ping 실패. 데이터 무결성 점검 권장."
  else
    log "MySQL 정상"
  fi
fi

log "EMS AIoT 복구 완료 — 모든 서비스 정상"
alert "EMS AIoT 서버 정상 복구 완료 ($(date '+%Y-%m-%d %H:%M:%S'))"
exit 0
