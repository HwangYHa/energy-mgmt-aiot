# API 명세서 (API Specification)

## 📡 기본 정보

**Base URL**: `https://api.yourapp.com` (프로덕션) / `http://localhost:3000` (개발)  
**인증**: NextAuth.js JWT 토큰  
**Content-Type**: `application/json`  
**응답 형식**: JSON  

---

## 🔐 인증

모든 API 요청에는 유효한 세션이 필요합니다.

```typescript
// 자동으로 처리됨 (getServerSession)
Authorization: Bearer <JWT_TOKEN>
```

---

## 🔮 예측 API

### 1. 부하 예측 요청

**Endpoint**: `POST /api/ai/forecast`

**요청**:
```json
{
  "horizon": "24h",
  "siteId": "site-123"
}
```

**매개변수**:
| 필드 | 타입 | 필수 | 설명 | 예시 |
|------|------|------|------|------|
| horizon | string | ✅ | 예측 시간대 (24h, 7d, 30d) | `"24h"` |
| siteId | string | ❌ | 사이트 ID (미지정시 테넌트 전체) | `"site-456"` |

**성공 응답** (200):
```json
{
  "predictions": [
    {
      "timestamp": "2024-01-30T11:00:00Z",
      "value": 152.5,
      "lower": 140.2,
      "upper": 164.8
    },
    {
      "timestamp": "2024-01-30T12:00:00Z",
      "value": 155.3,
      "lower": 142.1,
      "upper": 168.5
    }
  ],
  "accuracy": 0.92,
  "model": "LSTM",
  "horizon": "24h",
  "generatedAt": "2024-01-30T10:30:00Z"
}
```

**응답 필드**:
| 필드 | 타입 | 설명 |
|------|------|------|
| predictions | Array | 예측 데이터 배열 |
| predictions[].timestamp | ISO8601 | 예측 시간 |
| predictions[].value | number | 예측값 (kW) |
| predictions[].lower | number | 신뢰 구간 하한 (95%) |
| predictions[].upper | number | 신뢰 구간 상한 (95%) |
| accuracy | number | 모델 정확도 (MAPE, 0-1) |
| model | string | 사용된 모델 ("LSTM") |
| horizon | string | 예측 시간대 |
| generatedAt | ISO8601 | 예측 생성 시간 |

**에러 응답**:

```json
// 401 - 인증 실패
{
  "error": "Unauthorized",
  "message": "유효한 세션이 필요합니다"
}

// 400 - 불충분한 데이터
{
  "error": "BadRequest",
  "message": "최소 48개의 과거 데이터 포인트가 필요합니다",
  "details": {
    "available": 20,
    "required": 48
  }
}

// 500 - 서버 오류
{
  "error": "InternalServerError",
  "message": "예측 생성 중 오류 발생",
  "requestId": "req-12345"
}
```

**cURL 예제**:
```bash
curl -X POST http://localhost:3000/api/ai/forecast \
  -H "Content-Type: application/json" \
  -d '{"horizon": "24h"}'
```

---

## 🔍 이상 탐지 API

### 2. 이상 탐지 요청

**Endpoint**: `POST /api/ai/anomaly`

**요청**:
```json
{
  "sensitivity": 0.1,
  "siteId": "site-123"
}
```

**매개변수**:
| 필드 | 타입 | 필수 | 범위 | 기본값 | 설명 |
|------|------|------|------|-------|------|
| sensitivity | number | ❌ | 0.05 - 0.3 | 0.1 | 민감도 (낮을수록 엄격함) |
| siteId | string | ❌ | - | - | 특정 사이트만 분석 |

**성공 응답** (200):
```json
{
  "anomalies": [
    {
      "timestamp": "2024-01-30T12:00:00Z",
      "value": 289.5,
      "score": -0.85,
      "severity": "high",
      "reason": "급격한 전력 증가",
      "recommendedAction": "장비 상태 점검 필요"
    },
    {
      "timestamp": "2024-01-30T13:15:00Z",
      "value": 75.2,
      "score": -0.42,
      "severity": "medium",
      "reason": "일일 패턴 이상",
      "recommendedAction": "모니터링 필요"
    }
  ],
  "anomalyCount": 2,
  "anomalyRate": 0.0083,
  "severityDistribution": {
    "critical": 0,
    "high": 1,
    "medium": 1,
    "low": 0
  },
  "model": "IsolationForest",
  "analyzedPeriod": {
    "start": "2024-01-29T10:00:00Z",
    "end": "2024-01-30T10:00:00Z"
  }
}
```

**심각도 레벨**:
| 레벨 | 스코어 | 색상 | 대응 시간 | 설명 |
|------|--------|------|----------|------|
| critical | < -0.7 | 🔴 Red | 즉시 | 긴급 대응 필요 |
| high | -0.7 ~ -0.4 | 🟠 Orange | 1시간 | 원인 파악 필요 |
| medium | -0.4 ~ -0.1 | 🟡 Yellow | 4시간 | 모니터링 필요 |
| low | > -0.1 | 🔵 Blue | 일반 | 정상 범위 |

