# 🔍 Architecture Audit: 산업용 에너지 관리 SaaS 시스템
**작성일**: 2026-01-31  
**검토 범위**: Next.js 14 + TypeScript + Prisma 5 + MySQL 8 + TailwindCSS 3 + FastAPI (AI)  
**평가 기준**: 프로덕션 서비스 출시 직전 단계 (GO/NO-GO 판정)

---

## 📋 Executive Summary

**현재 상태**: 🟡 **CRITICAL** - 다수의 프로덕션 중단 위험 이슈 존재  
**위험도**: HIGH  
**영향도**: CRITICAL (보안, 멀티테넌시, 데이터 무결성)  
**권장사항**: 다음 섹션의 모든 CRITICAL/HIGH 이슈 해결 후 배포

| 카테고리 | 심각도 | 개수 | 상태 |
|---------|-------|------|------|
| 🔴 Critical Issues | CRITICAL | 8 | ❌ |
| 🟠 High Priority | HIGH | 12 | ❌ |
| 🟡 Medium Priority | MEDIUM | 15 | ⚠️ |
| 🟢 Low Priority | LOW | 7 | 📌 |
| **총계** | - | **42** | - |

---

# 1. ❌ CRITICAL ISSUES (즉시 해결 필요)

## 1.1 🔴 [CRITICAL-1] 멀티테넌시 보안 허점: 테넌트 ID 검증 부재

### 문제 정의
**파일**: `app/api/devices/route.ts`, `app/api/ai/forecast/route.ts` 등 대부분의 API  
**심각도**: 🔴 **CRITICAL - 데이터 유출 위험**

```typescript
// ❌ VULNERABLE - 현재 코드
export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 문제: session.user.tenantId가 어디서 검증되는가?
  // 공격자가 JWT 토큰을 조작하면?
  const devices = await DeviceService.findAll(session.user.tenantId);
  return NextResponse.json(devices);
}
```

### 왜 문제인가? (위험 분석)

1. **토큰 조작 공격 (Token Tampering)**
   - JWT 서명 검증이 있어도, tenantId 필드를 다른 테넌트 값으로 조작 가능
   - 클라이언트에서 받은 tenantId를 그대로 신뢰 → **보안 우회**

2. **API 레벨 테넌트 검증 부재**
   - 데이터베이스에서 쿼리하기 전 tenantId 유효성 검증 없음
   - 결과: 테넌트 A 사용자 → 테넌트 B 데이터 접근 가능

3. **Prisma Middleware의 불완전한 구현**
   - `lib/db/prisma.ts`에서 자동 tenantId 주입 시도했으나:
     ```typescript
     // 문제: getTenantId()가 어떻게 구현되는가?
     const tenantId = this.getTenantId(); // 컨텍스트 전달 불명확
     ```
   - 비동기 컨텍스트 추적 메커니즘 없음 → 멀티테넌트 쿼리에서 tenantId 누락 가능

### 실제 공격 시나리오

```bash
# 1. 사용자 A (tenant-001)가 로그인
GET /api/devices
Headers: Authorization: Bearer <JWT_A>

# 2. 토큰 클레임 조작
# JWT Payload:
# {
#   "sub": "user-001",
#   "tenantId": "tenant-002",  # ← 공격자가 조작
#   "role": "operator"
# }

# 3. 결과: 테넌트 002의 모든 기기 접근 가능 ❌
```

### 최적의 수정 방법

#### ✅ Step 1: AsyncLocalStorage를 사용한 안전한 컨텍스트 관리

**파일**: `lib/context/tenant-context.ts` (신규 생성)

```typescript
import { AsyncLocalStorage } from 'async_hooks';

interface TenantContext {
  tenantId: string;
  userId: string;
  role: string;
}

export const tenantContext = new AsyncLocalStorage<TenantContext>();

export function getTenantContext(): TenantContext | undefined {
  return tenantContext.getStore();
}

export function withTenantContext<T>(
  context: TenantContext,
  callback: () => Promise<T>
): Promise<T> {
  return tenantContext.run(context, callback);
}
```

#### ✅ Step 2: Middleware에서 검증된 tenantId만 설정

**파일**: `lib/auth/middleware.ts` (수정)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { tenantContext } from '@/lib/context/tenant-context';
import { prisma } from '@/lib/db/prisma';

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key'
);

export async function authMiddleware(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return NextResponse.json(
      { error: 'Missing token' },
      { status: 401 }
    );
  }

  try {
    // 1. JWT 서명 검증
    const verified = await jwtVerify(token, secret);
    const userId = verified.payload.sub as string;

    // 2. 데이터베이스에서 사용자 검증 (⭐ 중요)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        tenantId: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: 'User not found or inactive' },
        { status: 401 }
      );
    }

    // 3. JWT 클레임의 tenantId와 DB의 tenantId 비교 (⭐ 검증)
    const claimedTenantId = verified.payload.tenantId as string;
    if (claimedTenantId !== user.tenantId) {
      // 보안 이벤트: 토큰 조작 의심
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'SECURITY_TOKEN_TAMPERING_DETECTED',
          resourceType: 'USER',
          resourceId: userId,
          result: 'failure',
          errorMessage: `Tenant mismatch: claimed=${claimedTenantId}, actual=${user.tenantId}`,
          ipAddress: request.ip,
        },
      });
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // 4. 컨텍스트에 검증된 값만 저장
    const context = {
      tenantId: user.tenantId, // ← DB에서 검증된 값
      userId: user.id,
      role: user.role,
    };

    return context; // API 라우트에 전달
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid token' },
      { status: 401 }
    );
  }
}
```

#### ✅ Step 3: 모든 API 라우트에서 다층 방어

**파일**: `app/api/devices/route.ts` (수정)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify'; // 우리가 작성한 함수

export async function GET(request: NextRequest) {
  // 1. 인증 및 tenantId 검증
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const { tenantId } = auth;

  try {
    // 2. Prisma 쿼리에서 tenantId 필터 명시적 포함 (⭐ 다층 방어)
    const devices = await prisma.device.findMany({
      where: {
        tenantId, // ← 반드시 포함
      },
      select: {
        id: true,
        name: true,
        status: true,
        deviceType: true,
        // 민감한 필드 제외
      },
    });

    return NextResponse.json(devices);
  } catch (error) {
    console.error('Device fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const { tenantId, userId, role } = auth;

  // 3. 권한 검증 (역할 기반)
  if (!['site_manager', 'tenant_admin'].includes(role)) {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();

    // 4. 입력 검증 (siteId가 실제로 이 tenantId에 속하는가?)
    const site = await prisma.site.findUnique({
      where: { id: body.siteId },
      select: { tenantId: true },
    });

    if (!site || site.tenantId !== tenantId) {
      return NextResponse.json(
        { error: 'Site not found or access denied' },
        { status: 404 }
      );
    }

    // 5. tenantId를 강제 설정 (입력에서 오는 tenantId 무시)
    const device = await prisma.device.create({
      data: {
        ...body,
        tenantId, // ← 인증된 tenantId만 사용
      },
    });

    // 6. 감사 로그
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'DEVICE_CREATE',
        resourceType: 'DEVICE',
        resourceId: device.id,
        result: 'success',
      },
    });

    return NextResponse.json(device, { status: 201 });
  } catch (error) {
    console.error('Device creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create device' },
      { status: 500 }
    );
  }
}
```

