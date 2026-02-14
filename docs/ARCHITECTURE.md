# 탄소중립 에너지 관리 솔루션 (EMS) 아키텍처 설계

## 1. 구현 우선순위 (Implementation Priority)

### 우선순위 결정 기준
| 기준 | 설명 | 가중치 |
|------|------|--------|
| 데이터 의존성 | 다른 기능의 기반이 되는 데이터 | 30% |
| 서비스 가치 | 핵심 비즈니스 가치 전달 | 25% |
| 사용자 온보딩 | 첫 사용 경험에 필수 | 25% |
| 운영 안정성 | 시스템 안정 운영에 필수 | 20% |

### Phase 1: 기반 인프라 (Foundation) - Week 1-2
**목표: 데이터 수집의 기반이 되는 핵심 관리 기능**

| 순위 | 메뉴 | 근거 | 의존성 |
|------|------|------|--------|
| 1 | 사이트 관리 | 모든 데이터의 기준점, 테넌트 하위 조직 단위 | 없음 |
| 2 | 설비 모니터링 | 실제 데이터 수집 대상, 사이트에 종속 | 사이트 |
| 3 | 사용자 관리 | 접근 제어, 역할 기반 권한 | 사이트 |

### Phase 2: 핵심 대시보드 (Core Dashboard) - Week 3-4
**목표: 실시간 데이터 시각화 및 현황 파악**

| 순위 | 메뉴 | 근거 | 의존성 |
|------|------|------|--------|
| 4 | 대시보드 개요 | KPI 한눈에 파악, 의사결정 지원 | 사이트, 설비 |
| 5 | 실시간 모니터링 | 현재 상태 즉시 확인 | 설비 데이터 |
| 6 | 사이트 조회 | 사이트별 상세 현황 | 사이트 |

### Phase 3: 분석 및 인사이트 (Analytics) - Week 5-6
**목표: 데이터 기반 의사결정 지원**

| 순위 | 메뉴 | 근거 | 의존성 |
|------|------|------|--------|
| 7 | 에너지 분석 | 소비 패턴 파악, 절감 기회 발굴 | 측정 데이터 |
| 8 | 리포트 | 정기 보고서 생성, 규제 대응 | 분석 데이터 |
| 9 | AI 예측 | 수요 예측, 최적화 기반 | 히스토리 데이터 |

### Phase 4: 제어 및 최적화 (Control) - Week 7-8
**목표: 능동적 에너지 관리**

| 순위 | 메뉴 | 근거 | 의존성 |
|------|------|------|--------|
| 10 | 수동 제어 | 운영자 직접 제어 | 설비, 권한 |
| 11 | DR 참여 | 수요반응 이벤트 참여 | 제어 기능 |

### Phase 5: 고급 기능 (Advanced) - Week 9-10
**목표: 차별화된 고급 기능**

| 순위 | 메뉴 | 근거 | 의존성 |
|------|------|------|--------|
| 12 | 디지털 트윈 | 3D 시각화, 시뮬레이션 | 전체 데이터 |
| 13 | 알림 설정 | 사용자 맞춤 알림 | 알림 규칙 |
| 14 | 구독 관리 | 과금, 플랜 관리 | 사용량 데이터 |

---

## 2. 메뉴 구조 재설계 (Restructured Menu)

```
[대시보드] - LayoutDashboard
├── 개요 (/dashboard)                    # 핵심 KPI, 요약 정보
├── 실시간 모니터링 (/monitoring)         # 실시간 데이터 스트림
└── 디지털 트윈 (/digital-twin)          # 3D 시각화

[사이트 & 설비] - Building2              # 메뉴명 변경 제안
├── 사이트 목록 (/sites)                 # 사이트 CRUD
├── 사이트 상세 (/sites/[id])            # 사이트 대시보드
├── 설비 목록 (/devices)                 # 설비 CRUD
└── 설비 상세 (/devices/[id])            # 설비 상세 + 실시간

[제어] - Sliders
├── 수동 제어 (/control/manual)          # 직접 제어
├── DR 참여 (/control/dr)                # 수요반응
└── 자동 최적화 (/control/optimization)  # AI 기반 자동화

[분석 & 리포트] - BarChart3
├── 에너지 분석 (/analytics/energy)      # 소비 분석
├── 비용 분석 (/analytics/cost)          # 비용 최적화
├── 탄소 분석 (/analytics/carbon)        # 탄소 배출
├── AI 예측 (/analytics/forecast)        # 예측 분석
└── 리포트 (/reports)                    # 보고서 생성

[관리] - Settings
├── 사용자 관리 (/admin/users)           # 사용자 CRUD
├── 구독 관리 (/admin/subscription)      # 플랜/결제
└── 알림 규칙 (/admin/alerts)            # 알림 설정

[설정] - Cog
├── 계정 설정 (/settings/account)        # 개인 설정
├── 알림 설정 (/settings/notifications)  # 알림 채널
└── 도움말 (/settings/help)              # 매뉴얼/FAQ
```

---

## 3. 데이터베이스 설계 (Database Schema)

