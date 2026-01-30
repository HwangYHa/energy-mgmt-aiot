"""
에너지 최적화 엔진
"""
import numpy as np
import pandas as pd
from typing import List, Dict, Tuple
from datetime import datetime, timedelta
import logging


logger = logging.getLogger(__name__)


class OptimizationEngine:
    """에너지 최적화 엔진"""
    
    @staticmethod
    def analyze_peak_hours(time_series: np.ndarray, top_n: int = 5) -> Dict:
        """
        피크 시간대 분석
        
        Args:
            time_series: 시계열 데이터 (시간 단위)
            top_n: 상위 N개 피크 시간대
        
        Returns:
            피크 시간대 정보
        """
        # 시간별 평균 계산
        if len(time_series) < 24:
            hourly_avg = time_series
        else:
            hourly_avg = np.array([
                np.mean(time_series[i::24]) 
                for i in range(24)
            ])
        
        # 피크 시간대
        peak_indices = np.argsort(hourly_avg)[-top_n:][::-1]
        peak_hours = sorted(peak_indices.tolist())
        
        # 피크 시간대의 평균 부하
        peak_load = float(np.mean([hourly_avg[h] for h in peak_hours]))
        
        return {
            'peak_hours': peak_hours,
            'peak_load': peak_load,
            'base_load': float(np.min(hourly_avg)),
            'hourly_average': hourly_avg.tolist()
        }
    
    @staticmethod
    def optimize_ess_schedule(
        peak_hours: List[int],
        peak_load: float,
        target_reduction: float,
        ess_capacity: float = 100.0,  # kWh
        ess_efficiency: float = 0.9
    ) -> List[Dict]:
        """
        ESS (에너지 저장 시스템) 충방전 스케줄 최적화
        
        Args:
            peak_hours: 피크 시간대 리스트
            peak_load: 피크 부하
            target_reduction: 감축 목표
            ess_capacity: ESS 용량
            ess_efficiency: 충방전 효율
        
        Returns:
            ESS 스케줄
        """
        schedule = []
        
        for hour in range(24):
            if hour in peak_hours:
                # 피크 시간대: 방전
                discharge_power = min(target_reduction / len(peak_hours), peak_load * 0.3)
                schedule.append({
                    'hour': hour,
                    'operation': 'discharge',
                    'power': float(discharge_power),
                    'energy': float(discharge_power * 1),  # 1시간
                })
            elif 2 <= hour <= 6:
                # 심야 시간대 (2~6시): 충전
                charge_power = min(
                    (target_reduction / len(peak_hours)) / ess_efficiency,
                    ess_capacity / 4
                )
                schedule.append({
                    'hour': hour,
                    'operation': 'charge',
                    'power': float(charge_power),
                    'energy': float(charge_power * 1),
                })
            else:
                # 대기
                schedule.append({
                    'hour': hour,
                    'operation': 'standby',
                    'power': 0.0,
                    'energy': 0.0,
                })
        
        return schedule
    
    @staticmethod
    def optimize_hvac_settings(
        peak_hours: List[int],
        base_temperature: float = 22.0,
        setpoint_adjustment: float = 1.0
    ) -> Dict:
        """
        HVAC (난방/냉방) 설정 최적화
        
        Args:
            peak_hours: 피크 시간대
            base_temperature: 기본 설정 온도
            setpoint_adjustment: 온도 조정폭 (°C)
        
        Returns:
            HVAC 설정
        """
        settings = {
            'base_temperature': base_temperature,
            'hourly_setpoints': []
        }
        
        for hour in range(24):
            if hour in peak_hours:
                # 피크 시간대: 온도 상향 조정 (냉방 부하 감소)
                setpoint = base_temperature + setpoint_adjustment
                adjustment = 'increase'
            elif hour in [6, 7, 8]:
                # 출근 시간: 빠른 냉방
                setpoint = base_temperature - 0.5
                adjustment = 'decrease'
            else:
                setpoint = base_temperature
                adjustment = 'normal'
            
            settings['hourly_setpoints'].append({
                'hour': hour,
                'setpoint': float(setpoint),
                'adjustment': adjustment,
            })
        
        settings['estimated_load_reduction'] = 0.15  # 15% 냉난방 부하 감소
        
        return settings
    
    @staticmethod
    def calculate_load_shifting(
        time_series: np.ndarray,
        target_reduction: float,
        shiftable_loads: List[str] = None
    ) -> List[Dict]:
        """
        부하 이동 전략
        
        Args:
            time_series: 시계열 데이터
            target_reduction: 감축 목표
            shiftable_loads: 이동 가능 부하 (예: 충전기, 세탁기)
        
        Returns:
            부하 이동 계획
        """
        if shiftable_loads is None:
            shiftable_loads = ['ev_charger', 'water_heater', 'cooling']
        
        # 시간별 부하 계산
        hourly_load = np.array([
            np.mean(time_series[i::24]) 
            for i in range(24)
        ]) if len(time_series) >= 24 else time_series
        
        # 피크 시간대 추출
        peak_threshold = np.percentile(hourly_load, 80)
        peak_hours = np.where(hourly_load > peak_threshold)[0]
        
        # 저부하 시간대
        low_load_hours = np.argsort(hourly_load)[:5]  # 가장 낮은 5시간
        
        shifting_plan = []
        reduction_per_load = target_reduction / len(shiftable_loads)
        
        for load_type in shiftable_loads:
            shifting_plan.append({
                'load_type': load_type,
                'from_hours': peak_hours.tolist(),
                'to_hours': low_load_hours.tolist(),
                'estimated_reduction': float(reduction_per_load),
            })
        
        return shifting_plan
    
    @staticmethod
    def estimate_savings(
        peak_load: float,
        peak_hours: List[int],
        ess_schedule: List[Dict],
        hvac_settings: Dict,
        load_shifting: List[Dict],
        electricity_rate: float = 200.0  # ₩/kWh
    ) -> Dict:
        """
        절감액 추정
        
        Args:
            peak_load: 피크 부하
            peak_hours: 피크 시간대
            ess_schedule: ESS 스케줄
            hvac_settings: HVAC 설정
            load_shifting: 부하 이동 계획
            electricity_rate: 전기요금
        
        Returns:
            절감액 정보
        """
        # ESS를 통한 절감
        ess_reduction = sum([
            item['power'] for item in ess_schedule 
            if item['operation'] == 'discharge'
        ])
        
        # HVAC를 통한 절감
        hvac_reduction = (
            peak_load * len(peak_hours) * 
            hvac_settings['estimated_load_reduction']
        )
        
        # 부하 이동을 통한 절감
        shifting_reduction = sum([
            item['estimated_reduction'] 
            for item in load_shifting
        ])
        
        total_reduction = ess_reduction + hvac_reduction + shifting_reduction
        
        # 일일 절감액
        daily_savings = total_reduction * electricity_rate
        
        # 월간/연간 절감액
        monthly_savings = daily_savings * 30
        annual_savings = daily_savings * 365
        
        return {
            'ess_reduction': float(ess_reduction),
            'hvac_reduction': float(hvac_reduction),
            'shifting_reduction': float(shifting_reduction),
            'total_reduction': float(total_reduction),
            'daily_savings': float(daily_savings),
            'monthly_savings': float(monthly_savings),
            'annual_savings': float(annual_savings),
            'roi_days': float(50000 / daily_savings) if daily_savings > 0 else float('inf'),
        }
    
    def optimize(
        self,
        time_series: np.ndarray,
        target_reduction: float,
        ess_capacity: float = 100.0
    ) -> Dict:
        """
        통합 최적화 (피크 제어, ESS, HVAC, 부하 이동)
        
        Args:
            time_series: 시계열 데이터
            target_reduction: 감축 목표 (kW)
            ess_capacity: ESS 용량
        
        Returns:
            최적화 결과
        """
        logger.info(f"🔧 최적화 시작: 목표 감축 {target_reduction}kW")
        
        # 1. 피크 분석
        peak_analysis = self.analyze_peak_hours(time_series)
        peak_hours = peak_analysis['peak_hours']
        peak_load = peak_analysis['peak_load']
        
        # 2. ESS 스케줄 최적화
        ess_schedule = self.optimize_ess_schedule(
            peak_hours,
            peak_load,
            target_reduction,
            ess_capacity
        )
        
        # 3. HVAC 최적화
        hvac_settings = self.optimize_hvac_settings(peak_hours)
        
        # 4. 부하 이동
        load_shifting = self.calculate_load_shifting(
            time_series,
            target_reduction
        )
        
        # 5. 절감액 계산
        savings = self.estimate_savings(
            peak_load,
            peak_hours,
            ess_schedule,
            hvac_settings,
            load_shifting
        )
        
        # 6. 추천사항 생성
        recommendations = self._generate_recommendations(savings, peak_hours)
        
        return {
            'peak_hours': peak_hours,
            'peak_load': peak_load,
            'ess_schedule': ess_schedule,
            'hvac_settings': hvac_settings,
            'load_shifting': load_shifting,
            'estimated_saving': savings['total_reduction'],
            'daily_savings': savings['daily_savings'],
            'annual_savings': savings['annual_savings'],
            'recommendations': recommendations,
        }
    
    @staticmethod
    def _generate_recommendations(savings: Dict, peak_hours: List[int]) -> List[str]:
        """추천사항 생성"""
        recommendations = []
        
        if savings['total_reduction'] > 50:
            recommendations.append("✅ ESS 도입으로 피크 제어 효과 극대화")
        
        if savings['hvac_reduction'] > 10:
            recommendations.append("🌡️ HVAC 스케줄 조정으로 냉난방 비용 절감")
        
        if savings['shifting_reduction'] > 20:
            recommendations.append("⚡ 심야 전기요금 활용 부하 이동")
        
        if savings['annual_savings'] > 10000000:  # 1000만원
            recommendations.append("🎯 에너지 관리 시스템 고도화 투자 추천")
        
        peak_hour_str = f"{min(peak_hours)}~{max(peak_hours)}시"
        recommendations.append(f"⏰ 주요 피크 시간대: {peak_hour_str}")
        
        return recommendations
