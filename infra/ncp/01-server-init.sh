#!/bin/bash
# ============================================================
# NCP Ubuntu 22.04 서버 최초 초기화 스크립트
# 실행: sudo bash 01-server-init.sh
#
# 수행 작업:
#   1. 시스템 업데이트
#   2. Docker + Docker Compose V2 설치
#   3. 배포 전용 사용자 생성 (ems-deploy)
#   4. 디렉토리 구조 생성
#   5. 방화벽 (ufw) 설정
#   6. fail2ban 설치
#   7. 스왑 파일 생성 (4GB)
#   8. 시스템 튜닝
# ============================================================

set -euo pipefail

# ── 색상 출력 ─────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERR ]${NC} $1"; exit 1; }

[ "$(id -u)" -eq 0 ] || err "root 권한으로 실행하세요: sudo bash $0"

# ── 1. 시스템 업데이트 ────────────────────────────────────
log "시스템 업데이트..."
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq
apt-get install -y -qq \
  curl wget git unzip vim htop \
  net-tools ufw fail2ban \
  ca-certificates gnupg lsb-release \
  jq python3 python3-pip \
  logrotate cron

# ── 2. Docker 설치 ────────────────────────────────────────
log "Docker 설치..."
if ! command -v docker &>/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq \
    docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin
fi

systemctl enable docker
systemctl start docker
log "Docker 버전: $(docker --version)"
log "Docker Compose 버전: $(docker compose version)"

# ── 3. 배포 사용자 생성 ───────────────────────────────────
log "배포 사용자(ems-deploy) 생성..."
if ! id ems-deploy &>/dev/null; then
  useradd -m -s /bin/bash ems-deploy
  usermod -aG docker ems-deploy
  mkdir -p /home/ems-deploy/.ssh
  chmod 700 /home/ems-deploy/.ssh
  # GitHub Actions에서 등록한 공개키 — 배포 후 수동으로 추가
  # echo "ssh-ed25519 AAAA... your-key" >> /home/ems-deploy/.ssh/authorized_keys
  chown -R ems-deploy:ems-deploy /home/ems-deploy/.ssh
fi

# ── 4. 디렉토리 구조 ──────────────────────────────────────
log "배포 디렉토리 생성..."
mkdir -p /opt/ems-aiot
mkdir -p /opt/ems-data/mysql
mkdir -p /opt/ems-data/redis
mkdir -p /opt/backups/ems-mysql
mkdir -p /var/log/ems

chown -R ems-deploy:ems-deploy /opt/ems-aiot
chown -R 999:999 /opt/ems-data/mysql      # mysql container uid
chown -R ems-deploy:ems-deploy /opt/ems-data/redis
chown -R ems-deploy:ems-deploy /opt/backups/ems-mysql

# ── 5. 방화벽 설정 (ufw) ─────────────────────────────────
log "방화벽 설정..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
# MQTT는 VPC 내부에서만 — 인바운드 차단
# ufw allow from 10.0.0.0/8 to any port 1883
ufw --force enable
ufw status

# ── 6. fail2ban 설정 ─────────────────────────────────────
log "fail2ban 설정..."
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 5
backend  = systemd

[sshd]
enabled  = true
port     = ssh
logpath  = %(sshd_log)s
maxretry = 3
bantime  = 86400
EOF
systemctl enable fail2ban
systemctl restart fail2ban

# ── 7. 스왑 파일 생성 (4GB) ──────────────────────────────
log "스왑 파일 생성 (4GB)..."
if [ ! -f /swapfile ]; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ── 8. 시스템 튜닝 ───────────────────────────────────────
log "시스템 튜닝..."
cat >> /etc/sysctl.conf << 'EOF'

# EMS AIoT 튜닝
vm.swappiness                = 10
net.core.somaxconn           = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.core.netdev_max_backlog  = 65535
net.ipv4.tcp_fin_timeout     = 30
net.ipv4.tcp_keepalive_time  = 300
fs.file-max                  = 1000000
EOF
sysctl -p

# ulimit 설정
cat >> /etc/security/limits.conf << 'EOF'
ems-deploy soft nofile 65536
ems-deploy hard nofile 65536
EOF

# ── 9. logrotate 설정 ────────────────────────────────────
cat > /etc/logrotate.d/ems-aiot << 'EOF'
/var/log/ems/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 640 ems-deploy ems-deploy
    sharedscripts
    postrotate
        docker kill -s USR1 ems_nginx 2>/dev/null || true
    endscript
}
/opt/ems-aiot/infra/nginx/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    sharedscripts
    postrotate
        docker kill -s USR1 ems_nginx 2>/dev/null || true
    endscript
}
EOF

# ── 10. SSH 보안 강화 ────────────────────────────────────
log "SSH 보안 강화..."
sed -i 's/^#PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
echo "AllowUsers ems-deploy" >> /etc/ssh/sshd_config
systemctl restart sshd

log "=========================================="
log " 서버 초기화 완료!"
log " 다음 단계:"
log "   1. /home/ems-deploy/.ssh/authorized_keys 에 배포 공개키 추가"
log "   2. cd /opt/ems-aiot && git clone {repo} ."
log "   3. .env.production 파일 배치"
log "   4. bash infra/ncp/02-first-deploy.sh 실행"
log "=========================================="
