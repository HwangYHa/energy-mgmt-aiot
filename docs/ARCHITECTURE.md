# 탄소이음 EMS AIoT — 프로덕션 아키텍처

> 멀티 테넌트 에너지 관리 SaaS 시스템 아키텍처 가이드

---

## 1. 시스템 아키텍처 다이어그램

```
인터넷
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│  CDN (Cloudflare / AWS CloudFront)                      │
│  - 정적 파일 캐싱 (_next/static, images, fonts)          │
│  - DDoS 방어 / WAF                                      │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  Nginx 리버스 프록시 (443 SSL + 80→443 리다이렉트)        │
│  - TLS 종료 (Let's Encrypt)                             │
│  - 로드밸런싱 (Least Connection)                         │
│  - Rate Limiting (Auth: 10rpm, API: 60rpm)              │
│  - Brotli / Gzip 압축                                   │
└──────────┬──────────────────────┬───────────────────────┘
           │                      │
     ┌─────▼──────┐        ┌──────▼─────┐
     │  app1:3000 │        │  app2:3000 │   ← Next.js 15
     │  (Node 22) │        │  (Node 22) │     App Router
     └─────┬──────┘        └──────┬─────┘
           └────────┬─────────────┘
                    │
         ┌──────────▼──────────┐
         │   ai-engine:8001    │   ← FastAPI (Python 3.11)
         │   이상감지/예측/최적화│
         └──────────┬──────────┘
                    │
     ┌──────────────┴──────────────────┐
     │                                 │
┌────▼────┐  ┌──────────┐  ┌──────────▼──┐
│ MySQL   │  │  Redis   │  │ Mosquitto   │
│  8.0    │  │   7.x    │  │ MQTT 2.x    │
│ (멀티   │  │ (캐시/   │  │ (IoT 실시간 │
│  테넌트)│  │  세션)   │  │  데이터)    │
└─────────┘  └──────────┘  └─────────────┘
                                   │
                         ┌─────────▼──────────┐
                         │  IoT 게이트웨이      │
                         │  (각 사이트 현장)   │
                         │  → 센서 데이터      │
                         │  → 제어 명령        │
                         └────────────────────┘

모니터링 스택:
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Prometheus  │→ │   Grafana    │  │  Alertmanager│
│  (메트릭 수집)│  │  (대시보드)  │  │  (알람 발송) │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## 2. 서버 스펙 (권장)

### 소규모 (테넌트 ~50, 센서 ~500)
| 용도 | 사양 | 수량 |
|------|------|------|
| 앱 서버 (Next.js + Nginx) | 4 vCPU / 8GB RAM / SSD 100GB | 1대 |
| DB 서버 (MySQL) | 4 vCPU / 16GB RAM / SSD 200GB | 1대 |
| AI 엔진 | 2 vCPU / 4GB RAM / SSD 50GB | 1대 |

### 중규모 (테넌트 ~500, 센서 ~5,000)
| 용도 | 사양 | 수량 |
|------|------|------|
| Nginx (로드밸런서) | 2 vCPU / 4GB RAM | 1대 |
| 앱 서버 (Next.js) | 4 vCPU / 8GB RAM | 2대 |
| AI 엔진 | 4 vCPU / 8GB RAM | 1대 |
| DB 서버 (MySQL Primary) | 8 vCPU / 32GB RAM / NVMe 500GB | 1대 |
| DB 서버 (MySQL Replica) | 8 vCPU / 32GB RAM / NVMe 500GB | 1대 |
| Redis | 2 vCPU / 8GB RAM | 1대 |
| MQTT | 2 vCPU / 4GB RAM | 1대 |

### 대규모 (테넌트 1,000+)
- Kubernetes 클러스터 전환
- HPA (Horizontal Pod Autoscaler) 적용
- MySQL → AWS RDS Aurora (Multi-AZ)
- Redis → ElastiCache Cluster Mode
- MQTT → AWS IoT Core

---

## 3. 폴더 구조

```
energy-mgmt-aiot/
├── app/                         # Next.js 15 App Router
│   ├── (auth)/                  # 인증 페이지 (로그인, 회원가입)
│   ├── (public)/                # 퍼블릭 페이지 (데모, 마케팅)
│   ├── (tenant)/                # 인증 필요 앱 페이지
│   │   ├── admin/               # 관리자 (메뉴/사용자/테넌트/보안)
│   │   ├── analytics/           # 에너지/탄소/비용 분석
│   │   ├── control/             # 수동/스케줄/DR/최적화 제어
│   │   ├── dashboard/           # 대시보드
│   │   ├── monitoring/          # 실시간 모니터링
│   │   └── ...
│   ├── api/                     # API Routes
│   │   ├── auth/                # NextAuth + 커스텀 JWT
│   │   ├── health/              # 헬스 체크
│   │   ├── security/            # 보안 이벤트
│   │   └── ...
│   └── layout.tsx               # 루트 레이아웃 (JSON-LD, SEO)
│
├── lib/
│   ├── auth/                    # 인증 (session.ts, verify.ts, permissions.ts)
│   ├── db/                      # Prisma 클라이언트
│   ├── domains/                 # DDD 도메인 레이어
│   │   ├── carbon/              # 탄소 배출 (Big4 감사 대응)
│   │   ├── carbon-trading/      # 탄소 거래 (VCM, 블록체인, XBRL)
│   │   └── esg-report/          # ESG 보고서 (TCFD, CSRD, SEC)
│   ├── services/                # 애플리케이션 서비스
│   └── middleware/              # Plan Limit 등
│
├── components/                  # React 컴포넌트
├── prisma/                      # Prisma 스키마 + 마이그레이션
├── ai-engine/                   # FastAPI Python 서비스
│
├── infra/                       # 인프라 설정
│   ├── mysql/                   # MySQL 설정 + 초기화 SQL
│   ├── mosquitto/               # MQTT 브로커 설정
│   ├── nginx/                   # Nginx 리버스 프록시
│   ├── prometheus/              # 메트릭 수집
│   └── grafana/                 # 대시보드 + 데이터소스
│
├── scripts/                     # 운영 스크립트
│   ├── backup.sh                # MySQL 백업 (cron용)
│   └── prisma-migrate-prod.sh   # 프로덕션 마이그레이션
│
├── .github/workflows/           # CI/CD
│   ├── ci.yml                   # 타입체크 + 린트 + 테스트
│   └── deploy.yml               # 프로덕션 배포
│
├── Dockerfile                   # Next.js 멀티스테이지 빌드
├── docker-compose.yml           # 전체 스택 (개발/스테이징)
└── docker-compose.prod.yml      # 프로덕션 오버라이드
```

---

## 4. MQTT 토픽 설계

```
ems/<tenantId>/<siteId>/<gatewayId>/<topic>