#### ✅ Step 4: Prisma Middleware 개선 (선택사항)

**파일**: `lib/db/prisma.ts` (수정)

```typescript
import { PrismaClient } from '@prisma/client';
import { tenantContext } from '@/lib/context/tenant-context';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"],
  });

// Prisma Middleware: 자동 tenantId 필터 추가
prisma.$use(async (params, next) => {
  const context = tenantContext.getStore();
  
  if (!context) {
    // 시스템 작업 (초기화, 마이그레이션 등)
    return next(params);
  }

  const { tenantId } = context;
  const tenantModels = [
    'Device',
    'Measurement',
    'Metric',
    'Site',
    'AlertRule',
    'ControlLog',
    // ... 멀티테넌트 모델들
  ];

  // 읽기 작업에 tenantId 필터 자동 추가
  if (tenantModels.includes(params.model)) {
    if (params.action === 'findMany' || params.action === 'findFirst') {
      params.args.where = {
        ...params.args.where,
        tenantId, // ← 자동 추가
      };
    }
  }

  return next(params);
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
```

---

## 1.2 🔴 [CRITICAL-2] AI Engine 프로세스 통신 결함: 토큰/비밀 노출

### 문제 정의
**파일**: `app/api/ai/forecast/route.ts`, `ai-engine/src/api/main.py`  
**심각도**: 🔴 **CRITICAL - 데이터 유출, 권한 상승**

```typescript
// ❌ VULNERABLE
const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8001';

const response = await fetch(`${AI_ENGINE_URL}/forecast`, {
  method: 'POST',
  body: JSON.stringify({
    tenantId,
    siteId,
    historicalData: measurements,
  }),
  // ❌ 인증 없음! 누구나 호출 가능
});
```

```python
# ❌ VULNERABLE - main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ❌ 모든 도메인 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 왜 문제인가?

1. **AI Engine에 인증 메커니즘 없음**
   - 누구나 `/forecast`, `/anomaly`, `/optimize` 호출 가능
   - 임의의 tenantId로 다른 테넌트 데이터 예측 가능
   - 리소스 고갈 공격 (DoS) 가능

2. **CORS가 모든 도메인 허용**
   - 브라우저 기반 공격 (CSRF, XSS) 가능
   - 악의적인 웹사이트에서 백엔드로 직접 요청 가능

3. **통신 암호화 없음**
   - HTTP 사용 (https 아님)
   - 중간자 공격 (Man-in-the-Middle) 가능

### 수정 방법

#### ✅ Step 1: API 키 기반 인증 추가

**파일**: `ai-engine/src/api/main.py` (수정)

```python
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI(
    title="EMS AI Engine",
    description="에너지 관리 시스템 AI 엔진 API",
    version="1.0.0"
)

# ✅ CORS 제한
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.getenv('WEB_APP_URL', 'http://localhost:3000'),
    ],  # ← 명시적 도메인만 허용
    allow_credentials=True,
    allow_methods=['POST', 'GET'],  # ← 필요한 메서드만
    allow_headers=['Content-Type', 'Authorization'],
)

# ✅ API 키 검증 의존성
async def verify_api_key(authorization: str = Header(...)) -> str:
    """
    Authorization: Bearer <API_KEY>
    API_KEY는 Next.js 백엔드에서만 알고 있음
    """
    if not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Invalid auth header')
    
    api_key = authorization.split(' ')[1]
    valid_key = os.getenv('AI_ENGINE_API_KEY')
    
    if not valid_key:
        raise HTTPException(status_code=500, detail='Server misconfigured')
    
    if api_key != valid_key:
        raise HTTPException(status_code=401, detail='Invalid API key')
    
    return api_key

# ✅ 예측 API에 인증 추가
@app.post("/forecast", dependencies=[Depends(verify_api_key)])
async def forecast(request: ForecastRequest):
    """부하 예측 (인증 필수)"""
    try:
        predictions = forecaster.predict(
            historical_data=request.historicalData,
            horizon=request.horizon,
        )
        
        return ForecastResponse(
            predictions=predictions['values'],
            accuracy=predictions['mape'],
            model='LSTM-24h-v1.0',
            confidence_lower=predictions['ci_lower'],
            confidence_upper=predictions['ci_upper'],
            timestamp=datetime.now(),
        )
    except Exception as e:
        logger.error(f"Forecast error: {e}")
        raise HTTPException(status_code=500, detail='Forecast failed')

@app.post("/anomaly", dependencies=[Depends(verify_api_key)])
async def detect_anomaly(request: AnomalyRequest):
    """이상 탐지 (인증 필수)"""
    pass

@app.post("/optimize", dependencies=[Depends(verify_api_key)])
async def optimize(request: OptimizationRequest):
    """최적화 추천 (인증 필수)"""
    pass
```

#### ✅ Step 2: Next.js 백엔드에서 API 키 포함

**파일**: `app/api/ai/forecast/route.ts` (수정)

```typescript
// ✅ API 키는 환경 변수에서만 읽기
const AI_ENGINE_URL = process.env.AI_ENGINE_URL;
const AI_ENGINE_API_KEY = process.env.AI_ENGINE_API_KEY;

