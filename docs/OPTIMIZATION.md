# 성능 최적화 & 보안 가이드

## 🚀 성능 최적화

### 1. 데이터베이스 최적화

#### Prisma 쿼리 최적화

```typescript
// ❌ N+1 쿼리 문제
const measurements = await prisma.measurement.findMany();
for (const m of measurements) {
  const device = await prisma.device.findUnique({
    where: { id: m.deviceId },
  });
}

// ✅ Include 사용하여 한 번에 조회
const measurements = await prisma.measurement.findMany({
  include: {
    device: true,
  },
});
```

#### 인덱스 설정 (schema.prisma)

```prisma
model Measurement {
  id        String   @id @default(cuid())
  tenantId  String
  siteId    String
  deviceId  String
  value     Float
  receivedAt DateTime @default(now())
  
  @@index([tenantId])
  @@index([siteId])
  @@index([deviceId])
  @@index([receivedAt])
  @@index([tenantId, receivedAt])  // 복합 인덱스
}

model ForecastResult {
  id       String   @id @default(cuid())
  tenantId String
  siteId   String
  horizon  String
  data     Json
  createdAt DateTime @default(now())
  
  @@index([tenantId, horizon])
  @@index([createdAt])
}
```

#### 페이지네이션 구현

```typescript
// app/api/measurements/route.ts
export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '100');
  const skip = (page - 1) * limit;

  const [total, measurements] = await Promise.all([
    prisma.measurement.count(),
    prisma.measurement.findMany({
      skip,
      take: limit,
      orderBy: { receivedAt: 'desc' },
    }),
  ]);

  return Response.json({
    data: measurements,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
}
```

### 2. 캐싱 전략

#### Redis 캐시 구현

```typescript
// lib/cache.ts
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.REDIS_URL,
  token: process.env.REDIS_TOKEN,
});

export async function getCachedForecast(
  tenantId: string,
  horizon: string
) {
  const cacheKey = `forecast:${tenantId}:${horizon}`;
  
  // 캐시에서 먼저 조회
  const cached = await redis.get(cacheKey);
  if (cached) {
    return cached;
  }

  // 캐시 미스시 DB 조회
  const forecast = await prisma.forecastResult.findFirst({
    where: { tenantId, horizon },
    orderBy: { createdAt: 'desc' },
  });

  // 5분 TTL로 캐시
  if (forecast) {
    await redis.setex(cacheKey, 300, JSON.stringify(forecast));
  }

  return forecast;
}
```

#### API 응답 캐싱 (Next.js)

```typescript
// app/api/ai/forecast/route.ts
export const revalidate = 300; // 5분 ISR

export async function POST(request: Request) {
  const data = await request.json();
  
  // 동일한 요청은 캐시된 응답 반환
  const cacheKey = crypto
    .createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex');

  return Response.json(result, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
```

### 3. AI Engine 최적화

#### 배치 처리

```python
# ai-engine/src/api/main.py
from concurrent.futures import ThreadPoolExecutor

@app.post("/api/forecast/batch")
async def batch_forecast(requests: List[ForecastRequest]):
    """여러 테넌트의 예측을 병렬 처리"""
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [
            executor.submit(predict_single, req)
            for req in requests
        ]
        results = [f.result() for f in futures]
    return {"results": results}
```

#### 모델 캐싱

```python
# ai-engine/src/models/forecast.py
from functools import lru_cache
import joblib

class MultiHorizonForecaster:
    def __init__(self):
        self.models = {}
        self._load_cached_models()
    
    def _load_cached_models(self):
        """기존 학습된 모델 로드"""
        for horizon in ['24h', '7d', '30d']:
            try:
                self.models[horizon] = joblib.load(
                    f'models/cache/{horizon}_model.pkl'
                )
            except:
                self.models[horizon] = None
    
    def fit_all(self, data):
        for horizon in ['24h', '7d', '30d']:
            if self.models[horizon] is None:
                self.models[horizon] = self._fit_model(horizon, data)
                # 모델 저장
                joblib.dump(
                    self.models[horizon],
                    f'models/cache/{horizon}_model.pkl'
                )
```

#### 추론 최적화

```python
# ONNX 변환으로 추론 속도 향상
import onnx
import onnxruntime as rt

def convert_to_onnx(keras_model):
    onnx_model = tf2onnx.convert.from_keras(keras_model)
    onnx.save(onnx_model, "model.onnx")

def fast_predict(data):
    sess = rt.InferenceSession("model.onnx")
    pred = sess.run(None, {"input": data})
    return pred[0]
```

### 4. 프론트엔드 최적화

#### 번들 크기 최소화

```typescript
// next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer({
  swcMinify: true,
  compress: true,
  productionBrowserSourceMaps: false,
});
```

#### 컴포넌트 지연 로딩

```typescript
// app/(tenant)/analytics/forecast/page.tsx
import dynamic from 'next/dynamic';

const ForecastChart = dynamic(
  () => import('@/components/charts/ForecastChart'),
  { loading: () => <div>로딩 중...</div>, ssr: false }
);

export default function ForecastPage() {
  return <ForecastChart />;
}
```

#### 이미지 최적화

```typescript
import Image from 'next/image';

export default function Dashboard() {
  return (
    <Image
      src="/dashboard-icon.png"
      alt="대시보드"
      width={400}
      height={300}
      priority={false}
      placeholder="blur"
    />
  );
}
```