데이터 발행 (게이트웨이 → 서버):
  ems/{tenant}/{site}/{gw}/data/energy     # 에너지 측정값
  ems/{tenant}/{site}/{gw}/data/sensors    # 센서 상태
  ems/{tenant}/{site}/{gw}/status          # 게이트웨이 상태 (LWT)

명령 수신 (서버 → 게이트웨이):
  ems/{tenant}/{site}/{gw}/command/relay   # 릴레이 제어
  ems/{tenant}/{site}/{gw}/command/config  # 설정 변경

시스템:
  $SYS/broker/clients/connected            # 연결 수 (모니터링)
  $SYS/broker/messages/received           # 수신 메시지 수
```

**데이터 형식 (JSON):**
```json
{
  "ts": "2026-03-14T10:00:00.000Z",
  "gatewayId": "gw_abc123",
  "measurements": [
    { "sensorId": "s001", "type": "active_power", "value": 1250.5, "unit": "W" },
    { "sensorId": "s001", "type": "voltage", "value": 220.1, "unit": "V" }
  ]
}
```

---

## 5. Prisma 마이그레이션 전략

### 개발 환경
```bash
# 스키마 변경 후
npx prisma migrate dev --name describe_change
npx prisma generate
```

### 프로덕션 배포
```bash
# 1. 백업 (필수)
bash scripts/backup.sh

# 2. 마이그레이션 배포 (reset 없음, 기존 데이터 보존)
npx prisma migrate deploy