if (!AI_ENGINE_API_KEY) {
  throw new Error('AI_ENGINE_API_KEY not configured');
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { tenantId } = auth;

  try {
    // ✅ API 키 포함 및 HTTPS 사용
    const aiResponse = await fetch(`${AI_ENGINE_URL}/forecast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_ENGINE_API_KEY}`, // ← API 키 포함
      },
      body: JSON.stringify({
        tenantId,
        siteId: body.siteId,
        historicalData: measurements,
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(
        `AI Engine error: ${aiResponse.status} ${aiResponse.statusText}`
      );
    }

    const predictions = await aiResponse.json();

    // 결과 저장
    const forecast = await prisma.aiForecastResult.create({
      data: {
        tenantId,
        modelId: 'lstm-24h-v1',
        forecastType: 'load',
        horizonHours: 24,
        predictions: predictions.predictions,
        confidence: predictions.accuracy,
        mape: predictions.mape,
        rmse: predictions.rmse,
        inputDataPoints: measurements.length,
        featuresUsed: predictions.features,
      },
    });

    return NextResponse.json(forecast);
  } catch (error) {
    console.error('Forecast error:', error);
    return NextResponse.json(
      { error: 'Forecast failed' },
      { status: 500 }
    );
  }
}
```

#### ✅ Step 3: 환경 변수 설정

**파일**: `.env.local`, `.env.production`

```bash
# .env.local (개발)
DATABASE_URL="mysql://user:pass@localhost:3306/energy_mgmt"
AI_ENGINE_URL="http://localhost:8001"
AI_ENGINE_API_KEY="dev-secret-key-change-in-production"
JWT_SECRET="dev-jwt-secret-change-in-production"
WEB_APP_URL="http://localhost:3000"

# .env.production (프로덕션 - 반드시 보안되어야 함)
DATABASE_URL="[RDS 엔드포인트]"
AI_ENGINE_URL="https://ai-engine.internal:8001"  # ← HTTPS 사용
AI_ENGINE_API_KEY="[최소 32자 랜덤 문자열]"
JWT_SECRET="[최소 32자 랜덤 문자열]"
WEB_APP_URL="https://app.yourdomain.com"
```

---

## 1.3 🔴 [CRITICAL-3] 데이터베이스 스키마 불일치: Prisma Schema ↔ MySQL

### 문제 정의
**파일**: `prisma/schema.prisma` vs 제공된 MySQL CREATE TABLE 문  
**심각도**: 🔴 **CRITICAL - 마이그레이션 실패, 런타임 오류**

### 발견된 불일치

#### 1️⃣ **테이블 명명 규칙 불일치**

| Prisma Model | Expected DB | Actual DB | Status |
|-------------|-----------|-----------|--------|
| `AiForecastResult` | `ai_forecast_result` | `ai_forecast_results` (복수) | ❌ |
| `ForecastResult` | `forecast_result` | `forecastresult` (소문자, 언더스코어 없음) | ❌ |
| `DrEvent` | `dr_event` | `dr_events` (복수) | ❌ |
| `ControlLog` | `control_log` | `control_log` | ✅ |
| `Measurement` | `measurement` | `measurement` | ✅ |

**왜 중요한가?**
- Prisma 마이그레이션 실행 시 테이블을 찾을 수 없음 → 런타임 오류
- 현재 `prisma generate` 성공해도, 실제 쿼리 실행 시 "table not found" 에러

#### 2️⃣ **필드 타입 불일치**

**`ai_forecast_results` 테이블:**
```sql
-- 실제 MySQL
CREATE TABLE `ai_forecast_results` (
  `id` bigint NOT NULL AUTO_INCREMENT,  -- ← AUTO_INCREMENT (숫자)
  `tenant_id` varchar(50) NOT NULL,
  `predictions` json NOT NULL,
  `confidence` decimal(5,4) NOT NULL,
  ...
) ENGINE=InnoDB;
```

**Prisma Schema (추정):**
```prisma
model AiForecastResult {
  id          String @id @default(uuid()) // ← UUID (문자)
  tenantId    String
  predictions Json
  confidence  Decimal @db.Decimal(5, 4)
}
```

**문제**: 
- MySQL은 AUTO_INCREMENT (숫자), Prisma는 UUID (문자) 기대
- 마이그레이션 스크립트 생성 불가능

#### 3️⃣ **enum 타입 불일치**

**MySQL:**
```sql
`forecast_type` enum('load','cost','carbon','demand')
```

**Prisma (추정):**
```prisma
enum AiForecastType {
  load
  cost
  carbon
  demand
}
```

✅ 이것은 일치함 (다행)

#### 4️⃣ **외래키 관계 부재**

**MySQL의 `dr_events` 테이블:**
```sql
CREATE TABLE `dr_events` (
  `tenant_id` varchar(50) NOT NULL,
  -- ❌ FOREIGN KEY 없음!
  ...
);
```

**Prisma에서는 다음과 같이 정의되어 있을 것:**
```prisma
model DrEvent {
  tenantId String @map("tenant_id")
  tenant   Tenant @relation(fields: [tenantId], references: [id])
}
```

**문제**:
- 데이터베이스 레벨에서 무결성 보장 없음
- 고아 레코드 (orphan records) 생성 가능
- 성능 문제: JOIN 최적화 불가능

### 최적의 수정 방법

#### ✅ Step 1: Prisma Schema 검수 및 수정

**파일**: `prisma/schema.prisma` (전체 검토 및 수정)

```prisma
// ✅ CORRECTED
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

// ========================================
// AI 예측 결과
// ========================================

model AiForecastResult {
  id                BigInt    @id @default(autoincrement()) // ← BigInt로 수정
  tenantId          String    @map("tenant_id") @db.VarChar(50)
  siteId            String?   @map("site_id") @db.VarChar(50)
  modelId           String    @map("model_id") @db.VarChar(50)
  forecastType      String    @map("forecast_type") @db.VarChar(50) // 또는 enum 사용
  horizonHours      Int       @map("horizon_hours")
  predictions       Json      @map("predictions") @db.Json
  confidence        Decimal   @map("confidence") @db.Decimal(5, 4)
  mape              Decimal?  @map("mape") @db.Decimal(5, 2)
  rmse              Decimal?  @map("rmse") @db.Decimal(10, 2)
  inputDataPoints   Int       @map("input_data_points")
  featuresUsed      Json?     @map("features_used") @db.Json
  createdBy         String?   @map("created_by") @db.VarChar(50)
  createdAt         DateTime  @default(now()) @map("created_at")

  // 관계
  tenant            Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, createdAt(sort: Desc)])
  @@index([modelId])
  @@map("ai_forecast_results")
}

// ========================================
// 레거시 ForecastResult (마이그레이션 필요)
// ========================================

model ForecastResult {
  id        String   @id @default(uuid())
  tenantId  String   @map("tenantId")
  siteId    String?  @map("siteId")
  horizon   String
  predictions Json
  accuracy  Float
  model     String
  createdAt DateTime @default(now()) @map("createdAt")

  tenant    Tenant @relation(fields: [tenantId], references: [id], onDelete: Restrict)

  @@index([tenantId])
  @@index([siteId])
  @@map("forecastresult")
}

// ========================================
// DR 이벤트
// ========================================

model DrEvent {
  id                    BigInt      @id @default(autoincrement())
  tenantId              String      @map("tenant_id") @db.VarChar(50)
  eventName             String      @map("event_name") @db.VarChar(200)
  provider              String      @db.VarChar(100) // KPX, 한전 등
  eventType             String      @map("event_type") @db.VarChar(50) // CBL, peak_cut, emergency
  startTime             DateTime    @map("start_time")
  endTime               DateTime    @map("end_time")
  targetReductionKw     Decimal     @map("target_reduction_kw") @db.Decimal(10, 2)
  actualReductionKw     Decimal?    @map("actual_reduction_kw") @db.Decimal(10, 2)
  baselineKwh           Decimal?    @map("baseline_kwh") @db.Decimal(12, 2)
  revenue               Decimal?    @db.Decimal(12, 2)
  penalty               Decimal?    @db.Decimal(12, 2)
  status                String      @default("scheduled") @db.VarChar(50)
  strategy              Json?
  executionLog          Json?       @map("execution_log")
  createdAt             DateTime    @default(now()) @map("created_at")

  // ✅ 관계 추가 (DB 무결성 보장)
  tenant                Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, startTime])
  @@map("dr_events")
}

