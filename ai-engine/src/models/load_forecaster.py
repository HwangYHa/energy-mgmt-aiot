# ai-engine/src/models/load_forecaster.py
import tensorflow as tf
from tensorflow import keras
from sklearn.preprocessing import MinMaxScaler

class LoadForecaster:
    def __init__(self):
        self.model = self._build_lstm_model()
        self.scaler = MinMaxScaler()
        
    def _build_lstm_model(self):
        model = keras.Sequential([
            keras.layers.LSTM(128, return_sequences=True, input_shape=(168, 5)),  # 7일 시간당
            keras.layers.Dropout(0.2),
            keras.layers.LSTM(64, return_sequences=True),
            keras.layers.Dropout(0.2),
            keras.layers.LSTM(32),
            keras.layers.Dense(24)  # 24시간 예측
        ])
        model.compile(optimizer='adam', loss='mse', metrics=['mae'])
        return model
    
    def prepare_data(self, measurements: List[Measurement]):
        """168시간(7일) → 24시간 예측"""
        features = []
        for m in measurements:
            features.append([
                m.value,                    # 전력 사용량
                m.timestamp.hour,           # 시간
                m.timestamp.weekday(),      # 요일
                m.temperature,              # 외기 온도
                m.is_holiday               # 공휴일
            ])
        return self.scaler.fit_transform(features)
    
    def predict(self, historical_data):
        X = self.prepare_data(historical_data)
        X = X.reshape(1, 168, 5)
        predictions = self.model.predict(X)
        return self.scaler.inverse_transform(predictions)