# 3. 클라이언트 재생성
npx prisma generate
```

### 위험한 마이그레이션 처리 (컬럼 삭제 등)
1. 단계적 전개: Feature Flag으로 신 컬럼 활성화 → 구 컬럼 유지 → 검증 후 구 컬럼 삭제
2. Expand-Contract 패턴 적용
3. 롤백 SQL 사전 준비

### Windows 개발 환경 주의사항
```bash
# EPERM: dev 서버 실행 중 prisma generate 실패 시
# → 개발 서버 종료 후 실행
taskkill /F /IM node.exe
npx prisma generate
# → 서버 재시작
```

---

## 6. 스케일링 전략

### 수평 확장 (Horizontal Scaling)
```yaml
# docker-compose.yml에서 인스턴스 수 조정
docker compose up -d --scale app=4
```

### 데이터베이스 스케일링
- Read Replica: 분석/리포트 쿼리 분산
- Connection Pool: `DATABASE_URL` + `?connection_limit=10`
- 파티셔닝: `measurement` 테이블 → 월별 파티션

### MQTT 클러스터링
- Mosquitto 브리지 설정으로 다중 브로커 연결
- 또는 AWS IoT Core / HiveMQ 전환

### Redis 확장
- Cluster Mode: 데이터 샤딩
- ElastiCache: 관리형 서비스 전환

---

## 7. 보안 체크리스트

### 네트워크
- [ ] Nginx WAF 활성화 (ModSecurity 또는 Cloudflare)
- [ ] 방화벽: 80/443만 퍼블릭 오픈, DB/Redis/MQTT는 내부망
- [ ] MQTT TLS 적용 (8883 포트)

### 애플리케이션
- [ ] NEXTAUTH_SECRET 32자 이상
- [ ] CSRF 토큰 미들웨어 활성화
- [ ] Rate Limiting (Auth: 10rpm, API: 60rpm)
- [ ] Content-Security-Policy 헤더
- [ ] IP 브루트포스 차단 (5회 실패 → 30분 잠금)

### 데이터
- [ ] 암호화: bcrypt (cost=12) 비밀번호 해싱
- [ ] 암호화: TLS 전송 암호화
- [ ] 암호화: 민감 정보 DB 컬럼 암호화 (선택)
- [ ] 백업: 일 1회 + S3 업로드 + 30일 보존
- [ ] 감사 로그: AuditLog 테이블 append-only

### 운영
- [ ] 시크릿 로테이션: 3~6개월 주기
- [ ] 의존성 취약점 스캔: `pnpm audit`
- [ ] 컨테이너 이미지 스캔: Trivy

---

## 8. 모니터링 대시보드 (Grafana)

**주요 메트릭:**
| 패널 | 메트릭 | 임계값 |
|------|--------|--------|
| API 응답 시간 | p95 latency | > 1000ms → 알람 |
| 에러율 | 5xx / 전체 | > 1% → 알람 |
| DB 연결 수 | MySQL connections | > 150 → 알람 |
| 메모리 사용 | Node.js heap | > 80% → 알람 |
| CPU | 컨테이너 CPU | > 80% → 알람 |
| MQTT 연결 | 게이트웨이 수 | < 예상값 → 알람 |

**대시보드 URL:** `http://your-server:3001`
- 기본 계정: `admin` / `GRAFANA_PASSWORD` 환경변수

---

## 9. 배포 체크리스트

### 최초 배포
```bash
# 1. .env.production 준비
cp .env.example .env.production
# → 모든 값 채우기

# 2. 인프라 시작
docker compose up -d mysql redis mqtt

# 3. DB 초기화
docker compose run --rm app1 npx prisma migrate deploy
docker compose run --rm app1 npx prisma db seed

# 4. 전체 스택 시작
docker compose up -d

# 5. 헬스 체크
curl https://carboneum.kr/api/health
```

### 일반 업데이트
```bash
# GitHub Actions CD 자동 실행 (main 브랜치 push 시)
git push origin main
# → build-push → DB migration → Rolling restart → Health check
```

### 롤백
```bash
# 이전 이미지 태그로 되돌리기
docker compose up -d --no-deps app1 app2
# (docker-compose.override.yml에서 이미지 태그 이전 버전으로 변경)
```
