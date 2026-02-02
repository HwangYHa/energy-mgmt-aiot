# HMI 관점 UI/UX 문제점 분석 및 개선 설계

## 1. 현재 UI 문제점 분석

### 1.1 근본적인 문제: 마케팅 페이지 vs 운영 화면

**현재 상태:**
- 완전한 마케팅 랜딩 페이지 (히어로 섹션, CTA, 고객 후기, 가격 플랜)
- 실제 운영 데이터 전무 (모든 수치가 하드코딩된 마케팅 문구)
- 스크롤 기반 정보 전달 (운영자가 여러 화면을 스크롤해야 정보 확인)

**HMI 요구사항과의 불일치:**
- ❌ 24/7 모니터링 불가능: 실시간 데이터 없음
- ❌ 긴급 상황 대응 불가: 이상 징후/알람 시스템 부재
- ❌ 운영 효율성 저하: 핵심 정보 접근에 다중 스크롤/클릭 필요

---

### 1.2 HMI 3대 핵심 원칙 위반

#### ⚠️ **원칙 1: Situation Awareness (상황 인지) - 실패**

**문제점:**
```typescript
// 현재: 애니메이션 카운터로 가짜 데이터 표시
<MetricCard value={92} suffix="%" label="AI 예측 정확도" />

// 필요: 실시간 MySQL 데이터 조회
// SELECT current_usage, target_usage, status FROM energy_real_time WHERE tenant_id = ?
```

- 실시간 에너지 사용량 표시 없음
- 설비 상태 (정상/경고/위험) 표시 없음
- 탄소 배출량 실시간 추적 없음
- 이상 징후 알람 시스템 부재

**운영 영향:**
- 피크 부하 초과 시 즉시 인지 불가 → 전력 수요 관리 실패
- 설비 고장 징후 발견 지연 → 생산 중단 위험
- 탄소 목표 초과 사전 대응 불가 → 규제 위반 가능성

#### ⚠️ **원칙 2: Minimal Click Depth (최소 클릭) - 실패**

**문제점:**
```
현재 정보 접근 경로:
1. 메인 페이지 → 로그인 (2클릭)
2. 로그인 → 대시보드 (1클릭)
3. 대시보드 → 에너지 상세 (1클릭)
4. 상세 → 특정 사이트 (1클릭)
총 5클릭 + 여러 페이지 로딩

HMI 요구사항: 0클릭 (로그인 후 모든 정보 즉시 표시)
```

- 핵심 정보가 여러 섹션에 분산 (스크롤 필요)
- 실제 운영 데이터 접근에 페이지 전환 필요
- 긴급 상황 시 빠른 의사결정 불가

#### ⚠️ **원칙 3: Error Prevention (오류 방지) - 실패**

**문제점:**
- 시각적 경고 시스템 부재 (빨강/노랑/초록 상태 표시 없음)
- 임계값 초과 사전 알림 없음
- 운영자의 주관적 판단에 의존 → 인적 오류 가능성 높음

---

### 1.3 에너지 관리 운영 관점 문제점

#### 📊 **에너지 정보 부재**

**현재 표시 정보:**
- 없음 (마케팅 문구만 존재)

**HMI에서 필요한 정보:**
```sql
-- 실시간 전력 사용량 (kW)
SELECT
  SUM(m.active_power) as current_usage,
  t.energy_target,
  t.peak_demand_limit
FROM measurements m
JOIN sites s ON m.site_id = s.id
JOIN tenant t ON s.tenant_id = t.id
WHERE s.tenant_id = ? AND m.timestamp > NOW() - INTERVAL 5 MINUTE
GROUP BY t.id
```

**필수 표시 항목:**
1. **현재 전력 사용량**: 실시간 kW (5분 단위 갱신)
2. **목표 대비 상태**:
   - 초록: < 80% (안전)
   - 노랑: 80-95% (주의)
   - 빨강: > 95% (위험)
3. **피크 상태**: 계약 전력 대비 현재 사용률
4. **절감/초과량**: 목표 대비 실시간 차이 (kWh, ₩)

#### 🏭 **설비 상태 정보 부재**

**현재 표시 정보:**
- 없음