### 5. 부하 테스트

#### k6 테스트 스크립트

```javascript
// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 100,
  duration: '5m',
  stages: [
    { duration: '2m', target: 100 },
    { duration: '1m', target: 100 },
    { duration: '2m', target: 0 },
  ],
};

export default function () {
  // 1. 예측 API 테스트
  const forecastRes = http.post(
    'http://localhost:3000/api/ai/forecast',
    JSON.stringify({
      horizon: '24h',
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  check(forecastRes, {
    'forecast status is 200': (r) => r.status === 200,
    'forecast response time < 500ms': (r) => r.timings.duration < 500,
  });

  // 2. 이상 탐지 API 테스트
  const anomalyRes = http.post(
    'http://localhost:3000/api/ai/anomaly',
    JSON.stringify({}),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  check(anomalyRes, {
    'anomaly status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
```

실행:
```bash
k6 run load-test.js
```

---

## 🔒 보안 강화

### 1. 인증 & 인가

#### NextAuth.js 설정

```typescript
// lib/auth/options.ts
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      async authorize(credentials) {
        const user = await prisma.user.findUnique({
          where: { email: credentials?.email },
        });

        if (
          user &&
          (await bcrypt.compare(credentials?.password, user.password))
        ) {
          return {
            id: user.id,
            email: user.email,
            tenantId: user.tenantId,
          };
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.tenantId = user.tenantId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.tenantId = token.tenantId;
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24시간
  },
};
```

### 2. 입력 검증

#### Zod 스키마

```typescript
// lib/validators/index.ts
import { z } from 'zod';

export const ForecastRequestSchema = z.object({
  horizon: z.enum(['24h', '7d', '30d']),
  siteId: z.string().uuid().optional(),
});

export const AnomalyRequestSchema = z.object({
  sensitivity: z.number().min(0.05).max(0.3).default(0.1),
});

export const OptimizeRequestSchema = z.object({
  targetReduction: z
    .number()
    .min(10)
    .max(200)
    .describe('목표 감소량 (kW)'),
});

export const DREventSchema = z.object({
  title: z.string().min(1).max(255),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  targetReductionKw: z.number().min(10).max(500),
});
```

#### API 핸들러에서 사용

```typescript
// app/api/ai/forecast/route.ts
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validData = ForecastRequestSchema.parse(body);
    // 검증된 데이터로 처리
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { errors: error.errors },
        { status: 400 }
      );
    }
  }
}
```

### 3. API 레이트 제한

```typescript
// lib/middleware/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 h'),
  analytics: true,
});

export async function withRateLimit(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1';
  const { success, limit, reset, remaining } = await ratelimit.limit(
    `ratelimit_${ip}`
  );

  if (!success) {
    return new Response(
      JSON.stringify({ error: 'Too many requests' }),
      {
        status: 429,
        headers: {
          'RateLimit-Limit': limit.toString(),
          'RateLimit-Remaining': remaining.toString(),
          'RateLimit-Reset': reset.toString(),
        },
      }
    );
  }

  return { success: true };
}
```

### 4. HTTPS & HSTS

```typescript
// next.config.js
const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'unsafe-inline'",
  },
];

module.exports = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};
```

### 5. 환경 변수 보안

```typescript
// lib/env.ts
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  AI_ENGINE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);

// ❌ 절대 금지
console.log(process.env.DATABASE_URL);

// ✅ 클라이언트에는 공개하지 않기
const publicEnv = {
  NEXT_PUBLIC_APP_NAME: 'Energy Management',
};
```

### 6. 보안 감시

```typescript
// lib/security/audit-logger.ts
export async function auditLog(action: string, details: any) {
  await prisma.auditLog.create({
    data: {
      action,
      details,
      userId: getCurrentUserId(),
      ipAddress: getClientIP(),
      timestamp: new Date(),
    },
  });
}

// 사용법
await auditLog('CREATE_DR_EVENT', {
  drEventId: event.id,
  targetReduction: event.targetReductionKw,
});
```

---

## 📊 성능 모니터링

```typescript
// lib/monitoring/metrics.ts
import { register, Counter, Histogram } from 'prom-client';

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 5, 15, 50, 100, 500],
});

const forecastAccuracy = new Gauge({
  name: 'forecast_mape',
  help: 'Forecast MAPE accuracy',
});

// middleware에서 사용
export function withMetrics(handler: any) {
  return async (req: Request, res: Response) => {
    const start = Date.now();
    const res = await handler(req);
    const duration = Date.now() - start;

    httpRequestDuration
      .labels(req.method, req.url, res.status)
      .observe(duration);

    return res;
  };
}
```

---

## ✅ 보안 체크리스트

- [ ] 모든 환경 변수 보안
- [ ] HTTPS 강제 활성화
- [ ] CORS 정책 제한
- [ ] SQL Injection 방지 (Prisma 사용)
- [ ] XSS 방지 (입력 검증)
- [ ] CSRF 토큰 설정
- [ ] Rate Limiting 구성
- [ ] 감사 로그 활성화
- [ ] 정기 보안 패치
- [ ] 침입 탐지 시스템 모니터링

---

**마지막 업데이트**: 2024-01-30
**버전**: 1.0.0