// Tenant 모델에도 관계 추가
model Tenant {
  // ... 기존 필드 ...
  
  // 관계
  aiForecastResults   AiForecastResult[]
  drEvents            DrEvent[]
}
```

#### ✅ Step 2: 마이그레이션 스크립트 생성

```bash
# 1. 기존 스키마 스냅샷
npx prisma migrate resolve --rolled-back 001_init_schema

# 2. 새로운 마이그레이션 생성
npx prisma migrate dev --name fix_schema_naming_and_relations

# 3. 결과 확인
npx prisma db push --skip-generate

# 4. Prisma Client 재생성
npx prisma generate
```

#### ✅ Step 3: 외래키 추가 (MySQL 레벨)

만약 마이그레이션이 자동으로 수행되지 않으면, 수동 SQL 스크립트:

```sql
-- 1. dr_events에 foreign key 추가
ALTER TABLE `dr_events`
ADD CONSTRAINT `dr_events_tenant_id_fkey`
FOREIGN KEY (`tenant_id`) REFERENCES `tenant` (`id`)
ON DELETE CASCADE
ON UPDATE CASCADE;

-- 2. ai_forecast_results에 foreign key 추가
ALTER TABLE `ai_forecast_results`
ADD CONSTRAINT `ai_forecast_results_tenant_id_fkey`
FOREIGN KEY (`tenant_id`) REFERENCES `tenant` (`id`)
ON DELETE CASCADE
ON UPDATE CASCADE;

-- 3. 인덱스 최적화 확인
CREATE INDEX `idx_dr_events_tenant_time` 
ON `dr_events` (`tenant_id`, `start_time` DESC);

CREATE INDEX `idx_ai_forecast_tenant_created`
ON `ai_forecast_results` (`tenant_id`, `created_at` DESC);
```

---

## 1.4 🔴 [CRITICAL-4] 인증 시스템 미구현: NextAuth 설정 불완전

### 문제 정의
**파일**: `app/api/auth/login/route.ts` (빈 파일), `lib/auth/session.ts` (미검사)  
**심각도**: 🔴 **CRITICAL - 인증 우회 가능**

```typescript
// ❌ 현재 상태
// app/api/auth/login/route.ts
// (빈 파일!)

// app/api/devices/route.ts
export async function GET(request: NextRequest) {
  const session = await getServerSession(); // ← session이 undefined 가능
  if (!session?.user) { // ← 하지만 코드는 진행됨?
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ...
}
```

**문제**:
- `login` 엔드포인트 구현 없음
- `register` 엔드포인트 구현 없음
- NextAuth 설정 미확인 (`[...nextauth]/` 디렉토리 존재하지만 내용 확인 필요)
- 세션 관리 방식 불명확

### 최적의 수정 방법

#### ✅ Step 1: NextAuth 설정 파일 생성/수정

**파일**: `app/api/auth/[...nextauth]/route.ts` (신규 또는 수정)

```typescript
import NextAuth, { type NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/db/prisma';
import bcrypt from 'bcrypt';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Invalid credentials');
        }

        // 데이터베이스에서 사용자 조회
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            tenantId: true,
            role: true,
            isActive: true,
          },
        });

        if (!user) {
          throw new Error('User not found');
        }

        if (!user.isActive) {
          throw new Error('User is inactive');
        }

        // 비밀번호 검증
        const passwordValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!passwordValid) {
          // 보안: 실패 시도 기록
          await prisma.user.update({
            where: { id: user.id },
            data: {
              loginAttempts: { increment: 1 },
            },
          });
          throw new Error('Invalid password');
        }

        // 로그인 성공: 시도 횟수 초기화 및 lastLoginAt 업데이트
        await prisma.user.update({
          where: { id: user.id },
          data: {
            loginAttempts: 0,
            lastLoginAt: new Date(),
            lastLoginIp: req.headers?.['x-forwarded-for'] as string,
          },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          tenantId: user.tenantId,
          role: user.role,
        };
      },
    }),
  ],
  
  pages: {
    signIn: '/login',
    error: '/auth/error',
  },

  callbacks: {
    // JWT 콜백: 사용자 정보를 토큰에 포함
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.tenantId = user.tenantId;
        token.role = user.role;
      }
      return token;
    },

    // 세션 콜백: 토큰에서 세션 생성
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.tenantId = token.tenantId as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },

  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24시간
    updateAge: 60 * 60, // 1시간마다 갱신
  },

  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
    maxAge: 24 * 60 * 60,
  },

  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

#### ✅ Step 2: 환경 변수 추가

**파일**: `.env.local`, `.env.production`

```bash
# NextAuth 설정
NEXTAUTH_URL="http://localhost:3000"  # 개발
# NEXTAUTH_URL="https://app.yourdomain.com"  # 프로덕션

NEXTAUTH_SECRET="[생성: openssl rand -base64 32]"
```

#### ✅ Step 3: 로그인 API 엔드포인트 구현

**파일**: `app/api/auth/login/route.ts` (신규)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { signIn } from 'next-auth/react';

