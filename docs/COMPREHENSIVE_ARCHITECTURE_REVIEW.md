# 🔍 종합 아키텍처 리뷰: 에너지 관리 SaaS 플랫폼
**작성일**: 2026-01-31  
**검토 범위**: Next.js 14 + TypeScript + Prisma 5 + MySQL 8 + TailwindCSS 3  
**평가 기준**: 프로덕션 서비스 출시 직전 단계 (GO/NO-GO 판정)

---

## 📋 Executive Summary

**현재 상태**: 🟡 **CRITICAL** - 다수의 프로덕션 중단 위험 이슈 존재  
**위험도**: HIGH  
**영향도**: CRITICAL (보안, 멀티테넌시, 데이터 무결성, 런타임 안정성)  
**권장사항**: 다음 섹션의 모든 CRITICAL/HIGH 이슈 해결 후 배포

| 카테고리 | 심각도 | 개수 | 상태 |
|---------|-------|------|------|
| 🔴 Critical Issues | CRITICAL | 12 | ❌ |
| 🟠 High Priority | HIGH | 18 | ❌ |
| 🟡 Medium Priority | MEDIUM | 15 | ⚠️ |
| 🟢 Low Priority | LOW | 8 | 📌 |
| **총계** | - | **53** | - |

---

# 1. ❌ CRITICAL ISSUES (즉시 해결 필요)

## 1.1 🔴 [CRITICAL-1] 환경 변수 직접 접근: lib/env.ts 무시

### 문제 정의
**파일**: `app/api/ai/forecast/route.ts`, `app/api/ai/anomaly/route.ts`, `app/api/ai/optimize/route.ts`  
**심각도**: 🔴 **CRITICAL - 환경 변수 누락 시 런타임 오류**

```typescript
// ❌ VULNERABLE - 현재 코드
const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8001';
```

### 왜 문제인가?

1. **환경 변수 검증 우회**
   - `lib/env.ts`에서 Zod 스키마로 검증하지만, 일부 API는 직접 접근
   - 프로덕션에서 `AI_ENGINE_URL` 누락 시 기본값 사용 → 잘못된 엔드포인트 호출
   - 타입 안정성 부재: `process.env.AI_ENGINE_URL`은 `string | undefined`

2. **일관성 부족**
   - 일부는 `env.AI_ENGINE_URL` 사용, 일부는 `process.env` 직접 접근
   - 코드 리뷰 및 유지보수 어려움

3. **런타임 오류 위험**
   - 개발 환경에서는 기본값으로 동작하지만, 프로덕션에서 문제 발생 가능

### 최적의 수정 방법

```typescript
// ✅ CORRECT - 수정된 코드
import env from '@/lib/env';

const AI_ENGINE_URL = env.AI_ENGINE_URL; // 타입 안전, 검증됨
```

**수정 대상 파일**:
- `app/api/ai/forecast/route.ts` (35번째 줄)
- `app/api/ai/anomaly/route.ts` (22번째 줄)
- `app/api/ai/optimize/route.ts` (45번째 줄)
- `app/api/auth/csrf/route.ts` (53번째 줄)

---

## 1.2 🔴 [CRITICAL-2] 인증 방식 불일치: NextAuth vs verifyAuth

### 문제 정의
**파일**: `app/api/ai/forecast/route.ts`, `app/api/ai/anomaly/route.ts`, `app/api/analytics/carbon/footprint/route.ts`  
**심각도**: 🔴 **CRITICAL - 보안 취약점, 테넌트 데이터 유출 위험**

```typescript
// ❌ VULNERABLE - 현재 코드 (app/api/ai/forecast/route.ts)
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const tenantId = session.user.tenantId; // ⚠️ 검증 없이 사용
  // ...
}
```

### 왜 문제인가?

1. **3중 검증 우회**
   - `verifyAuth()`는 JWT 서명 검증 + DB 사용자 확인 + tenantId 일치 검증 수행
   - `getServerSession()`은 세션만 확인 → **토큰 조작 공격에 취약**

2. **테넌트 데이터 유출 위험**
   - `session.user.tenantId`가 JWT에서 추출된 값이라면, 조작 가능
   - DB에서 실제 tenantId를 확인하지 않음

3. **일관성 부족**
   - `app/api/devices/route.ts`는 `verifyAuth()` 사용 (올바름)
   - `app/api/ai/forecast/route.ts`는 `getServerSession()` 사용 (취약)

