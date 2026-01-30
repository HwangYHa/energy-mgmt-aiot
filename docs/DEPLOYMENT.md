# 배포 가이드 (Deployment Guide)

## 🚀 Vercel 배포 단계

### 1. 사전 요구사항

```bash
# Node.js 18+ 필요
node --version

# pnpm 설치
npm install -g pnpm

# 프로젝트 의존성 설치
pnpm install
```

### 2. 데이터베이스 마이그레이션

```bash
# Prisma 마이그레이션 생성
pnpm prisma migrate dev --name init

# 프로덕션 환경에 적용
DATABASE_URL=mysql://user:pass@host/db pnpm prisma migrate deploy
```

### 3. 환경변수 설정 (.env.production)

```env
# 데이터베이스
DATABASE_URL=mysql://user:password@host:port/energy_mgmt_db
SHADOW_DATABASE_URL=mysql://user:password@host:port/energy_mgmt_shadow

# 인증
NEXTAUTH_URL=https://yourapp.vercel.app
NEXTAUTH_SECRET=<생성: openssl rand -base64 32>

# AI Engine
AI_ENGINE_URL=https://ai-engine.yourapp.com
AI_ENGINE_API_KEY=your-api-key

# MQTT
MQTT_URL=mqtt://mqtt-broker:1883
MQTT_USERNAME=user
MQTT_PASSWORD=password

# Redis (선택사항)
REDIS_URL=redis://host:port

# 로깅
LOG_LEVEL=info

# 기능 플래그
ENABLE_ANOMALY_DETECTION=true
ENABLE_DR_SYSTEM=true
```

### 4. Vercel 배포

```bash
# 로그인
vercel login

# 배포
vercel deploy --prod

# 환경변수 설정
vercel env add DATABASE_URL
vercel env add NEXTAUTH_SECRET
vercel env add AI_ENGINE_URL
```

### 5. 배포 후 검증

```bash
# 헬스 체크
curl https://yourapp.vercel.app/api/health

# DB 연결 테스트
curl https://yourapp.vercel.app/api/db-test

# AI Engine 연결 테스트
curl https://yourapp.vercel.app/api/ai/health
```

---

## 🐳 Docker Kubernetes 배포

### 1. Docker 이미지 빌드

```bash
# Next.js 앱 빌드
docker build -t energy-mgmt-web:1.0.0 -f Dockerfile.web .

# AI Engine 빌드
docker build -t energy-mgmt-ai:1.0.0 -f ai-engine/Dockerfile .

# Registry에 푸시
docker push yourregistry/energy-mgmt-web:1.0.0
docker push yourregistry/energy-mgmt-ai:1.0.0
```

### 2. Kubernetes 배포

```bash
# 네임스페이스 생성
kubectl create namespace energy-mgmt

# ConfigMap 및 Secret 생성
kubectl create configmap app-config --from-env-file=.env.k8s -n energy-mgmt
kubectl create secret generic app-secrets --from-env-file=.env.secrets -n energy-mgmt

# 배포
kubectl apply -f infra/k8s/ -n energy-mgmt

# 상태 확인
kubectl get deployments -n energy-mgmt
kubectl get pods -n energy-mgmt
```

### 3. 헬스 체크 설정

```yaml
# infra/k8s/api-deployment.yaml
livenessProbe:
  httpGet:
    path: /api/health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /api/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
```

---

## 🔒 보안 설정

### 1. CORS 정책

```typescript
// next.config.js
const securityHeaders = [
  {
    key: 'Access-Control-Allow-Origin',
    value: process.env.ALLOWED_ORIGINS || 'https://yourapp.com',
  },
  {
    key: 'Access-Control-Allow-Methods',
    value: 'GET, POST, PUT, DELETE',
  },
  {
    key: 'Access-Control-Allow-Headers',
    value: 'Content-Type, Authorization',
  },
];
```

### 2. 입력 검증 (Zod)

```typescript
// lib/validators/forecast.ts
import { z } from 'zod';

export const ForecastRequestSchema = z.object({
  horizon: z.enum(['24h', '7d', '30d']),
  tenantId: z.string().uuid(),
  targetReduction: z.number().min(0).max(1000),
});
```

### 3. Rate Limiting

