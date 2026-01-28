# apps/ai-engine/src/ml/load_forecaster.py
import numpy as np
import pandas as pd
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from sklearn.preprocessing import MinMaxScaler

class LoadForecaster:
    def __init__(self):
        self.model = None
        self.scaler = MinMaxScaler()
        self.sequence_length = 24  # 24시간 히스토리
    
    def build_model(self, input_shape):
        """
        LSTM 모델 구축
        """
        model = Sequential([
            LSTM(50, activation='relu', return_sequences=True, input_shape=input_shape),
            Dropout(0.2),
            LSTM(50, activation='relu'),
            Dropout(0.2),
            Dense(24)  # 24시간 예측
        ])
        
        model.compile(optimizer='adam', loss='mse')
        self.model = model
        return model
    
    def prepare_data(self, data: pd.DataFrame):
        """
        학습 데이터 준비
        """
        # 정규화
        scaled_data = self.scaler.fit_transform(data[['value']])
        
        X, y = [], []
        for i in range(len(scaled_data) - self.sequence_length - 24):
            X.append(scaled_data[i:i+self.sequence_length])
            y.append(scaled_data[i+self.sequence_length:i+self.sequence_length+24])
        
        return np.array(X), np.array(y).reshape(-1, 24)
    
    async def train(self, data: pd.DataFrame, epochs: int = 50):
        """
        모델 학습
        """
        X, y = self.prepare_data(data)
        
        if self.model is None:
            self.build_model(input_shape=(X.shape[1], X.shape[2]))
        
        self.model.fit(
            X, y,
            epochs=epochs,
            batch_size=32,
            validation_split=0.2,
            verbose=1
        )
    
    async def predict(self, recent_data: pd.DataFrame) -> np.ndarray:
        """
        24시간 예측
        """
        # 최근 24시간 데이터
        scaled_input = self.scaler.transform(recent_data[['value']].tail(self.sequence_length))
        input_data = scaled_input.reshape(1, self.sequence_length, 1)
        
        # 예측
        prediction_scaled = self.model.predict(input_data)
        prediction = self.scaler.inverse_transform(prediction_scaled)
        
        return prediction.flatten()