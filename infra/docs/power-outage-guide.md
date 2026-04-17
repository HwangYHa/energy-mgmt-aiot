# 정전 및 순간정전 대비/대응 가이드

## 개요

EMS AIoT 시스템의 두 계층(클라우드 서버 / 현장 수집기 PC)에 대한 정전 대응 전략입니다.

---

## 1. 클라우드 서버 (NCP)

### 현황 (이미 적용됨)
| 항목 | 상태 |
|------|------|
| 모든 컨테이너 `restart: always` | ✅ docker-compose.prod.yml 적용됨 |
| Docker 데몬 자동 시작 | ✅ NCP 서버 기본 설정 |
| NCP 데이터센터 UPS | ✅ IDC 인프라 보장 (SLA 99.9%+) |

### 추가 설치 (신규)

#### 부팅 복구 서비스
```bash
# 서버에서 실행
sudo mkdir -p /opt/ems-aiot
sudo cp infra/scripts/startup-recovery.sh /opt/ems-aiot/infra/scripts/
sudo chmod +x /opt/ems-aiot/infra/scripts/startup-recovery.sh

sudo cp infra/systemd/ems-recovery.service /etc/systemd/system/
sudo cp infra/systemd/docker-compose-ems.service /etc/systemd/system/

sudo systemctl daemon-reload
sudo systemctl enable ems-recovery.service
sudo systemctl enable docker-compose-ems.service
```

#### 알림 설정 (선택)
`/opt/ems-aiot/.env.recovery` 파일 생성:
```bash
# Slack Webhook (복구 완료 알림)
SLACK_WEBHOOK=https://hooks.slack.com/services/xxx/yyy/zzz

# MySQL root 비밀번호 (헬스체크용)
MYSQL_ROOT_PASSWORD=your_root_password
```

### NCP 서버 보호 권장사항
1. **스냅샷 정책**: 매일 1회 자동 스냅샷 (NCP 콘솔 → Server → Snapshot 설정)
2. **모니터링 알림**: NCP Monitoring → CPU 90% / Memory 90% 알림 설정
3. **오브젝트 스토리지 백업**: 시스템 설정 페이지에서 NCP 버킷 연결

---

## 2. 현장 수집기 PC

### 2-1. Windows PC

#### NSSM 서비스 설치
```batch
# 관리자 권한 명령프롬프트에서:
cd C:\EmsCollector
scripts\install-service-windows.bat
```

**효과**: PC 전원 ON → Windows 부팅 → EmsCollector 서비스 자동 시작

#### 추가 Windows 설정
1. **빠른 시작 비활성화**: 제어판 → 전원 옵션 → "빠른 시작 사용" 해제
   - 이유: 하이버네이션 재개 시 드라이버/네트워크 불안정 방지
2. **BIOS 전원 복구 설정**: BIOS → Power Management → "AC Power Loss" → **Last State** 또는 **Power On**
   - 이유: 정전 후 전력 복구 시 PC 자동 켜짐
3. **자동 로그인 (선택)**: `netplwiz` → "암호 입력 필요" 해제 → 도메인 비가입 PC에서만 권장

### 2-2. Linux/라즈베리파이 PC

```bash
sudo bash collector/scripts/install-service-linux.sh
```

#### BIOS 자동 전원 복구
- AMI BIOS: Advanced → ACPI Settings → **Restore AC Power Loss** → **Last State**
- Raspberry Pi: EEPROM 설정 `POWER_OFF_ON_HALT=0`

---

## 3. UPS (무정전 전원장치) 권장사항

### 서버 — NCP IDC
- NCP 데이터센터가 UPS + 발전기 이중 운영 → 별도 조치 불필요

### 현장 수집기 PC

| 등급 | 제품 예시 | 용량 | 백업 시간 | 권장 환경 |
|------|---------|------|---------|---------|
| 기본 | APC Back-UPS BX700U | 700VA | PC 1대 기준 15~20분 | 소규모 현장 |
| 표준 | APC Smart-UPS SMT1500 | 1500VA | 30~45분 | 중형 공장 |
| 고급 | Eaton 5PX 2200 | 2200VA | 60분+ | 게이트웨이+스위치 통합 |

#### UPS 선정 기준
- 수집기 PC 소비전력 × 1.5 배 이상
- 최소 **15분** 백업 보장 (전력 복구 또는 정상 종료 시간)
- USB/RS-232 통신 포트 — 소프트웨어 감지 및 자동 종료

#### UPS 소프트웨어 연동 (NUT / apcupsd)

**Linux:**
```bash
# apcupsd 설치
sudo apt install apcupsd

# /etc/apcupsd/apcupsd.conf 수정
DEVICE /dev/usb/hiddev0
UPSTYPE usb
BATTERYLEVEL 20      # 배터리 20% 이하 시 종료
MINUTES 5            # 5분 이하 잔량 시 종료
KILLDELAY 0
```

**Windows:** APC PowerChute Personal Edition 설치 (APC UPS에 포함)

---

## 4. 순간정전(전압 강하) 대응

### 문제
- 100ms~1초 미만 순간정전 → UPS는 대응하나 컨테이너/프로세스 상태 불안정 가능

### 대응 방법
1. **MySQL InnoDB 이중 쓰기 버퍼**: 이미 기본 활성화 — 데이터 손상 방지
2. **Redis AOF 영속성**: `appendonly yes` + `appendfsync everysec` (docker-compose.prod.yml 확인)
3. **수집기 로컬 버퍼링**: OTA 캐시 파일(`ota_cache.json`)은 atomic write 사용 — 손상 없음
4. **측정 데이터 재전송**: 수집기는 MQTT QoS 1 사용 → 재연결 시 미전송 메시지 재발행

---

## 5. 복구 시나리오별 흐름

### 시나리오 A: NCP 서버 재부팅
```
전력 복구
  → Docker 데몬 자동 시작 (systemd)
  → ems-recovery.service 실행
  → docker-compose up -d
  → 헬스체크 통과 (최대 5분)
  → Slack 복구 완료 알림
```

### 시나리오 B: 수집기 PC 재부팅 (Windows)
```
전원 버튼 누름 (또는 AC 복구 후 BIOS 자동 켜짐)
  → Windows 자동 로그인
  → EmsCollector 서비스 자동 시작 (NSSM)
  → OTA 3-tier 폴백으로 디바이스 설정 복원
    ① 플랫폼 API 연결 성공 → 최신 설정 수신
    ② 오프라인 → ota_cache.json 복원
    ③ 캐시 없음 → config.yaml 사용
  → MQTT 수집 재개
```

### 시나리오 C: 수집기 PC 재부팅 (Linux)
```
AC 복구
  → Linux 부팅
  → network-online.target 도달
  → ems-collector.service 자동 시작
  → OTA 설정 복원 → 수집 재개
```

---

## 6. 모니터링 및 알림

### EMS 대시보드 게이트웨이 오프라인 감지
- `/api/cron/check-alerts` — 30분 이상 heartbeat 없으면 알림 발송
- 알림 수신: 이메일 / SMS (시스템 설정 → 알림 규칙)

### 권장 알림 규칙 설정
| 트리거 | 채널 | 임계값 |
|--------|------|--------|
| 게이트웨이 오프라인 | 이메일 + SMS | 30분 |
| 서버 복구 완료 | Slack | 즉시 |
| MySQL 디스크 90% | 이메일 | 즉시 |