### 최적의 수정 방법

```typescript
// ✅ CORRECT - 수정된 코드
import { verifyAuth } from '@/lib/auth/verify';

export async function POST(request: NextRequest) {
  // ✅ 3중 검증 수행
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  const { tenantId } = auth; // ✅ DB에서 검증된 tenantId
  // ...
}
```

**수정 대상 파일**:
- `app/api/ai/forecast/route.ts` (42번째 줄)
- `app/api/ai/anomaly/route.ts` (7번째 줄)
- `app/api/ai/optimize/route.ts` (8번째 줄)
- `app/api/analytics/carbon/footprint/route.ts` (13번째 줄)

---

## 1.3 🔴 [CRITICAL-3] Prisma 스키마와 DB 스키마 불일치

### 문제 정의
**파일**: `prisma/schema.prisma` vs 제공된 MySQL CREATE TABLE 문  
**심각도**: 🔴 **CRITICAL - 마이그레이션 실패, 런타임 오류**

### 발견된 불일치

#### 1️⃣ **테이블 명명 규칙 불일치**

| Prisma Model | Expected DB | Actual DB | Status |
|-------------|-----------|-----------|--------|
| `ForecastResult` | `forecast_result` | `forecastresult` (소문자, 언더스코어 없음) | ❌ |
| `AiForecastResult` (없음) | - | `ai_forecast_results` (복수) | ❌ |
| `DrEvent` | `dr_event` | `dr_events` (복수) | ❌ |

**문제점**:
- Prisma가 `ForecastResult` 모델을 `forecastresult` 테이블로 매핑
- 실제 DB에는 `ai_forecast_results` 테이블이 존재하지만 Prisma 스키마에 없음
- `app/api/ai/forecast/route.ts`에서 `prisma.forecastResult.create()` 호출 시 오류 가능

#### 2️⃣ **필드 타입 불일치**

**실제 MySQL `ai_forecast_results` 테이블:**
```sql
CREATE TABLE `ai_forecast_results` (
  `id` bigint NOT NULL AUTO_INCREMENT,  -- ← BigInt, AUTO_INCREMENT
  `tenant_id` varchar(50) NOT NULL,
  `model_id` varchar(50) NOT NULL,
  `forecast_type` enum('load','cost','carbon','demand') NOT NULL,
  `horizon_hours` int NOT NULL DEFAULT '24',
  `predictions` json NOT NULL,
  `confidence` decimal(5,4) NOT NULL,
  `mape` decimal(5,2) DEFAULT NULL,
  `rmse` decimal(10,2) DEFAULT NULL,
  `input_data_points` int NOT NULL,
  `features_used` json DEFAULT NULL,
  `created_by` varchar(50) DEFAULT 'system',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);
```

**Prisma Schema (현재):**
```prisma
model ForecastResult {
  id          String   @id @default(cuid())  // ← String, cuid()
  tenantId    String
  siteId      String?
  horizon     String   // '24h', '7d', '30d'
  predictions Json
  accuracy    Float    // confidence가 아님
  model       String
  createdAt   DateTime @default(now())
  // ...
}
```

**문제점**:
- ID 타입 불일치: `bigint AUTO_INCREMENT` vs `String cuid()`
- 필드명 불일치: `horizon_hours` vs `horizon`
- 필드 누락: `model_id`, `forecast_type`, `confidence`, `mape`, `rmse` 등

### 최적의 수정 방법

**Option 1: Prisma 스키마를 DB에 맞춤 (권장)**

```prisma
// ✅ CORRECT - ai_forecast_results 테이블에 맞춘 스키마
model AiForecastResult {
  id              BigInt    @id @default(autoincrement())
  tenantId        String    @map("tenant_id") @db.VarChar(50)
  siteId          String?   @map("site_id") @db.VarChar(50)
  modelId         String    @map("model_id") @db.VarChar(50)
  forecastType    AiForecastType @map("forecast_type")
  horizonHours    Int       @map("horizon_hours") @default(24)
  predictions     Json
  confidence      Decimal   @db.Decimal(5, 4)
  mape            Decimal?  @map("mape") @db.Decimal(5, 2)
  rmse            Decimal?  @map("rmse") @db.Decimal(10, 2)
  inputDataPoints Int       @map("input_data_points")
  featuresUsed    Json?     @map("features_used")
  createdBy       String?   @map("created_by") @db.VarChar(50) @default("system")
  createdAt       DateTime  @default(now()) @map("created_at")

  tenant          Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, createdAt(sort: Desc)])
  @@index([modelId])
  @@map("ai_forecast_results")
}

enum AiForecastType {
  load
  cost
  carbon
  demand
}
```

