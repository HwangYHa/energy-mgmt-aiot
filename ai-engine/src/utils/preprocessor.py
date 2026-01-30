"""
시계열 데이터 전처리 및 Feature Engineering
"""
import numpy as np
import pandas as pd
from typing import Dict, List, Tuple
from datetime import datetime, timedelta


class TimeSeriesPreprocessor:
    """시계열 데이터 전처리"""
    
    @staticmethod
    def handle_missing_values(data: np.ndarray, method: str = 'linear') -> np.ndarray:
        """
        결측치 처리
        
        Args:
            data: 원본 데이터
            method: 'linear', 'forward_fill', 'mean'
        
        Returns:
            처리된 데이터
        """
        df = pd.Series(data)
        
        if method == 'linear':
            df = df.interpolate(method='linear')
        elif method == 'forward_fill':
            df = df.fillna(method='ffill')
        elif method == 'mean':
            df = df.fillna(df.mean())
        
        return df.values
    
    @staticmethod
    def remove_outliers(data: np.ndarray, threshold: float = 3.0) -> np.ndarray:
        """
        이상치 제거 (Z-score 방법)
        
        Args:
            data: 원본 데이터
            threshold: Z-score 임계값
        
        Returns:
            이상치 제거된 데이터
        """
        mean = np.mean(data)
        std = np.std(data)
        
        z_scores = np.abs((data - mean) / std)
        cleaned_data = data.copy()
        cleaned_data[z_scores > threshold] = np.nan
        
        # 결측치 처리
        return TimeSeriesPreprocessor.handle_missing_values(cleaned_data)
    
    @staticmethod
    def normalize(data: np.ndarray, method: str = 'minmax') -> Tuple[np.ndarray, Dict]:
        """
        데이터 정규화
        
        Args:
            data: 원본 데이터
            method: 'minmax', 'zscore'
        
        Returns:
            정규화된 데이터, 정규화 파라미터
        """
        if method == 'minmax':
            min_val = np.min(data)
            max_val = np.max(data)
            normalized = (data - min_val) / (max_val - min_val + 1e-8)
            params = {'min': min_val, 'max': max_val, 'method': 'minmax'}
        else:  # zscore
            mean = np.mean(data)
            std = np.std(data)
            normalized = (data - mean) / (std + 1e-8)
            params = {'mean': mean, 'std': std, 'method': 'zscore'}
        
        return normalized, params
    
    @staticmethod
    def denormalize(normalized_data: np.ndarray, params: Dict) -> np.ndarray:
        """정규화 해제"""
        if params['method'] == 'minmax':
            return normalized_data * (params['max'] - params['min']) + params['min']
        else:  # zscore
            return normalized_data * params['std'] + params['mean']


