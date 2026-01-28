# apps/ai-engine/src/analysis/timeseries.py
import pandas as pd
import numpy as np
from statsmodels.tsa.seasonal import seasonal_decompose
from sklearn.preprocessing import StandardScaler

class TimeSeriesAnalyzer:
    def __init__(self):
        self.scaler = StandardScaler()
    
    async def detect_anomaly_zscore(
        self,
        data: pd.DataFrame,
        column: str = 'value',
        threshold: float = 3.0
    ) -> pd.DataFrame:
        """
        Z-score 기반 이상치 탐지
        """
        # Z-score 계산
        z_scores = np.abs((data[column] - data[column].mean()) / data[column].std())
        
        # 이상치 표시
        data['is_anomaly'] = z_scores > threshold
        data['z_score'] = z_scores
        
        return data
    
    async def decompose_seasonality(
        self,
        data: pd.DataFrame,
        period: int = 24  # 24시간 주기
    ) -> Dict:
        """
        계절성 분해 (트렌드/계절성/잔차)
        """
        result = seasonal_decompose(
            data['value'],
            model='additive',
            period=period
        )
        
        return {
            'trend': result.trend,
            'seasonal': result.seasonal,
            'residual': result.resid
        }
    
    async def simple_forecast(
        self,
        data: pd.DataFrame,
        horizon: int = 24  # 24시간 예측
    ) -> pd.DataFrame:
        """
        이동평균 기반 간단한 예측
        """
        # 지수 가중 이동평균
        ewm = data['value'].ewm(span=24, adjust=False).mean()
        
        # 마지막 값으로 예측 (단순화)
        last_value = ewm.iloc[-1]
        forecast = pd.DataFrame({
            'timestamp': pd.date_range(
                start=data.index[-1],
                periods=horizon + 1,
                freq='H'
            )[1:],
            'forecast': [last_value] * horizon
        })
        
        return forecast