### 핵심 도메인 모델
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Tenant    │────<│    Site     │────<│   Device    │
│  (테넌트)   │     │  (사업장)   │     │   (설비)    │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    User     │     │   Gateway   │     │   Metric    │
│  (사용자)   │     │ (게이트웨이)│     │ (계측포인트)│
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │ Measurement │
                                        │  (측정값)   │
                                        └─────────────┘
```

### 에너지/탄소 도메인
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   DrEvent   │     │EmissionsData│     │   Report    │
│ (DR 이벤트) │     │ (탄소배출)  │     │  (보고서)   │
└─────────────┘     └─────────────┘     └─────────────┘
```

---

## 4. API 설계 원칙 (API Design)

### RESTful 엔드포인트 구조
```
/api/v1/
├── sites/                    # 사이트 관리
│   ├── GET    /              # 목록 조회
│   ├── POST   /              # 생성
│   ├── GET    /:id           # 상세 조회
│   ├── PUT    /:id           # 수정
│   ├── DELETE /:id           # 삭제
│   └── GET    /:id/dashboard # 사이트 대시보드
│
├── devices/                  # 설비 관리
│   ├── GET    /              # 목록 조회
│   ├── POST   /              # 생성
│   ├── GET    /:id           # 상세 조회
│   ├── PUT    /:id           # 수정
│   ├── DELETE /:id           # 삭제
│   ├── GET    /:id/metrics   # 계측 포인트
│   └── GET    /:id/realtime  # 실시간 데이터
│
├── measurements/             # 측정 데이터
│   ├── GET    /              # 조회 (시계열)
│   └── POST   /              # 수집 (게이트웨이)
│
├── analytics/                # 분석
│   ├── GET    /energy        # 에너지 분석
│   ├── GET    /cost          # 비용 분석
│   ├── GET    /carbon        # 탄소 분석
│   └── GET    /forecast      # 예측
│
├── control/                  # 제어
│   ├── POST   /commands      # 제어 명령
│   ├── GET    /dr-events     # DR 이벤트
│   └── POST   /dr-events/:id/participate  # DR 참여
│
└── admin/                    # 관리
    ├── users/                # 사용자 관리
    ├── subscriptions/        # 구독 관리
    └── alerts/               # 알림 규칙
```

### 응답 표준 형식
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    timestamp: string;
  };
}
```

---

## 5. 프론트엔드 컴포넌트 구조 (Frontend Architecture)

### 디렉토리 구조
```
components/
├── common/                   # 공통 컴포넌트
│   ├── DataTable/           # 테이블
│   ├── Modal/               # 모달
│   ├── Form/                # 폼 요소
│   └── Charts/              # 차트 컴포넌트
│
├── dashboard/               # 대시보드 전용
│   ├── DashboardPanel/
│   ├── StatDisplay/
│   ├── CircularGauge/
│   └── ImageGauge/
│
├── sites/                   # 사이트 관련
│   ├── SiteCard/
│   ├── SiteForm/
│   └── SiteMap/
│
├── devices/                 # 설비 관련
│   ├── DeviceCard/
│   ├── DeviceForm/
│   ├── DeviceStatus/
│   └── DeviceMetrics/
│
├── monitoring/              # 모니터링
│   ├── RealtimeChart/
│   ├── AlertBanner/
│   └── StatusIndicator/
│
└── layout/                  # 레이아웃
    ├── Header/
    ├── Sidebar/
    └── Breadcrumb/
```

### 상태 관리
```typescript
// 전역 상태 (Zustand 또는 Context)
interface GlobalState {
  tenant: Tenant | null;
  user: User | null;
  sites: Site[];
  selectedSite: Site | null;
  alerts: Alert[];
  realtimeConnected: boolean;
}

// 페이지별 로컬 상태 (React Query)
// - 서버 상태는 React Query로 관리
// - 캐싱, 무효화, 리페칭 자동화
```

---

## 6. 실시간 데이터 아키텍처

### WebSocket 연결 구조
```
클라이언트  ──WebSocket──>  API Server  ──>  Redis Pub/Sub
                                │
                                ▼
                           Gateway
                                │
                                ▼
                           Devices
```

### 이벤트 타입
```typescript
enum RealtimeEventType {
  MEASUREMENT = 'measurement',
  DEVICE_STATUS = 'device_status',
  ALERT = 'alert',
  DR_EVENT = 'dr_event',
  CONTROL_RESULT = 'control_result',
}
```

---

## 7. 보안 설계 (Security)

### 인증/인가
- NextAuth.js + JWT
- Role-based Access Control (RBAC)
- Tenant 격리 (모든 쿼리에 tenantId 필터)

### API 보안
- Rate Limiting (플랜별 차등)
- CORS 설정
- Input Validation (Zod)
- SQL Injection 방지 (Prisma)

### 데이터 보안
- 민감 데이터 암호화
- 감사 로그 (AuditLog)
- 세션 관리

---

## 8. 확장성 고려사항

### 수평 확장
- Stateless API 서버
- Redis 세션 저장소
- 데이터베이스 Read Replica

### 시계열 데이터
- 파티셔닝 (월별)
- 데이터 보존 정책 (플랜별)
- 집계 테이블 (hourly, daily, monthly)

### ESG/규제 확장
- 보고서 템플릿 시스템
- 규제 프레임워크 플러그인
- 외부 시스템 연동 (API)
