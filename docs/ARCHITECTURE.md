# 탄소이음 시스템 아키텍처

> EMS AIoT Platform — 전체 시스템 설계 문서
> 작성일: 2026-03-24

---

## 1. 시스템 개요

```
탄소이음 = 멀티테넌트 에너지 관리 SaaS
  - IoT 디바이스에서 에너지 데이터 수집 (MQTT/Modbus)
  - AI 기반 이상 탐지 + 에너지 절감 추천
  - ESG 탄소 보고서 자동 생성 (GHG Protocol, TCFD, CSRD, US SEC)
  - 탄소 배출권 거래 (K-ETS, VCM)
  - 수요 반응(DR) 자동 참여
  - 사업자 단위 멀티테넌트 격리
```

---

## 2. 기술 스택

| 레이어 | 기술 | 버전 |
|-------|------|------|
| **Frontend** | Next.js (App Router) | 15.x |
| **UI** | Tailwind CSS + Lucide Icons + Recharts | - |
| **ORM** | Prisma | 6.x |
| **DB** | MySQL | 8.0 |
| **IoT 통신** | MQTT (Mosquitto 브로커) | 2.x |
| **인증** | NextAuth.js + 커스텀 JWT | v5 |
| **결제** | 토스페이먼츠 | v1 |
| **SMS/알림톡** | Solapi | REST API |
| **PDF** | PDFKit (serverExternalPackages) | - |
| **Excel** | ExcelJS | - |
| **언어** | TypeScript | 5.x |
| **패키지** | npm | - |

---

## 3. 폴더 구조

```
energy-mgmt-aiot/
├── app/                          # Next.js App Router
│   ├── (public)/                 # 공개 페이지 (랜딩, 가격, 지원)
│   ├── (auth)/                   # 로그인/회원가입
│   ├── (tenant)/                 # 인증 필요 페이지
│   │   ├── dashboard/            # 메인 대시보드
│   │   ├── admin/                # 관리자 메뉴
│   │   │   ├── tenants/          # 테넌트 관리 (super_admin 전용)
│   │   │   ├── users/            # 사용자 관리
│   │   │   ├── security/         # 보안 (정책, 랜섬웨어 대응)
│   │   │   ├── erp/              # ERP 대시보드 (super_admin 전용)
│   │   │   └── equipment/        # 자원/장비 관리
│   │   └── super-admin/          # Super Admin 리텐션 대시보드
│   └── api/                      # API Routes
│       ├── admin/                # 관리 API
│       ├── ai/                   # AI 분석 API
│       ├── analytics/            # 분석 API
│       ├── auth/                 # 인증 API (NextAuth)
│       ├── compliance/           # 규정 준수 API
│       ├── cron/                 # 배치 작업
│       ├── esg-reports/          # ESG 보고서 API
│       ├── monitoring/           # 모니터링 / 이벤트
│       ├── payment/              # 결제 API
│       └── super-admin/          # Super Admin API
├── components/                   # 재사용 컴포넌트
│   ├── layout/                   # Sidebar, Header, etc.
│   ├── landing/                  # 랜딩 페이지 컴포넌트
│   ├── support/                  # 지원 페이지 컴포넌트
│   └── ui/                       # 공통 UI (Button, Input, etc.)
├── lib/                          # 공통 라이브러리
│   ├── api/                      # API 클라이언트 + 응답 헬퍼
│   ├── auth/                     # 인증 검증 (verify.ts, permissions.ts)
│   ├── constants/                # 에러 메시지, 상수
│   ├── db/                       # Prisma 클라이언트 + 테넌트 격리
│   ├── domains/                  # DDD 도메인 레이어
│   │   ├── carbon/               # Carbon DDD (Big4 감사 대응)
│   │   ├── carbon-trading/       # 탄소 거래 + VCM/블록체인/XBRL
│   │   └── esg-report/           # ESG 보고서 엔진
│   ├── middleware/               # Plan 제한, 인증 미들웨어
│   ├── modules/                  # 기능 모듈
│   ├── services/                 # 서비스 레이어
│   └── utils/                   # 유틸리티 함수
├── prisma/
│   ├── schema.prisma             # DB 스키마
│   └── migrations/               # 마이그레이션 히스토리
├── features/                     # Feature Slice (carbon, dr 등)
├── hooks/                        # React 커스텀 훅
├── infra/                        # 인프라 설정 (Mosquitto 등)
├── docs/                         # 문서 (현재 파일 위치)
└── public/                       # 정적 파일 (폰트, 이미지)
```

---

## 4. 데이터베이스 스키마 개요

### 핵심 테이블 그룹

```
[테넌트 & 사용자]
  tenant ──< user ──< user_access_log
  tenant ──< subscription >── plan

[사이트 & 디바이스]
  tenant ──< site ──< device ──< measurement
  site ──< gateway

[탄소 & ESG]
  tenant ──< emissions_data          (Scope1/3 수동 등록)
  tenant ──< emission_factor         (배출계수, 버전관리)
  emission_factor ──< emission_factor_audit_log (Hash Chain)
  tenant ──< esg_report ──< report_data_source
  esg_report ──< report_audit_log
  esg_report ──< report_generation_log

[탄소 거래]
  tenant ──< carbon_credit_ledger
  tenant ──< carbon_vcm_project
  tenant ──< carbon_token_record
  tenant ──< tenant_carbon_wallet

[수요 반응 (DR)]
  tenant ──< dr_event ──< dr_participant

[결제]
  tenant ──< subscription >── plan
  subscription ──< payment_history

[알림]
  user ──< notification_log
  user ──< notification_rule

[장비/자원관리]
  tenant ──< equipment ──< equipment_lot
  tenant ──< equipment_stock

[Super Admin 리텐션]
  tenant ──< tenant_churn_score
  tenant ──< retention_event
  tenant ──< onboarding_milestone
  tenant ──< retention_action
  kakao_alimtalk_log

[보안]
  tenant ──< security_policy
  tenant ──< user_login_history
  tenant ──< ransomware_detection_log

[메뉴 시스템]
  menu_group ──< menu_item
  tenant.settings.menu (JSON) — 테넌트별 메뉴 제한
```

