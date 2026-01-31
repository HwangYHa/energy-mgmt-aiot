# ai-engine/src/models/forecaster.py
import numpy as np
import pandas as pd
from typing import List, Dict, Any
from datetime import datetime
import tensorflow as tf
from tensorflow import keras
from sklearn.preprocessing import MinMaxScaler
import joblib
import os

class LoadForecaster:
    """
    LSTM 기반 부하 예측 모델
    
    특징:
    - 168시간(7일) 입력 → 24시간 예측
    - Multi-feature 지원 (전력, 온도, 요일, 시간 등)
    - 신뢰도 추정 기능
    - 모델 저장/로드
    """
    
    def __init__(self, model_path: str = None):
        self.version = "1.0.0"
        self.sequence_length = 168  # 7일 (시간당)
        self.prediction_horizon = 24  # 24시간
        self.n_features = 5  # value, hour, weekday, temperature, is_weekend
        
        self.scaler_X = MinMaxScaler()
        self.scaler_y = MinMaxScaler()
        
        self.overall_confidence = 0.85  # 기본 신뢰도
        self.last_accuracy = None
        
        if model_path and os.path.exists(model_path):
            self.load_model(model_path)
        else:
            self.model = self._build_model()
    
    def _build_model(self) -> keras.Model:
        """
        LSTM 모델 구축
        """
        model = keras.Sequential([
            # 첫 번째 LSTM 레이어
            keras.layers.LSTM(
                128,
                return_sequences=True,
                input_shape=(self.sequence_length, self.n_features)
            ),
            keras.layers.Dropout(0.2),
            
            # 두 번째 LSTM 레이어
            keras.layers.LSTM(64, return_sequences=True),
            keras.layers.Dropout(0.2),
            
            # 세 번째 LSTM 레이어
            keras.layers.LSTM(32),
            keras.layers.Dropout(0.2),
            
            # Dense 레이어
            keras.layers.Dense(64, activation='relu'),
            keras.layers.Dropout(0.1),
            
            # 출력 레이어 (24시간 예측)
            keras.layers.Dense(self.prediction_horizon)
        ])
        
        model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=0.001),
            loss='mse',
            metrics=['mae', 'mape']
        )
        
        return model
    
    def prepare_features(self, df: pd.DataFrame) -> np.ndarray:
        """
        피처 준비
        """
        features = []
        
        for _, row in df.iterrows():
            # 기본 피처
            feature_vector = [
                row['value'],
                row.get('hour', 0),
                row.get('weekday', 0),
                row.get('temperature', 20),  # 기본값 20도
                row.get('is_weekend', 0)
            ]
            features.append(feature_vector)
        
        return np.array(features)
    
    def predict(
        self,
        historical_data: pd.DataFrame,
        horizon: int = 24,
        features: List[str] = None
    ) -> np.ndarray:
        """
        부하 예측 수행
        
        Args:
            historical_data: 과거 데이터 (DataFrame)
            horizon: 예측 범위 (시간)
            features: 사용할 피처 목록
        
        Returns:
            predictions: 예측 값 배열 (shape: [horizon,])
        """
        try:
            # 1. 피처 준비
            X = self.prepare_features(historical_data)
            
            # 2. 데이터가 부족한 경우 폴백
            if len(X) < self.sequence_length:
                return self._fallback_prediction(historical_data, horizon)
            
            # 3. 스케일링
            X_scaled = self.scaler_X.fit_transform(X)
            
            # 4. 시퀀스 생성 (최근 168시간)
            X_seq = X_scaled[-self.sequence_length:].reshape(
                1, self.sequence_length, self.n_features
            )
            
            # 5. 예측 수행
            predictions_scaled = self.model.predict(X_seq, verbose=0)
            
            # 6. 역스케일링
            # y_scaler를 맞추기 위해 과거 값 사용
            y_values = X[:, 0].reshape(-1, 1)  # value 컬럼
            self.scaler_y.fit(y_values)
            
            predictions = self.scaler_y.inverse_transform(
                predictions_scaled.reshape(-1, 1)
            ).flatten()
            
            # 7. 음수 값 보정
            predictions = np.maximum(predictions, 0)
            
            # 8. horizon에 맞게 조정
            if horizon != self.prediction_horizon:
                predictions = self._adjust_horizon(predictions, horizon)
            
            # 9. 신뢰도 계산
            self._calculate_confidence(predictions, historical_data)
            
            return predictions
        
        except Exception as e:
            print(f"Prediction error: {e}")
            # 에러 발생 시 폴백
            return self._fallback_prediction(historical_data, horizon)
    
    def _fallback_prediction(
        self,
        historical_data: pd.DataFrame,
        horizon: int
    ) -> np.ndarray:
        """
        폴백 예측 (단순 이동 평균)
        """
        recent_values = historical_data['value'].tail(24).values
        avg_value = np.mean(recent_values)
        
        # 시간대별 패턴 반영 (간단한 사인 곡선)
        t = np.arange(horizon)
        pattern = 1 + 0.2 * np.sin(2 * np.pi * t / 24)
        
        predictions = avg_value * pattern
        self.overall_confidence = 0.5  # 낮은 신뢰도
        
        return predictions
    
    def _adjust_horizon(
        self,
        predictions: np.ndarray,
        target_horizon: int
    ) -> np.ndarray:
        """
        예측 범위 조정
        """
        if target_horizon > len(predictions):
            # 외삽 (마지막 값 반복)
            last_value = predictions[-1]
            extension = np.full(
                target_horizon - len(predictions),
                last_value
            )
            return np.concatenate([predictions, extension])
        else:
            # 절단
            return predictions[:target_horizon]
    
    def _calculate_confidence(
        self,
        predictions: np.ndarray,
        historical_data: pd.DataFrame
    ):
        """
        신뢰도 계산
        """
        # 예측 값의 변동성 기반 신뢰도
        pred_std = np.std(predictions)
        hist_std = historical_data['value'].std()
        
        if hist_std > 0:
            confidence_ratio = 1 - min(pred_std / hist_std, 1.0)
        else:
            confidence_ratio = 0.5
        
        # 데이터 품질 기반 신뢰도
        data_quality = min(len(historical_data) / self.sequence_length, 1.0)
        
        # 종합 신뢰도
        self.overall_confidence = (confidence_ratio * 0.6 + data_quality * 0.4)
    
    def get_confidence(self, hour_index: int) -> float:
        """
        특정 시간의 신뢰도 반환
        (시간이 지날수록 신뢰도 감소)
        """
        decay_factor = 0.95 ** hour_index
        return self.overall_confidence * decay_factor
    
    def validate(
        self,
        train_df: pd.DataFrame,
        test_df: pd.DataFrame
    ) -> float:
        """
        모델 검증 (MAPE 계산)
        """
        try:
            # 예측
            predictions = self.predict(train_df, horizon=len(test_df))
            
            # 실제 값
            actual = test_df['value'].values[:len(predictions)]
            
            # MAPE 계산
            mape = np.mean(
                np.abs((actual - predictions) / actual)
            ) * 100
            
            self.last_accuracy = mape
            return mape
        
        except Exception as e:
            print(f"Validation error: {e}")
            return None
    
    def train(
        self,
        train_data: pd.DataFrame,
        val_data: pd.DataFrame = None,
        epochs: int = 50,
        batch_size: int = 32
    ):
        """
        모델 학습
        """
        # 피처 준비
        X = self.prepare_features(train_data)
        y = train_data['value'].values
        
        # 스케일링
        X_scaled = self.scaler_X.fit_transform(X)
        y_scaled = self.scaler_y.fit_transform(y.reshape(-1, 1)).flatten()
        
        # 시퀀스 생성
        X_seq, y_seq = self._create_sequences(X_scaled, y_scaled)
        
        # 학습
        history = self.model.fit(
            X_seq, y_seq,
            epochs=epochs,
            batch_size=batch_size,
            validation_split=0.2 if val_data is None else 0,
            callbacks=[
                keras.callbacks.EarlyStopping(
                    patience=10,
                    restore_best_weights=True
                ),
                keras.callbacks.ReduceLROnPlateau(
                    factor=0.5,
                    patience=5
                )
            ],
            verbose=1
        )
        
        return history
    
    def _create_sequences(
        self,
        X: np.ndarray,
        y: np.ndarray
    ) -> tuple:
        """
        시퀀스 데이터 생성
        """
        X_seq, y_seq = [], []
        
        for i in range(len(X) - self.sequence_length - self.prediction_horizon):
            X_seq.append(X[i:i + self.sequence_length])
            y_seq.append(y[i + self.sequence_length:i + self.sequence_length + self.prediction_horizon])
        
        return np.array(X_seq), np.array(y_seq)
    
    def save_model(self, path: str):
        """모델 저장"""
        os.makedirs(path, exist_ok=True)
        
        # Keras 모델 저장
        self.model.save(os.path.join(path, 'model.h5'))
        
        # Scaler 저장
        joblib.dump(self.scaler_X, os.path.join(path, 'scaler_X.pkl'))
        joblib.dump(self.scaler_y, os.path.join(path, 'scaler_y.pkl'))
        
        print(f"Model saved to {path}")
    
    def load_model(self, path: str):
        """모델 로드"""
        self.model = keras.models.load_model(
            os.path.join(path, 'model.h5')
        )
        self.scaler_X = joblib.load(os.path.join(path, 'scaler_X.pkl'))
        self.scaler_y = joblib.load(os.path.join(path, 'scaler_y.pkl'))
        
        print(f"Model loaded from {path}")