/**
 * POST /api/auth/login
 * 사용자 로그인
 */
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // ⭐ NextAuth에서 로그인 처리
    // (실제 로그인은 /api/auth/callback/credentials에서 수행됨)
    
    // 클라이언트는 다음을 수행:
    // const result = await signIn('credentials', {
    //   email,
    //   password,
    //   redirect: false,
    // });
    
    return NextResponse.json(
      { message: 'Use signIn from next-auth/react on client' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}
```

#### ✅ Step 4: 회원가입 엔드포인트

**파일**: `app/api/auth/register/route.ts` (신규)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import bcrypt from 'bcrypt';
import { z } from 'zod';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  name: z.string().min(1).max(100),
  tenantId: z.string().uuid(), // 기존 테넌트에 가입
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name, tenantId } = registerSchema.parse(body);

    // 1. 이미 존재하는 사용자인지 확인
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    // 2. 테넌트 존재 확인
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // 3. 비밀번호 해싱
    const passwordHash = await bcrypt.hash(password, 12);

    // 4. 사용자 생성
    const user = await prisma.user.create({
      data: {
        email,
        name,
        tenantId,
        passwordHash,
        role: 'viewer', // 기본 역할
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    );
  }
}
```

---

## 1.5 🔴 [CRITICAL-5] 입력 검증 부재: 모든 API에 XSS/SQL Injection 위험

### 문제 정의
**파일**: 모든 API 라우트 (`app/api/**/route.ts`)  
**심각도**: 🔴 **CRITICAL - XSS, SQL Injection, DoS**

```typescript
// ❌ VULNERABLE - 현재 패턴
export async function POST(request: NextRequest) {
  const body = await request.json();
  
  // 입력 검증 없음!
  const device = await prisma.device.create({
    data: {
      name: body.name, // ← 검증 없음, 극단적인 길이 가능
      deviceType: body.deviceType, // ← enum인지 확인 안 함
      connectionConfig: body.connectionConfig, // ← JSON 구조 검증 없음
    },
  });
  
  return NextResponse.json(device);
}
```

**문제**:
- `name` 필드: 100KB 문자열 가능 → 저장소 고갈
- `deviceType`: 유효한 값('HVAC', 'LIGHTING')이 아닌 임의의 문자열 저장
- `connectionConfig`: JSON 검증 없음 → 구조 예측 불가능
- SQL Injection: Prisma ORM 사용으로 직접 위험은 낮지만, 입력 크기 제한 없음

### 최적의 수정 방법

#### ✅ 통합 검증 라이브러리 설정

**파일**: `lib/validation/schemas.ts` (신규)

```typescript
import { z } from 'zod';

// ✅ 공통 스키마
export const uuidSchema = z.string().uuid();
export const emailSchema = z.string().email().max(255);
export const passwordSchema = z.string().min(8).max(100);
export const tenantIdSchema = z.string().uuid();

// ✅ Device 검증
export const deviceCreateSchema = z.object({
  name: z.string()
    .min(1, 'Name required')
    .max(200, 'Name too long')
    .trim(),
  
  deviceType: z.enum([
    'HVAC',
    'LIGHTING',
    'METER',
    'POWER_FACTOR',
    'TEMPERATURE_SENSOR',
    'PRODUCTION_EQUIPMENT',
  ]),
  
  protocol: z.enum(['modbus_tcp', 'modbus_rtu', 'bacnet', 'opcua', 'mqtt', 'http']),
  
  connectionConfig: z.object({
    host: z.string().ip().or(z.string().hostname()),
    port: z.number().min(1).max(65535),
    timeout: z.number().min(100).max(30000).optional(),
    // ... 추가 필드
  }),
  
  controlCapable: z.boolean().optional(),
  siteId: uuidSchema,
});

export const deviceUpdateSchema = deviceCreateSchema.partial();

// ✅ Forecast Request 검증
export const forecastRequestSchema = z.object({
  siteId: uuidSchema.optional(),
  horizon: z.enum(['24h', '7d', '30d']).default('24h'),
  features: z.array(z.string()).optional(),
});

// ✅ DR Event 검증
export const drEventCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  eventType: z.enum(['CBL', 'peak_cut', 'emergency']),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  targetReductionKw: z.number().positive(),
  baselineKwh: z.number().positive().optional(),
});

// ✅ 권한 검증
export const validateTenantAccess = (
  userTenantId: string,
  resourceTenantId: string
) => {
  if (userTenantId !== resourceTenantId) {
    throw new Error('Access denied');
  }
};
```

#### ✅ API에 검증 적용

**파일**: `app/api/devices/route.ts` (수정)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify';
import { deviceCreateSchema } from '@/lib/validation/schemas';
import { z } from 'zod';

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    // ✅ 입력 검증
    const validated = deviceCreateSchema.parse(body);

    // ✅ 권한 검증: siteId가 이 테넌트에 속하는지 확인
    const site = await prisma.site.findUnique({
      where: { id: validated.siteId },
      select: { tenantId: true },
    });

    if (!site || site.tenantId !== auth.tenantId) {
      return NextResponse.json(
        { error: 'Site not found or access denied' },
        { status: 404 }
      );
    }

    // ✅ 데이터베이스에 저장
    const device = await prisma.device.create({
      data: {
        ...validated,
        tenantId: auth.tenantId,
      },
    });

    return NextResponse.json(device, { status: 201 });
  } catch (error) {
    // ✅ Zod 검증 오류 처리
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    console.error('Device creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create device' },
      { status: 500 }
    );
  }
}
```

---

## 1.6 🔴 [CRITICAL-6] 에러 처리 및 로깅 전략 부재

### 문제 정의
**심각도**: 🔴 **CRITICAL - 운영상 가시성 없음, 보안 로깅 부재**

```typescript
// ❌ VULNERABLE - 현재 패턴
export async function GET(request: NextRequest) {
  try {
    const data = await someService.fetch();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error); // ← 너무 일반적
    return NextResponse.json(
      { error: 'Failed' },  // ← 정보 부족
      { status: 500 }
    );
  }
}
```

**문제**:
- 구조화된 로깅 없음 (timestamp, request ID 등)
- 보안 이벤트 로깅 부재 (login failure, unauthorized access)
- 에러 추적 불가능 (correlation ID 없음)
- 스택 트레이스가 클라이언트에 노출될 수 있음

### 최적의 수정 방법

#### ✅ Step 1: 구조화된 로깅 시스템 구축

**파일**: `lib/logger/index.ts` (신규)

```typescript
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

// 요청별 고유 ID를 저장하는 AsyncLocalStorage
import { AsyncLocalStorage } from 'async_hooks';

export const requestIdContext = new AsyncLocalStorage<string>();

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: 'energy-mgmt-api' },
  transports: [
    // 파일: 모든 로그
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
    }),
    // 파일: 에러만
    new winston.transports.File({
      filename: 'logs/errors.log',
      level: 'error',
    }),
    // 파일: 보안 이벤트만
    new winston.transports.File({
      filename: 'logs/security.log',
      level: 'warn',
    }),
  ],
});

// 개발 환경에서는 콘솔도 출력
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}

export interface LogContext {
  requestId: string;
  userId?: string;
  tenantId?: string;
  ip?: string;
}

export class Logger {
  private context: LogContext;

  constructor(context: Partial<LogContext> = {}) {
    this.context = {
      requestId: context.requestId || uuidv4(),
      ...context,
    };
  }

  // API 요청 시작
  logRequestStart(method: string, path: string) {
    logger.info('API_REQUEST_START', {
      ...this.context,
      method,
      path,
      timestamp: new Date().toISOString(),
    });
  }

  // API 요청 완료
  logRequestEnd(method: string, path: string, status: number, duration: number) {
    logger.info('API_REQUEST_END', {
      ...this.context,
      method,
      path,
      status,
      durationMs: duration,
    });
  }

  // 보안 이벤트 (로그인 실패, 무단 접근 등)
  logSecurityEvent(event: string, details: any) {
    logger.warn('SECURITY_EVENT', {
      ...this.context,
      event,
      details,
      timestamp: new Date().toISOString(),
    });
  }