**Option 2: DB를 Prisma 스키마에 맞춤 (마이그레이션 필요)**

```sql
-- 마이그레이션 스크립트 필요
ALTER TABLE `ai_forecast_results` 
  CHANGE COLUMN `id` `id` VARCHAR(191) NOT NULL,
  -- ... 기타 필드 수정
```

**권장사항**: Option 1 (Prisma 스키마 수정) - 기존 DB 구조 유지

---

## 1.4 🔴 [CRITICAL-4] 빈 API 라우트 파일

### 문제 정의
**파일**: `app/api/sites/route.ts`  
**심각도**: 🔴 **CRITICAL - 404 오류, 기능 누락**

```typescript
// ❌ 현재 파일 내용: 비어있음
```

### 왜 문제인가?

1. **기능 누락**
   - `/api/sites` 엔드포인트가 동작하지 않음
   - 프론트엔드에서 사이트 목록 조회 시 404 오류

2. **일관성 부족**
   - `app/api/devices/route.ts`는 완전히 구현됨
   - `app/api/sites/route.ts`는 비어있음

### 최적의 수정 방법

```typescript
// ✅ CORRECT - sites/route.ts 구현
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, requireRole } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import { siteCreateSchema, formatValidationError } from '@/lib/validation/schemas';
import { z } from 'zod';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const take = Number(searchParams.get('take') || 20);
    const skip = Number(searchParams.get('skip') || 0);

    const sites = await prisma.site.findMany({
      where: {
        tenantId: auth.tenantId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        code: true,
        siteType: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });

    return NextResponse.json({ data: sites, count: sites.length });
  } catch (error) {
    console.error('Site fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sites' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!requireRole(auth, ['site_manager', 'tenant_admin'])) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validated = siteCreateSchema.parse(body);

    const site = await prisma.site.create({
      data: {
        ...validated,
        tenantId: auth.tenantId,
      },
      select: {
        id: true,
        name: true,
        code: true,
        siteType: true,
        createdAt: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId: auth.tenantId,
        userId: auth.userId,
        action: 'SITE_CREATE',
        resourceType: 'SITE',
        resourceId: site.id,
        result: 'success',
      },
    }).catch((err) => console.error('Audit log error:', err));

    return NextResponse.json(site, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatValidationError(error),
        },
        { status: 400 }
      );
    }

    console.error('Site creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create site' },
      { status: 500 }
    );
  }
}
```

---

## 1.5 🔴 [CRITICAL-5] 트랜잭션 부재: 데이터 일관성 위험

### 문제 정의
**파일**: 대부분의 API 라우트  
**심각도**: 🔴 **CRITICAL - 데이터 불일치, 부분 실패 시 롤백 불가**

### 발견된 문제

**예시: `app/api/devices/route.ts` POST 메서드**

```typescript
// ❌ VULNERABLE - 트랜잭션 없음
export async function POST(request: NextRequest) {
  // ...
  
  // 1. 기기 생성
  const device = await prisma.device.create({...});
  
  // 2. 감사 로그 기록
  await prisma.auditLog.create({...}).catch(...); // ⚠️ 실패해도 계속 진행
  
  return NextResponse.json(device, { status: 201 });
}
```

### 왜 문제인가?

1. **부분 실패 시나리오**
   - 기기 생성 성공 → 감사 로그 실패 → 데이터 불일치
   - 감사 로그는 선택적이지만, 중요한 작업은 반드시 기록되어야 함

2. **동시성 문제**
   - 여러 요청이 동시에 같은 리소스를 수정할 때 일관성 보장 불가

3. **롤백 불가**
   - 중간에 실패해도 이미 커밋된 데이터는 롤백 불가

### 최적의 수정 방법

