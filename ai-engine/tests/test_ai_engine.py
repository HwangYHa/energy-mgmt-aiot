"""
AI Engine 테스트
"""
import pytest
from datetime import datetime, timedelta
import numpy as np
from src.models.forecast import LSTMForecastModel, MultiHorizonForecaster
from src.utils.preprocessor import preprocess_historical_data, DataQualityChecker
from src.models.anomaly import MultivariatAnomalyDetector
from src.models.optimization import OptimizationEngine


class TestForecast:
    """부하 예측 테스트"""
    
    @pytest.fixture
    def sample_data(self):
        """샘플 데이터 생성"""
        np.random.seed(42)
        base_load = 150
        data = []
        for i in range(720):  # 30일
            hour = i % 24
            # 시간대별 부하 변동
            if 6 <= hour < 9:
                load = base_load * 1.3
            elif 12 <= hour < 14:
                load = base_load * 1.2
            elif 17 <= hour < 20:
                load = base_load * 1.5
            else:
                load = base_load * 0.7
            
            # 노이즈 추가
            load += np.random.normal(0, 5)
            
            data.append({
                'timestamp': datetime.now() - timedelta(hours=720-i),
                'value': max(50, load)
            })
        return data
    
    def test_data_preprocessing(self, sample_data):
        """데이터 전처리 테스트"""
        data_dict = [{'timestamp': d['timestamp'], 'value': d['value']} for d in sample_data]
        processed = preprocess_historical_data(data_dict)
        
        assert len(processed) > 0
        assert not np.isnan(processed).any()
        assert np.min(processed) > 0
    
    def test_forecast_model_creation(self):
        """LSTM 모델 생성 테스트"""
        model = LSTMForecastModel(lookback=24, forecast_horizon=24)
        assert model.lookback == 24
        assert model.forecast_horizon == 24
    
    def test_multi_horizon_predictor(self, sample_data):
        """다중 시간대 예측 테스트"""
        forecaster = MultiHorizonForecaster()
        
        # 데이터 추출
        data = np.array([d['value'] for d in sample_data])
        
        # 모델 학습
        forecaster.fit_all(data)
        
        # 최근 24시간 데이터로 예측
        recent_data = data[-24:]
        
        for horizon in ['24h', '7d', '30d']:
            result = forecaster.predict(horizon, recent_data)
            assert len(result['prediction']) > 0
            assert 0 <= result['prediction'][0] < 500


class TestAnomaly:
    """이상 탐지 테스트"""
    
    def test_anomaly_detection(self):
        """이상 탐지 테스트"""
        # 정상 데이터 + 이상 데이터
        np.random.seed(42)
        data = np.concatenate([
            np.random.normal(150, 10, 100),  # 정상
            np.array([300, 310, 290]),  # 이상
            np.random.normal(150, 10, 97),  # 정상
        ])
        
        detector = MultivariatAnomalyDetector(sensitivity=0.1)
        anomalies = detector.detect(data)
        
        assert len(anomalies) > 0
        assert any(anom['severity'] == 'high' for anom in anomalies)
    
    def test_anomaly_score_range(self):
        """이상 점수 범위 테스트"""
        np.random.seed(42)
        data = np.random.normal(150, 10, 200)
        
        detector = MultivariatAnomalyDetector()
        anomalies = detector.detect(data)
        
        for anom in anomalies:
            assert -1 <= anom['score'] <= 1


class TestOptimization:
    """최적화 테스트"""
    
    def test_peak_analysis(self):
        """피크 분석 테스트"""
        optimizer = OptimizationEngine()
        
        # 시간별 부하 (24시간)
        hourly_load = np.array([
            100, 90, 80, 75, 70, 80,  # 0-6시 (심야)
            120, 150, 160, 170, 180, 190,  # 6-12시 (오전)
            180, 170, 160, 180, 200, 210,  # 12-18시 (오후)
            190, 170, 150, 120, 110, 100,  # 18-24시 (저녁)
        ])
        
        result = optimizer.analyze_peak_hours(hourly_load)
        
        assert len(result['peak_hours']) > 0
        assert all(0 <= h < 24 for h in result['peak_hours'])
    
    def test_ess_schedule_generation(self):
        """ESS 스케줄 생성 테스트"""
        optimizer = OptimizationEngine()
        
        peak_hours = [14, 15, 16, 17, 18, 19]
        peak_load = 200
        target_reduction = 50
        
        schedule = optimizer.optimize_ess_schedule(
            peak_hours, peak_load, target_reduction
        )
        
        assert len(schedule) == 24
        assert all('operation' in item for item in schedule)
        
        # 충전이 있는지 확인
        charge_hours = [s for s in schedule if s['operation'] == 'charge']
        assert len(charge_hours) > 0
        
        # 방전이 있는지 확인
        discharge_hours = [s for s in schedule if s['operation'] == 'discharge']
        assert len(discharge_hours) > 0
    
    def test_savings_calculation(self):
        """절감액 계산 테스트"""
        savings = OptimizationEngine().estimate_savings(
            peak_load=200,
            peak_hours=[14, 15, 16, 17, 18, 19],
            ess_schedule=[
                {'operation': 'discharge', 'power': 10, 'energy': 10}
            ] * 24,
            hvac_settings={'estimated_load_reduction': 0.15},
            load_shifting=[
                {'estimated_reduction': 15}
            ],
            electricity_rate=200
        )
        
        assert savings['total_reduction'] > 0
        assert savings['daily_savings'] > 0
        assert savings['annual_savings'] > savings['daily_savings'] * 100


class TestDataQuality:
    """데이터 품질 테스트"""
    
    def test_quality_check(self):
        """데이터 품질 검사 테스트"""
        data = np.random.normal(150, 10, 1000)
        
        quality = DataQualityChecker.check_quality(data)
        
        assert 0 <= quality['completeness'] <= 1
        assert 0 <= quality['missing_rate'] <= 1
        assert 0 <= quality['quality_score'] <= 1
        assert quality['is_acceptable']


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