```typescript
// lib/middleware/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 h'),
});

export async function withRateLimit(req: Request) {
  const { success } = await ratelimit.limit(`ip_${getClientIp(req)}`);
  if (!success) {
    return new Response('Rate limited', { status: 429 });
  }
}
```

### 4. SQL Injection 방지

```typescript
// Prisma 사용으로 자동 방지
const measurement = await prisma.measurement.findMany({
  where: {
    tenantId: session.user.tenantId,
    receivedAt: { gte: startDate },
  },
});
```

### 5. XSS 방지

```typescript
// sanitize-html 라이브러리 사용
import sanitizeHtml from 'sanitize-html';

const cleanInput = sanitizeHtml(userInput, {
  allowedTags: [],
  allowedAttributes: {},
});
```

### 6. CSRF 토큰

```typescript
// app/api/middleware.ts
import { csrf } from 'next-csrf';

export const middleware = csrf();
```

---

## 📊 모니터링 & 로깅

### 1. Prometheus 메트릭

```yaml
# infra/prometheus/prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'ai-engine'
    static_configs:
      - targets: ['localhost:8001']
  
  - job_name: 'nextjs'
    static_configs:
      - targets: ['localhost:3000']
```

### 2. Grafana 대시보드

```json
{
  "title": "Energy Management Dashboard",
  "panels": [
    {
      "title": "Forecast Accuracy",
      "targets": [
        {
          "expr": "rate(forecast_mape[5m])"
        }
      ]
    },
    {
      "title": "API Response Time",
      "targets": [
        {
          "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))"
        }
      ]
    },
    {
      "title": "Anomaly Detection Rate",
      "targets": [
        {
          "expr": "rate(anomaly_detections_total[1h])"
        }
      ]
    }
  ]
}
```

### 3. 로깅 설정

```typescript
// lib/logger.ts
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

export default logger;
```

---

## 🔄 CI/CD 파이프라인

### GitHub Actions 설정

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'
      
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm test:integration

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Vercel
        run: vercel --prod --token ${{ secrets.VERCEL_TOKEN }}
      
      - name: Deploy AI Engine to ECR
        run: |
          aws ecr get-login-password --region ${{ env.AWS_REGION }} | \
          docker login --username AWS --password-stdin ${{ env.ECR_REGISTRY }}
          docker push ${{ env.ECR_REGISTRY }}/energy-mgmt-ai:latest
```

---

## 🆘 트러블슈팅

### 문제: AI Engine 연결 오류

```bash
# 1. AI Engine 헬스 체크
curl http://ai-engine:8001/health

# 2. 네트워크 연결 확인
telnet ai-engine 8001

# 3. Docker 로그 확인
docker logs energy-mgmt-ai-engine

# 4. 환경변수 확인
echo $AI_ENGINE_URL
```

### 문제: 데이터베이스 연결 타임아웃

```bash
# 1. DB 연결 문자열 검증
mysql -h $DB_HOST -u $DB_USER -p $DB_PASSWORD -e "SELECT 1"

# 2. Prisma 마이그레이션 상태 확인
pnpm prisma migrate status

# 3. 연결 풀 설정 확인
echo $DATABASE_URL | grep -o 'pool=[0-9]*'
```

### 문제: 높은 메모리 사용

```bash
# 1. Node.js 메모리 제한 설정
NODE_OPTIONS="--max-old-space-size=1024"

# 2. AI Engine 메모리 프로파일링
python -m memory_profiler ai-engine/src/api/main.py

# 3. 데이터베이스 쿼리 최적화
# N+1 쿼리 문제 확인
pnpm prisma spy
```

---

## 📋 배포 체크리스트

- [ ] 모든 환경변수 설정됨
- [ ] 데이터베이스 마이그레이션 완료
- [ ] AI Engine 배포 완료
- [ ] SSL 인증서 설치됨
- [ ] 백업 설정됨
- [ ] 모니터링 활성화됨
- [ ] 로그 수집 설정됨
- [ ] 헬스 체크 구성됨
- [ ] 보안 검사 완료됨
- [ ] 성능 테스트 통과함

---

## 📞 지원 연락처

- 기술 지원: devops@company.com
- 인시던트 보고: incidents@company.com
- 긴급 연락처: +82-10-1234-5678

**마지막 업데이트**: 2024-01-30
**버전**: 1.0.0
