# 탄소이음 IoT Collector Service

현장 에너지 계측 장치에서 데이터를 수집해 탄소이음 SaaS 클라우드로 전송하는 **엣지 게이트웨이 서비스**입니다.

## 지원 프로토콜

| 프로토콜 | 방식 | 주요 장치 |
|:--------:|:----:|:--------:|
| Modbus TCP | Poll | 스마트 미터, 인버터, PLC |
| Modbus RTU | Poll | RS-485 시리얼 장치 |
| MQTT | Push | IoT 센서, 스마트 게이트웨이 |
| HTTP/REST | Poll | API 제공 장치, 웹훅 |
| OPC-UA | Poll | SCADA, PLC, 스마트 인버터 |

## 빠른 시작

```bash
# 1. 설정 파일 준비
cp config/config.example.yaml config/config.yaml
# config.yaml 편집: cloud.gateway_id, cloud.gateway_token, devices 목록

# 2. 의존성 설치
pip install -r requirements.txt

# 3. GUI 모드 실행 (현장 운용자)
python -m src.main --gui

# 4. 헤드리스 모드 실행 (서버/Docker)
python -m src.main --headless

# 5. Docker로 실행
cp .env.example .env && vi .env
docker compose up -d
```

## 주요 기능

- **오프라인 내성**: SQLite 로컬 버퍼 (최대 72시간 × 500K 레코드)
- **자동 재연결**: 지수 백오프로 장치 연결 자동 복구
- **무중단 장치 추가**: 런타임 hot-swap (엔진 재시작 불필요)
- **OTA 설정**: 클라우드에서 원격으로 장치 설정 갱신
- **현장 GUI**: ttkbootstrap dark 테마 운용자 인터페이스
- **플러그인 아키텍처**: `@DriverRegistry.register("protocol")` 한 줄로 새 프로토콜 추가

## 문서

- [ARCHITECTURE.md](ARCHITECTURE.md) — 시스템 구조 및 데이터 흐름 다이어그램
- [DEPLOYMENT.md](DEPLOYMENT.md) — Windows EXE / Docker / systemd 배포 가이드
- [config/config.example.yaml](config/config.example.yaml) — 전체 설정 예시

## 요구사항

- Python 3.10 이상
- OS: Windows 10+, Ubuntu 20.04+, Raspberry Pi OS (64bit)
- RAM: 최소 64MB, 권장 256MB
- 디스크: 버퍼 DB용 100MB 이상