  // 에러
  logError(message: string, error: unknown, context?: any) {
    logger.error(message, {
      ...this.context,
      ...context,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
      } : String(error),
    });
  }

  // 데이터베이스 쿼리
  logDatabase(query: string, duration: number) {
    logger.debug('DATABASE_QUERY', {
      ...this.context,
      query,
      durationMs: duration,
    });
  }

  // AI 엔진 호출
  logAICall(endpoint: string, duration: number, success: boolean) {
    logger.info('AI_ENGINE_CALL', {
      ...this.context,
      endpoint,
      durationMs: duration,
      success,
    });
  }
}

export default logger;
```

#### ✅ Step 2: 미들웨어에서 요청 ID 설정

**파일**: `lib/auth/middleware.ts` (수정)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requestIdContext } from '@/lib/logger';
import { v4 as uuidv4 } from 'uuid';

export function withRequestId(handler: Function) {
  return async (request: NextRequest, ...args: any[]) => {
    const requestId = request.headers.get('x-request-id') || uuidv4();
    
    return requestIdContext.run(requestId, async () => {
      // 응답 헤더에 Request ID 포함
      const response = await handler(request, ...args);
      
      if (response instanceof NextResponse) {
        response.headers.set('x-request-id', requestId);
      }
      
      return response;
    });
  };
}
```

#### ✅ Step 3: API 라우트에 로깅 적용

**파일**: `app/api/devices/route.ts` (수정)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { Logger, requestIdContext } from '@/lib/logger';
import { withRequestId } from '@/lib/auth/middleware';

// ✅ 로깅이 적용된 핸들러
const handler = withRequestId(async (request: NextRequest) => {
  const startTime = Date.now();
  const requestId = requestIdContext.getStore() || '';
  const logger = new Logger({ requestId });

  try {
    // 요청 시작 로그
    logger.logRequestStart(request.method, request.nextUrl.pathname);

    // 인증
    const auth = await verifyAuth(request);
    if (!auth) {
      // 보안 이벤트 로그
      logger.logSecurityEvent('UNAUTHORIZED_ACCESS_ATTEMPT', {
        path: request.nextUrl.pathname,
        method: request.method,
      });
      
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: { 'x-request-id': requestId } }
      );
    }

    logger = new Logger({
      requestId,
      userId: auth.userId,
      tenantId: auth.tenantId,
    });

    // 비즈니스 로직
    if (request.method === 'GET') {
      const devices = await prisma.device.findMany({
        where: { tenantId: auth.tenantId },
      });

      const duration = Date.now() - startTime;
      logger.logRequestEnd(request.method, request.nextUrl.pathname, 200, duration);

      return NextResponse.json(devices, {
        headers: { 'x-request-id': requestId },
      });
    }

    return NextResponse.json(
      { error: 'Method not allowed' },
      { status: 405, headers: { 'x-request-id': requestId } }
    );
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.logError('API_ERROR', error, {
      path: request.nextUrl.pathname,
      method: request.method,
      durationMs: duration,
    });

    return NextResponse.json(
      { error: 'Internal server error', requestId }, // 클라이언트는 Request ID로 추적
      { status: 500, headers: { 'x-request-id': requestId } }
    );
  }
});

export const GET = handler;
export const POST = handler;
```

#### ✅ Step 4: 환경 변수

**.env.local**, **.env.production**:

```bash
# 로깅 설정
LOG_LEVEL="debug"  # 개발: debug, 프로덕션: info
```

---

## 1.7 🔴 [CRITICAL-7] 환경 변수 관리: 프로덕션 보안 자격증명 노출

### 문제 정의
**심각도**: 🔴 **CRITICAL - 자격증명 노출, 접근 제어 우회**

```bash
# ❌ .env.production (찾기 쉬운 위치)
DATABASE_URL="mysql://admin:password123@prod-rds.amazonaws.com:3306/energy_mgmt"
AI_ENGINE_API_KEY="my-secret-key-prod"
NEXTAUTH_SECRET="prod-secret-12345"
JWT_SECRET="jwt-secret-prod"
```

**문제**:
- `.env.production` 파일이 깃 저장소에 포함될 수 있음
- 모든 개발자가 프로덕션 자격증명 접근 가능
- 로컬 머신에 평문 저장 (랜섬웨어/악성코드 위험)
- 배포 로그에 자격증명이 노출될 수 있음

### 최적의 수정 방법

#### ✅ Step 1: .env 파일을 .gitignore에 추가

**파일**: `.gitignore` (확인 및 수정)

```bash
# ❌ 절대 커밋되면 안 되는 파일들
.env
.env.local
.env.development
.env.production
.env.*.local
.env.d.ts

# AWS Credentials
~/.aws/credentials
~/.aws/config

# SSH Keys
*.pem
*.pub
id_rsa

# Logs
logs/
*.log
npm-debug.log*

# Dependencies
node_modules/
.pnpm-store/

# Build outputs
.next/
dist/
build/

# IDEs
.vscode/
.idea/
*.swp
*.swo
```

#### ✅ Step 2: 환경 변수 검증 및 로드

**파일**: `lib/env.ts` (신규)

```typescript
import { z } from 'zod';

// ✅ 환경 변수 스키마 정의
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url().min(1),
  
  // NextAuth
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32, 'NEXTAUTH_SECRET must be at least 32 chars'),
  
  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),
  
  // AI Engine
  AI_ENGINE_URL: z.string().url(),
  AI_ENGINE_API_KEY: z.string().min(20),
  
  // Node Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

type Env = z.infer<typeof envSchema>;

let env: Env;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('Environment variable validation failed:');
    error.errors.forEach((err) => {
      console.error(`  ${err.path.join('.')}: ${err.message}`);
    });
    process.exit(1);
  }
  throw error;
}

export default env;
```

#### ✅ Step 3: AWS Secrets Manager를 사용한 자격증명 관리 (프로덕션)

**파일**: `scripts/setup-secrets.ts` (신규)

```typescript
/**
 * 프로덕션 환경 설정 가이드
 * 
 * 1. AWS Secrets Manager에서 보안 저장소 생성
 * 
 * aws secretsmanager create-secret \
 *   --name prod/energy-mgmt/database-url \
 *   --secret-string "mysql://..." \
 *   --region us-east-1
 * 
 * 2. Lambda/ECS에 IAM 역할 할당하여 Secrets 읽기 권한 부여
 * 
 * 3. 애플리케이션 시작 시 Secrets Manager에서 로드
 */

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: 'us-east-1' });

async function getSecret(secretName: string): Promise<string> {
  try {
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await client.send(command);
    
    if ('SecretString' in response) {
      return response.SecretString;
    }
    
    throw new Error('Secret not found');
  } catch (error) {
    console.error(`Failed to retrieve secret: ${secretName}`, error);
    throw error;
  }
}

