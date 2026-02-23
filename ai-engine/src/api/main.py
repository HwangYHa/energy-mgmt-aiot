from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta
import os
import logging
import hmac
import math
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── 선택적 의존성 임포트 ──────────────────────────────────────────────────────

try:
    import numpy as np
    _numpy_available = True
except ImportError:
    _numpy_available = False
    logger.warning("numpy not available — using pure-Python fallbacks")

try:
    from sklearn.ensemble import IsolationForest
    _sklearn_available = True
except ImportError:
    _sklearn_available = False
    logger.warning("scikit-learn not available — using Z-score/IQR anomaly detection")

# LoadForecaster requires TensorFlow — may not be installed in dev environments
_forecaster: Any = None
_forecaster_available = False
try:
    from models.forecaster import LoadForecaster
    _forecaster = LoadForecaster()
    _forecaster_available = True
    logger.info("LoadForecaster (LSTM) loaded successfully")
except Exception as e:
    logger.warning(f"LoadForecaster not available: {e} — using seasonal pattern forecast")

# ── FastAPI App ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="EMS AI Engine",
    description="에너지 관리 시스템 AI 엔진 API",
    version="2.0.0",
)

ALLOWED_ORIGINS = [
    os.getenv("WEB_APP_URL", "http://localhost:3000"),
    "http://localhost:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type", "Authorization"],
)


async def verify_api_key(authorization: str = Header(...)) -> str:
    """Bearer token 검증 (timing-safe)"""
    if not authorization.startswith("Bearer "):
        logger.warning("Invalid auth header format")
        raise HTTPException(status_code=401, detail="Invalid auth header")
    api_key = authorization[7:]
    valid_key = os.getenv("AI_ENGINE_API_KEY")
    if not valid_key:
        logger.error("AI_ENGINE_API_KEY not configured")
        raise HTTPException(status_code=500, detail="Server misconfigured")
    if not hmac.compare_digest(api_key, valid_key):
        logger.warning("Invalid API key attempt")
        raise HTTPException(status_code=401, detail="Invalid API key")
    return api_key


# ── Pydantic Models ───────────────────────────────────────────────────────────

class MeasurementData(BaseModel):
    timestamp: datetime
    value: float


class AnomalyRequest(BaseModel):
    tenantId: str
    siteId: Optional[str] = None
    historicalData: List[MeasurementData]
    sensitivity: float = Field(0.5, ge=0.0, le=1.0)


class ForecastRequest(BaseModel):
    tenantId: str
    siteId: Optional[str] = None
    horizon: str = Field("24h", description="24h | 7d | 30d")
    historicalData: List[MeasurementData]
    features: Optional[List[str]] = None
    options: Optional[Dict[str, Any]] = None


class OptimizationRequest(BaseModel):
    tenantId: str
    siteId: Optional[str] = None
    historicalData: List[MeasurementData]
    targetReduction: float = Field(..., description="목표 감축률 (%)")


# ── Utility Functions ─────────────────────────────────────────────────────────

def parse_horizon_hours(horizon: str) -> int:
    """'24h' → 24, '7d' → 168, '30d' → 720"""
    if horizon.endswith("d"):
        return int(horizon[:-1]) * 24
    if horizon.endswith("h"):
        return int(horizon[:-1])
    return 24


def build_hourly_pattern(
    values: List[float],
    timestamps: List[datetime],
) -> tuple:
    """
    30일 실측 데이터에서 (hour × dayType) 평균 패턴 추출.
    Returns: (weekday[24], weekend[24], global_mean, global_std)
    """
    weekday_sum = [0.0] * 24
    weekday_cnt = [0] * 24
    weekend_sum = [0.0] * 24
    weekend_cnt = [0] * 24

    for ts, v in zip(timestamps, values):
        h = ts.hour
        dow = ts.weekday()  # 0=월, 6=일
        if dow >= 5:
            weekend_sum[h] += v
            weekend_cnt[h] += 1
        else:
            weekday_sum[h] += v
            weekday_cnt[h] += 1

    n = len(values)
    global_mean = sum(values) / n if n > 0 else 0.0
    global_variance = sum((v - global_mean) ** 2 for v in values) / n if n > 0 else 1.0
    global_std = math.sqrt(global_variance)

    weekday = [
        weekday_sum[h] / weekday_cnt[h] if weekday_cnt[h] > 0 else global_mean
        for h in range(24)
    ]
    weekend = [
        weekend_sum[h] / weekend_cnt[h] if weekend_cnt[h] > 0 else global_mean
        for h in range(24)
    ]
    return weekday, weekend, global_mean, global_std


