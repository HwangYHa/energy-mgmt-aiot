# ai-engine/src/models/anomaly_detector.py
from sklearn.ensemble import IsolationForest
import numpy as np

class AnomalyDetector:
    def __init__(self):
        self.model = IsolationForest(
            contamination=0.05,  # 5% 이상치 가정
            random_state=42
        )
        
    def detect(self, measurements: np.ndarray):
        """
        Returns:
          - anomaly_scores: -1 (이상), 1 (정상)
          - anomaly_indices: 이상치 인덱스 리스트
          - severity: 'low', 'medium', 'high'
        """
        predictions = self.model.predict(measurements)
        scores = self.model.decision_function(measurements)
        
        anomaly_indices = np.where(predictions == -1)[0]
        severity = self._calculate_severity(scores[anomaly_indices])
        
        return {
            'anomaly_scores': predictions.tolist(),
            'anomaly_indices': anomaly_indices.tolist(),
            'severity': severity,
            'confidence': abs(scores.mean())
        }
    
    def _calculate_severity(self, scores):
        avg_score = abs(scores.mean())
        if avg_score > 0.5:
            return 'high'
        elif avg_score > 0.3:
            return 'medium'
        return 'low'