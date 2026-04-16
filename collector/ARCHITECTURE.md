# 탄소이음 Collector Service — 아키텍처

## 전체 시스템 구조

```
┌─────────────────────────────────────────────────────────────────────┐
│                    현장 게이트웨이 (Edge)                             │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   CollectorEngine                            │   │
│  │                                                              │   │
│  │  ┌──────────┐  poll()  ┌─────────────────────────────────┐  │   │
│  │  │APScheduler├─────────►      ThreadPoolExecutor          │  │   │
│  │  │(장치별 주기)│          │        (max_workers=20)          │  │   │
│  │  └──────────┘          └──────────────┬──────────────────┘  │   │
│  │                                       │ safe_poll()          │   │
│  │  ┌────────────────────────────────────▼──────────────────┐   │   │
│  │  │                  DriverRegistry                        │   │   │
│  │  │  ┌──────────┐  ┌──────────┐  ┌────────┐  ┌────────┐  │   │   │
│  │  │  │ Modbus   │  │  MQTT    │  │  HTTP  │  │ OPC-UA │  │   │   │
│  │  │  │ TCP/RTU  │  │ (Push)   │  │ (Poll) │  │        │  │   │   │
│  │  │  └────┬─────┘  └────┬─────┘  └───┬────┘  └───┬────┘  │   │   │
│  │  └───────┼─────────────┼────────────┼────────────┼───────┘   │   │
│  │          │             │            │            │            │   │
│  │          └─────────────┴────────────┴────────────┘           │   │
│  │                              │ Reading[]                      │   │
│  │                    ┌─────────▼─────────┐                     │   │
│  │                    │   LocalBuffer     │                     │   │
│  │                    │  (SQLite WAL)     │                     │   │
│  │                    │  • push()         │                     │   │
│  │                    │  • pop_batch()    │                     │   │
│  │                    │  • mark_sent()    │                     │   │
│  │                    │  • purge_expired()│                     │   │
│  │                    └─────────┬─────────┘                     │   │
│  │                              │                               │   │
│  │                    ┌─────────▼─────────┐                     │   │
│  │                    │   CloudSync       │                     │   │
│  │                    │ • _sync_loop      │                     │   │
│  │                    │ • _heartbeat_loop │                     │   │
│  │                    │ • fetch_config    │                     │   │
│  │                    └─────────┬─────────┘                     │   │
│  └──────────────────────────────┼───────────────────────────────┘   │
│                                 │                                   │
└─────────────────────────────────┼───────────────────────────────────┘
                                  │ HTTPS (Bearer Token)
                                  │ POST /api/gateways/{id}/data
                                  │ GET  /api/gateways/{id}
                                  ▼
                    ┌─────────────────────────┐
                    │   탄소이음 SaaS 클라우드  │
                    │   (Next.js + MySQL)      │
                    └─────────────────────────┘
```

## 데이터 흐름

```
장치(물리)
   │
   │  프로토콜별 통신
   ▼
Driver.poll() ──────────────────────────────────────────────────────┐
   │ Reading { sensor_code, metric_key, value, unit, timestamp }    │
   ▼                                                                │
LocalBuffer.push()                                                  │
   │ INSERT INTO readings (unsent)                                  │
   │                                                                │
   ├──[on_data callback]─────────────────────────────────────────►  │
   │                     GUI 실시간 표시 (CollectorApp)              │
   │                                                                │
CloudSync._sync_loop() [10초마다]                                    │
   │ SELECT ... WHERE sent=0 LIMIT 500                              │
   │ POST /api/gateways/{id}/data                                   │
   │ ─── 성공 → DELETE rows                                         │
   │ ─── 실패 → 보존 (지수 백오프 재시도)                              │
   │                                                                │
CloudSync._heartbeat_loop() [30초마다]                               │
   │ POST /api/gateways/{id}/data (readings=[])                    │
   │ 게이트웨이 온라인 상태 갱신                                        │
   │                                                                │
└───────────────────────────────────────────────────────────────────┘
```

## 파일 구조

```
collector/
├── requirements.txt          # Python 의존성
├── collector.spec            # PyInstaller EXE 빌드 스펙
├── Dockerfile                # 멀티스테이지 Docker 이미지
├── docker-compose.yml        # 컨테이너 오케스트레이션
├── .env.example              # 환경변수 템플릿
│
├── config/
│   └── config.example.yaml  # 설정 파일 예시 (config.yaml로 복사 후 수정)
│
└── src/
    ├── main.py               # 진입점 (--gui / --headless / --status)
    │
    ├── config/
    │   ├── __init__.py
    │   └── config_manager.py # Pydantic 설정 모델 + load_config()
    │
    ├── buffer/
    │   ├── __init__.py
    │   └── local_buffer.py   # SQLite WAL 버퍼 (Reading dataclass)
    │
    ├── drivers/
    │   ├── __init__.py       # 모든 드라이버 자동 등록
    │   ├── base_driver.py    # BaseDriver ABC + DriverRegistry
    │   ├── modbus_driver.py  # Modbus TCP + RTU
    │   ├── mqtt_driver.py    # MQTT (Push → Pull 브릿지)
    │   ├── http_driver.py    # HTTP/REST 폴링
    │   └── opcua_driver.py   # OPC-UA (asyncua)
    │
    ├── sync/
    │   ├── __init__.py
    │   └── cloud_sync.py     # 클라우드 동기화 + 하트비트 + OTA
    │
    ├── engine/
    │   ├── __init__.py
    │   └── collector_engine.py # APScheduler + ThreadPoolExecutor
    │
    └── gui/
        ├── __init__.py
        └── app.py            # ttkbootstrap GUI (DashboardTab, DevicesTab, ...)
```

## 드라이버 상태 머신

```
IDLE ──connect()──► CONNECTING ──성공──► CONNECTED
                                  │
                                  └──실패──► ERROR
                                               │
                            지수 백오프 재시도 ◄─┘
                            (30s × 2^n, max 300s)

CONNECTED ──poll()──► POLLING ──완료──► CONNECTED
                                  │
                                  └──오류──► ERROR / DISCONNECTED
```

## 재연결 정책 (지수 백오프)

| 연속 실패 횟수 | 대기 시간 |
|:----------:|:--------:|
| 1          | 30초     |
| 2          | 60초     |
| 3          | 120초    |
| 4          | 240초    |
| 5+         | 300초    |

## 클라우드 전송 실패 처리

```
전송 실패 → 레코드 버퍼 보존 (DELETE 안 함)
          → consecutive_fails++
          → 10회 실패마다 경고 로그

버퍼 용량: 최대 500,000건 (기본)
보존 기간: 72시간 (기본) → 만료 시 자동 삭제
유지보수 : purge_expired() 매 1시간 / vacuum() 매 24시간
```

## GUI 이벤트 흐름 (스레드 안전)

```
엔진 스레드 (N개)
    │
    │  engine._handle_readings()
    │  engine._handle_driver_status()
    │
    ▼
gui_queue: queue.Queue(maxsize=2000)
    │
    │  post("data_update", {...})
    │  post("device_status", {...})
    │  post("log_message", {...})
    │
    ▼  [tkinter after(100ms)]
CollectorApp._process_queue()
    │
    ├──► DashboardTab.update()
    ├──► DevicesTab.update()
    └──► LogsTab.append()
```