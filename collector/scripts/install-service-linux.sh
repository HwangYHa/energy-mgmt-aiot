#!/usr/bin/env bash
# =============================================================================
# EMS AIoT 수집기 — Linux systemd 서비스 설치 스크립트
# 대상: Ubuntu 20.04+ / Debian 11+ / RHEL 8+ (Linux 게이트웨이 PC)
#
# 정전 대비 효과:
#   - 서버 재부팅 시 자동 시작 (WantedBy=multi-user.target)
#   - 비정상 종료 시 10초 후 자동 재시작 (Restart=on-failure)
#   - 네트워크 연결 후 시작 (After=network-online.target)
# =============================================================================
set -euo pipefail

# --- 설정 (환경에 맞게 수정) ---
SERVICE_NAME="ems-collector"
INSTALL_DIR="/opt/ems-collector"
VENV_PYTHON="${INSTALL_DIR}/venv/bin/python"
COLLECTOR_MAIN="${INSTALL_DIR}/src/main.py"
SERVICE_USER="ems"   # 비루트 실행 권장
LOG_DIR="/var/log/ems-collector"

# --- 권한 확인 ---
if [[ $EUID -ne 0 ]]; then
  echo "[오류] root 또는 sudo 로 실행해주세요."
  echo "  sudo bash install-service-linux.sh"
  exit 1
fi

# --- 서비스 계정 생성 ---
if ! id "${SERVICE_USER}" &>/dev/null; then
  echo "서비스 계정 생성: ${SERVICE_USER}"
  useradd --system --no-create-home --shell /usr/sbin/nologin "${SERVICE_USER}"
fi

# --- 로그 디렉토리 ---
mkdir -p "${LOG_DIR}"
chown "${SERVICE_USER}:${SERVICE_USER}" "${LOG_DIR}"

# --- 설치 디렉토리 소유권 ---
if [[ -d "${INSTALL_DIR}" ]]; then
  chown -R "${SERVICE_USER}:${SERVICE_USER}" "${INSTALL_DIR}"
fi

# --- systemd 유닛 파일 작성 ---
UNIT_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

cat > "${UNIT_FILE}" << UNIT
[Unit]
Description=EMS AIoT 수집기 (탄소이음)
Documentation=https://github.com/your-org/ems-aiot/tree/main/collector
# 네트워크 및 MQTT 브로커 연결 후 시작
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_USER}
WorkingDirectory=${INSTALL_DIR}

ExecStart=${VENV_PYTHON} ${COLLECTOR_MAIN}
ExecReload=/bin/kill -HUP \$MAINPID

# 정전/재부팅 복구 핵심 설정
Restart=on-failure
RestartSec=10
StartLimitIntervalSec=120
StartLimitBurst=5

# 환경 변수
Environment="PYTHONUNBUFFERED=1"
EnvironmentFile=-${INSTALL_DIR}/config/.env

# 로그 (journald 기록 + 파일 동시 출력)
StandardOutput=append:${LOG_DIR}/collector.log
StandardError=append:${LOG_DIR}/collector-error.log

# 리소스 제한
LimitNOFILE=65536
MemoryMax=512M
CPUQuota=80%

# 종료 대기
TimeoutStopSec=30
KillMode=mixed
KillSignal=SIGTERM

[Install]
WantedBy=multi-user.target
UNIT

echo "systemd 유닛 파일 작성 완료: ${UNIT_FILE}"

# --- systemd 리로드 및 활성화 ---
systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"
systemctl start "${SERVICE_NAME}"

# --- 상태 확인 ---
sleep 2
if systemctl is-active --quiet "${SERVICE_NAME}"; then
  echo ""
  echo "========================================"
  echo "설치 완료: EMS AIoT 수집기"
  echo "========================================"
  systemctl status "${SERVICE_NAME}" --no-pager
  echo ""
  echo "서비스 관리:"
  echo "  시작: systemctl start ${SERVICE_NAME}"
  echo "  중지: systemctl stop ${SERVICE_NAME}"
  echo "  재시작: systemctl restart ${SERVICE_NAME}"
  echo "  상태: systemctl status ${SERVICE_NAME}"
  echo "  로그: journalctl -u ${SERVICE_NAME} -f"
  echo "  로그파일: ${LOG_DIR}/"
  echo ""
  echo "[정전 대비] 재부팅 후 자동 시작이 활성화되었습니다."
else
  echo "[오류] 서비스 시작 실패. 로그를 확인하세요:"
  journalctl -u "${SERVICE_NAME}" --no-pager -n 30
  exit 1
fi