---

## 5. 인증 & 권한 시스템

### 인증 방식 (3가지)

```
1. NextAuth 세션 쿠키     — 브라우저 사용자 (Google OAuth)
2. Bearer JWT             — API 클라이언트 / 외부 연동
3. auth-token 쿠키        — 커스텀 인증 (Naver OAuth)
```

`lib/auth/verify.ts` — 모든 인증 방식을 통합 처리

### 역할 체계 (RBAC 5단계)

```
super_admin (4) → 플랫폼 전체 관리
tenant_admin (3) → 테넌트 관리자
manager (2)     → 현장 관리자
operator (1)    → 운영자
viewer (0)      → 읽기 전용
```

`lib/auth/permissions.ts` — `hasPermission(user, requiredRole)` 함수

---

## 6. 멀티테넌트 격리

```typescript
// lib/db/tenant-prisma.ts
const tenantPrisma = withTenant(tenantId);
// → 모든 쿼리에 tenantId 필터 자동 적용
// → 테넌트 간 데이터 격리 보장
```

---

## 7. IoT 데이터 흐름

```
현장 디바이스 (Modbus/BACnet)
    → IoT 게이트웨이 (Edge)
        → MQTT 브로커 (Mosquitto)
            → Next.js API (app/api/monitoring/ingest/)
                → Measurement 테이블 저장
                    → 실시간 AI 분석 (이상 탐지)
                    → 탄소 배출 자동 계산
```

토픽 구조: `ems/{tenantId}/{siteId}/{deviceId}/data`

---

## 8. ESG 보고서 생성 파이프라인

```
보고서 생성 요청 (API)
    → ReportDataCollector.collectEmissionsRecords()
    → ReportGenerationLog 생성 (pending)
    → ReportEngine.generate() — 7단계:
        1. 데이터 수집
        2. 표준 템플릿 적용 (GHG/TCFD/CSRD/SEC 등)
        3. 섹션 빌드 (8개 표준 섹션)
        4. 스냅샷 저장 (activity, factor, engine)
        5. SHA-256 무결성 해시 생성
        6. DB 저장 (ESGReport)
        7. PDF/Excel/JSON 렌더링
    → ReportGenerationLog 완료 (success/failed)
    → ReportDataSource 연결 (데이터 계보)
    → ReportAuditLog 기록 (Append-only)
```

지원 표준: `GHG_PROTOCOL | K_MRV | CDP | ISSB | TCFD | CSRD | US_SEC | ISO_14064 | K_ETS`

---

## 9. Super Admin 리텐션 시스템

```
[이벤트 수집]
  POST /api/monitoring/events → RetentionEvent 저장
  → markMilestone() — 온보딩 마일스톤 자동 업데이트

[야간 배치 (02:00 KST)]
  GET /api/cron/churn-score
    → runBatchScoring()
        → 모든 활성 테넌트 순회
        → collectSignals(tenantId) — 6개 신호 수집
        → calculateChurnScore(signals) — 가중치 공식 계산
        → TenantChurnScore 저장
    → Critical 테넌트 자동 리텐션 액션
        → runRetentionPipeline() — 카카오 알림톡 발송

[Churn Score 공식]
  Score = onboarding×0.20 + engagement×0.25 + org×0.15
        + roi×0.20 + support×0.10 + payment×0.10

  0~39  → normal (정상)
  40~69 → warning (주의)
  70~100 → critical (즉시 조치 필요)
```

---

## 10. CSRF 보안

```typescript
// 모든 POST/PUT/PATCH/DELETE 요청에 자동 포함
import { apiPost, apiPatch, apiDelete } from '@/lib/api/client';

// FormData는 수동으로 헤더 추가 필요
const csrfToken = await getCsrfToken();
fetch('/api/upload', {
  headers: { 'X-CSRF-Token': csrfToken },
  body: formData,
});
```

미들웨어(`middleware.ts`)에서 헤더 + 쿠키 이중 검증.

---

## 11. 알려진 제약사항

| 항목 | 제약 | 해결 방법 |
|------|------|-----------|
| `prisma generate` EPERM | 개발 서버 실행 중 DLL 잠금 | 서버 종료 후 실행 또는 `(prisma as any).xxx` 패턴 |
| PDFKit in Next.js 15 | 서버 컴포넌트 번들링 불가 | `serverExternalPackages: ['pdfkit']` + webpack externals |
| MQTT 로컬 개발 | 불필요한 연결 오류 | `.env.local`에서 `MQTT_BROKER_URL=` (빈값) |
| MySQL `trigger` 예약어 | 컬럼명 충돌 | `trigger_type` 컬럼명 + Prisma `@map("trigger_type")` |
| Vercel Cron 제한 | 서버리스 함수 최대 300초 | `export const maxDuration = 300` 설정 |
| 한국 폰트 (PDF) | 개발 환경 Windows | `C:\Windows\Fonts\malgun.ttf` 자동 감지 |

---

## 12. 관련 문서

- [INFRASTRUCTURE.md](INFRASTRUCTURE.md) — 서버 선정 + 배포 자동화
- [BUSINESS.md](BUSINESS.md) — 사업자 등록 + 도메인 정보
- [DEPLOYMENT.md](DEPLOYMENT.md) — 배포 단계별 가이드
