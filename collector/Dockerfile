# ────────────────────────────────────────────────────────────────
# 탄소이음 Collector Service — 멀티스테이지 Dockerfile
#
# Stage 1 (builder) : 의존성 설치 + wheel 빌드
# Stage 2 (runtime) : 최소 런타임 이미지 (GUI 없는 헤드리스 전용)
#
# 빌드:
#   docker build -t tansoeum/collector:latest .
#
# 실행:
#   docker run -d \
#     -v /opt/collector/config:/app/config \
#     -v /opt/collector/data:/app/data \
#     -v /opt/collector/logs:/app/logs \
#     -e GATEWAY_ID=gw_xxx \
#     -e GATEWAY_TOKEN=your_token \
#     -e CLOUD_API_URL=https://your-server.com \
#     tansoeum/collector:latest
# ────────────────────────────────────────────────────────────────

# ── Stage 1: Builder ─────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

# 시스템 의존성 (pymodbus 직렬 포트, asyncua 빌드)
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        g++ \
        libffi-dev \
        libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# requirements 먼저 복사 (캐시 레이어 최적화)
COPY requirements.txt .

# wheel 빌드 (GUI 라이브러리 제외)
RUN pip install --upgrade pip && \
    pip wheel --no-cache-dir --wheel-dir /build/wheels \
        pymodbus==3.7.4 \
        paho-mqtt==2.1.0 \
        httpx==0.27.2 \
        asyncua==1.1.5 \
        apscheduler==3.10.4 \
        tenacity==9.0.0 \
        pydantic==2.7.4 \
        pydantic-settings==2.3.4 \
        pyyaml==6.0.2 \
        aiosqlite==0.20.0


# ── Stage 2: Runtime ─────────────────────────────────────────────
FROM python:3.11-slim AS runtime

LABEL maintainer="탄소이음 <dev@carbonieum.co.kr>"
LABEL version="1.0.0"
LABEL description="탄소이음 IoT Collector Service (헤드리스)"

WORKDIR /app

# 시스템 의존성 (직렬 포트 접근용)
RUN apt-get update && apt-get install -y --no-install-recommends \
        libffi8 \
        libssl3 \
        tzdata \
    && rm -rf /var/lib/apt/lists/*

# 타임존 설정 (한국 표준시)
ENV TZ=Asia/Seoul
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# builder에서 빌드된 wheel 설치
COPY --from=builder /build/wheels /tmp/wheels
RUN pip install --no-cache-dir --no-index --find-links=/tmp/wheels \
        pymodbus \
        paho-mqtt \
        httpx \
        asyncua \
        apscheduler \
        tenacity \
        pydantic \
        pydantic-settings \
        pyyaml \
        aiosqlite \
    && rm -rf /tmp/wheels

# 소스 복사
COPY src/ ./src/

# 디렉터리 생성 (볼륨 마운트 포인트)
RUN mkdir -p /app/config /app/data /app/logs

# 비루트 사용자 (보안)
RUN groupadd -r collector && useradd -r -g collector -s /sbin/nologin collector
RUN chown -R collector:collector /app
USER collector

# 환경변수 기본값
ENV COLLECTOR_CONFIG=/app/config/config.yaml
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# 헬스체크 (버퍼 DB 존재 확인)
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c "from src.config.config_manager import load_config; c=load_config(); print('OK')" || exit 1

# 헤드리스 모드로 실행
ENTRYPOINT ["python", "-m", "src.main", "--headless"]