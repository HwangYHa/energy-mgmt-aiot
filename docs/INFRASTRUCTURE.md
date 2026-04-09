# 인프라 & 서버 선정 가이드

> 탄소이음 (EMS AIoT) — 저예산 고가성비 배포 전략
> 작성일: 2026-03-24

---

## 1. 서비스 요구사항 분석

| 항목 | 내용 |
|------|------|
| 프레임워크 | Next.js 15 (App Router, SSR + API Routes) |
| DB | MySQL 8.0 (Prisma ORM) |
| MQTT | Mosquitto 브로커 (IoT 디바이스 연결) |
| 인증 | NextAuth.js (Google OAuth + 커스텀 JWT) |
| 대상 | 한국 B2B SaaS (에너지 관리, 탄소중립) |
| 파일 저장 | PDF/Excel 보고서 (서버 임시 생성 → 다운로드) |

---

## 2. 서버 옵션 비교 (저예산 기준)

### ✅ 최종 추천: Hetzner Cloud + Vercel 하이브리드

---

### Option A — Vercel + Railway (완전 관리형, 입문 최적)

| 서비스 | 역할 | 비용 |
|-------|------|------|
| **Vercel Pro** | Next.js 앱 호스팅 | $20/월 |
| **Railway Starter** | MySQL + MQTT 브로커 | $5~15/월 |
| **합계** | | **약 $25~35/월 (₩35,000~50,000)** |

**장점:**
- 코드 push만 하면 자동 배포 (GitHub 연동)
- 별도 서버 관리 불필요 (OS 업데이트, 방화벽 등)
- Vercel Analytics + Logs 무료 제공
- 글로벌 CDN 자동 적용

**단점:**
- MQTT 브로커 장기 운영 시 Railway 비용 증가
- Vercel 서버리스 함수는 최대 실행시간 300초 제한 (배치 작업 주의)
- 한국 서버 없음 (미국/유럽) — 응답 속도 약 150~200ms

**적합한 시기:** 초기 MVP, 고객 수 < 50개사

---

### Option B — Hetzner Cloud VPS + Coolify (저예산 자체 관리)

| 서버 | 스펙 | 비용 |
|------|------|------|
| **Hetzner CX21** | 2vCPU / 4GB RAM / 40GB SSD | €5.77/월 (₩8,500) |
| **Hetzner CX31** (권장) | 2vCPU / 8GB RAM / 80GB SSD | €10.59/월 (₩15,000) |
| **Hetzner CCX13** (고성능) | 2vCPU(전용) / 8GB RAM / 80GB SSD | €21.67/월 (₩31,000) |

**데이터센터 위치:** Falkenstein(독일) / Helsinki(핀란드) — 서울까지 약 280~320ms
→ **응답 속도 개선 필요 시** ap-northeast-2(서울) 리전 없으므로 Cloudflare CDN 앞에 배치

**Coolify 자동화 (무료 오픈소스):**
```
GitHub Push → Coolify Webhook → Docker Build → 무중단 배포 (Rollback 지원)
```

설치 구성:
- Docker + Coolify (자체 PaaS)
- MySQL 8.0 컨테이너
- Mosquitto MQTT 컨테이너
- Nginx 리버스 프록시 + Let's Encrypt SSL

**합계: €10.59/월 (₩15,000) — 서버 1대로 전부 운영 가능**

**장점:**
- 업계 최고 가성비 (AWS 대비 1/5 비용)
- CPU/RAM/디스크 100% 독점 사용
- 데이터 국내 반출 불필요 (EU GDPR 준수 지역)
- Coolify로 Vercel급 자동 배포 경험

**단점:**
- 초기 서버 설정 필요 (1~2시간)
- 서버 장애 시 직접 대응 (→ Hetzner 99.9% SLA)
- 한국 리전 없음 (→ Cloudflare 무료 플랜으로 캐싱 보완)

**적합한 시기:** 고객 수 10~200개사, 월 예산 ₩30,000 이하

---

### Option C — NHN Cloud / Naver Cloud (한국 클라우드)

