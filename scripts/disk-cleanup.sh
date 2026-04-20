#!/bin/bash
# =============================================================================
# 탄소이음 EMS AIoT — 디스크 공간 정리 스크립트
#
# 사용법 (NCP 서버에서 실행):
#   chmod +x scripts/disk-cleanup.sh
#   ./scripts/disk-cleanup.sh
#
# 주기적 실행 (서버 crontab 추가):
#   0 4 * * 0  /opt/ems/scripts/disk-cleanup.sh >> /var/log/ems-cleanup.log 2>&1
# =============================================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }

echo "======================================"
echo "  EMS AIoT 디스크 정리 시작"
echo "  $(date '+%Y-%m-%d %H:%M:%S KST')"
echo "======================================"

# 정리 전 디스크 사용량
BEFORE=$(df -h / | awk 'NR==2{print $3"/"$2" ("$5")"}')
echo "정리 전 디스크: $BEFORE"

# 1. Docker 미사용 컨테이너/이미지/볼륨/네트워크 정리
echo ""
warn "1. Docker 미사용 리소스 정리..."

# 중지된 컨테이너 (24시간 이상)
docker container prune -f --filter "until=24h" 2>/dev/null && log "중지 컨테이너 정리 완료" || true

# Dangling 이미지 (태그 없는 빌드 중간 레이어)
docker image prune -f 2>/dev/null && log "Dangling 이미지 정리 완료" || true

# 72시간 이상 된 미사용 이미지
docker image prune -a -f --filter "until=72h" 2>/dev/null && log "구버전 이미지 정리 완료" || true

# 미사용 빌드 캐시
docker builder prune -f --filter "until=48h" 2>/dev/null && log "빌드 캐시 정리 완료" || true

# 2. NCP Container Registry 구버전 이미지 정리
# (로컬 이미지만 삭제, NCP 원격 레지스트리는 NCP 콘솔에서 수동 관리)
NCP_REGISTRY="${NCP_REGISTRY:-carbonieum-ems-aiot.kr.ncr.ntruss.com}"
echo ""
warn "2. 로컬 NCP Registry 이미지 정리 (최신 3개 유지)..."
for img in "ems-app" "ems-seeder" "ems-ai"; do
  docker images "${NCP_REGISTRY}/${img}" --format '{{.Tag}}' \
    | grep -v 'latest' \
    | sort -rV \
    | tail -n +4 \
    | xargs -r -I{} sh -c "docker rmi '${NCP_REGISTRY}/${img}:{}' 2>/dev/null && echo '  삭제: ${NCP_REGISTRY}/${img}:{}'" || true
done

# 3. Docker JSON 로그 파일 크기 확인 및 경고
echo ""
warn "3. Docker 컨테이너 로그 용량 확인..."
LOG_TOTAL=0
for log_file in /var/lib/docker/containers/*/*.log; do
  [ -f "$log_file" ] || continue
  size=$(stat -c%s "$log_file" 2>/dev/null || echo 0)
  LOG_TOTAL=$((LOG_TOTAL + size))
  # 50MB 이상인 로그 파일 경고
  if [ "$size" -gt 52428800 ]; then
    size_mb=$((size / 1048576))
    warn "  대용량 로그: $log_file (${size_mb}MB)"
  fi
done
log "총 컨테이너 로그: $((LOG_TOTAL / 1048576))MB"

# 4. Next.js 빌드 캐시 정리 (.next/cache)
echo ""
warn "4. Next.js 빌드 캐시 확인..."
NEXT_CACHE="/opt/ems/.next/cache"
if [ -d "$NEXT_CACHE" ]; then
  CACHE_SIZE=$(du -sh "$NEXT_CACHE" 2>/dev/null | cut -f1)
  log ".next/cache 크기: $CACHE_SIZE (자동 관리됨)"
fi

# 5. 시스템 임시 파일 정리
echo ""
warn "5. 시스템 임시 파일 정리..."
find /tmp -type f -mtime +7 -delete 2>/dev/null && log "/tmp 7일 이상 파일 삭제" || true

# 정리 후 디스크 사용량
AFTER=$(df -h / | awk 'NR==2{print $3"/"$2" ("$5")"}')

echo ""
echo "======================================"
echo "  정리 전: $BEFORE"
echo "  정리 후: $AFTER"
echo "======================================"
echo ""
log "디스크 정리 완료 ($(date '+%Y-%m-%d %H:%M:%S KST'))"