**이상 원인 분류**:
```
- "급격한 전력 증가": 비정상적인 부하 증가
- "급격한 전력 감소": 갑작스러운 부하 단절
- "일일 패턴 이상": 시간대별 패턴 변화
- "장비 이상": 평균값 대비 큰 편차
- "계절 패턴 변화": 계절 기준 이상 값
```

**cURL 예제**:
```bash
curl -X POST http://localhost:3000/api/ai/anomaly \
  -H "Content-Type: application/json" \
  -d '{"sensitivity": 0.1}'
```

---

## ⚡ 최적화 API

### 3. 에너지 최적화 요청

**Endpoint**: `POST /api/ai/optimize`

**요청**:
```json
{
  "targetReduction": 50,
  "siteId": "site-123"
}
```

**매개변수**:
| 필드 | 타입 | 필수 | 범위 | 설명 |
|------|------|------|------|------|
| targetReduction | number | ✅ | 10 - 200 | 목표 감소량 (kW) |
| siteId | string | ❌ | - | 특정 사이트만 분석 |

**성공 응답** (200):
```json
{
  "peakAnalysis": {
    "peakHours": [14, 15, 16, 17, 18, 19],
    "peakLoad": 210,
    "baseLoad": 150,
    "peakLoadReduction": "23.8%"
  },
  "essSchedule": [
    {
      "hour": 2,
      "operation": "charge",
      "power": 10,
      "energy": 10,
      "efficiency": 0.9
    },
    {
      "hour": 14,
      "operation": "discharge",
      "power": 15,
      "energy": 15,
      "efficiency": 0.9
    }
  ],
  "hvacSettings": {
    "baseTemperature": 24,
    "peakHourAdjustment": 1,
    "businessHourStrategy": "aggressive",
    "estimatedLoadReduction": 0.15
  },
  "loadShifting": [
    {
      "deviceType": "EV Charger",
      "currentLoad": 20,
      "shiftedLoad": 10,
      "estimatedReduction": 10,
      "shiftWindow": "22:00 - 06:00"
    }
  ],
  "estimatedSavings": {
    "daily": 1200,
    "monthly": 36000,
    "annual": 432000,
    "dailyRevenue": 300000,
    "monthlyRevenue": 9000000,
    "annualRevenue": 108000000
  },
  "recommendations": [
    "피크 시간(14-19시) 온도를 1°C 상향 조정합니다",
    "ESS를 오전 2-6시에 충전하고 피크 시간에 방전합니다",
    "EV 충전을 심야 시간대(22-06시)로 이동합니다",
    "냉난방 부하를 15% 감소시킬 수 있습니다"
  ],
  "roi": {
    "equipmentCost": 50000000,
    "daysToBreakEven": 598,
    "annualSavings": 108000000
  }
}
```

**응답 필드**:
| 필드 | 타입 | 설명 |
|------|------|------|
| peakAnalysis | object | 피크 분석 결과 |
| essSchedule | Array | 24시간 ESS 운영 스케줄 |
| hvacSettings | object | 냉난방 최적화 설정 |
| loadShifting | Array | 부하 이동 전략 |
| estimatedSavings | object | 예상 절감액 (kWh, ₩) |
| recommendations | Array | AI 추천사항 |
| roi | object | 투자 수익률 분석 |

**cURL 예제**:
```bash
curl -X POST http://localhost:3000/api/ai/optimize \
  -H "Content-Type: application/json" \
  -d '{"targetReduction": 50}'
```

---

## 📢 DR (Demand Response) API

### 4. DR 이벤트 생성

**Endpoint**: `POST /api/dr`

**요청**:
```json
{
  "title": "2024년 1월 30일 피크 관리",
  "description": "피크 시간대 전력 수요 감소 프로그램",
  "startTime": "2024-01-30T14:00:00Z",
  "endTime": "2024-01-30T19:00:00Z",
  "targetReductionKw": 50,
  "incentiveRate": 250,
  "tags": ["peak-shaving", "dr-2024-winter"]
}
```

**성공 응답** (201):
```json
{
  "id": "dr-event-abc123",
  "title": "2024년 1월 30일 피크 관리",
  "status": "scheduled",
  "startTime": "2024-01-30T14:00:00Z",
  "endTime": "2024-01-30T19:00:00Z",
  "durationMinutes": 300,
  "targetReductionKw": 50,
  "incentiveRate": 250,
  "affectedDevices": [],
  "createdAt": "2024-01-30T10:30:00Z",
  "updatedAt": "2024-01-30T10:30:00Z"
}
```

### 5. DR 이벤트 목록 조회

**Endpoint**: `GET /api/dr`

