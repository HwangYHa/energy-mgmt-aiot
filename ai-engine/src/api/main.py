from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from datetime import datetime
import os
import logging
import hmac
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="EMS AI Engine",
    description="에너지 관리 시스템 AI 엔진 API",
    version="1.0.0"
)

# ✅ CORS 설정 - 명시적 도메인만 허용
ALLOWED_ORIGINS = [
    os.getenv('WEB_APP_URL', 'http://localhost:3000'),
    'http://localhost:3000',
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=['POST', 'GET'],
    allow_headers=['Content-Type', 'Authorization'],
)

# ✅ API 키 검증
async def verify_api_key(authorization: str = Header(...)) -> str:
    """API 키 검증 (Bearer token)"""
    if not authorization.startswith('Bearer '):
        logger.warning('Invalid auth header format')
        raise HTTPException(status_code=401, detail='Invalid auth header')
    
    api_key = authorization[7:]
    valid_key = os.getenv('AI_ENGINE_API_KEY')
    
    if not valid_key:
        logger.error('AI_ENGINE_API_KEY not configured')
        raise HTTPException(status_code=500, detail='Server misconfigured')
    
    # ✅ Timing-safe 비교
    if not hmac.compare_digest(api_key, valid_key):
        logger.warning('Invalid API key attempt')
        raise HTTPException(status_code=401, detail='Invalid API key')
    
    return api_key


# ==================== Request/Response Models ====================

class MeasurementData(BaseModel):
    timestamp: datetime
    value: float


class ForecastRequest(BaseModel):
    tenantId: str
    siteId: str
    horizon: str = Field(..., description="24h, 7d, 30d")
    historicalData: List[MeasurementData]


class ForecastResponse(BaseModel):
    predictions: List[Dict]
    accuracy: float = Field(..., ge=0, le=1)
    model: str
    confidence_lower: List[float]
    confidence_upper: List[float]
    timestamp: datetime


class AnomalyRequest(BaseModel):
    tenantId: str
    siteId: str
    historicalData: List[MeasurementData]
    sensitivity: float = Field(0.1, ge=0.05, le=0.3)


class AnomalyResponse(BaseModel):
    anomalies: List[Dict]
    anomaly_rate: float
    model: str
    timestamp: datetime


class OptimizationRequest(BaseModel):
    tenantId: str
    siteId: str
    historicalData: List[MeasurementData]
    targetReduction: float = Field(..., description="목표 감축량 (kW)")


class OptimizationResponse(BaseModel):
    peakHours: List[int]
    essSchedule: List[Dict]
    hvacSettings: Dict
    estimatedSaving: float
    recommendations: List[str]
    timestamp: datetime


# ==================== 부하 예측 API ====================

@app.post(
    "/api/forecast",
    response_model=ForecastResponse,
    summary="전력 부하 예측",
    tags=["AI Prediction"],
    dependencies=[Depends(verify_api_key)]  # ✅ 인증 필수
)
async def create_forecast(request: ForecastRequest):
    """
    LSTM 기반 전력 부하 예측
    
    최소 요구사항:
    - 48시간 이상의 과거 데이터
    - 유효한 tenantId와 siteId
    
    응답:
    - predictions: 예측된 값들 (시간별)
    - accuracy: MAPE 정확도
    - confidence_lower/upper: 신뢰도 구간
    """
    try:
        logger.info(
            f"Forecast request: tenant={request.tenantId}, "
            f"site={request.siteId}, horizon={request.horizon}"
        )
        
        # 최소 데이터 포인트 검증
        if len(request.historicalData) < 48:
            raise HTTPException(
                status_code=400,
                detail="Minimum 48 historical data points required"
            )
        
        # ✅ 실제 예측 로직 (Mock)
        predictions = [
            {
                "timestamp": (
                    request.historicalData[-1].timestamp + 
                    datetime.timedelta(hours=i)
                ).isoformat(),
                "value": request.historicalData[-1].value * (0.95 + 0.1 * (i % 3)),
            }
            for i in range(1, 25)
        ]
        
        return ForecastResponse(
            predictions=predictions,
            accuracy=0.92,
            model="LSTM-24h-v1.0",
            confidence_lower=[p['value'] * 0.9 for p in predictions],
            confidence_upper=[p['value'] * 1.1 for p in predictions],
            timestamp=datetime.now(),
        )
    
    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Forecast error: {error}")
        raise HTTPException(status_code=500, detail="Forecast failed")


# ==================== 이상 탐지 API ====================

@app.post(
    "/api/anomaly",
    response_model=AnomalyResponse,
    summary="이상치 탐지",
    tags=["AI Prediction"],
    dependencies=[Depends(verify_api_key)]  # ✅ 인증 필수
)
async def detect_anomaly(request: AnomalyRequest):
    """
    시계열 데이터에서 이상치 탐지
    """
    try:
        logger.info(
            f"Anomaly detection: tenant={request.tenantId}, "
            f"site={request.siteId}"
        )
        
        # ✅ Mock 구현
        anomalies = []
        
        return AnomalyResponse(
            anomalies=anomalies,
            anomaly_rate=0.05,
            model="IsolationForest-v1.0",
            timestamp=datetime.now(),
        )
    
    except Exception as error:
        logger.error(f"Anomaly detection error: {error}")
        raise HTTPException(status_code=500, detail="Anomaly detection failed")


# ==================== 최적화 추천 API ====================

@app.post(
    "/api/optimize",
    response_model=OptimizationResponse,
    summary="최적화 추천",
    tags=["AI Prediction"],
    dependencies=[Depends(verify_api_key)]  # ✅ 인증 필수
)
async def optimize(request: OptimizationRequest):
    """
    전력 사용 최적화 추천
    """
    try:
        logger.info(
            f"Optimization request: tenant={request.tenantId}, "
            f"site={request.siteId}, target={request.targetReduction}kW"
        )
        
        # ✅ Mock 구현
        return OptimizationResponse(
            peakHours=[9, 10, 11, 18, 19, 20],
            essSchedule=[
                {"hour": "23:00", "operation": "charging", "power": 40},
                {"hour": "09:00", "operation": "discharging", "power": 30},
            ],
            hvacSettings={"setpoint": 25, "strategy": "setback"},
            estimatedSaving=request.targetReduction * 0.95,
            recommendations=[
                "HVAC 피크 제어: 25→26°C 설정",
                "ESS 충방전 최적화",
                "조명 수동 제어",
            ],
            timestamp=datetime.now(),
        )
    
    except Exception as error:
        logger.error(f"Optimization error: {error}")
        raise HTTPException(status_code=500, detail="Optimization failed")


# ==================== 헬스 체크 ====================

@app.get("/health", tags=["System"])
async def health_check():
    """API 상태 확인"""
    return {"status": "ok", "service": "AI Engine"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8001)),
        log_level="info"
    )