| 서비스 | 스펙 | 비용 |
|-------|------|------|
| NHN Cloud c2.c1m2 | 1vCPU / 2GB | ₩20,000/월 |
| Naver Cloud Micro | 1vCPU / 1GB | ₩11,000/월 |
| NHN Cloud DB for MySQL | 관리형 MySQL | ₩70,000~/월 |

**장점:**
- 국내 IDC (서울 응답 속도 <10ms)
- 한국어 고객지원
- 국내 데이터 보관 (의료/금융 규제 대응 시 필수)
- 카카오/네이버 API 연동 친화적

**단점:**
- Hetzner 대비 2~5배 비용
- 관리형 MySQL은 매우 고가
- 자동화 생태계가 AWS/GCP 대비 빈약

**적합한 시기:** 공공기관/대기업 납품, 데이터 국내 저장 의무 발생 시

---

## 3. 최종 권장 아키텍처

### 단계별 서버 전략

```
[Phase 1 — MVP ~ 50개사]          [Phase 2 — 50~200개사]        [Phase 3 — 200개사+]
Vercel (Next.js)              →   Hetzner CX31 + Coolify    →   멀티 리전 (Hetzner + 국내)
Railway (MySQL + MQTT)            MySQL 8.0 (자체 관리)          MySQL RDS (관리형)
비용: ₩35,000/월                  비용: ₩15,000/월               비용: ₩200,000~/월
```

### Phase 1 권장 구성 (현재)

```
┌────────────────────────────────────────────────────────┐
│                   Vercel (Next.js)                     │
│  - 자동 SSL, CDN, CI/CD                                │
│  - GitHub push → 자동 배포                             │
└──────────────────┬─────────────────────────────────────┘
                   │
        ┌──────────▼──────────┐
        │   Railway.app       │
        │  ┌──────────────┐   │
        │  │  MySQL 8.0   │   │
        │  └──────────────┘   │
        │  ┌──────────────┐   │
        │  │  Mosquitto   │   │
        │  │  MQTT 브로커  │   │
        │  └──────────────┘   │
        └─────────────────────┘
```

---

## 4. Vercel + Railway 배포 설정

### 4-1. Vercel 설정

```bash
# 1. Vercel CLI 설치
npm install -g vercel

# 2. 로그인 및 프로젝트 연결
vercel login
vercel link

# 3. 프로덕션 배포
vercel --prod
```

**vercel.json** (루트에 생성):
```json
{
  "framework": "nextjs",
  "crons": [
    { "path": "/api/cron/churn-score", "schedule": "0 2 * * *" },
    { "path": "/api/cron/check-alerts", "schedule": "*/30 * * * *" }
  ]
}
```

**Vercel 환경변수 설정 (Dashboard > Settings > Environment Variables):**
```
DATABASE_URL          = mysql://user:pass@railway-host/dbname
NEXTAUTH_SECRET       = (32자 이상 랜덤 문자열)
NEXTAUTH_URL          = https://your-domain.com
GOOGLE_CLIENT_ID      = ...
GOOGLE_CLIENT_SECRET  = ...
MQTT_BROKER_URL       = mqtt://railway-mqtt-host:1883
CRON_SECRET           = (랜덤 문자열)
```

### 4-2. Railway 설정