**쿼리 매개변수**:
| 매개변수 | 타입 | 설명 | 예시 |
|---------|------|------|------|
| status | string | 상태 필터 (scheduled, in_progress, completed, cancelled) | `?status=scheduled,in_progress` |
| limit | number | 최대 결과 수 (기본값: 50) | `?limit=100` |
| offset | number | 오프셋 (기본값: 0) | `?offset=50` |

**성공 응답** (200):
```json
{
  "events": [
    {
      "id": "dr-event-1",
      "title": "2024년 1월 30일 피크 관리",
      "status": "scheduled",
      "startTime": "2024-01-30T14:00:00Z",
      "endTime": "2024-01-30T19:00:00Z",
      "targetReductionKw": 50,
      "actualReductionKw": null,
      "incentiveRate": 250,
      "estimatedRevenue": 62500,
      "actualRevenue": null,
      "devices": 12,
      "responseRate": null
    }
  ],
  "pagination": {
    "total": 5,
    "limit": 50,
    "offset": 0,
    "pages": 1
  }
}
```

### 6. DR 이벤트 실행

**Endpoint**: `PUT /api/dr/{eventId}/execute`

**성공 응답** (200):
```json
{
  "id": "dr-event-abc123",
  "status": "in_progress",
  "startedAt": "2024-01-30T14:00:00Z",
  "affectedDevices": 12,
  "commandsSent": 12,
  "progress": {
    "percentage": 0,
    "currentReduction": 0,
    "targetReduction": 50,
    "responseRate": "0%"
  }
}
```

### 7. DR 이벤트 취소

**Endpoint**: `PUT /api/dr/{eventId}/cancel`

**성공 응답** (200):
```json
{
  "id": "dr-event-abc123",
  "status": "cancelled",
  "reason": "수동 취소",
  "cancelledAt": "2024-01-30T14:30:00Z"
}
```

---

## 🏥 헬스 체크 API

### 8. 서비스 헬스 체크

**Endpoint**: `GET /api/health`

**성공 응답** (200):
```json
{
  "status": "healthy",
  "service": "energy-mgmt-api",
  "version": "1.0.0",
  "timestamp": "2024-01-30T10:30:00Z",
  "checks": {
    "database": "healthy",
    "redis": "healthy",
    "aiEngine": "healthy",
    "mqtt": "healthy"
  }
}
```

### 9. AI Engine 헬스 체크

**Endpoint**: `GET /api/ai/health`

**성공 응답** (200):
```json
{
  "status": "healthy",
  "service": "ai-engine",
  "version": "1.0.0",
  "models": {
    "forecast_24h": "ready",
    "forecast_7d": "ready",
    "forecast_30d": "ready",
    "anomaly": "ready",
    "optimization": "ready"
  },
  "memoryUsage": "425 MB / 1024 MB"
}
```

---

## ⏱️ 응답 시간 목표

| API | 목표 | 달성 |
|-----|------|------|
| /api/ai/forecast | 500ms | ✅ 250ms |
| /api/ai/anomaly | 300ms | ✅ 180ms |
| /api/ai/optimize | 400ms | ✅ 220ms |
| /api/dr | 200ms | ✅ 100ms |

---

## 🔄 상태 코드

| 코드 | 설명 |
|------|------|
| 200 | ✅ 성공 |
| 201 | ✅ 리소스 생성됨 |
| 400 | ❌ 잘못된 요청 |
| 401 | ❌ 인증 필요 |
| 403 | ❌ 권한 부족 |
| 404 | ❌ 리소스 없음 |
| 429 | ❌ Rate Limited |
| 500 | ❌ 서버 오류 |

---

## 📈 Rate Limiting

```
기본 제한: 100 요청/시간
대역: 1,000 요청/시간 (프리미엄)

Rate-Limit 헤더:
- X-RateLimit-Limit: 100
- X-RateLimit-Remaining: 42
- X-RateLimit-Reset: 1706612400
```

---

## 🔑 예제 코드

### JavaScript/TypeScript
```typescript
async function getForecast(horizon: '24h' | '7d' | '30d') {
  const response = await fetch('/api/ai/forecast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ horizon }),
  });
  
  if (!response.ok) throw new Error('Forecast failed');
  return response.json();
}

// 사용법
const forecast = await getForecast('24h');
console.log(forecast.accuracy);
```

### Python
```python
import requests

def get_forecast(horizon: str) -> dict:
    response = requests.post(
        'http://localhost:3000/api/ai/forecast',
        json={'horizon': horizon},
        headers={'Content-Type': 'application/json'}
    )
    response.raise_for_status()
    return response.json()

# 사용법
forecast = get_forecast('24h')
print(forecast['accuracy'])
```

### cURL
```bash
curl -X POST http://localhost:3000/api/ai/forecast \
  -H "Content-Type: application/json" \
  -d '{"horizon":"24h"}' \
  | jq '.accuracy'
```

---

**마지막 업데이트**: 2024-01-30  
**버전**: 1.0.0  
**상태**: Production Ready
