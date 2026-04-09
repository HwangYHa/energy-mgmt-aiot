# 탄소이음 EMS AIoT — NCP 프로덕션 배포 RunBook

> 버전: 2026-04-08 | 대상: DevOps 담당자

---

## 1. NCP 서버 스펙 및 단계별 권장안

### MVP ~ 50개사 (초기 운영)

| 구성 | 스펙 | 월 비용(예상) |
|------|------|-------------|
| **메인 서버** | Standard-g2 / 4vCPU 16GB | ~₩130,000 |
| **DB 서버** | Standard-g2 / 2vCPU 8GB (별도 권장) | ~₩65,000 |
| **Load Balancer** | NCP Application Load Balancer | ~₩30,000 |
| **Object Storage** | 백업용 100GB | ~₩3,000 |
| **Public IP** | 공인 IP 1개 | ~₩3,000 |
| **합계** | | **~₩231,000/월** |

> **초기 단일서버 최소 구성**: Standard-g2 / 8vCPU 32GB 1대 (₩260,000/월)
> — Docker로 모든 서비스 단일 서버 운영, LB 제외

### 50 ~ 200개사

| 구성 | 스펙 | 비고 |
|------|------|------|
| **앱 서버 × 2** | Standard-g2 / 4vCPU 16GB | Blue-Green |
| **DB 서버** | High Memory / 4vCPU 32GB | MySQL 전용 |
| **Cache 서버** | Standard-g2 / 2vCPU 8GB | Redis 전용 |
| **NCP ALB** | Application Load Balancer | SSL Termination |
| **NCP CDN+** | 정적 자산 | 선택 |

### 200 ~ 1000개사

| 구성 | 스펙 |
|------|------|
| **앱 서버** | Auto Scaling Group (4vCPU 16GB × 2~8) |
| **DB** | Cloud DB for MySQL (HA, 자동 Failover) |
| **Redis** | Cloud Cache for Redis (HA) |
| **MQTT** | 전용 서버 분리 |
| **AI Engine** | GPU 서버 (G2) |
| **NKS** | Naver Kubernetes Service (확장 시) |

---

## 2. 운영 아키텍처

```
Internet
    │
    ▼
[NCP WAF / DDoS Protection]
    │
    ▼
[NCP Application Load Balancer]  ← SSL Termination
    │
    ▼
[Nginx Reverse Proxy]  ← Rate Limiting, Security Headers
    │
    ├──► [Next.js app1 :3000]  ┐
    │                          ├── least_conn 로드밸런싱
    └──► [Next.js app2 :3000]  ┘
              │
              ├──► [AI Engine FastAPI :8001]  ← /api/ai-engine/*
              ├──► [MySQL :3306]              ← prisma ORM
              ├──► [Redis :6379]              ← 세션/캐시/rate limit
              └──► [MQTT Broker :1883]        ← IoT 디바이스 연결
                        │
                        └──► IoT 게이트웨이 → 센서

[Prometheus] ← 메트릭 수집 (15s)
    │
    ▼
[Grafana :3000/grafana] ← 대시보드

[Certbot] ← Let's Encrypt 자동 갱신
```

---

## 3. GitHub Secrets 설정

GitHub → Settings → Secrets and variables → Actions

| Secret | 값 | 설명 |
|--------|-----|------|
| `NCP_ACCESS_KEY` | NCP API Access Key | NCR 로그인 |
| `NCP_SECRET_KEY` | NCP API Secret Key | NCR 로그인 |
| `NCP_REGISTRY` | `ncr.kr-standard.ncr.gov-ncloud.com/ems-aiot` | NCR 엔드포인트 |
| `DEPLOY_HOST` | `xxx.xxx.xxx.xxx` | 서버 공인 IP |
| `DEPLOY_USER` | `ems-deploy` | SSH 사용자 |
| `DEPLOY_SSH_KEY` | ED25519 PEM 전체 | 서버 접속 키 |
| `DEPLOY_PORT` | `22` | SSH 포트 |
| `NEXT_PUBLIC_TOSS_CLIENT_KEY` | `live_ck_...` | 빌드 시 주입 |
| `SLACK_WEBHOOK_URL` | Webhook URL | 배포 알림 (선택) |