**HMI에서 필요한 정보:**
```sql
-- 설비별 상태 집계
SELECT
  COUNT(CASE WHEN status = 'normal' THEN 1 END) as normal_count,
  COUNT(CASE WHEN status = 'warning' THEN 1 END) as warning_count,
  COUNT(CASE WHEN status = 'danger' THEN 1 END) as danger_count,
  (SELECT device_name FROM devices WHERE status != 'normal' ORDER BY updated_at DESC LIMIT 5) as recent_abnormal
FROM devices
WHERE tenant_id = ? AND is_active = 1
```

**필수 표시 항목:**
1. **설비 상태 요약**: 정상/경고/위험 개수
2. **이상 설비 목록**: 최근 5건 (설비명, 상태, 시간)
3. **긴급 조치 필요**: 위험 상태 설비 강조 표시

#### 🌱 **탄소 배출 정보 부재**

**현재 표시 정보:**
- 없음

**HMI에서 필요한 정보:**
```sql
-- 실시간 탄소 배출량
SELECT
  SUM(co2_emissions) as current_emissions,
  baseline_emissions,
  target_reduction_rate
FROM emissions_data
WHERE tenant_id = ? AND DATE(timestamp) = CURDATE()
```

**필수 표시 항목:**
1. **실시간 배출량**: 당일 누적 CO2 (kg)
2. **기준선 대비**: 목표 대비 절감/초과 상태
3. **즉시 표시**: 목표 초과 시 경고

---

### 1.4 운영자 사용성 문제

#### 👁️ **야간/장시간 운영 부적합**

**문제점:**
```css
/* 현재: 밝은 배경 + 강한 컬러 조합 */
bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900
text-5xl text-white /* 과도하게 큰 텍스트 */
blur-3xl opacity-20 /* 불필요한 장식 효과 */
```

- 배경 그라디언트 효과 → 눈의 피로 증가
- 과도한 blur/shadow 효과 → 24시간 모니터링 시 눈부심
- 애니메이션 카운터 → 주의 분산

