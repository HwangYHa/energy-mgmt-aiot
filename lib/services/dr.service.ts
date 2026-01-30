"""
DR (Demand Response) 서비스
"""
from sqlalchemy import Column, String, DateTime, Float, JSON
from sqlalchemy.ext.declarative import declarative_base
from typing import List, Dict
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class DRService:
    """Demand Response (수요 반응) 관리"""

    @staticmethod
    async def create_event(data: Dict) -> Dict:
        """
        DR 이벤트 생성
        
        Args:
            data: {
                'name': '2024년 1월 피크 관리',
                'startTime': '2024-01-30T14:00:00',
                'endTime': '2024-01-30T17:00:00',
                'targetReduction': 50,  # kW
                'devices': ['device-1', 'device-2'],
                'priority': 'high'
            }
        
        Returns:
            생성된 이벤트
        """
        try:
            logger.info(f"📢 DR 이벤트 생성: {data['name']}")
            
            event = {
                'id': f"dr-{datetime.now().timestamp()}",
                'name': data['name'],
                'startTime': data['startTime'],
                'endTime': data['endTime'],
                'targetReduction': data['targetReduction'],
                'status': 'scheduled',
                'createdAt': datetime.now().isoformat(),
                'devices': data.get('devices', []),
                'priority': data.get('priority', 'medium'),
            }
            
            return event
        except Exception as e:
            logger.error(f"❌ DR 이벤트 생성 실패: {e}")
            raise

    @staticmethod
    async def execute_event(event_id: str) -> Dict:
        """
        DR 이벤트 실행
        
        Args:
            event_id: 이벤트 ID
        
        Returns:
            실행 결과
        """
        try:
            logger.info(f"⚡ DR 이벤트 실행: {event_id}")
            
            # 1. 대상 기기 식별
            # devices = await get_event_devices(event_id)
            
            # 2. 제어 명령 생성
            # for device in devices:
            #     await send_control_command(device, ...)
            
            # 3. 실행 기록
            result = {
                'eventId': event_id,
                'status': 'executing',
                'startTime': datetime.now().isoformat(),
                'affectedDevices': 0,  # 실제 기기 수
                'estimatedReduction': 0,  # 예상 감축량
            }
            
            return result
        except Exception as e:
            logger.error(f"❌ DR 이벤트 실행 실패: {e}")
            raise

    @staticmethod
    async def cancel_event(event_id: str) -> Dict:
        """DR 이벤트 취소"""
        logger.info(f"❌ DR 이벤트 취소: {event_id}")
        return {'eventId': event_id, 'status': 'cancelled'}

    @staticmethod
    async def get_event_status(event_id: str) -> Dict:
        """DR 이벤트 상태 조회"""
        return {
            'eventId': event_id,
            'status': 'executing',
            'progress': 0.75,
            'currentReduction': 37.5,
            'targetReduction': 50,
        }

    @staticmethod
    async def get_event_history(tenant_id: str, days: int = 30) -> List[Dict]:
        """
        DR 이벤트 이력 조회
        
        Args:
            tenant_id: 테넌트 ID
            days: 조회 기간
        
        Returns:
            이벤트 목록
        """
        # TODO: DB 조회
        return [
            {
                'id': 'dr-1',
                'name': '2024-01-30 피크 관리',
                'status': 'completed',
                'reduction': 45.2,
                'revenue': 9040,  # 45.2kW * 200₩/kW
            }
        ]

    @staticmethod
    def calculate_revenue(reduction: float, hours: float, rate: float = 200) -> float:
        """
        수익 계산
        
        Args:
            reduction: 감축량 (kW)
            hours: 지속 시간 (h)
            rate: 단가 (₩/kWh)
        
        Returns:
            수익 (₩)
        """
        return reduction * hours * rate


class DROptimizer:
    """DR 이벤트 최적화"""

    @staticmethod
    def optimize_device_selection(
        available_devices: List[Dict],
        target_reduction: float,
        priority: str = 'cost_effective'
    ) -> List[str]:
        """
        대상 기기 최적 선택
        
        Args:
            available_devices: [{'id': '...', 'reduction_capacity': 10, ...}]
            target_reduction: 목표 감축량
            priority: 'cost_effective', 'impact', 'reliability'
        
        Returns:
            선택된 기기 ID 리스트
        """
        # 기기를 감축 용량으로 정렬
        sorted_devices = sorted(
            available_devices,
            key=lambda x: x['reduction_capacity'],
            reverse=True
        )
        
        selected = []
        total_reduction = 0
        
        for device in sorted_devices:
            if total_reduction >= target_reduction:
                break
            
            selected.append(device['id'])
            total_reduction += device['reduction_capacity']
        
        return selected

    @staticmethod
    def optimize_timing(
        peak_hours: List[int],
        max_duration: int = 4  # 최대 4시간
    ) -> tuple:
        """
        DR 이벤트 최적 시간대
        
        Args:
            peak_hours: 피크 시간대
            max_duration: 최대 지속 시간
        
        Returns:
            (시작 시간, 종료 시간)
        """
        if not peak_hours:
            return (14, 18)  # 기본값
        
        start_hour = min(peak_hours)
        end_hour = min(max(peak_hours) + 1, start_hour + max_duration)
        
        return (start_hour, end_hour)


class DRAnalytics:
    """DR 분석"""

    @staticmethod
    def calculate_savings(
        reduction: float,
        hours: float,
        avoided_cost_per_kwh: float = 200,
        dr_incentive_per_kwh: float = 100
    ) -> Dict:
        """
        절감액 계산
        
        Args:
            reduction: 감축량 (kW)
            hours: 지속 시간
            avoided_cost_per_kwh: 회피 비용 (₩/kWh)
            dr_incentive_per_kwh: DR 인센티브 (₩/kWh)
        
        Returns:
            절감액 정보
        """
        energy_reduction = reduction * hours
        
        return {
            'energyReduction': energy_reduction,
            'avoidedCost': energy_reduction * avoided_cost_per_kwh,
            'drIncentive': energy_reduction * dr_incentive_per_kwh,
            'totalRevenue': energy_reduction * (avoided_cost_per_kwh + dr_incentive_per_kwh),
        }

    @staticmethod
    def analyze_response_rate(
        target_reduction: float,
        actual_reduction: float,
        target_devices: int,
        responsive_devices: int
    ) -> Dict:
        """
        응답률 분석
        
        Args:
            target_reduction: 목표 감축량
            actual_reduction: 실제 감축량
            target_devices: 대상 기기 수
            responsive_devices: 응답한 기기 수
        
        Returns:
            응답률 분석 결과
        """
        reduction_rate = actual_reduction / target_reduction if target_reduction > 0 else 0
        device_response_rate = responsive_devices / target_devices if target_devices > 0 else 0
        
        return {
            'reduction_rate': reduction_rate,
            'device_response_rate': device_response_rate,
            'success': reduction_rate >= 0.8 and device_response_rate >= 0.7,
            'feedback': get_feedback(reduction_rate, device_response_rate),
        }


def get_feedback(reduction_rate: float, device_response_rate: float) -> str:
    """응답률 기반 피드백"""
    if reduction_rate >= 0.95 and device_response_rate >= 0.9:
        return '⭐ 매우 우수한 응답'
    elif reduction_rate >= 0.8 and device_response_rate >= 0.7:
        return '✅ 좋은 응답'
    elif reduction_rate >= 0.6:
        return '⚠️ 개선 필요'
    else:
        return '❌ 낮은 응답률'