// 애플리케이션 시작 시 호출
export async function initializeSecrets() {
  const secrets = {
    DATABASE_URL: await getSecret('prod/energy-mgmt/database-url'),
    AI_ENGINE_API_KEY: await getSecret('prod/energy-mgmt/ai-api-key'),
    NEXTAUTH_SECRET: await getSecret('prod/energy-mgmt/nextauth-secret'),
    JWT_SECRET: await getSecret('prod/energy-mgmt/jwt-secret'),
  };

  // 환경 변수에 설정 (메모리에만, 디스크에 쓰지 않음)
  Object.entries(secrets).forEach(([key, value]) => {
    process.env[key] = value;
  });
}
```

#### ✅ Step 4: 로컬 개발용 .env 템플릿

**파일**: `.env.example` (신규)

```bash
# ✅ 이 파일은 깃에 커밋해도 OK
# 로컬 개발 시 이 파일을 .env.local로 복사하고 값 채우기

# Database (로컬 개발: 테스트 DB 사용)
DATABASE_URL="mysql://dev_user:dev_password@localhost:3306/energy_mgmt_dev"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="[generate with: openssl rand -base64 32]"

# JWT
JWT_SECRET="[generate with: openssl rand -base64 32]"

# AI Engine (로컬 개발: 로컬 FastAPI 서버)
AI_ENGINE_URL="http://localhost:8001"
AI_ENGINE_API_KEY="dev-secret-key"

# Node Environment
NODE_ENV="development"

# Logging
LOG_LEVEL="debug"

# Web App URL
WEB_APP_URL="http://localhost:3000"
```

---

## 1.8 🔴 [CRITICAL-8] CORS & CSRF 보호 부재

### 문제 정의
**심각도**: 🔴 **CRITICAL - 크로스 도메인 공격 가능**

```typescript
// ❌ VULNERABLE - AI Engine
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  // ❌ 모든 도메인 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 최적의 수정 방법

#### ✅ Step 1: CORS 정책 제한

**파일**: `lib/middleware/cors.ts` (신규)

```typescript
import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://app.yourdomain.com',
  'https://admin.yourdomain.com',
];

export function corsMiddleware(request: NextRequest) {
  const origin = request.headers.get('origin');

  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    // CORS 요청 거부
    return new NextResponse('CORS policy violation', { status: 403 });
  }

  const response = NextResponse.next();

  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, PATCH'
  );
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-request-id'
  );
  response.headers.set('Access-Control-Max-Age', '3600');

  return response;
}
```

#### ✅ Step 2: CSRF 토큰 추가

**파일**: `lib/middleware/csrf.ts` (신규)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function verifyCsrfToken(token: string, storedToken: string): boolean {
  return crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(storedToken)
  );
}

export function csrfMiddleware(request: NextRequest) {
  // POST, PUT, DELETE 요청만 검증
  if (['POST', 'PUT', 'DELETE'].includes(request.method)) {
    const csrfToken = request.headers.get('x-csrf-token');
    const sessionCsrfToken = request.cookies.get('csrf-token')?.value;

    if (!csrfToken || !sessionCsrfToken) {
      return NextResponse.json(
        { error: 'CSRF token missing' },
        { status: 403 }
      );
    }

    try {
      if (!verifyCsrfToken(csrfToken, sessionCsrfToken)) {
        return NextResponse.json(
          { error: 'Invalid CSRF token' },
          { status: 403 }
        );
      }
    } catch (error) {
      return NextResponse.json(
        { error: 'CSRF validation failed' },
        { status: 403 }
      );
    }
  }

  return NextResponse.next();
}
```

---

## 📊 Critical Issues Summary

| ID | 제목 | 파일 | 영향도 | 수정 난이도 | 추정 시간 |
|----|------|------|--------|-----------|----------|
| 1 | 멀티테넌시 보안 허점 | API routes | 극대 | 중간 | 6-8시간 |
| 2 | AI Engine 통신 결함 | FastAPI + Next.js | 극대 | 낮음 | 2-3시간 |
| 3 | DB 스키마 불일치 | Prisma + MySQL | 극대 | 중간 | 4-6시간 |
| 4 | 인증 시스템 미구현 | NextAuth | 극대 | 중간 | 4-6시간 |
| 5 | 입력 검증 부재 | 모든 API | 극대 | 높음 | 8-10시간 |
| 6 | 에러/로깅 부재 | 모든 API | 높음 | 중간 | 4-6시간 |
| 7 | 환경 변수 관리 | .env files | 극대 | 낮음 | 1-2시간 |
| 8 | CORS/CSRF 부재 | Middleware | 극대 | 낮음 | 2-3시간 |

---

# 2. 🟠 HIGH PRIORITY ISSUES (1주일 내 해결)

## 2.1 🟠 [HIGH-1] TypeScript 엄격 모드 미설정

### 문제
```json
{
  "compilerOptions": {
    "strict": false  // ❌ 타입 안전성 보장 안 함
  }
}
```

### 수정
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  }
}
```

---

## 2.2 🟠 [HIGH-2] 메모리 누수: Prisma Client 싱글톤 미구현

### 문제
```typescript
// ❌ 매 요청마다 새로운 PrismaClient 생성
const prisma = new PrismaClient();

// vs ✅ 싱글톤 (현재 코드에서 부분 적용)
```

### 수정
```typescript
// ✅ lib/db/prisma.ts
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

---

## 2.3 🟠 [HIGH-3] HTTP 헤더 보안 미설정

### 최적의 수정 방법

**파일**: `lib/middleware/security-headers.ts` (신규)

```typescript
import { NextRequest, NextResponse } from 'next/server';

export function securityHeadersMiddleware(response: NextResponse) {
  // ✅ 클릭재킹 방지
  response.headers.set('X-Frame-Options', 'DENY');
  
  // ✅ MIME 타입 스니핑 방지
  response.headers.set('X-Content-Type-Options', 'nosniff');
  
  // ✅ XSS 필터 활성화
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  // ✅ Referrer Policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // ✅ Content Security Policy
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;"
  );
  
  // ✅ HSTS (HTTPS 강제)
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );

  return response;
}
```

---

## 2.4 🟠 [HIGH-4] 데이터베이스 연결 풀 미구성

### 문제
```bash
# DATABASE_URL에 연결 풀 파라미터 없음
DATABASE_URL="mysql://user:pass@localhost:3306/db"
```

### 수정
```bash
# ✅ PlanetScale/Supabase의 경우
DATABASE_URL="mysql://[user:pass@]host/database?schema=public&connection_limit=10"

# ✅ Prisma에서 연결 풀 설정
prisma:
  datasource:
    url: env("DATABASE_URL")
```

---

## 2.5 🟠 [HIGH-5] 감사 로그 시스템 미구현

**파일**: `lib/audit/logger.ts` (신규)

```typescript
import { prisma } from '@/lib/db/prisma';

