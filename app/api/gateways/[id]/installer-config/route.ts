/**
 * GET /api/gateways/{id}/installer-config?type=windows|docker|linux
 *
 * 게이트웨이별 사전 설정된 수집기 설치 파일 생성 및 다운로드.
 * 인증키(gateway_id + API key)가 자동으로 포함된 파일을 반환.
 *
 * type=windows  → config.yaml 다운로드 (EXE와 함께 사용)
 * type=docker   → docker-compose.yml 다운로드
 * type=linux    → install.sh 원클릭 설치 스크립트
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth, requireRoleOrHigher } from '@/lib/auth/verify';
import { UserRole } from '@/lib/constants/roles';

export const dynamic = 'force-dynamic';

// ── API 키 발급 (수집기 전용) ──────────────────────────────────────────
import { createHash, randomBytes } from 'crypto';

async function getOrCreateCollectorApiKey(
  tenantId: string,
  gatewayId: string,
): Promise<string> {
  // 기존 수집기 전용 키 조회
  const existing = await (prisma as any).apiKey.findFirst({
    where: {
      tenantId,
      name: { startsWith: `collector-${gatewayId}` },
      isActive: true,
    },
    select: { id: true },
  });

  // 이미 있으면 새로 발급 (키 원문은 DB에 없음 — 재발급 필요)
  // 수집기용은 항상 새로 발급하고 응답에 포함 (1회 노출)
  const rawKey  = `sk_collector_${randomBytes(24).toString('hex')}`;
  const keyHash = createHash('sha256').update(rawKey).digest('hex');

  // 기존 키 비활성화
  if (existing) {
    await (prisma as any).apiKey.update({
      where: { id: existing.id },
      data: { isActive: false },
    });
  }

  // 신규 발급
  await (prisma as any).apiKey.create({
    data: {
      tenantId,
      name:      `collector-${gatewayId}-${Date.now()}`,
      keyHash,
      isActive:  true,
      expiresAt: null,   // 만료 없음
    },
  });

  return rawKey;
}

// ── 파일 생성 헬퍼 ──────────────────────────────────────────────────────

function buildConfigYaml(
  apiUrl: string,
  gatewayId: string,
  apiKey: string,
  gatewayName: string,
): string {
  return `# 탄소이음 Collector 설정 파일
# 게이트웨이: ${gatewayName} (${gatewayId})
# 생성일시: ${new Date().toISOString()}
# ⚠ 이 파일에는 인증 토큰이 포함되어 있습니다. 외부 공유 금지.

cloud:
  api_url: "${apiUrl}"
  gateway_id: "${gatewayId}"
  gateway_token: "${apiKey}"
  sync_interval_sec: 10
  heartbeat_interval_sec: 30
  batch_size: 500
  timeout_sec: 15

buffer:
  db_path: "data/collector_buffer.db"
  max_records: 500000
  retention_hours: 72

engine:
  max_workers: 20
  default_poll_interval_ms: 5000

logging:
  level: "INFO"
  file: "logs/collector.log"

# ──────────────────────────────────────────────
# 장치 설정 — 현장 상황에 맞게 수정하세요
# ──────────────────────────────────────────────
devices:
  # Modbus TCP 예시 (전력 계량기)
  # - id: "meter_01"
  #   name: "1층 전력계량기"
  #   protocol: "modbus_tcp"
  #   enabled: true
  #   poll_interval_ms: 5000
  #   connection:
  #     host: "192.168.1.101"
  #     port: 502
  #     unit_id: 1
  #     timeout_sec: 3
  #   registers:
  #     - address: 40001
  #       data_type: float32
  #       sensor_code: "METER-01-KWH"
  #       metric_key: energy_kwh
  #       unit: kWh
  #       scale: 0.001

  # MQTT 예시 (IoT 센서)
  # - id: "iot_hub_01"
  #   name: "IoT 허브"
  #   protocol: "mqtt"
  #   enabled: true
  #   poll_interval_ms: 1000
  #   connection:
  #     broker_host: "192.168.1.200"
  #     broker_port: 1883
  #     subscribe_topics:
  #       - "sensors/#"
`;
}

function buildDockerCompose(
  apiUrl: string,
  gatewayId: string,
  apiKey: string,
  gatewayName: string,
): string {
  return `# 탄소이음 Collector — Docker Compose
# 게이트웨이: ${gatewayName} (${gatewayId})
# 생성일시: ${new Date().toISOString()}
# ⚠ 이 파일에는 인증 토큰이 포함되어 있습니다. 외부 공유 금지.

version: "3.9"

services:
  collector:
    image: ghcr.io/tansoeum/collector:latest
    container_name: tansoeum-collector
    restart: unless-stopped
    environment:
      - CLOUD_API_URL=${apiUrl}
      - GATEWAY_ID=${gatewayId}
      - GATEWAY_TOKEN=${apiKey}
      - TZ=Asia/Seoul
    volumes:
      - ./config:/app/config:ro
      - collector-data:/app/data
      - collector-logs:/app/logs
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

volumes:
  collector-data:
  collector-logs:
`;
}

function buildInstallScript(
  apiUrl: string,
  gatewayId: string,
  apiKey: string,
  gatewayName: string,
): string {
  return `#!/bin/bash
# 탄소이음 Collector 원클릭 설치 스크립트
# 게이트웨이: ${gatewayName} (${gatewayId})
# 생성일시: ${new Date().toISOString()}
# ⚠ 이 스크립트에는 인증 토큰이 포함되어 있습니다. 외부 공유 금지.

set -e

INSTALL_DIR="/opt/tansoeum-collector"
COMPOSE_URL="https://ghcr.io/tansoeum/collector:latest"

echo "===================================="
echo " 탄소이음 Collector 설치 시작"
echo " 게이트웨이: ${gatewayName}"
echo "===================================="

# Docker 설치 확인
if ! command -v docker &> /dev/null; then
  echo "[1/4] Docker 설치 중..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
else
  echo "[1/4] Docker 확인 완료"
fi

# 설치 디렉터리 생성
echo "[2/4] 디렉터리 설정 중..."
mkdir -p "$INSTALL_DIR/config" "$INSTALL_DIR/data" "$INSTALL_DIR/logs"

# docker-compose.yml 생성
echo "[3/4] 설정 파일 생성 중..."
cat > "$INSTALL_DIR/docker-compose.yml" << 'COMPOSE_EOF'
version: "3.9"
services:
  collector:
    image: ghcr.io/tansoeum/collector:latest
    container_name: tansoeum-collector
    restart: unless-stopped
    environment:
      - CLOUD_API_URL=${apiUrl}
      - GATEWAY_ID=${gatewayId}
      - GATEWAY_TOKEN=${apiKey}
      - TZ=Asia/Seoul
    volumes:
      - ./config:/app/config:ro
      - collector-data:/app/data
      - collector-logs:/app/logs
volumes:
  collector-data:
  collector-logs:
COMPOSE_EOF

# config.yaml 생성 (장치 설정 — 현장에서 추가 편집 필요)
cat > "$INSTALL_DIR/config/config.yaml" << 'CONFIG_EOF'
cloud:
  api_url: "${apiUrl}"
  gateway_id: "${gatewayId}"
  gateway_token: "${apiKey}"
devices: []
CONFIG_EOF

# 서비스 시작
echo "[4/4] 서비스 시작 중..."
cd "$INSTALL_DIR"
docker compose pull
docker compose up -d

echo ""
echo "===================================="
echo " 설치 완료!"
echo " 상태 확인: docker compose -f $INSTALL_DIR/docker-compose.yml logs -f"
echo " 장치 설정: $INSTALL_DIR/config/config.yaml 편집 후 docker compose restart"
echo "===================================="
`;
}

// ── 핸들러 ─────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });
    }
    if (!requireRoleOrHigher(auth, 'site_manager' as UserRole)) {
      return NextResponse.json({ success: false, error: '권한 없음' }, { status: 403 });
    }

    const { id: gatewayId } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') ?? 'windows'; // windows | docker | linux

    // 게이트웨이 조회 + 소유권 검증
    const gateway = await prisma.gateway.findFirst({
      where: { id: gatewayId, tenantId: auth.tenantId },
      select: { id: true, name: true, serialNumber: true },
    });
    if (!gateway) {
      return NextResponse.json({ success: false, error: '게이트웨이 없음' }, { status: 404 });
    }

    // 수집기 전용 API 키 발급
    const apiKey  = await getOrCreateCollectorApiKey(auth.tenantId, gatewayId);
    const apiUrl  = process.env.NEXTAUTH_URL ?? 'https://your-server.com';
    const gwName  = gateway.name ?? gateway.serialNumber;

    // 파일 타입별 응답
    if (type === 'docker') {
      const content = buildDockerCompose(apiUrl, gatewayId, apiKey, gwName);
      return new NextResponse(content, {
        headers: {
          'Content-Type': 'text/yaml; charset=utf-8',
          'Content-Disposition': `attachment; filename="tansoeum-collector-${gatewayId}.docker-compose.yml"`,
        },
      });
    }

    if (type === 'linux') {
      const content = buildInstallScript(apiUrl, gatewayId, apiKey, gwName);
      return new NextResponse(content, {
        headers: {
          'Content-Type': 'text/x-sh; charset=utf-8',
          'Content-Disposition': `attachment; filename="tansoeum-install-${gatewayId}.sh"`,
        },
      });
    }

    // 기본: windows (config.yaml)
    const content = buildConfigYaml(apiUrl, gatewayId, apiKey, gwName);
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/yaml; charset=utf-8',
        'Content-Disposition': `attachment; filename="tansoeum-collector-config-${gatewayId}.yaml"`,
      },
    });

  } catch (error) {
    console.error('[API] 수집기 설정 생성 오류:', error);
    return NextResponse.json({ success: false, error: '서버 오류' }, { status: 500 });
  }
}