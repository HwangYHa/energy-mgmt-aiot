# apps/ai-engine/src/rules/threshold_checker.py
from typing import List, Dict
from datetime import datetime, timedelta

class ThresholdChecker:
    def __init__(self, db_client):
        self.db = db_client
    
    async def check_power_threshold(
        self,
        tenant_id: str,
        metric_id: str,
        threshold: float,
        duration_seconds: int = 300  # 5분
    ) -> bool:
        """
        전력 임계값 초과 여부 확인
        """
        end_time = datetime.now()
        start_time = end_time - timedelta(seconds=duration_seconds)
        
        # 최근 N분간 데이터 조회
        data = await self.db.query(f"""
            SELECT value
            FROM measurement
            WHERE tenant_id = '{tenant_id}'
              AND metric_id = '{metric_id}'
              AND time >= '{start_time}'
              AND time <= '{end_time}'
            ORDER BY time DESC
        """)
        
        if not data:
            return False
        
        # 모든 값이 임계값 초과인지 확인
        exceeds = all(row['value'] > threshold for row in data)
        
        return exceeds
    
    async def detect_sudden_change(
        self,
        tenant_id: str,
        metric_id: str,
        change_percent: float = 20.0
    ) -> bool:
        """
        급격한 변화 감지 (20% 이상)
        """
        # 현재값
        current = await self.db.query_one(f"""
            SELECT value
            FROM measurement
            WHERE tenant_id = '{tenant_id}'
              AND metric_id = '{metric_id}'
            ORDER BY time DESC
            LIMIT 1
        """)
        
        # 1시간 전 평균
        one_hour_ago = datetime.now() - timedelta(hours=1)
        avg = await self.db.query_one(f"""
            SELECT AVG(value) as avg_value
            FROM measurement
            WHERE tenant_id = '{tenant_id}'
              AND metric_id = '{metric_id}'
              AND time >= '{one_hour_ago}'
        """)
        
        if not current or not avg:
            return False
        
        change = abs(current['value'] - avg['avg_value']) / avg['avg_value'] * 100
        
        return change > change_percent