export async function logAuditEvent(
  tenantId: string,
  userId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  result: 'success' | 'failure' | 'partial',
  errorMessage?: string,
  ipAddress?: string
) {
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action,
      resourceType,
      resourceId,
      result,
      errorMessage,
      ipAddress,
      requestId: getRequestId(), // AsyncLocalStorage에서
    },
  });
}
```

---

## 2.6 🟠 [HIGH-6] 레이트 제한 미구현

**파일**: `lib/middleware/rate-limit.ts` (신규)

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.REDIS_URL,
  token: process.env.REDIS_TOKEN,
});

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 h'),
});

export async function checkRateLimit(identifier: string) {
  const { success, pending, limit, reset, remaining } = await ratelimit.limit(
    identifier
  );

  return { success, remaining, limit, reset };
}
```

---

## 2.7 🟠 [HIGH-7] AI Engine과 Next.js 간 데이터 직렬화 오류

### 문제
```typescript
// ❌ Python datetime → JSON 변환 문제
{
  "timestamp": "2026-01-31T15:30:00.000Z",  // ← ISO 8601
  "predictions": [
    { "timestamp": "2026-01-31T16:00:00Z", "value": 245.7 }
  ]
}
```

### 수정
```typescript
// ✅ 엄격한 타입 정의
export interface AIPrediction {
  timestamp: string; // ISO 8601
  value: number;
  confidence: number;
}

export interface AIForecastResponse {
  predictions: AIPrediction[];
  accuracy: number;
  model: string;
  generatedAt: string; // ISO 8601
}
```

---

## 2.8 🟠 [HIGH-8] 성능: N+1 쿼리 문제

### 문제
```typescript
// ❌ N+1 쿼리 문제
const devices = await prisma.device.findMany({
  where: { tenantId },
});

// Loop에서 각 device마다 별도 쿼리
devices.forEach(async (device) => {
  const measurements = await prisma.measurement.findMany({
    where: { deviceId: device.id },
  });
});
```

### 수정
```typescript
// ✅ 한 번의 쿼리로 모든 데이터 가져오기
const devices = await prisma.device.findMany({
  where: { tenantId },
  include: {
    measurements: {
      take: 10, // 최근 10개만
      orderBy: { time: 'desc' },
    },
  },
});
```

---

## 2.9 🟠 [HIGH-9] 민감한 정보 노출: API 응답에 비밀번호 해시 포함

### 문제
```typescript
// ❌ passwordHash 포함됨
return NextResponse.json(user); // passwordHash 포함
```

### 수정
```typescript
// ✅ select로 필드 명시적 선택
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: {
    id: true,
    email: true,
    name: true,
    role: true,
    // passwordHash 제외
  },
});
```

---

## 2.10 🟠 [HIGH-10] 동시 요청 제어: 데이터베이스 연결 고갈

### 문제
Prisma의 기본 연결 풀 크기가 충분하지 않을 수 있음

### 수정
```bash
# .env.production
DATABASE_URL="mysql://...?connection_limit=10&pool_timeout=60"
```

---

## 2.11 🟠 [HIGH-11] 테스트 커버리지 부재

### 필수 테스트
```typescript
// ✅ app/__tests__/api/devices.test.ts
import { POST } from '@/app/api/devices/route';

describe('POST /api/devices', () => {
  it('should create device with valid input', async () => {
    // 테스트
  });

  it('should reject invalid tenantId', async () => {
    // 보안 테스트
  });

  it('should validate input schema', async () => {
    // 입력 검증 테스트
  });
});
```

---

## 2.12 🟠 [HIGH-12] API 문서화 부재

### 최적의 수정 방법

**파일**: `lib/swagger/config.ts` (신규)

```typescript
import swaggerJsdoc from 'swagger-jsdoc';

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Energy Management SaaS API',
      version: '1.0.0',
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Development' },
      { url: 'https://api.yourdomain.com', description: 'Production' },
    ],
  },
  apis: ['./app/api/**/*.ts'],
});

export default swaggerSpec;
```

---

# 3. 🟡 MEDIUM PRIORITY ISSUES (2주일 내 해결)

## 3.1 성능 최적화: 이미지 최적화, 캐싱 미설정

## 3.2 UI/UX: 모바일 반응형 미검증

## 3.3 배포: Docker, Kubernetes 설정 부재

## 3.4 모니터링: Prometheus, Grafana 미연동

## 3.5 지표 집계: Measurement 테이블의 시계열 데이터 쿼리 성능

## 3.6 알림: AlertRule 실행 엔진 미구현

## 3.7 백업: 데이터베이스 백업 정책 미정의

## 3.8 마이그레이션: 구 ForecastResult → 신 AiForecastResult 데이터 이관 전략 부재

## 3.9 API 버전 관리: /v1, /v2 경로 전략 부재

## 3.10 동시성 제어: 업데이트 충돌 해결 메커니즘 부재

## 3.11 포기: AI 엔진 학습 모델 버전 관리 불명확

## 3.12 권한: 역할별 기능 제어 미완성

## 3.13 알림 채널: 이메일, SMS, Slack 통합 미구현

## 3.14 보고서: PDF 생성, 스케줄링 미구현

## 3.15 ESS 제어: 배터리 충방전 스케줄 최적화 알고리즘 성숙도 미정

---

# 4. 🟢 LOW PRIORITY ISSUES (1개월 내 해결)

## 4.1 문서화: 아키텍처 문서, API 가이드

## 4.2 개발 환경: Docker Compose 통합 개발 환경 구축

## 4.3 성능 프로파일링: 느린 쿼리 분석

## 4.4 보안 감사: 의존성 취약점 스캔

## 4.5 CI/CD: GitHub Actions 파이프라인

## 4.6 로드 테스트: 동시 사용자 1000명 시뮬레이션

## 4.7 사용자 체험: A/B 테스팅 프레임워크

---

# 🎯 ACTION PLAN: GO-LIVE 준비

## Phase 1: CRITICAL Issues 해결 (1주일)
- [ ] 멀티테넌시 검증 강화
- [ ] 인증 시스템 완성
- [ ] 입력 검증 통합
- [ ] DB 스키마 동기화

**예상 시간**: 25-30시간

## Phase 2: HIGH Priority Issues 해결 (3일)
- [ ] 보안 헤더 추가
- [ ] 레이트 제한 구현
- [ ] 감사 로깅 활성화
- [ ] API 문서화

**예상 시간**: 15-20시간

## Phase 3: 테스트 및 배포 (3-5일)
- [ ] 통합 테스트
- [ ] 성능 테스트
- [ ] 보안 침투 테스트
- [ ] 스테이징 배포

**예상 시간**: 20-30시간

## 총 예상 기간: **2-3주**

---

# 📋 결론

이 시스템은 **산업 표준에 미달하는 상태**입니다.  
프로덕션 배포 전에 위의 **CRITICAL 8개 이슈**를 반드시 해결해야 합니다.

**리스크 평가**: 🔴 **GO 불가능**
- 보안: 심각한 허점 8개
- 운영성: 가시성 및 로깅 부재
- 확장성: 성능 최적화 미실시

**권장**: 최소 **2주 강화 개발** 후 배포 검토