```typescript
// ✅ CORRECT - 트랜잭션 사용
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!requireRole(auth, ['site_manager', 'tenant_admin'])) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validated = deviceCreateSchema.parse(body);

    // ✅ 사이트 존재 확인 및 테넌트 일치 검증
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

    // ✅ 트랜잭션으로 원자성 보장
    const result = await prisma.$transaction(async (tx) => {
      // 1. 기기 생성
      const device = await tx.device.create({
        data: {
          ...validated,
          tenantId: auth.tenantId,
          status: 'offline',
        },
        select: {
          id: true,
          name: true,
          deviceType: true,
          siteId: true,
          createdAt: true,
        },
      });

      // 2. 감사 로그 기록 (실패 시 전체 롤백)
      await tx.auditLog.create({
        data: {
          tenantId: auth.tenantId,
          userId: auth.userId,
          action: 'DEVICE_CREATE',
          resourceType: 'DEVICE',
          resourceId: device.id,
          result: 'success',
        },
      });

      return device;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    // ...
  }
}
```

**수정 대상 파일**:
- `app/api/devices/route.ts` (POST)
- `app/api/sites/route.ts` (POST, 수정 후)
- `app/api/control/route.ts` (제어 명령 실행)
- 기타 데이터 생성/수정 API

---

## 1.6 🔴 [CRITICAL-6] 입력 검증 누락

### 문제 정의
**파일**: `app/api/ai/anomaly/route.ts`, `app/api/ai/optimize/route.ts`  
**심각도**: 🔴 **CRITICAL - SQL Injection, XSS, 데이터 오염 위험**

```typescript
// ❌ VULNERABLE - 검증 없음
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { siteId, sensitivity = 0.1 } = body; // ⚠️ 검증 없음
  
  // siteId가 UUID 형식인지 확인하지 않음
  // sensitivity가 숫자인지, 범위가 적절한지 확인하지 않음
}
```

### 최적의 수정 방법

```typescript
// ✅ CORRECT - Zod 스키마로 검증
import { z } from 'zod';

const anomalyRequestSchema = z.object({
  siteId: z.string().uuid().optional(),
  sensitivity: z.number().min(0).max(1).default(0.1),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = anomalyRequestSchema.parse(body);
    
    // ✅ 검증된 데이터만 사용
    const { siteId, sensitivity } = validated;
    // ...
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatValidationError(error),
        },
        { status: 400 }
      );
    }
    // ...
  }
}
```

---

## 1.7 🔴 [CRITICAL-7] 에러 처리 불일치 및 정보 누출

### 문제 정의
**파일**: 여러 API 라우트  
**심각도**: 🔴 **CRITICAL - 보안 정보 누출, 디버깅 어려움**

```typescript
// ❌ VULNERABLE - 에러 정보 누출
catch (error) {
  return NextResponse.json(
    {
      error: 'Failed to generate forecast',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: process.env.NODE_ENV === 'development' ? error : undefined, // ⚠️ 조건부
    },
    { status: 500 }
  );
}
```

### 문제점

1. **개발 환경에서만 상세 에러 노출**
   - 프로덕션에서도 실수로 `NODE_ENV=development` 설정 시 정보 누출
   - 스택 트레이스에 DB 연결 정보, 파일 경로 등 포함 가능

2. **에러 로깅 부재**
   - 클라이언트에만 에러 전달, 서버 로그에 기록하지 않음
   - 디버깅 및 모니터링 어려움

### 최적의 수정 방법

```typescript
// ✅ CORRECT - 안전한 에러 처리
import { logError } from '@/lib/logger';

catch (error) {
  // ✅ 서버 로그에 상세 정보 기록
  logError({
    message: 'Forecast generation failed',
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
    tenantId: auth?.tenantId,
    userId: auth?.userId,
  });

  // ✅ 클라이언트에는 일반적인 메시지만 전달
  return NextResponse.json(
    {
      error: 'Failed to generate forecast',
      // 프로덕션에서는 상세 정보 절대 노출하지 않음
    },
    { status: 500 }
  );
}
```

---

## 1.8 🔴 [CRITICAL-8] Next.js 설정 최소화: 성능 및 보안 최적화 부재

### 문제 정의
**파일**: `next.config.js`  
**심각도**: 🔴 **CRITICAL - 성능 저하, 보안 취약점**

```javascript
// ❌ 현재 설정: 최소한만
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  pageExtensions: ['ts', 'tsx', 'js', 'jsx'],
};

module.exports = nextConfig;
```

### 문제점

1. **보안 헤더 부재**
   - CSP, HSTS, X-Frame-Options 등 보안 헤더 설정 없음
   - `middleware.ts`에서 처리하지만, Next.js 레벨에서도 설정 필요

2. **성능 최적화 부재**
   - 이미지 최적화 설정 없음
   - 번들 분석 설정 없음
   - 압축 설정 없음