---

## 4. 최초 서버 셋업 순서

```bash
# 1. NCP 콘솔에서 서버 생성
#    - Ubuntu 22.04 LTS
#    - Standard-g2 / 4vCPU 16GB
#    - 공인 IP 할당
#    - Security Group: 22, 80, 443 인바운드 허용

# 2. 서버 접속
ssh root@{SERVER_IP}

# 3. 서버 초기화
wget -O init.sh https://raw.githubusercontent.com/{your-repo}/main/infra/ncp/01-server-init.sh
bash init.sh

# 4. 배포 공개키 등록
su ems-deploy
echo "{GITHUB_ACTIONS_PUBLIC_KEY}" >> ~/.ssh/authorized_keys

# 5. 코드 배포
cd /opt/ems-aiot
git clone https://github.com/{your-repo}.git .

# 6. .env.production 생성
cp infra/ncp/.env.production.template .env.production
vim .env.production   # 모든 값 채우기

# 7. NCP NCR에 이미지 빌드 & 푸시 (로컬 or GitHub Actions)
# GitHub Actions main 브랜치 push → 자동 빌드 & 배포

# 8. 최초 배포
bash infra/ncp/02-first-deploy.sh
```

---

## 5. 일상 배포 명령어

```bash
# ── 배포 (GitHub Actions 자동) ────────────────────────────
git push origin main   # main 브랜치 push → 자동 배포

# ── 수동 배포 ────────────────────────────────────────────
cd /opt/ems-aiot
APP_VERSION=$(git -C . rev-parse --short HEAD) \
  docker compose -f docker-compose.prod.yml --env-file .env.production \
  up -d --no-deps app1 app2

# ── 롤백 ─────────────────────────────────────────────────
bash infra/ncp/03-rollback.sh              # 이전 버전으로
bash infra/ncp/03-rollback.sh abc1234      # 특정 SHA로

# ── 서비스 상태 확인 ─────────────────────────────────────
docker compose -f docker-compose.prod.yml ps
curl -s http://localhost/api/health | python3 -m json.tool

# ── 로그 확인 ────────────────────────────────────────────
docker logs ems_app1 --tail 100 -f
docker logs ems_nginx --tail 100 -f
docker logs ems_mysql --tail 50

# ── DB 마이그레이션 수동 실행 ─────────────────────────────
bash scripts/prisma-migrate-prod.sh

# ── 전체 재시작 (무중단 아님 — 긴급 시만) ─────────────────
docker compose -f docker-compose.prod.yml --env-file .env.production restart
```

---

## 6. 배포 전 개발자 체크리스트

### Critical (배포 차단)
- [ ] `output: 'standalone'` → next.config.js ✅ 완료
- [ ] `NEXTAUTH_URL` → 실제 도메인 설정
- [ ] `NEXTAUTH_SECRET` / `JWT_SECRET` → 운영 전용 새 키 (openssl rand -base64 48)
- [ ] `DATABASE_URL` → 운영 DB 비밀번호
- [ ] `MYSQL_ROOT_PASSWORD` / `MYSQL_PASSWORD` 강화
- [ ] Stripe Price ID → `price_xxx` (현재 `prod_xxx` 상태 ⚠)
- [ ] Google/Naver OAuth Redirect URI → 운영 도메인으로 변경
- [ ] `DEV_BYPASS_FEATURES=false` 확인
- [ ] `NODE_ENV=production` 확인
- [ ] `pnpm build` 에러 없음 확인

### Important (가능한 빨리)
- [ ] `GMAIL_APP_PASSWORD` → 공백 없는 16자리 확인
- [ ] Toss 라이브 키 교체 (`test_` → `live_`)
- [ ] Stripe 라이브 키 교체 (`sk_test_` → `sk_live_`)
- [ ] `CRON_SECRET` 운영용 새 값 생성
- [ ] SSL 인증서 발급 (certbot)
- [ ] Naver OAuth `NAVER_REDIRECT_URI` 업데이트