1. [railway.app](https://railway.app) 접속 → New Project
2. **Add MySQL** → 자동 `DATABASE_URL` 생성
3. **Add Service → Docker Image** → `eclipse-mosquitto:2` (MQTT)
4. Mosquitto 환경변수:
   ```
   MOSQUITTO_CONFIG=listener 1883\nallow_anonymous true
   ```
5. MySQL `DATABASE_URL`을 Vercel 환경변수에 붙여넣기

### 4-3. GitHub Actions 자동 배포 (선택)

`.github/workflows/deploy.yml`:
```yaml
name: Deploy to Vercel
on:
  push:
    branches: [master]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install -g vercel
      - run: vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
      - run: vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
      - run: |
          DATABASE_URL=${{ secrets.DATABASE_URL }} \
          npx prisma migrate deploy
      - run: vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
```

GitHub Secrets 등록:
- `VERCEL_TOKEN` — Vercel Account Settings > Tokens
- `DATABASE_URL` — Railway MySQL URL
- `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` — `vercel link` 후 `.vercel/project.json` 확인

---

## 5. Hetzner + Coolify 배포 설정 (Phase 2)

### 5-1. Hetzner 서버 생성

1. [hetzner.com/cloud](https://www.hetzner.com/cloud) → New Server
2. 설정:
   - Location: **Falkenstein** 또는 **Helsinki**
   - Image: **Ubuntu 22.04 LTS**
   - Type: **CX31** (2vCPU / 8GB / 80GB)
   - Networking: IPv4 + IPv6 (방화벽: 22, 80, 443, 1883 포트)
3. SSH Key 등록 → 서버 생성

### 5-2. Coolify 설치

```bash
# SSH 접속
ssh root@your-hetzner-ip

# Coolify 원클릭 설치
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash

# 설치 완료 후 브라우저에서 접속
# http://your-hetzner-ip:8000
```

### 5-3. Coolify에서 Next.js 앱 등록

1. Coolify 대시보드 → New Project → Add Application
2. Source: **GitHub Repository** 연결
3. Build Pack: **Nixpacks** (자동 감지) 또는 **Dockerfile**
4. 환경변수 입력 (DATABASE_URL, NEXTAUTH_SECRET 등)
5. Branch: `master` → Save → Deploy

이후 GitHub push 시 자동 빌드 + 무중단 배포.

### 5-4. MySQL + MQTT 컨테이너

```bash
# Coolify → Add Service → MySQL 8.0
# Coolify → Add Service → Docker Image: eclipse-mosquitto:2
```

---

## 6. 도메인 & SSL 설정

### 도메인 구매 (hosting.kr)

1. [hosting.kr](https://www.hosting.kr) → 도메인 검색
2. 추천 도메인: `carbonieum.com` 또는 `탄소이음.kr`
3. 구매 후 **네임서버 변경**:
   - Vercel 사용 시: Vercel DNS로 변경 (Dashboard > Domains)
   - Hetzner 사용 시: Cloudflare DNS로 변경 (무료 CDN + SSL)

### Cloudflare 설정 (무료)

```
도메인 → Cloudflare 추가 → DNS A 레코드 → Hetzner IP 지정
SSL/TLS 모드: Full (strict)
캐싱: 정적 파일 자동 캐시 (응답속도 개선)
```

---

## 7. 환경변수 전체 목록

```env
# DB
DATABASE_URL=mysql://user:password@host:3306/dbname

# 인증
NEXTAUTH_SECRET=랜덤32자이상
NEXTAUTH_URL=https://carbonieum.com
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# MQTT
MQTT_BROKER_URL=mqtt://host:1883
MQTT_USERNAME=
MQTT_PASSWORD=

# SMS (Solapi)
SOLAPI_API_KEY=
SOLAPI_API_SECRET=
SOLAPI_SENDER_PHONE=

# 카카오 알림톡
KAKAO_CHANNEL_ID=
KAKAO_SENDER_KEY=

# 결제 (토스페이먼츠)
NEXT_PUBLIC_TOSS_CLIENT_KEY=
TOSS_SECRET_KEY=

# 배치 크론
CRON_SECRET=랜덤문자열

# AI (선택)
AI_ENGINE_URL=
ANTHROPIC_API_KEY=

# 전기요금 / 탄소크레딧
ELECTRICITY_PRICE_KRW=120
CARBON_CREDIT_KRW=25000
```

---

## 8. 비용 요약

| 시나리오 | 월 비용 | 적합 고객 수 |
|---------|---------|------------|
| Vercel Free + Railway | $5~15 (₩7,000~22,000) | MVP / 테스트 |
| Vercel Pro + Railway | $25~35 (₩37,000~52,000) | ~50개사 |
| Hetzner CX31 + Coolify | €11 (₩16,000) | ~200개사 |
| NHN Cloud | ₩100,000~ | 공공/대기업 |

**현재 단계 권장: Vercel Pro + Railway ($25/월)**
**6개월 후 전환: Hetzner CX31 + Coolify (€11/월)**