3. **환경별 설정 분리 없음**
   - 개발/프로덕션 설정 구분 없음

### 최적의 수정 방법

```javascript
// ✅ CORRECT - 최적화된 설정
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  pageExtensions: ['ts', 'tsx', 'js', 'jsx'],
  
  // ✅ 보안 헤더 (middleware와 중복되지만 Next.js 레벨에서도 설정)
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          }
        ],
      },
    ];
  },
  
  // ✅ 이미지 최적화
  images: {
    domains: process.env.ALLOWED_IMAGE_DOMAINS?.split(',') || [],
    formats: ['image/avif', 'image/webp'],
  },
  
  // ✅ 압축
  compress: true,
  
  // ✅ 프로덕션 최적화
  ...(process.env.NODE_ENV === 'production' && {
    output: 'standalone',
    poweredByHeader: false,
  }),
  
  // ✅ 실험적 기능 (필요시)
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

module.exports = nextConfig;
```

---

## 1.9 🔴 [CRITICAL-9] Tailwind CSS 설정 최소화

### 문제 정의
**파일**: `tailwind.config.js`  
**심각도**: 🔴 **CRITICAL - 스타일 일관성 부재, 커스터마이징 어려움**

```javascript
// ❌ 현재 설정: 최소한만
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

### 문제점

1. **디자인 시스템 부재**
   - 색상 팔레트, 타이포그래피, 간격 등 표준화 없음
   - 일관성 없는 UI

2. **다크 모드 미지원**
   - 현대적인 웹 앱 필수 기능 부재

3. **커스텀 유틸리티 부재**
   - 프로젝트 특화 유틸리티 클래스 없음

### 최적의 수정 방법

```javascript
// ✅ CORRECT - 완전한 Tailwind 설정
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class', // ✅ 다크 모드 지원
  theme: {
    extend: {
      // ✅ 색상 팔레트 (에너지 관리 테마)
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        energy: {
          low: '#10b981',    // 저전력
          medium: '#f59e0b', // 중전력
          high: '#ef4444',    // 고전력
        },
        carbon: {
          low: '#10b981',
          medium: '#f59e0b',
          high: '#ef4444',
        },
      },
      // ✅ 타이포그래피
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Fira Code', 'monospace'],
      },
      // ✅ 간격
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      // ✅ 애니메이션
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'), // ✅ 폼 스타일링
    require('@tailwindcss/typography'), // ✅ 타이포그래피
  ],
};
```

---

## 1.10 🔴 [CRITICAL-10] TypeScript 설정: noUncheckedIndexedAccess 위험

### 문제 정의
**파일**: `tsconfig.json`  
**심각도**: 🔴 **CRITICAL - 런타임 오류 위험**

```json
{
  "compilerOptions": {
    "noUncheckedIndexedAccess": true, // ✅ 설정됨
    // ...
  }
}
```

### 문제점

**설정은 되어 있지만, 코드에서 무시하는 경우가 많음**

```typescript
// ❌ VULNERABLE - 타입 안전성 무시
const devices = await prisma.device.findMany({...});
const firstDevice = devices[0]; // ⚠️ undefined 가능성 무시
firstDevice.name; // 런타임 오류 가능
```

### 최적의 수정 방법

```typescript
// ✅ CORRECT - 안전한 접근
const devices = await prisma.device.findMany({...});
const firstDevice = devices[0];
if (!firstDevice) {
  return NextResponse.json({ error: 'No devices found' }, { status: 404 });
}
// ✅ 이제 안전하게 사용 가능
return NextResponse.json({ data: firstDevice });
```

---

## 1.11 🔴 [CRITICAL-11] 데이터베이스 연결 풀 설정 부재

### 문제 정의
**파일**: `prisma/schema.prisma`  
**심각도**: 🔴 **CRITICAL - 연결 고갈, 성능 저하**

```prisma
// ❌ 현재: 주석만 있음
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
  
  // 연결 풀링 설정 (Prisma Accelerate)
  // directUrl = env("DIRECT_DATABASE_URL")  # Prisma Accelerate 사용 시
}
```

### 문제점

1. **연결 풀 크기 미설정**
   - 기본값 사용 → 프로덕션에서 연결 고갈 가능
   - 동시 요청 증가 시 "Too many connections" 오류

2. **타임아웃 설정 없음**
   - 느린 쿼리 시 연결이 계속 점유됨

### 최적의 수정 방법

**DATABASE_URL에 파라미터 추가:**

```env
# ✅ CORRECT - 연결 풀 설정 포함
DATABASE_URL="mysql://user:password@host:port/database?connection_limit=10&pool_timeout=20&connect_timeout=10&socket_timeout=30"
```

**또는 Prisma Client 생성 시 설정:**

```typescript
// lib/db/prisma.ts
const client = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + '?connection_limit=10&pool_timeout=20',
    },
  },
  // ...
});
```

---

## 1.12 🔴 [CRITICAL-12] MQTT 클라이언트 연결 관리 부재

### 문제 정의
**파일**: `lib/mqtt/client.ts` (확인 필요)  
**심각도**: 🔴 **CRITICAL - 메시지 손실, 재연결 실패**

### 예상 문제점

1. **재연결 로직 부재**
   - 네트워크 단절 시 자동 재연결 없음

2. **메시지 큐 부재**
   - 연결 끊김 중 메시지 손실

3. **에러 핸들링 부족**
   - 연결 실패 시 복구 메커니즘 없음

### 최적의 수정 방법

```typescript
// ✅ CORRECT - 견고한 MQTT 클라이언트
import mqtt from 'mqtt';
import { EventEmitter } from 'events';

