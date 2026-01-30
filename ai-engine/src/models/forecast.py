"""
LSTM 기반 부하 예측 모델
"""
import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from sklearn.preprocessing import MinMaxScaler
from typing import Tuple, List
import pickle
import os


class LSTMForecastModel:
    """LSTM을 이용한 시계열 예측 모델"""
    
    def __init__(self, lookback: int = 24, forecast_horizon: int = 24):
        """
        Args:
            lookback: 입력 시퀀스 길이 (과거 24시간)
            forecast_horizon: 예측 길이 (향후 24시간)
        """
        self.lookback = lookback
        self.forecast_horizon = forecast_horizon
        self.scaler = MinMaxScaler(feature_range=(0, 1))
        self.model = None
        self.is_trained = False
    
    def build_model(self, input_shape: Tuple[int, int]) -> keras.Model:
        """
        LSTM 모델 구축
        
        Args:
            input_shape: (lookback, features) 형태
        
        Returns:
            Keras 모델
        """
        model = keras.Sequential([
            # LSTM 레이어 1
            layers.LSTM(
                units=64,
                return_sequences=True,
                input_shape=input_shape,
                activation='relu'
            ),
            layers.Dropout(0.2),
            
            # LSTM 레이어 2
            layers.LSTM(
                units=32,
                return_sequences=False,
                activation='relu'
            ),
            layers.Dropout(0.2),
            
            # Dense 레이어
            layers.Dense(16, activation='relu'),
            layers.Dense(self.forecast_horizon)
        ])
        
        model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=0.001),
            loss='mse',
            metrics=['mae']
        )
        
        self.model = model
        return model
    
    def create_sequences(self, data: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        시계열 데이터를 입력-출력 쌍으로 변환
        
        Args:
            data: 1D 시계열 데이터
        
        Returns:
            X, y 시퀀스 쌍
        """
        X, y = [], []
        
        for i in range(len(data) - self.lookback - self.forecast_horizon + 1):
            X.append(data[i:i + self.lookback])
            y.append(data[i + self.lookback:i + self.lookback + self.forecast_horizon])
        
        return np.array(X), np.array(y)
    
    def fit(self, historical_data: np.ndarray, epochs: int = 50, batch_size: int = 32):
        """
        모델 학습
        
        Args:
            historical_data: 과거 데이터 배열 (1D)
            epochs: 에포크 수
            batch_size: 배치 크기
        """
        # 데이터 정규화
        scaled_data = self.scaler.fit_transform(historical_data.reshape(-1, 1))
        
        # 시퀀스 생성
        X, y = self.create_sequences(scaled_data.flatten())
        
        # 훈련/검증 분할 (80/20)
        split_idx = int(len(X) * 0.8)
        X_train, X_val = X[:split_idx], X[split_idx:]
        y_train, y_val = y[:split_idx], y[split_idx:]
        
        # 모델 구축
        if self.model is None:
            self.build_model((X_train.shape[1], X_train.shape[2]))
        
        # 모델 학습
        self.model.fit(
            X_train, y_train,
            validation_data=(X_val, y_val),
            epochs=epochs,
            batch_size=batch_size,
            verbose=1,
            callbacks=[
                keras.callbacks.EarlyStopping(
                    monitor='val_loss',
                    patience=5,
                    restore_best_weights=True
                )
            ]
        )
        
        self.is_trained = True
    
    def predict(self, recent_data: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        미래 값 예측
        
        Args:
            recent_data: 최근 데이터 (lookback 길이)
        
        Returns:
            predictions, confidence_intervals
        """
        if not self.is_trained or self.model is None:
            raise ValueError("모델이 훈련되지 않았습니다")
        
        # 데이터 정규화
        scaled_input = self.scaler.transform(recent_data.reshape(-1, 1))
        X = scaled_input.reshape(1, self.lookback, 1)
        
        # 예측
        scaled_prediction = self.model.predict(X, verbose=0)[0]
        
        # 역정규화
        prediction = self.scaler.inverse_transform(
            scaled_prediction.reshape(-1, 1)
        ).flatten()
        
        # 신뢰도 계산 (표준편차 기반)
        std_dev = np.std(recent_data) * 0.15  # 과거 데이터의 15%
        confidence_lower = prediction - 1.96 * std_dev
        confidence_upper = prediction + 1.96 * std_dev
        
        return prediction, confidence_lower, confidence_upper
    
    def calculate_mape(self, y_true: np.ndarray, y_pred: np.ndarray) -> float:
        """
        MAPE (Mean Absolute Percentage Error) 계산
        
        Args:
            y_true: 실제 값
            y_pred: 예측 값
        
        Returns:
            MAPE (%)
        """
        mask = y_true != 0
        return np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100
    
    def save(self, path: str):
        """모델 저장"""
        if self.model:
            self.model.save(os.path.join(path, 'lstm_model.h5'))
            pickle.dump(self.scaler, open(os.path.join(path, 'scaler.pkl'), 'wb'))
    
    def load(self, path: str):
        """모델 로드"""
        self.model = keras.models.load_model(os.path.join(path, 'lstm_model.h5'))
        self.scaler = pickle.load(open(os.path.join(path, 'scaler.pkl'), 'rb'))
        self.is_trained = True


class MultiHorizonForecaster:
    """다중 시간대별 예측 (24h, 7d, 30d)"""
    
    def __init__(self):
        self.models = {
            '24h': LSTMForecastModel(lookback=24, forecast_horizon=24),
            '7d': LSTMForecastModel(lookback=7*24, forecast_horizon=7*24),
            '30d': LSTMForecastModel(lookback=30*24, forecast_horizon=30*24),
        }
    
    def fit_all(self, historical_data: np.ndarray):
        """모든 모델 학습"""
        for horizon, model in self.models.items():
            print(f"🔄 {horizon} 모델 학습 중...")
            model.fit(historical_data, epochs=50)
            print(f"✅ {horizon} 모델 학습 완료")
    
    def predict(self, horizon: str, recent_data: np.ndarray):
        """예측 실행"""
        if horizon not in self.models:
            raise ValueError(f"지원하지 않는 horizon: {horizon}")
        
        model = self.models[horizon]
        prediction, lower, upper = model.predict(recent_data)
        
        return {
            'prediction': prediction,
            'confidence_lower': lower,
            'confidence_upper': upper,
            'horizon': horizon
        }
