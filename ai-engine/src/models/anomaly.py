"""
이상 탐지 모델 (Isolation Forest)
"""
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from typing import List, Dict, Tuple
import logging


logger = logging.getLogger(__name__)


class AnomalyDetector:
    """Isolation Forest 기반 이상 탐지"""
    
    def __init__(self, contamination: float = 0.1, random_state: int = 42):
        """
        Args:
            contamination: 이상치 비율 (0.05 ~ 0.3)
            random_state: 랜덤 시드
        """
        self.contamination = contamination
        self.random_state = random_state
        self.model = IsolationForest(
            contamination=contamination,
            random_state=random_state,
            n_estimators=100
        )
        self.scaler = StandardScaler()
        self.is_fitted = False
    
    def fit(self, X: np.ndarray):
        """
        모델 학습
        
        Args:
            X: 학습 데이터 (n_samples, n_features)
        """
        X_scaled = self.scaler.fit_transform(X)
        self.model.fit(X_scaled)
        self.is_fitted = True
    
    def predict(self, X: np.ndarray) -> np.ndarray:
        """
        이상 탐지
        
        Args:
            X: 입력 데이터
        
        Returns:
            -1 (이상), 1 (정상)
        """
        if not self.is_fitted:
            raise ValueError("모델이 훈련되지 않았습니다")
        
        X_scaled = self.scaler.transform(X)
        return self.model.predict(X_scaled)
    
    def score_samples(self, X: np.ndarray) -> np.ndarray:
        """
        이상 스코어 계산 (낮을수록 이상)
        
        Args:
            X: 입력 데이터
        
        Returns:
            이상 스코어 배열
        """
        if not self.is_fitted:
            raise ValueError("모델이 훈련되지 않았습니다")
        
        X_scaled = self.scaler.transform(X)
        return self.model.score_samples(X_scaled)
    
    def detect_with_scores(self, X: np.ndarray) -> List[Dict]:
        """
        이상 탐지 (스코어 포함)
        
        Args:
            X: 입력 데이터
        
        Returns:
            이상 정보 리스트
        """
        predictions = self.predict(X)
        scores = self.score_samples(X)
        
        anomalies = []
        for i, (pred, score) in enumerate(zip(predictions, scores)):
            if pred == -1:  # 이상
                # 심각도 분류
                if score < -0.7:
                    severity = 'critical'
                elif score < -0.4:
                    severity = 'high'
                elif score < -0.1:
                    severity = 'medium'
                else:
                    severity = 'low'
                
                anomalies.append({
                    'index': i,
                    'score': float(score),
                    'severity': severity,
                    'normalized_score': float((score + 1) / 2)  # 0~1 범위
                })
        
        return anomalies


class MultivariatAnomalyDetector:
    """다변량 이상 탐지"""
    
    def __init__(self, sensitivity: float = 0.1):
        """
        Args:
            sensitivity: 민감도 (0.05 ~ 0.3)
        """
        self.detector = AnomalyDetector(contamination=sensitivity)
        self.feature_names = []
    
    def create_features(self, time_series: np.ndarray) -> Tuple[np.ndarray, List[str]]:
        """
        시계열 데이터로부터 특성 생성
        
        Args:
            time_series: 1D 시계열 데이터
        
        Returns:
            특성 행렬, 특성명 리스트
        """
        df = pd.Series(time_series)
        
        features = []
        feature_names = []
        
        # 1. 원본 값
        features.append(df.values)
        feature_names.append('value')
        
        # 2. 1시간 전 값 (lag-1)
        features.append(df.shift(1).fillna(method='bfill').values)
        feature_names.append('lag_1')
        
        # 3. 24시간 전 값 (lag-24)
        if len(df) > 24:
            features.append(df.shift(24).fillna(method='bfill').values)
            feature_names.append('lag_24')
        
        # 4. 이동 평균 (3시간)
        features.append(df.rolling(3).mean().fillna(method='bfill').values)
        feature_names.append('rolling_mean_3')
        
        # 5. 이동 표준편차 (3시간)
        features.append(df.rolling(3).std().fillna(method='bfill').values)
        feature_names.append('rolling_std_3')
        
        # 6. 1시간 변화율
        change = df.pct_change().fillna(0).values
        features.append(change)
        feature_names.append('pct_change')
        
        X = np.column_stack(features)
        self.feature_names = feature_names
        
        return X, feature_names
    
    def detect(self, time_series: np.ndarray) -> List[Dict]:
        """
        다변량 이상 탐지
        
        Args:
            time_series: 시계열 데이터
        
        Returns:
            이상 정보 리스트 (원인 분석 포함)
        """
        # 특성 생성
        X, _ = self.create_features(time_series)
        
        # 모델 학습 및 예측
        self.detector.fit(X)
        anomalies = self.detector.detect_with_scores(X)
        
        # 이상 원인 분석
        for anom in anomalies:
            idx = anom['index']
            anom['reason'] = self._analyze_reason(time_series, idx)
            anom['value'] = float(time_series[idx])
        
        return anomalies
    
    def _analyze_reason(self, time_series: np.ndarray, idx: int) -> str:
        """
        이상의 원인 분석
        
        Args:
            time_series: 시계열 데이터
            idx: 이상 인덱스
        
        Returns:
            원인 설명
        """
        if idx < 1:
            return "데이터 부족"
        
        current = time_series[idx]
        previous = time_series[idx - 1]
        
        # 급격한 변화
        change = abs(current - previous)
        avg = np.mean(time_series[max(0, idx-24):idx])
        std = np.std(time_series[max(0, idx-24):idx])
        
        if change > 3 * std:
            if current > avg:
                return "급격한 전력 증가"
            else:
                return "급격한 전력 감소"
        
        # 비정상적 패턴
        if idx >= 24:
            same_hour_values = time_series[::24]
            same_hour_std = np.std(same_hour_values[-7:])  # 최근 7일
            same_hour_avg = np.mean(same_hour_values[-7:])
            
            if abs(current - same_hour_avg) > 2 * same_hour_std:
                return "일일 패턴 이상"
        
        return "비정상적인 패턴 감지"


class ContextualAnomalyDetector:
    """문맥 기반 이상 탐지"""
    
    @staticmethod
    def detect_with_context(
        time_series: np.ndarray,
        context: Dict  # {'hour': int, 'day_of_week': int, ...}
    ) -> List[Dict]:
        """
        문맥을 고려한 이상 탐지
        
        Args:
            time_series: 시계열 데이터
            context: 현재 문맥 정보
        
        Returns:
            이상 정보
        """
        detector = MultivariatAnomalyDetector(sensitivity=0.1)
        anomalies = detector.detect(time_series)
        
        # 문맥에 따른 가중치 조정
        for anom in anomalies:
            idx = anom['index']
            
            # 업무 시간 vs 비업무 시간
            is_business_hours = 9 <= context.get('hour', 12) < 18
            is_weekend = context.get('day_of_week', 0) >= 5
            
            if is_weekend and anom['severity'] == 'high':
                anom['severity'] = 'medium'  # 주말은 변동이 크므로 조정
            elif is_business_hours and anom['severity'] == 'medium':
                anom['severity'] = 'high'  # 업무 시간 이상은 더 심각
        
        return anomalies
