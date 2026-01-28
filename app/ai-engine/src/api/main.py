# apps/ai-engine/src/api/main.py
from fastapi import FastAPI, Depends
from .routers import forecasting, anomaly
from .services import ModelService

app = FastAPI(title="EMS AI Engine")

@app.post("/api/v1/forecast")
async def create_forecast(
    tenant_id: str,
    metric_id: str,
    horizon: int = 24,
    model_service: ModelService = Depends()
):
    """
    부하 예측
    """
    # 최근 데이터 조회
    data = await model_service.get_historical_data(tenant_id, metric_id, days=30)
    
    # 예측
    forecast = await model_service.forecast(data, horizon=horizon)
    
    return {
        "tenant_id": tenant_id,
        "metric_id": metric_id,
        "forecast": forecast.tolist(),
        "timestamp": datetime.now().isoformat()
    }

@app.post("/api/v1/detect-anomaly")
async def detect_anomaly(
    tenant_id: str,
    metric_id: str,
    method: str = "zscore",  # zscore, isolation_forest
    model_service: ModelService = Depends()
):
    """
    이상치 탐지
    """
    data = await model_service.get_recent_data(tenant_id, metric_id, hours=24)
    
    if method == "zscore":
        result = await model_service.detect_anomaly_zscore(data)
    elif method == "isolation_forest":
        result = await model_service.detect_anomaly_ml(data)
    
    return {
        "tenant_id": tenant_id,
        "metric_id": metric_id,
        "anomalies": result,
        "method": method
    }