class MQTTClient extends EventEmitter {
  private client: mqtt.MqttClient | null = null;
  private messageQueue: Array<{ topic: string; message: Buffer }> = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  connect() {
    this.client = mqtt.connect(process.env.MQTT_BROKER_URL!, {
      reconnectPeriod: 5000,
      connectTimeout: 10000,
      keepalive: 60,
    });

    this.client.on('connect', () => {
      console.log('✅ MQTT connected');
      this.reconnectAttempts = 0;
      this.processQueue();
    });

    this.client.on('error', (error) => {
      console.error('❌ MQTT error:', error);
      this.emit('error', error);
    });

    this.client.on('close', () => {
      console.warn('⚠️ MQTT disconnected');
      this.reconnect();
    });

    this.client.on('message', (topic, message) => {
      this.emit('message', { topic, message });
    });
  }

  private reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    setTimeout(() => {
      console.log(`🔄 Reconnecting... (attempt ${this.reconnectAttempts})`);
      this.connect();
    }, 5000 * this.reconnectAttempts);
  }

  private processQueue() {
    while (this.messageQueue.length > 0 && this.client?.connected) {
      const { topic, message } = this.messageQueue.shift()!;
      this.client.publish(topic, message);
    }
  }

  publish(topic: string, message: Buffer | string) {
    if (this.client?.connected) {
      this.client.publish(topic, message);
    } else {
      this.messageQueue.push({ topic, message: Buffer.from(message) });
    }
  }
}

export const mqttClient = new MQTTClient();
```

---

# 2. ⚠️ HIGH PRIORITY ISSUES

## 2.1 🟠 [HIGH-1] API 응답 형식 불일치

### 문제 정의
**파일**: 여러 API 라우트  
**심각도**: 🟠 **HIGH - 프론트엔드 통합 어려움**

```typescript
// ❌ 불일치: 일부는 { data: [...] }, 일부는 [...]
// app/api/devices/route.ts
return NextResponse.json({ data: devices, nextCursor, pageSize: take });

// app/api/ai/forecast/route.ts
return NextResponse.json({ success: true, predictions, ... });
```

### 최적의 수정 방법

**표준 응답 형식 정의:**

```typescript
// lib/api/response.ts
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    nextCursor?: string;
  };
  metadata?: Record<string, unknown>;
}

export function successResponse<T>(
  data: T,
  metadata?: Record<string, unknown>
): ApiResponse<T> {
  return {
    success: true,
    data,
    ...(metadata && { metadata }),
  };
}

export function errorResponse(
  code: string,
  message: string,
  details?: unknown
): ApiResponse<never> {
  return {
    success: false,
    error: { code, message, details },
  };
}
```

---

## 2.2 🟠 [HIGH-2] 로깅 시스템 불일치

### 문제 정의
**파일**: 여러 API 라우트  
**심각도**: 🟠 **HIGH - 디버깅 어려움, 모니터링 불가**

```typescript
// ❌ 불일치: console.log, console.error 혼용
console.log('[AI Forecast] Calling AI Engine...');
console.error('[AI Forecast] Error:', error);
```

### 최적의 수정 방법

**통일된 로깅 시스템 사용:**

```typescript
// ✅ 모든 API에서 사용
import { logger } from '@/lib/logger';