class FeatureEngineer:
    """Feature Engineering"""
    
    @staticmethod
    def extract_temporal_features(timestamps: List[datetime]) -> pd.DataFrame:
        """
        시간대 특성 추출
        
        Args:
            timestamps: 타임스탬프 리스트
        
        Returns:
            시간대 특성 DataFrame
        """
        df = pd.DataFrame({'timestamp': timestamps})
        df['hour'] = df['timestamp'].dt.hour
        df['day_of_week'] = df['timestamp'].dt.dayofweek
        df['day_of_year'] = df['timestamp'].dt.dayofyear
        df['month'] = df['timestamp'].dt.month
        df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)
        
        return df[['hour', 'day_of_week', 'is_weekend', 'month']]
    
    @staticmethod
    def create_lag_features(
        data: np.ndarray,
        lags: List[int] = [1, 24, 168]  # 1h, 1d, 1w
    ) -> np.ndarray:
        """
        Lag 특성 생성
        
        Args:
            data: 원본 시계열 데이터
            lags: Lag 값 리스트
        
        Returns:
            Lag 특성 추가된 데이터
        """
        df = pd.DataFrame({'value': data})
        
        for lag in lags:
            df[f'lag_{lag}'] = df['value'].shift(lag)
        
        df = df.dropna()
        return df.values
    
    @staticmethod
    def create_rolling_features(
        data: np.ndarray,
        windows: List[int] = [3, 24, 168]
    ) -> pd.DataFrame:
        """
        이동 평균 특성 생성
        
        Args:
            data: 원본 시계열 데이터
            windows: 윈도우 크기 리스트
        
        Returns:
            이동 평균 특성
        """
        df = pd.DataFrame({'value': data})
        
        for window in windows:
            df[f'rolling_mean_{window}'] = df['value'].rolling(window).mean()
            df[f'rolling_std_{window}'] = df['value'].rolling(window).std()
        
        return df.dropna()
    
    @staticmethod
    def detect_seasonality(data: np.ndarray) -> Dict:
        """
        계절성 감지
        
        Args:
            data: 시계열 데이터
        
        Returns:
            계절성 정보
        """
        df = pd.Series(data)
        
        # 자기상관함수 (ACF) 계산
        from scipy import signal
        
        acf_values = [np.corrcoef(df[:-lag], df[lag:])[0, 1] 
                      for lag in range(1, min(168, len(df)//2))]
        
        # 피크 찾기 (계절성 주기)
        peaks, _ = signal.find_peaks(acf_values, height=0.3)
        
        return {
            'seasonal_periods': peaks.tolist() if len(peaks) > 0 else [24],
            'has_daily_seasonality': 24 in peaks or True,
            'has_weekly_seasonality': 168 in peaks or False,
        }


class DataQualityChecker:
    """데이터 품질 검사"""
    
    @staticmethod
    def check_quality(data: np.ndarray, min_quality: float = 0.8) -> Dict:
        """
        데이터 품질 검사
        
        Args:
            data: 데이터
            min_quality: 최소 품질 점수
        
        Returns:
            품질 지표
        """
        total_points = len(data)
        valid_points = np.sum(~np.isnan(data))
        completeness = valid_points / total_points if total_points > 0 else 0
        
        # 결측치 비율
        missing_rate = 1 - completeness
        
        # 이상치 감지
        df = pd.Series(data)
        Q1 = df.quantile(0.25)
        Q3 = df.quantile(0.75)
        IQR = Q3 - Q1
        outliers = ((df < (Q1 - 1.5 * IQR)) | (df > (Q3 + 1.5 * IQR))).sum()
        outlier_rate = outliers / total_points if total_points > 0 else 0
        
        # 전체 품질 점수
        quality_score = completeness * (1 - outlier_rate * 0.5)
        
        return {
            'completeness': completeness,
            'missing_rate': missing_rate,
            'outlier_rate': outlier_rate,
            'quality_score': quality_score,
            'is_acceptable': quality_score >= min_quality,
        }


def preprocess_historical_data(
    historical_data: List[Dict],
    remove_outliers: bool = True,
    handle_missing: bool = True
) -> np.ndarray:
    """
    과거 데이터 전처리 (통합 함수)
    
    Args:
        historical_data: [{'timestamp': ..., 'value': ...}, ...]
        remove_outliers: 이상치 제거 여부
        handle_missing: 결측치 처리 여부
    
    Returns:
        전처리된 데이터
    """
    # DataFrame 변환
    df = pd.DataFrame(historical_data)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df.sort_values('timestamp').reset_index(drop=True)
    
    data = df['value'].values.astype(float)
    
    # 이상치 처리
    if remove_outliers:
        data = TimeSeriesPreprocessor.remove_outliers(data, threshold=3.0)
    
    # 결측치 처리
    if handle_missing:
        data = TimeSeriesPreprocessor.handle_missing_values(data, method='linear')
    
    # 품질 검사
    quality = DataQualityChecker.check_quality(data)
    print(f"📊 데이터 품질: {quality['quality_score']:.2%}")
    
    if not quality['is_acceptable']:
        print("⚠️ 경고: 데이터 품질이 낮습니다")
    
    return data
