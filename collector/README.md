# 탄소이음 IoT Collector Service

현장 에너지 계측 장치에서 데이터를 수집해 탄소이음 SaaS 클라우드로 전송하는 **엣지 게이트웨이 서비스**입니다.

---

## 목차

1. [역할별 가이드라인](#역할별-가이드라인)
2. [배포/연동 전체 흐름](#배포연동-전체-흐름)
3. [최적 배포 전략 선택](#최적-배포-전략-선택)
4. [플랫폼 연동 상세](#플랫폼-연동-상세)
5. [지원 프로토콜](#지원-프로토콜)
6. [빠른 시작](#빠른-시작)
7. [주요 기능](#주요-기능)
8. [문서](#문서)
9. [시스템 요구사항](#시스템-요구사항)

---

## 역할별 가이드라인

수집기 도입에는 세 가지 역할이 관여합니다. 본인의 역할에 해당하는 섹션만 읽으셔도 됩니다.

---

### 관리자 (플랫폼 운영자 / 개발자)

> 탄소이음 플랫폼을 운영하고 고객사에 수집기를 배포하는 담당자

**해야 할 일:**

#### 1단계 — 게이트웨이 등록
```
탄소이음 플랫폼 로그인
→ 설정 > 게이트웨이 > 게이트웨이 등록
→ 이름, 시리얼 번호, 설치 사이트 입력 후 저장
→ Gateway ID 자동 발급 (예: gw_a1b2c3d4e5f6)
```

#### 2단계 — 수집기 설치 파일 발급
```
게이트웨이 목록에서 해당 게이트웨이 행의 ↓ 버튼 클릭
→ 수집기 다운로드 모달 팝업
→ 환경에 맞는 옵션 선택:
   - Windows (현장 PC) → config.yaml 다운로드
   - Docker (Linux 서버) → docker-compose.yml 다운로드
   - Linux 원클릭 → curl 명령어 복사
```

> 다운로드 파일에는 gateway_id와 인증 토큰이 자동으로 포함됩니다.  
> 설비 담당자에게 파일만 전달하면 별도 설정 없이 실행 가능합니다.

#### 3단계 — 센서 코드 등록
설비 담당자가 어떤 장치를 연결할지 확인 후, 플랫폼에서 센서를 미리 등록합니다.

```
설정 > 센서 > 센서 등록
→ 센서 코드 입력 (예: BLDG-A-METER-01-KWH)
→ 메트릭 키 입력 (예: energy_kwh)
→ 단위, 장치 연결 등 설정
```

> 센서 코드는 현장 담당자에게 공유해서 config.yaml의 sensor_code 값과 일치시켜야 합니다.

#### 관리자 체크리스트

- [ ] 플랫폼에 게이트웨이 등록 완료
- [ ] 게이트웨이별 수집기 설치 파일 발급
- [ ] 현장 장치에 대응하는 센서 코드 플랫폼에 등록
- [ ] 설비 담당자에게 설치 파일 + 센서 코드 목록 전달
- [ ] 설치 완료 후 대시보드에서 게이트웨이 온라인 상태 확인
- [ ] 데이터 수신 정상 여부 확인 (측정값 > 현황)

---

### 설비 담당자 / 현장 공사업자

> 현장에서 계측 장치를 설치하고 수집기를 연결하는 담당자

**필요한 것:** 관리자에게 받은 설치 파일 (config.yaml 또는 docker-compose.yml)

#### Windows 현장 PC 설치 (가장 흔한 환경)

**1단계 — 수집기 EXE 다운로드**

GitHub에서 최신 버전 다운로드:
```
https://github.com/tansoeum/collector/releases/latest
→ TansoEum-Collector.exe 다운로드
```

**2단계 — 파일 배치**
```
C:\Collector\
    ├── TansoEum-Collector.exe   ← 다운로드한 EXE
    └── config\
        └── config.yaml          ← 관리자에게 받은 파일
```

**3단계 — 장치 IP 설정**

config.yaml을 메모장으로 열어 현장 장치의 IP 주소를 입력합니다:
```yaml
devices:
  - id: "meter_01"
    name: "1층 전력계량기"
    protocol: "modbus_tcp"
    connection:
      host: "192.168.1.101"    # ← 계량기 IP 주소 입력
      port: 502                 # ← 보통 502 그대로
      unit_id: 1                # ← 장치 주소 (계량기 설정 확인)
    registers:
      - sensor_code: "BLDG-A-METER-01-KWH"   # ← 관리자에게 받은 코드
        metric_key: energy_kwh
        address: 40001           # ← 계량기 매뉴얼 참조
        data_type: float32
        unit: kWh
        scale: 0.001
```

**4단계 — 실행**
```
TansoEum-Collector.exe 더블클릭
→ GUI 화면 실행
→ ▶ 시작 버튼 클릭
→ 장치 탭에서 연결 상태 확인 (녹색 = 정상)
```

#### Linux / Raspberry Pi 설치

관리자에게 받은 원클릭 명령어를 터미널에 붙여넣기:
```bash
curl -sSL "https://platform.carbonieum.co.kr/api/gateways/gw_xxx/installer-config?type=linux" | bash
```
→ Docker 자동 설치 후 수집기 서비스 자동 시작

#### 현장 담당자가 꼭 확인해야 할 사항

**네트워크 연결 확인**
```
현장 PC/서버  ←→  계측 장치 (같은 LAN 필수)
현장 PC/서버  ←→  인터넷 (탄소이음 서버 전송용)
```

**방화벽/포트 확인표**

| 프로토콜 | 포트 | 방향 | 용도 |
|:--------:|:----:|:----:|:----:|
| Modbus TCP | 502 | 수집기 → 계량기 | 데이터 읽기 |
| MQTT | 1883 | 수집기 → 브로커 | 센서 데이터 수신 |
| OPC-UA | 4840 | 수집기 → PLC | 데이터 읽기 |
| HTTPS | 443 | 수집기 → 클라우드 | 데이터 전송 |

**장치 통신 설정 확인사항**
- Modbus TCP: 장치의 IP 주소, 포트(보통 502), Unit ID(장치 주소)
- Modbus RTU: COM 포트 번호, 통신 속도(Baudrate), Unit ID
- MQTT: 브로커 IP, 포트, 토픽 형식
- OPC-UA: 엔드포인트 URL (예: opc.tcp://192.168.1.200:4840)

#### 현장 담당자 체크리스트

- [ ] 수집기 PC/서버와 계측 장치가 같은 네트워크에 연결됨
- [ ] 수집기 PC/서버에서 인터넷 접속 가능 확인
- [ ] 각 계측 장치의 IP 주소 / 통신 설정 확인
- [ ] config.yaml에 장치 IP 및 레지스터 주소 입력 완료
- [ ] 수집기 실행 후 GUI 장치 탭에서 연결 상태 녹색 확인
- [ ] 관리자에게 설치 완료 통보 (게이트웨이 ID 전달)

---

## 배포/연동 전체 흐름

```
[관리자]                    [설비 담당자]              [탄소이음 플랫폼]
    │                            │                           │
    │ 1. 게이트웨이 등록          │                           │
    │──────────────────────────────────────────────────────►│
    │◄────────────────────────────────────────── gateway_id ─┤
    │                            │                           │
    │ 2. 설치 파일 발급 (↓ 버튼)  │                           │
    │──────────────────────────────────────────────────────►│
    │◄──────────── config.yaml / docker-compose.yml (토큰포함)┤
    │                            │                           │
    │ 3. 파일 + 센서코드 전달      │                           │
    │───────────────────────────►│                           │
    │                            │                           │
    │                 4. 장치 IP 설정 (config.yaml)           │
    │                            │                           │
    │                 5. 수집기 실행                          │
    │                            │                           │
    │                            │ 6. 데이터 자동 전송 시작    │
    │                            │──────────────────────────►│
    │                            │ 7. 하트비트 (30초마다)      │
    │                            │──────────────────────────►│
    │                            │                           │
    │ 8. 대시보드 확인             │                           │
    │──────────────────────────────────────────────────────►│
    │◄────────────────────────── 게이트웨이 온라인 + 측정값 ───┤
```

**연동 후 자동으로 되는 것:**
- 장치 연결 및 데이터 수집 (설정된 주기마다)
- 로컬 SQLite 버퍼에 저장 (오프라인 대비)
- 10초마다 클라우드 배치 전송
- 30초마다 하트비트 (온라인 상태 갱신)
- 연결 끊김 시 자동 재연결 (지수 백오프)
- 네트워크 복구 시 미전송 데이터 자동 재전송

**수동으로 설정해야 하는 것:**
- 게이트웨이 등록 (관리자, 1회)
- 장치 IP/통신 주소 입력 (현장 담당자, 장치당 1회)
- 센서 코드 매핑 (관리자, 장치당 1회)

---

## 최적 배포 전략 선택

현장 환경에 따라 아래 표를 참고해 배포 방식을 선택하세요.

| 환경 | 권장 방식 | 이유 |
|:----:|:--------:|:----:|
| 공장/빌딩 현장 PC (Windows) | **EXE + GUI** | 비개발자도 운용 가능, 시각적 모니터링 |
| 라즈베리파이 / 산업용 컴퓨터 | **Docker** | 무중단 서비스, 자동 재시작 |
| 클라우드 Linux 서버 | **Docker / systemd** | 원격 관리, 로그 중앙화 |
| 다수 현장 일괄 배포 | **Linux 원클릭 스크립트** | curl 한 줄로 완료 |
| 개발 / 테스트 | **Python 직접 실행** | 빠른 설정 변경 가능 |

### 전략 A — Windows EXE (현장 PC, 권장)

```
장점: 설치 쉬움, GUI로 실시간 상태 확인, 비개발자 운용 가능
단점: Windows 전용, PC가 꺼지면 수집 중단
적합: 공장 관제실 PC, 항상 켜져 있는 현장 단말기
```

```
배포 절차:
① 플랫폼에서 config.yaml 다운로드
② GitHub Releases에서 TansoEum-Collector.exe 다운로드
③ 같은 폴더에 배치 → 실행
소요시간: 5분
```

### 전략 B — Docker (Linux 서버, 권장)

```
장점: 서버 재시작 후 자동 복구, OS 독립적, 원격 관리 용이
단점: Docker 기본 지식 필요
적합: 상시 가동 서버, Raspberry Pi, 산업용 엣지 게이트웨이
```

```
배포 절차:
① 플랫폼에서 docker-compose.yml 다운로드
② 서버에 업로드
③ docker compose up -d
소요시간: 10분 (Docker 미설치 시 추가 5분)
```

### 전략 C — Linux 원클릭 (가장 빠름)

```
장점: 명령어 한 줄, Docker 자동 설치, 완전 자동화
단점: 인터넷 연결 필수
적합: 원격지 서버, 다수 현장 일괄 배포
```

```
배포 절차:
① 플랫폼 다운로드 모달에서 명령어 복사
② 서버 터미널에 붙여넣기 → Enter
소요시간: 3분
```

---

## 플랫폼 연동 상세

### 인증 방식

수집기는 두 가지 방법으로 플랫폼에 인증합니다.

| 방법 | 헤더 | 발급 위치 |
|:----:|:----:|:--------:|
| Bearer API Key | `Authorization: Bearer sk_collector_xxx` | 플랫폼 > 설정 > API 키 |
| Gateway Token | `X-Gateway-Token: {serial}` | 게이트웨이 시리얼 번호 |

> 플랫폼의 "수집기 다운로드" 기능을 사용하면 API 키가 자동 발급되어 config.yaml에 삽입됩니다.

### API 엔드포인트

| 메서드 | 경로 | 용도 | 호출 주기 |
|:------:|:----:|:----:|:--------:|
| POST | `/api/gateways/{id}/data` | 수집 데이터 전송 | 10초 (배치) |
| POST | `/api/gateways/{id}/heartbeat` | 온라인 상태 갱신 | 30초 |
| GET  | `/api/gateways/{id}` | OTA 설정 조회 | 수동/이벤트 |

### 데이터 전송 페이로드 형식

```json
{
  "timestamp": "2026-04-16T12:00:00Z",
  "readings": [
    {
      "sensorId": "BLDG-A-METER-01-KWH",
      "metricKey": "energy_kwh",
      "value": 1234.56,
      "quality": "good",
      "unit": "kWh",
      "timestamp": "2026-04-16T12:00:00Z"
    }
  ],
  "meta": {
    "protocol": "modbus_tcp",
    "bufferCount": 0,
    "firmwareVersion": "1.0.0"
  }
}
```

### 센서 코드 매핑 규칙

config.yaml의 `sensor_code`는 **플랫폼에 등록된 센서의 code 값과 정확히 일치**해야 합니다.

```
플랫폼 센서 등록:
  코드(code):       BLDG-A-METER-01-KWH
  메트릭 키:        energy_kwh

config.yaml:
  sensor_code:    "BLDG-A-METER-01-KWH"   ← 동일해야 함
  metric_key:     energy_kwh               ← 동일해야 함
```

불일치 시 서버 응답의 `unknownSensors` 배열에 해당 코드가 표시되며 데이터가 저장되지 않습니다.  
수집기 로그에서 확인: `[WARN] 알 수 없는 센서: BLDG-A-METER-01-KWH`

**권장 센서 코드 명명 규칙:**

```
{건물/현장코드}-{층/구역}-{장치유형}-{번호}-{측정항목}

예시:
  BLDG-A-1F-ELEC-01-KWH     건물A 1층 전력계량기 01번 - 전력량
  FACTORY-LINE1-MOTOR-02-PW  공장 라인1 모터 02번 - 전력
  PLANT-BOILER-01-TEMP       설비 보일러 01번 - 온도
```

---

## 지원 프로토콜

| 프로토콜 | 방식 | 주요 장치 | 필요 정보 |
|:--------:|:----:|:--------:|:--------:|
| Modbus TCP | Poll | 스마트 미터, 인버터, PLC | IP, 포트(502), Unit ID |
| Modbus RTU | Poll | RS-485 시리얼 장치 | COM 포트, Baudrate, Unit ID |
| MQTT | Push | IoT 센서, 스마트 게이트웨이 | 브로커 IP, 포트(1883), 토픽 |
| HTTP/REST | Poll | API 제공 장치, 웹훅 | URL, API 키 |
| OPC-UA | Poll | SCADA, PLC, 스마트 인버터 | 엔드포인트 URL |

---

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

# 6. 상태 확인
python -m src.main --status
```

---

## 주요 기능

- **오프라인 내성**: SQLite 로컬 버퍼 (최대 72시간 × 500K 레코드)  
  → 인터넷 단절 시에도 데이터 수집 계속, 복구 후 자동 전송
- **자동 재연결**: 지수 백오프로 장치 연결 자동 복구 (최대 5분 간격)
- **무중단 장치 추가**: 런타임 hot-swap (엔진 재시작 불필요)
- **OTA 설정**: 클라우드에서 원격으로 장치 설정 갱신
- **현장 GUI**: ttkbootstrap dark 테마 운용자 인터페이스
- **플러그인 아키텍처**: `@DriverRegistry.register("protocol")` 한 줄로 새 프로토콜 추가

---

## 문서

| 문서 | 내용 |
|:----:|:----:|
| [ARCHITECTURE.md](ARCHITECTURE.md) | 시스템 구조 및 데이터 흐름 다이어그램 |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Windows EXE / Docker / systemd 상세 배포 가이드, 장애복구, 성능튜닝 |
| [config/config.example.yaml](config/config.example.yaml) | 전체 설정 예시 (Modbus/MQTT/HTTP/OPC-UA) |

---

## 시스템 요구사항

| 항목 | 최소 | 권장 |
|:----:|:----:|:----:|
| Python | 3.10 | 3.11 이상 |
| OS | Windows 10, Ubuntu 20.04, Raspberry Pi OS 64bit | Windows 11, Ubuntu 22.04 |
| RAM | 64MB | 256MB |
| 디스크 | 100MB (버퍼 DB) | 1GB |
| 네트워크 | 계측 장치 LAN + 인터넷 | 유선 권장 |

---

## 자주 묻는 질문 (FAQ)

**Q. 인터넷이 끊기면 데이터가 사라지나요?**  
A. 아닙니다. 로컬 SQLite 버퍼에 최대 72시간치 데이터를 보관합니다. 인터넷 복구 후 자동으로 전송됩니다.

**Q. 계량기 IP가 바뀌면 어떻게 하나요?**  
A. config.yaml의 `connection.host` 값을 변경 후 수집기를 재시작합니다. GUI 모드라면 설정 탭에서 저장하면 됩니다.

**Q. 여러 대의 계량기를 연결할 수 있나요?**  
A. 가능합니다. config.yaml의 `devices` 목록에 장치를 추가하면 됩니다. 기본 최대 20개 동시 폴링 (설정으로 확장 가능).

**Q. 수집기와 계량기가 다른 네트워크에 있어도 되나요?**  
A. Modbus TCP는 같은 LAN이어야 합니다. VPN으로 연결된 경우도 가능합니다. MQTT/HTTP는 인터넷을 통한 원격 연결도 가능합니다.

**Q. 수집기 PC가 재부팅되면 자동으로 시작되나요?**  
A. Windows: 시작 프로그램에 등록하거나 NSSM으로 서비스 등록. Docker: `restart: unless-stopped` 설정으로 자동 재시작.

**Q. 로그는 어디서 확인하나요?**  
A. GUI 모드: 로그 탭에서 실시간 확인. 헤드리스 모드: `logs/collector.log` 파일. Docker: `docker compose logs -f collector`.