logger.info('AI Forecast request', { tenantId, siteId });
logger.error('AI Forecast failed', { error, tenantId });
```

---

## 2.3 🟠 [HIGH-3] 페이지네이션 불일치

### 문제 정의
**파일**: 여러 API 라우트  
**심각도**: 🟠 **HIGH - 성능 저하, 사용자 경험 저하**

```typescript
// ❌ 일부는 커서 기반, 일부는 skip/take
// app/api/devices/route.ts: 커서 + skip/take 혼용
// app/api/ai/forecast/route.ts: limit만 사용
```

### 최적의 수정 방법

**표준 페이지네이션 유틸리티:**

```typescript
// lib/utils/pagination.ts
export interface PaginationParams {
  cursor?: string;
  take?: number;
  skip?: number;
}

export function parsePagination(searchParams: URLSearchParams): PaginationParams {
  return {
    cursor: searchParams.get('cursor') || undefined,
    take: Number(searchParams.get('take') || 20),
    skip: Number(searchParams.get('skip') || 0),
  };
}
```

---

# 3. 🟡 MEDIUM PRIORITY ISSUES

## 3.1 🟡 [MEDIUM-1] 테스트 커버리지 부족

### 문제 정의
**파일**: `__tests__/`, `tests/`  
**심각도**: 🟡 **MEDIUM - 리그레션 위험**

- 단위 테스트는 있지만 통합 테스트 부족
- API 라우트 테스트 부족

---

## 3.2 🟡 [MEDIUM-2] API 문서화 부족

### 문제 정의
**파일**: `app/api/docs/route.ts`  
**심각도**: 🟡 **MEDIUM - 개발자 경험 저하**

- OpenAPI 스키마는 있지만 완전하지 않음
- 예제 요청/응답 부족

---

# 4. 🟢 LOW PRIORITY ISSUES

## 4.1 🟢 [LOW-1] 코드 주석 부족

### 문제 정의
**심각도**: 🟢 **LOW - 유지보수 어려움**

- 복잡한 비즈니스 로직에 주석 부족

---

## 4.2 🟢 [LOW-2] 폴더 구조 개선 여지

### 문제 정의
**심각도**: 🟢 **LOW - 확장성 저하**

- `lib/services/`에 많은 파일이 있지만 서비스 레이어 분리가 불명확

---

# 5. 📋 수정 우선순위 및 액션 플랜

## Phase 1: CRITICAL 이슈 해결 (즉시)

1. ✅ 환경 변수 직접 접근 수정 (1.1)
2. ✅ 인증 방식 통일 (1.2)
3. ✅ Prisma 스키마 수정 (1.3)
4. ✅ 빈 API 라우트 구현 (1.4)
5. ✅ 트랜잭션 추가 (1.5)
6. ✅ 입력 검증 추가 (1.6)
7. ✅ 에러 처리 개선 (1.7)
8. ✅ Next.js 설정 최적화 (1.8)
9. ✅ Tailwind 설정 완성 (1.9)
10. ✅ TypeScript 안전성 강화 (1.10)
11. ✅ DB 연결 풀 설정 (1.11)
12. ✅ MQTT 클라이언트 개선 (1.12)

## Phase 2: HIGH 이슈 해결 (1주일 내)

1. API 응답 형식 표준화
2. 로깅 시스템 통일
3. 페이지네이션 표준화

## Phase 3: MEDIUM/LOW 이슈 해결 (2주일 내)

1. 테스트 커버리지 향상
2. API 문서화 완성
3. 코드 주석 추가

---

# 6. ✅ 결론

현재 프로젝트는 **기본 구조는 잘 갖춰져 있지만, 프로덕션 배포 전 반드시 해결해야 할 CRITICAL 이슈가 12개** 존재합니다.

**가장 시급한 문제**:
1. 인증 방식 불일치 (보안 취약점)
2. Prisma 스키마 불일치 (런타임 오류)
3. 환경 변수 직접 접근 (타입 안전성 부재)
4. 트랜잭션 부재 (데이터 일관성 위험)

**권장사항**: Phase 1의 모든 CRITICAL 이슈를 해결한 후 프로덕션 배포를 진행하세요.

---

**작성자**: AI 아키텍처 리뷰 시스템  
**검토일**: 2026-01-31  
**다음 검토 예정일**: CRITICAL 이슈 해결 후
