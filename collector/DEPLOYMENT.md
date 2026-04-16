# 탄소이음 Collector — 배포 가이드

## 목차
1. [사전 준비](#사전-준비)
2. [Windows EXE 배포 (현장 PC)](#windows-exe-배포)
3. [Docker 배포 (Linux 서버)](#docker-배포)
4. [systemd 서비스 등록 (Linux)](#systemd-서비스)
5. [설정 파일 작성](#설정-파일-작성)
6. [신규 센서 추가](#신규-센서-추가)
7. [신규 프로토콜 드라이버 개발](#신규-프로토콜-드라이버-개발)
8. [장애 복구 절차](#장애-복구-절차)
9. [성능 튜닝](#성능-튜닝)

---

## 사전 준비

### Python 환경 (직접 실행 시)
```bash
# Python 3.10 이상 필요
python --version

# 가상환경 생성 (권장)
python -m venv .venv
source .venv/bin/activate       # Linux/Mac
.venv\Scripts\activate.bat      # Windows

# 의존성 설치
pip install -r requirements.txt
```

### 설정 파일 복사
```bash
cp config/config.example.yaml config/config.yaml
# 이후 config/config.yaml을 편집기로 열어 수정
```

---

## Windows EXE 배포

현장 PC (GUI 모드, 운영자 인터페이스)에 적합.

### PyInstaller로 EXE 빌드
```bash
# 개발 PC에서 실행 (Windows 환경 필요)
pip install pyinstaller==6.11.0
pyinstaller collector.spec

# 결과: dist/TansoEum-Collector.exe
```

### 현장 배포 패키지 구성
```
현장배포/
├── TansoEum-Collector.exe    # 단일 실행 파일
└── config/
    └── config.yaml           # 장치별 맞춤 설정
```

### 실행
```
# 설정 파일이 ./config/config.yaml에 있으면 더블클릭으로 실행
TansoEum-Collector.exe

# 설정 파일 경로 지정
TansoEum-Collector.exe --config C:\Collector\config.yaml

# 헤드리스 모드 (Windows 서비스용)
TansoEum-Collector.exe --headless --config C:\Collector\config.yaml
```

### Windows 서비스 등록 (NSSM 사용)
```powershell
# NSSM 설치 후
nssm install TansoEumCollector "C:\Collector\TansoEum-Collector.exe"
nssm set TansoEumCollector AppParameters "--headless --config C:\Collector\config.yaml"
nssm set TansoEumCollector AppDirectory "C:\Collector"
nssm set TansoEumCollector Start SERVICE_AUTO_START
nssm start TansoEumCollector
```

---

## Docker 배포

Linux 서버/에지 게이트웨이 (헤드리스 모드)에 적합.

### 빠른 시작
```bash
# 1. 저장소 클론 또는 collector/ 디렉터리 복사
# 2. 환경변수 설정
cp .env.example .env
vi .env   # CLOUD_API_URL, GATEWAY_ID, GATEWAY_TOKEN 수정

# 3. 설정 파일 복사 및 수정
mkdir -p config
cp config/config.example.yaml config/config.yaml
vi config/config.yaml   # 장치 목록 수정

# 4. 실행
docker compose up -d

# 로그 확인
docker compose logs -f collector

# 상태 확인
docker compose exec collector python -m src.main --status

# 재시작
docker compose restart collector

# 중지
docker compose down
```

### Modbus TCP 장치 접근 (host 네트워크)
Modbus 장치가 게이트웨이와 같은 LAN에 있을 경우:
```yaml
# docker-compose.yml에서 주석 해제:
network_mode: host
```

### 직렬 포트 (Modbus RTU) 접근
```yaml
# docker-compose.yml에 추가:
devices:
  - /dev/ttyUSB0:/dev/ttyUSB0
```

---

## systemd 서비스

Python 직접 실행을 systemd로 관리.

```ini
# /etc/systemd/system/tansoeum-collector.service
[Unit]
Description=탄소이음 IoT Collector Service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=collector
WorkingDirectory=/opt/collector
ExecStart=/opt/collector/.venv/bin/python -m src.main --headless
Restart=on-failure
RestartSec=10s
StandardOutput=journal
StandardError=journal

# 환경변수
EnvironmentFile=/opt/collector/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable tansoeum-collector
sudo systemctl start tansoeum-collector
sudo journalctl -u tansoeum-collector -f
```

---

## 설정 파일 작성

`config/config.yaml` 핵심 섹션:

### 클라우드 연결
```yaml
cloud:
  api_url: "https://your-server.com"      # SaaS 서버 주소
  gateway_id: "gw_xxxxxxxxxx"             # 관리 화면에서 발급
  gateway_token: "your_token_here"        # 관리 화면에서 발급
  sync_interval_sec: 10                   # 전송 주기 (초)
  heartbeat_interval_sec: 30             # 하트비트 주기
```

### Modbus TCP 장치 추가
```yaml
devices:
  - id: "meter_01"
    name: "1층 전력계량기"
    protocol: "modbus_tcp"
    enabled: true
    poll_interval_ms: 5000
    connection:
      host: "192.168.1.101"
      port: 502
      unit_id: 1
      timeout_sec: 3
    registers:
      - address: 40001
        function_code: 3          # 3=Holding, 4=Input
        data_type: float32        # float32/int16/uint16/int32
        sensor_code: "METER-01-KWH"
        metric_key: energy_kwh
        unit: kWh
        scale: 0.001
```

### MQTT 장치 추가
```yaml
devices:
  - id: "iot_sensor_01"
    name: "스마트 온습도 센서"
    protocol: "mqtt"
    enabled: true
    poll_interval_ms: 1000
    connection:
      broker_host: "192.168.1.200"
      broker_port: 1883
      client_id: "collector_iot_01"
      subscribe_topics:
        - "sensors/building/+/temperature"
        - "sensors/building/+/humidity"
```

---

## 신규 센서 추가

기존 장치에 새 레지스터(측정 항목)를 추가할 때:

1. `config/config.yaml`에서 해당 장치 `registers` 항목에 추가:
```yaml
registers:
  - address: 40005           # 새 레지스터 주소
    sensor_code: "METER-01-PF"    # 탄소이음 센서 코드
    metric_key: power_factor
    unit: ""
    scale: 0.01
    data_type: int16
```

2. 탄소이음 관리 화면에서 해당 `sensor_code`로 센서를 등록

3. collector 재시작 없이 **런타임 적용** (SettingsTab → Save → Restart Engine)

> 센서 코드 규칙: `{사이트코드}-{장치번호}-{측정항목}` (예: `B1F-M01-KWH`)

---

## 신규 프로토콜 드라이버 개발

새 프로토콜(예: BACnet, DNP3)을 플러그인으로 추가하는 방법:

### 1. 드라이버 파일 생성
```python
# src/drivers/bacnet_driver.py
from .base_driver import BaseDriver, DriverRegistry, DriverStatus
from ..buffer.local_buffer import Reading

@DriverRegistry.register("bacnet")        # ← 이 데코레이터로 자동 등록
class BACnetDriver(BaseDriver):

    def connect(self) -> bool:
        # BACnet 연결 로직
        self._set_status(DriverStatus.CONNECTED)
        return True

    def disconnect(self) -> None:
        self._set_status(DriverStatus.DISCONNECTED)

    def poll(self) -> list[Reading]:
        readings = []
        # BACnet 읽기 로직
        # ...
        return readings
```

### 2. `__init__.py`에 등록
```python
# src/drivers/__init__.py에 추가:
from .bacnet_driver import BACnetDriver
```

### 3. 설정 스키마 확장 (선택)
`src/config/config_manager.py`의 `DeviceConfig`는 `model_extra = "allow"` 덕분에  
임의 연결 설정을 그대로 드라이버 `config` dict로 전달합니다.

### 4. 테스트
```bash
python -c "
from src.drivers import DriverRegistry
print(DriverRegistry.list_protocols())  # bacnet 출력 확인
"
```

### BaseDriver 재정의 메서드
| 메서드 | 필수 | 설명 |
|--------|------|------|
| `connect()` | ✓ | 연결 수립, True/False 반환 |
| `disconnect()` | ✓ | 연결 해제 |
| `poll()` | ✓ | 데이터 읽기, Reading[] 반환 |
| `test_connection()` | 선택 | GUI 테스트 버튼용 |

---

## 장애 복구 절차

### 시나리오 1: 클라우드 연결 단절
- **영향**: 데이터 수집 계속됨, 로컬 버퍼에 축적
- **자동 복구**: CloudSync가 10초마다 재시도, 연결 복구 시 자동 전송
- **확인**: `python -m src.main --status` → 미전송 레코드 수 확인
- **수동 조치**: 필요 없음. 72시간 내 복구 시 데이터 무손실

### 시나리오 2: 버퍼 DB 손상
```bash
# 손상된 DB 백업 후 재생성
mv data/buffer.db data/buffer.db.bak
# collector 재시작 → 새 DB 자동 생성
```

### 시나리오 3: 특정 장치 응답 없음
- **자동 복구**: 지수 백오프 재연결 (최대 5분 간격)
- **수동 조치**: GUI DevicesTab → 장치 선택 → Reconnect
- **로그 확인**: `[DRIVER] ERROR` 태그 메시지 확인

### 시나리오 4: 버퍼 용량 초과 (500K 초과)
- **자동 처리**: 가장 오래된 미전송 레코드부터 덮어쓰기
- **예방**: 클라우드 연결 복구 우선 / max_records 조정

### 재해 복구 데이터 복원
```bash
# 버퍼 DB에서 미전송 데이터 수동 추출
sqlite3 data/buffer.db "
  SELECT device_id, sensor_code, metric_key, value, unit, timestamp
  FROM readings
  WHERE sent = 0
  ORDER BY timestamp
" > recovery.csv
```

---

## 성능 튜닝

### 장치 수에 따른 권장 설정

| 장치 수 | max_workers | sync_interval | batch_size |
|:------:|:-----------:|:-------------:|:----------:|
| ~10    | 10          | 10s           | 200        |
| ~50    | 20          | 10s           | 500        |
| ~100   | 30          | 5s            | 1000       |
| 100+   | 50          | 5s            | 2000       |

```yaml
# config.yaml
engine:
  max_workers: 20         # ThreadPoolExecutor 스레드 수
cloud:
  sync_interval_sec: 10   # 클라우드 전송 주기
  batch_size: 500         # 배치 전송 크기
buffer:
  max_records: 500000     # 버퍼 최대 레코드 수
```

### 폴링 주기 권장값

| 장치 유형 | 권장 주기 | 최소 주기 |
|:--------:|:--------:|:--------:|
| 전력계량기 | 5,000ms  | 1,000ms  |
| 환경센서  | 30,000ms | 5,000ms  |
| MQTT      | 1,000ms  | 100ms    |
| OPC-UA    | 1,000ms  | 500ms    |

### SQLite 성능 최적화
WAL 모드와 NORMAL synchronous는 기본 적용됨.  
대용량(100K+ 레코드/일) 환경에서 추가 설정:
```python
# local_buffer.py에서 이미 적용됨:
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA cache_size=-64000;  # 64MB 캐시
```