### Recommended
- [ ] SEO Analytics ID (GTM, GA4, Naver) 입력
- [ ] Kakao AlimTalk 채널 개설 후 `KAKAO_SENDER_KEY` 입력
- [ ] Grafana 비밀번호 변경
- [ ] 백업 cron 등록 확인
- [ ] 모니터링 알람 수신 이메일 설정

---

## 7. 장애 대응 시나리오

### 시나리오 1: 앱 컨테이너 크래시

```bash
# 1. 로그 확인
docker logs ems_app1 --tail 200

# 2. 헬스체크
curl http://localhost/api/health

# 3. 재시작
docker restart ems_app1

# 4. 원인 불명 시 이전 버전 롤백
bash infra/ncp/03-rollback.sh
```

### 시나리오 2: MySQL 연결 실패

```bash
# 1. MySQL 상태 확인
docker exec ems_mysql mysqladmin -u root -p${MYSQL_ROOT_PASSWORD} status

# 2. 컨테이너 상태
docker inspect ems_mysql | grep -A5 '"Health"'

# 3. 디스크 확인 (풀 났을 경우)
df -h /opt/ems-data/mysql

# 4. 재시작
docker restart ems_mysql
sleep 30
docker restart ems_app1 ems_app2

# 5. 데이터 복구
bash scripts/backup.sh restore /opt/backups/ems-mysql/latest.sql.gz
```

### 시나리오 3: 디스크 Full

```bash
# 1. Docker 불필요 이미지/컨테이너 정리
docker system prune -af --volumes   # ⚠ 주의: 미사용 볼륨도 삭제

# 2. 로그 로테이션 강제
logrotate -f /etc/logrotate.d/ems-aiot

# 3. 오래된 백업 정리
find /opt/backups/ems-mysql -name "*.gz" -mtime +30 -delete

# 4. Docker 로그 크기 확인
du -sh /var/lib/docker/containers/*/
```

### 시나리오 4: 배포 후 에러율 급증

```bash
# 1. 에러 로그
docker logs ems_app1 --since 5m | grep -i error

# 2. 즉시 자동 롤백
bash infra/ncp/03-rollback.sh

# 3. DB 마이그레이션이 문제인 경우
# → rollback 후 migration 수동 처리 필요
# → prisma/migrations 에서 해당 마이그레이션 파일 확인
```

---

## 8. 보안 강화 사항

```bash
# SSH 키 기반 인증만 허용 (init 스크립트로 설정됨)
# fail2ban 3회 실패 시 24시간 차단 (init 스크립트로 설정됨)
# Docker 컨테이너: 비-root 사용자(nextjs uid=1001)로 실행
# MySQL/Redis: 외부 포트 미노출 (expose만, ports 아님)
# MQTT: 인증 필수 (allow_anonymous false)
# Nginx: IP 직접 접근 444 차단
# HSTS: max-age=63072000 (2년)
# CSP: next.config.js 헤더로 설정

# 정기 보안 점검
# 1. 의존성 취약점: pnpm audit
# 2. Docker 이미지: docker scout quickview
# 3. SSL 등급 확인: https://www.ssllabs.com/ssltest/
```

---

## 9. 비용 최적화

| 항목 | 절약 방법 |
|------|---------|
| 서버 | 예약 인스턴스 (1년 약정 30% 할인) |
| 이미지 | NCP NCR 캐시 레이어 재사용 (CI 시간 단축) |
| 백업 | Object Storage (S3 호환) 활용, 30일 보관 |
| CDN | NCP CDN+ 로 정적 자산 오리진 부하 감소 |
| 로그 | json-file max-size 제한 (현재 설정됨) |

---

## 10. 확장 로드맵

```
현재 (MVP)     → 단일 서버, Docker Compose
50개사         → 서버 분리 (앱/DB), ALB
200개사        → Auto Scaling, Cloud DB for MySQL (HA)
500개사        → NKS (Kubernetes), Horizontal Pod Autoscaler
1000개사       → Multi-AZ, DR 리전, MQTT Cluster
```