**HMI 색상 원칙:**
- 어두운 배경 (#1a1a1a ~ #2a2a2a)
- 높은 대비 텍스트 (WCAG AAA)
- 색상 코드 표준화:
  - 빨강 (#ef4444): 위험/긴급
  - 노랑 (#fbbf24): 경고/주의
  - 초록 (#10b981): 정상/안전
  - 파랑 (#3b82f6): 정보/중립

#### 🎬 **불필요한 애니메이션**

**현재 문제:**
```typescript
// requestAnimationFrame 기반 카운터 애니메이션
function useCountUp(end: number, duration: number = 2000) {
  // ... 2초 동안 숫자 증가 애니메이션
}

// hover 효과, shadow 효과 등
hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/10
```

**HMI에서 허용되는 애니메이션:**
- ✅ 상태 변화 시 깜빡임 (위험 알람만)
- ✅ 데이터 갱신 표시 (간단한 펄스)
- ❌ 장식 애니메이션
- ❌ 카운터 애니메이션
- ❌ hover 효과

---

## 2. HMI 개선 방향 및 설계 원칙

### 2.1 HMI 설계 원칙

#### **원칙 1: Single Screen Principle (단일 화면 원칙)**
```
모든 핵심 정보를 첫 화면에 표시
- 스크롤 최소화 (1080p 기준 1.5 화면 이내)
- 페이지 전환 없이 상태 파악 가능
- F11 전체화면 모드 최적화
```

#### **원칙 2: Information Hierarchy (정보 계층)**
```
위험도 기반 배치 (위 → 아래)
1. 긴급 알람 (빨강 배너)
2. 실시간 핵심 지표 (에너지/설비/탄소)
3. 상세 정보 (차트/이력)
4. 부가 정보 (예측/추천)
```

#### **원칙 3: Immediate Recognition (즉시 인지)**
```
색상 코드 + 크기 + 위치
- 위험: 큰 빨강 표시 + 상단 배치
- 경고: 중간 노랑 표시 + 중앙 배치
- 정상: 작은 초록 표시 + 하단 배치
```

#### **원칙 4: Minimal Cognitive Load (인지 부하 최소화)**
```
- 숫자는 명확하게 (단위 포함, 천단위 구분)
- 상태는 색상으로 (텍스트 불필요)
- 트렌드는 아이콘으로 (↑ ↓)
```

---

### 2.2 화면 레이아웃 구조

```
┌─────────────────────────────────────────────────────────────┐
│ [헤더] EnergyAI | 테넌트명 | 사용자 | 🔔알람(2)    [시간 14:23] │
├─────────────────────────────────────────────────────────────┤
│ ⚠️ [긴급 알람 배너] 사이트 A 피크 전력 95% 초과 (조치 필요) │
├───────────────────┬───────────────────┬─────────────────────┤
│                   │                   │                     │
│  [에너지 위젯]     │  [설비 위젯]       │  [탄소 위젯]         │
│                   │                   │                     │
│  현재: 1,234 kW   │  ● 정상: 45       │  오늘: 8,234 kg CO2 │
│  목표: 1,500 kW   │  ⚠ 경고: 3        │  기준: 10,000 kg    │
│  🟢 82%           │  🔴 위험: 1       │  🟢 -17.7%          │
│  절감: 256 kW     │                   │                     │
│  (₩38.4k)         │  [이상 설비 목록]  │  [배출량 추이]      │
│                   │  • 냉동기 #3      │   ▂▄▆▃▅▄           │
│  [실시간 차트]     │    압축기 과열    │                     │
│   ▁▂▃▅▇▆▄▃▁      │    30분 전        │                     │
│                   │                   │                     │
├───────────────────┴───────────────────┴─────────────────────┤
│ [사이트별 상세 현황]                                          │
│  사이트 A  🟢 정상  | 1,234 kW | 3개 경고                    │
│  사이트 B  🟡 주의  |   987 kW | 피크 92%                    │
│  사이트 C  🔴 위험  | 1,567 kW | 계약전력 초과               │
├─────────────────────────────────────────────────────────────┤
│ [AI 예측 & 최적화 추천]                                       │
│  • 17:00 피크 예상 (1,678 kW) - ESS 방전 권장               │
│  • 사이트 B HVAC 설정 조정으로 123 kW 절감 가능              │
└─────────────────────────────────────────────────────────────┘
```

---

### 2.3 컴포넌트 설계

#### **Widget 아키텍처**

```typescript
// HMI 위젯 공통 구조
interface HMIWidgetProps<T> {
  title: string;
  data: T;
  status: 'normal' | 'warning' | 'danger';
  refreshInterval?: number; // 기본 5초
  onAlert?: (alert: Alert) => void;
}

// 상태별 색상 매핑
const STATUS_COLORS = {
  normal: { bg: 'bg-green-900/20', border: 'border-green-500', text: 'text-green-400' },
  warning: { bg: 'bg-yellow-900/20', border: 'border-yellow-500', text: 'text-yellow-400' },
  danger: { bg: 'bg-red-900/20', border: 'border-red-500', text: 'text-red-400' },
};
```

#### **핵심 위젯 3종**

1. **EnergyWidget** (에너지 모니터링)
```typescript
interface EnergyData {
  currentUsage: number; // kW
  targetUsage: number;
  peakLimit: number;
  savings: number; // kWh
  savingsCost: number; // ₩
  trend: number[]; // 실시간 차트 데이터
  status: 'normal' | 'warning' | 'danger';
}
```

2. **EquipmentWidget** (설비 상태)
```typescript
interface EquipmentData {
  normalCount: number;
  warningCount: number;
  dangerCount: number;
  abnormalDevices: {
    deviceName: string;
    status: string;
    message: string;
    timestamp: Date;
  }[];
}
```

3. **CarbonWidget** (탄소 배출)
```typescript
interface CarbonData {
  currentEmissions: number; // kg CO2
  baselineEmissions: number;
  reductionRate: number; // %
  status: 'normal' | 'warning' | 'danger';
  trend: number[]; // 시간별 배출량
}
```

---

### 2.4 데이터베이스 연동 설계

#### **API 엔드포인트**

```typescript
// GET /api/dashboard/overview
// 대시보드 전체 데이터 (5초마다 갱신)
interface DashboardOverview {
  energy: EnergyData;
  equipment: EquipmentData;
  carbon: CarbonData;
  alerts: Alert[];
  sites: SiteStatus[];
  timestamp: Date;
}
```

#### **MySQL 쿼리 최적화**

```sql
-- 1. 실시간 에너지 데이터 (인덱스 활용)
CREATE INDEX idx_measurements_recent
ON measurements(tenant_id, timestamp DESC, site_id);

SELECT
  s.id as site_id,
  s.name as site_name,
  SUM(m.active_power) as current_usage,
  MAX(m.timestamp) as last_update
FROM sites s
LEFT JOIN measurements m ON s.id = m.site_id
  AND m.timestamp > NOW() - INTERVAL 5 MINUTE
WHERE s.tenant_id = ? AND s.is_active = 1
GROUP BY s.id, s.name;

-- 2. 설비 상태 집계 (상태별 카운트)
SELECT
  status,
  COUNT(*) as count
FROM devices
WHERE tenant_id = ? AND is_active = 1
GROUP BY status;

-- 3. 탄소 배출량 (당일 누적)
SELECT
  SUM(co2_emissions) as total_emissions,
  MAX(timestamp) as last_update
FROM emissions_data
WHERE tenant_id = ? AND DATE(timestamp) = CURDATE();
```

---

## 3. 구현 계획

### 3.1 파일 구조

```
app/
  page.tsx                          # HMI 대시보드 메인
  api/
    dashboard/
      overview/
        route.ts                    # 통합 대시보드 API
      energy/
        route.ts                    # 에너지 상세 데이터
      equipment/
        route.ts                    # 설비 상세 데이터
      carbon/
        route.ts                    # 탄소 상세 데이터

components/
  hmi/
    EnergyWidget.tsx                # 에너지 모니터링 위젯
    EquipmentWidget.tsx             # 설비 상태 위젯
    CarbonWidget.tsx                # 탄소 배출 위젯
    AlertBanner.tsx                 # 긴급 알람 배너
    SiteStatusTable.tsx             # 사이트별 현황
    RealtimeChart.tsx               # 실시간 차트
    StatusIndicator.tsx             # 상태 표시 (●)
    TrendIndicator.tsx              # 트렌드 표시 (↑↓)

lib/
  hooks/
    use-dashboard-data.ts           # 대시보드 데이터 fetching
    use-realtime-updates.ts         # 5초 자동 갱신
  utils/
    hmi-colors.ts                   # HMI 색상 시스템
    status-calculator.ts            # 상태 계산 로직
```

### 3.2 구현 순서

1. ✅ 문제점 분석 (현재 문서)
2. ⏭️ API 엔드포인트 생성 (데이터 연동)
3. ⏭️ HMI 위젯 컴포넌트 생성
4. ⏭️ app/page.tsx 전면 리팩토링
5. ⏭️ 실시간 갱신 로직 구현
6. ⏭️ 알람 시스템 통합
7. ⏭️ 테스트 및 최적화

---

## 4. 핵심 개선 사항 요약

| 항목 | 현재 (마케팅 페이지) | 개선 후 (HMI 대시보드) |
|------|---------------------|----------------------|
| **데이터** | 하드코딩된 마케팅 수치 | MySQL 실시간 데이터 (5초 갱신) |
| **정보 접근** | 5+ 클릭 + 스크롤 | 0클릭 (로그인 후 즉시) |
| **상태 인지** | 없음 | 색상 코드 (빨강/노랑/초록) |
| **알람** | 없음 | 실시간 긴급 알람 배너 |
| **야간 운영** | 부적합 (밝은 배경) | 최적화 (어두운 배경, 높은 대비) |
| **애니메이션** | 과도함 (카운터, hover) | 최소화 (상태 변화만) |
| **설비 상태** | 없음 | 실시간 정상/경고/위험 집계 |
| **탄소 추적** | 없음 | 실시간 배출량 + 목표 대비 |
| **피크 관리** | 없음 | 계약전력 대비 실시간 모니터링 |

---

**다음 단계**: API 엔드포인트 생성 및 app/page.tsx 리팩토링 시작