# ── 이상 탐지 API ─────────────────────────────────────────────────────────────

@app.post(
    "/api/anomaly",
    summary="이상치 탐지",
    tags=["AI Prediction"],
    dependencies=[Depends(verify_api_key)],
)
async def detect_anomaly(request: AnomalyRequest):
    """
    실측 데이터 기반 이상치 탐지.
    - sklearn 가용: IsolationForest (sensitivity → contamination 동적 계산)
    - 폴백: Z-score + IQR 통계적 방법 (numpy 불필요)
    """
    try:
        logger.info(
            f"Anomaly: tenant={request.tenantId}, n={len(request.historicalData)}, "
            f"sensitivity={request.sensitivity}"
        )
        data = request.historicalData
        n = len(data)
        if n < 10:
            raise HTTPException(status_code=400, detail="Minimum 10 data points required")

        values = [d.value for d in data]
        timestamps = [d.timestamp for d in data]
        anomalies: List[Dict] = []
        model_name = ""

        if _sklearn_available and _numpy_available:
            import numpy as np

            # sensitivity [0, 1] → contamination [0.02, 0.15]
            contamination = max(0.01, min(0.15, 0.02 + request.sensitivity * 0.13))
            arr = np.array(values).reshape(-1, 1)
            iso = IsolationForest(
                contamination=contamination,
                random_state=42,
                n_estimators=100,
            )
            iso.fit(arr)
            preds = iso.predict(arr)       # -1: 이상, 1: 정상
            scores = iso.decision_function(arr)  # 낮을수록 이상

            mean_val = float(np.mean(values))
            std_val = float(np.std(values)) or 1.0

            for i, (pred, score) in enumerate(zip(preds, scores)):
                if pred == -1:
                    z = abs((values[i] - mean_val) / std_val)
                    if z >= 5 or score < -0.3:
                        severity = "critical"
                    elif z >= 4 or score < -0.2:
                        severity = "high"
                    elif z >= 3:
                        severity = "medium"
                    else:
                        severity = "low"
                    anomalies.append({
                        "timestamp": timestamps[i].isoformat(),
                        "value": values[i],
                        "score": round(float(score), 4),
                        "severity": severity,
                        "description": (
                            f"IsolationForest 이상 탐지 "
                            f"(score={score:.3f}, Z={z:.1f}σ)"
                        ),
                    })
            model_name = f"IsolationForest-v1.0 (contamination={contamination:.2f})"

        else:
            # Pure-Python Z-score + IQR 폴백
            mean_val = sum(values) / n
            variance = sum((v - mean_val) ** 2 for v in values) / n
            std_val = math.sqrt(variance) or 1.0

            sorted_vals = sorted(values)
            q1 = sorted_vals[int(n * 0.25)]
            q3 = sorted_vals[int(n * 0.75)]
            iqr = q3 - q1
            iqr_low = q1 - 1.5 * iqr
            iqr_high = q3 + 1.5 * iqr

            # sensitivity [0, 1] → threshold [3.5σ, 2.0σ]
            threshold = 3.5 - request.sensitivity * 1.5

            for i, v in enumerate(values):
                z = abs((v - mean_val) / std_val)
                iqr_flag = v < iqr_low or v > iqr_high
                if z >= threshold or iqr_flag:
                    if z >= 5:
                        severity = "critical"
                    elif z >= 4:
                        severity = "high"
                    elif z >= threshold:
                        severity = "medium"
                    else:
                        severity = "low"
                    anomalies.append({
                        "timestamp": timestamps[i].isoformat(),
                        "value": v,
                        "score": round(z, 4),
                        "severity": severity,
                        "description": (
                            f"Z-score={z:.1f}σ"
                            + (" (IQR 이상)" if iqr_flag else "")
                        ),
                    })
            model_name = f"ZSCORE-IQR (threshold={threshold:.1f}σ)"

        anomaly_rate = len(anomalies) / n if n > 0 else 0.0

        return {
            "anomalies": anomalies,
            "anomaly_rate": round(anomaly_rate, 4),
            "model": model_name,
            "timestamp": datetime.now().isoformat(),
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Anomaly detection error: {error}")
        raise HTTPException(status_code=500, detail="Anomaly detection failed")


# ── 부하 예측 API ─────────────────────────────────────────────────────────────

@app.post(
    "/api/forecast",
    summary="전력 부하 예측",
    tags=["AI Prediction"],
    dependencies=[Depends(verify_api_key)],
)
async def create_forecast(request: ForecastRequest):
    """
    실측 데이터 기반 전력 부하 예측.
    - LSTM(LoadForecaster) 가용 시 사용
    - 폴백: 30일 실측 계절성 패턴 + 7일 선형 추세 (Math.random 없음)
    """
    try:
        logger.info(
            f"Forecast: tenant={request.tenantId}, horizon={request.horizon}, "
            f"n={len(request.historicalData)}"
        )
        if len(request.historicalData) < 48:
            raise HTTPException(
                status_code=400, detail="Minimum 48 historical data points required"
            )

        hours = parse_horizon_hours(request.horizon)
        values = [d.value for d in request.historicalData]
        timestamps = [d.timestamp for d in request.historicalData]
        predictions: List[Dict] = []
        confidence = 0.70
        model_name = ""

        # LSTM 시도
        if _forecaster_available and _numpy_available:
            try:
                import numpy as np
                import pandas as pd

                df = pd.DataFrame({
                    "value": values,
                    "timestamp": timestamps,
                })
                df["hour"] = df["timestamp"].apply(lambda t: t.hour)
                df["weekday"] = df["timestamp"].apply(lambda t: t.weekday())
                df["is_weekend"] = df["weekday"].apply(lambda d: 1 if d >= 5 else 0)
                df["temperature"] = 20.0

                preds = _forecaster.predict(df, horizon=hours)
                confidence = _forecaster.overall_confidence
                now = datetime.now()
                sigma = float(
                    np.std(values[-168:]) if len(values) >= 168 else np.std(values)
                )
                for i, v in enumerate(preds):
                    v_f = float(max(0.0, v))
                    future_ts = now + timedelta(hours=i + 1)
                    predictions.append({
                        "timestamp": future_ts.isoformat(),
                        "value": round(v_f, 2),
                        "lower": round(max(0.0, v_f - sigma), 2),
                        "upper": round(v_f + sigma, 2),
                        "confidence": round(_forecaster.get_confidence(i), 3),
                    })
                model_name = "LSTM-v1.0"
                logger.info(
                    f"LSTM forecast: {len(predictions)} points, "
                    f"confidence={confidence:.2f}"
                )
            except Exception as lstm_err:
                logger.warning(f"LSTM forecast failed, using seasonal: {lstm_err}")
                predictions = []

        # 계절성 패턴 폴백 (Math.random 없음)
        if not predictions:
            weekday, weekend, global_mean, global_std = build_hourly_pattern(
                values, timestamps
            )
            # 최근 7일 선형 추세
            recent = values[-168:] if len(values) >= 168 else values
            trend = (
                (recent[-1] - recent[0]) / len(recent) if len(recent) >= 2 else 0.0
            )
            now = datetime.now()
            confidence = 0.85 if len(values) >= 336 else 0.70

            for i in range(1, hours + 1):
                future_ts = now + timedelta(hours=i)
                h = future_ts.hour
                is_weekend = future_ts.weekday() >= 5
                pattern_val = weekend[h] if is_weekend else weekday[h]

                # 추세 감쇠 (멀수록 약하게)
                decay = math.exp(-i / (hours * 0.5))
                v = max(0.0, pattern_val + trend * i * decay)
                # 신뢰도도 시간이 지날수록 감소
                conf_i = round(confidence * (0.95 ** (i // 24)), 3)

                predictions.append({
                    "timestamp": future_ts.isoformat(),
                    "value": round(v, 2),
                    "lower": round(max(0.0, v - global_std), 2),
                    "upper": round(v + global_std, 2),
                    "confidence": conf_i,
                })
            model_name = "SEASONAL-PATTERN"

        return {
            "predictions": predictions,
            "confidence": round(confidence, 3),
            "accuracy": None,
            "model": model_name,
            "metadata": {
                "dataPoints": len(request.historicalData),
                "horizon": request.horizon,
                "siteId": request.siteId or "all",
                "patternSource": "historical",
            },
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Forecast error: {error}")
        raise HTTPException(status_code=500, detail="Forecast failed")


# ── 최적화 추천 API ───────────────────────────────────────────────────────────

KRW_PER_KWH = 150.0


@app.post(
    "/api/optimize",
    summary="최적화 추천",
    tags=["AI Prediction"],
    dependencies=[Depends(verify_api_key)],
)
async def optimize(request: OptimizationRequest):
    """
    실측 데이터 패턴 분석 기반 최적화 추천 (5가지 규칙).
    """
    try:
        logger.info(
            f"Optimize: tenant={request.tenantId}, "
            f"target={request.targetReduction}%, n={len(request.historicalData)}"
        )
        if len(request.historicalData) < 24:
            raise HTTPException(status_code=400, detail="Minimum 24 data points required")

        values = [d.value for d in request.historicalData]
        timestamps = [d.timestamp for d in request.historicalData]
        n = len(values)

        # 기초 통계
        mean_val = sum(values) / n
        max_val = max(values)
        min_val = min(values)
        variance = sum((v - mean_val) ** 2 for v in values) / n
        cv = math.sqrt(variance) / mean_val if mean_val > 0 else 0.0

        # 시간대별 집계
        hourly_sum = [0.0] * 24
        hourly_cnt = [0] * 24
        weekday_sum = [0.0] * 24
        weekday_cnt = [0] * 24
        weekend_sum = [0.0] * 24
        weekend_cnt = [0] * 24

        for ts, v in zip(timestamps, values):
            h = ts.hour
            dow = ts.weekday()
            hourly_sum[h] += v
            hourly_cnt[h] += 1
            if dow >= 5:
                weekend_sum[h] += v
                weekend_cnt[h] += 1
            else:
                weekday_sum[h] += v
                weekday_cnt[h] += 1

        hourly_avg = [
            hourly_sum[h] / hourly_cnt[h] if hourly_cnt[h] > 0 else mean_val
            for h in range(24)
        ]
        weekday_avg = [
            weekday_sum[h] / weekday_cnt[h] if weekday_cnt[h] > 0 else mean_val
            for h in range(24)
        ]
        weekend_avg = [
            weekend_sum[h] / weekend_cnt[h] if weekend_cnt[h] > 0 else mean_val
            for h in range(24)
        ]

        # 피크 시간대 (상위 4시간)
        peak_hours = sorted(
            sorted(range(24), key=lambda h: hourly_avg[h], reverse=True)[:4]
        )

        # 야간 평균 (23-06시)
        night_hours = [23, 0, 1, 2, 3, 4, 5, 6]
        night_avg = sum(hourly_avg[h] for h in night_hours) / len(night_hours)

        weekday_mean = sum(weekday_avg) / 24
        weekend_mean = sum(weekend_avg) / 24
        weekend_ratio = weekend_mean / weekday_mean if weekday_mean > 0 else 1.0

        recommendations: List[Dict] = []

        # 1. 피크 부하 이동
        peak_excess = max_val - mean_val * 1.3
        if peak_excess > 0:
            savings_kwh = peak_excess * 0.3 * 22  # 하루 0.3h × 22일
            recommendations.append({
                "id": "opt-peak-shift",
                "priority": "high",
                "category": "피크 관리",
                "title": (
                    f"피크 부하 이동 "
                    f"({', '.join(f'{h}시' for h in peak_hours)} 집중)"
                ),
                "description": (
                    f"최대 부하({max_val:.1f} kW)가 평균({mean_val:.1f} kW)의 "
                    f"{max_val / mean_val * 100:.0f}%입니다. "
                    "피크 시간대 고소비 설비의 운전 스케줄을 경부하 시간(23-09시)으로 "
                    "이동하면 수요 전력 감소 및 요금 절감이 가능합니다."
                ),
                "estimatedSavings": round(savings_kwh),
                "estimatedCostSaving": round(savings_kwh * KRW_PER_KWH),
                "confidence": 0.75,
                "peakHours": peak_hours,
            })

        # 2. 야간 대기전력 감소
        standby_threshold = mean_val * 0.3
        if night_avg > standby_threshold:
            standby_waste = (night_avg - standby_threshold) * 8 * 30  # 8h × 30일
            recommendations.append({
                "id": "opt-standby",
                "priority": "high" if night_avg > mean_val * 0.5 else "medium",
                "category": "대기전력",
                "title": "야간 대기전력 감소",
                "description": (
                    f"야간(23-06시) 평균 부하가 {night_avg:.1f} kW로 "
                    f"전체 평균의 {night_avg / mean_val * 100:.0f}%입니다. "
                    "비가동 설비의 전원 차단 자동화 및 대기전력 차단 멀티탭 적용을 권장합니다."
                ),
                "estimatedSavings": round(standby_waste),
                "estimatedCostSaving": round(standby_waste * KRW_PER_KWH),
                "confidence": 0.80,
            })

        # 3. 주말 스케줄 최적화
        if weekend_ratio > 0.7 and weekday_mean > 0:
            weekend_excess = (weekend_mean - weekday_mean * 0.4) * 16 * 8
            if weekend_excess > 0:
                recommendations.append({
                    "id": "opt-weekend",
                    "priority": "medium",
                    "category": "스케줄 최적화",
                    "title": "주말 설비 가동 스케줄 최적화",
                    "description": (
                        f"주말 평균 부하({weekend_mean:.1f} kW)가 "
                        f"주중({weekday_mean:.1f} kW)의 {weekend_ratio * 100:.0f}%입니다. "
                        "비필수 공조·조명 설비를 주말 자동 절전 모드로 전환하면 "
                        "추가 절감이 가능합니다."
                    ),
                    "estimatedSavings": round(weekend_excess),
                    "estimatedCostSaving": round(weekend_excess * KRW_PER_KWH),
                    "confidence": 0.70,
                })

        # 4. 고변동성 → 설비 진단
        if cv > 0.4:
            recommendations.append({
                "id": "opt-variance",
                "priority": "medium",
                "category": "설비 진단",
                "title": "전력 소비 변동성 원인 점검",
                "description": (
                    f"전력 소비의 변동계수(CV)가 {cv * 100:.0f}%로 높습니다 "
                    f"(최솟값 {min_val:.1f} kW ↔ 최댓값 {max_val:.1f} kW). "
                    "인버터 불량, 압축기 과부하, 전압 불균형 등을 점검하고 "
                    "에너지 집중 설비의 효율을 측정하세요."
                ),
                "estimatedSavings": round(mean_val * cv * 0.15 * 720),
                "estimatedCostSaving": round(mean_val * cv * 0.15 * 720 * KRW_PER_KWH),
                "confidence": 0.60,
            })

        # 5. 목표 갭 분석
        target_savings_kwh = mean_val * (request.targetReduction / 100) * 720
        achievable = sum(r["estimatedSavings"] for r in recommendations)
        if target_savings_kwh > 0 and achievable < target_savings_kwh * 0.5:
            recommendations.append({
                "id": "opt-goal-gap",
                "priority": "low",
                "category": "목표 관리",
                "title": f"{request.targetReduction}% 절감 목표 달성을 위한 추가 조치 필요",
                "description": (
                    f"현재 파악된 절감 기회({achievable:.0f} kWh/월)로는 "
                    f"목표({target_savings_kwh:.0f} kWh/월)의 "
                    f"{achievable / target_savings_kwh * 100:.0f}%만 달성 가능합니다. "
                    "에너지 감사(Energy Audit)를 통해 추가 절감 기회를 발굴하세요."
                ),
                "estimatedSavings": 0,
                "estimatedCostSaving": 0,
                "confidence": 0.50,
            })

        total_savings = sum(r["estimatedSavings"] for r in recommendations)
        total_cost = sum(r["estimatedCostSaving"] for r in recommendations)
        peak_reduction = (
            min(100.0, (max_val - mean_val) / mean_val * 50) if mean_val > 0 else 0.0
        )

        return {
            "recommendations": recommendations,
            "summary": {
                "totalEstimatedSavings": round(total_savings),
                "totalCostSaving": round(total_cost),
                "overallEfficiency": round(max(0.0, 100.0 - cv * 100)),
                "peakReductionOpportunity": round(peak_reduction),
            },
            "model": "PATTERN-ANALYSIS-v2.0",
            "timestamp": datetime.now().isoformat(),
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Optimization error: {error}")
        raise HTTPException(status_code=500, detail="Optimization failed")


# ── 헬스 체크 ─────────────────────────────────────────────────────────────────

@app.get("/health", tags=["System"])
async def health_check():
    """API 상태 및 모델 가용성 확인"""
    return {
        "status": "ok",
        "service": "AI Engine",
        "version": "2.0.0",
        "models": {
            "isolationForest": _sklearn_available,
            "loadForecaster": _forecaster_available,
            "numpy": _numpy_available,
        },
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8001)),
        log_level="info",
    )
