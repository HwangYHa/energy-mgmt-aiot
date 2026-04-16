"""
base_driver.py
──────────────
모든 프로토콜 드라이버가 구현해야 하는 추상 기반 클래스

Plugin 구조:
  - 새 프로토콜 추가 = BaseDriver 상속 + DriverRegistry 등록
  - 엔진은 BaseDriver 인터페이스만 사용 → 드라이버 교체 자유
"""
from __future__ import annotations

import logging
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Callable, List, Optional

from ..buffer.local_buffer import Reading

logger = logging.getLogger(__name__)

# ── 상태 열거형 ───────────────────────────────────────────────────────

class DriverStatus(str, Enum):
    IDLE         = "idle"
    CONNECTING   = "connecting"
    CONNECTED    = "connected"
    POLLING      = "polling"
    DISCONNECTED = "disconnected"
    ERROR        = "error"

# ── 드라이버 통계 ─────────────────────────────────────────────────────

@dataclass
class DriverStats:
    total_polls:      int   = 0
    success_polls:    int   = 0
    failed_polls:     int   = 0
    total_readings:   int   = 0
    last_poll_at:     float = 0.0
    last_success_at:  float = 0.0
    last_error:       str   = ""
    consecutive_fails: int  = 0
    connect_at:       float = 0.0

    @property
    def success_rate(self) -> float:
        if self.total_polls == 0:
            return 0.0
        return self.success_polls / self.total_polls * 100

    @property
    def uptime_sec(self) -> float:
        if not self.connect_at:
            return 0.0
        return time.time() - self.connect_at

# ── 추상 드라이버 ─────────────────────────────────────────────────────

class BaseDriver(ABC):
    """
    모든 프로토콜 드라이버의 공통 인터페이스.

    서브클래스 구현 필수:
      - connect()    : 장치 연결
      - disconnect() : 연결 해제
      - poll()       : 데이터 수집 → List[Reading] 반환

    선택 구현:
      - test_connection() : 연결 테스트 (GUI 테스트 버튼용)
      - write_value()     : 제어 출력 (양방향 제어)
    """

    def __init__(self, device_id: str, config: dict):
        self.device_id  = device_id
        self.config     = config
        self.status     = DriverStatus.IDLE
        self.stats      = DriverStats()
        self._on_data:  Optional[Callable[[str, List[Reading]], None]] = None
        self._on_status: Optional[Callable[[str, DriverStatus, str], None]] = None

    # ── 이벤트 콜백 등록 ─────────────────────────────────────────────

    def on_data(self, callback: Callable[[str, List[Reading]], None]):
        """데이터 수신 콜백 등록: callback(device_id, readings)"""
        self._on_data = callback

    def on_status_change(self, callback: Callable[[str, DriverStatus, str], None]):
        """상태 변경 콜백 등록: callback(device_id, status, message)"""
        self._on_status = callback

    def _emit_data(self, readings: List[Reading]):
        if self._on_data and readings:
            try:
                self._on_data(self.device_id, readings)
            except Exception as e:
                logger.error(f"[{self.device_id}] 데이터 콜백 오류: {e}")

    def _set_status(self, status: DriverStatus, message: str = ""):
        if self.status != status:
            logger.info(f"[{self.device_id}] 상태: {self.status} → {status} {message}")
            self.status = status
            if self._on_status:
                try:
                    self._on_status(self.device_id, status, message)
                except Exception as e:
                    logger.error(f"[{self.device_id}] 상태 콜백 오류: {e}")

    # ── 추상 메서드 ──────────────────────────────────────────────────

    @abstractmethod
    def connect(self) -> bool:
        """장치 연결. 성공 시 True 반환."""
        ...

    @abstractmethod
    def disconnect(self) -> None:
        """연결 해제 및 리소스 정리."""
        ...

    @abstractmethod
    def poll(self) -> List[Reading]:
        """
        장치에서 데이터 읽기.

        반환: 수집된 Reading 목록 (실패 시 빈 리스트)
        예외를 던지지 않고 빈 리스트 반환 원칙.
        """
        ...

    # ── 기본 구현 (오버라이드 가능) ──────────────────────────────────

    def test_connection(self) -> tuple[bool, str]:
        """연결 테스트. (성공여부, 메시지) 반환."""
        try:
            ok = self.connect()
            if ok:
                self.disconnect()
                return True, "연결 성공"
            return False, "연결 실패"
        except Exception as e:
            return False, str(e)

    def write_value(self, register: int, value: float) -> bool:
        """제어 출력 (서브클래스에서 필요 시 구현)."""
        logger.warning(f"[{self.device_id}] write_value 미구현")
        return False

    # ── 폴링 실행 래퍼 ───────────────────────────────────────────────

    def safe_poll(self) -> List[Reading]:
        """
        poll() 안전 래퍼:
          - 통계 업데이트
          - 예외 처리
          - 연속 실패 추적
        """
        self.stats.total_polls += 1
        self.stats.last_poll_at = time.time()

        try:
            self._set_status(DriverStatus.POLLING)
            readings = self.poll()
            self.stats.success_polls += 1
            self.stats.total_readings += len(readings)
            self.stats.last_success_at = time.time()
            self.stats.consecutive_fails = 0
            self.stats.last_error = ""
            self._set_status(DriverStatus.CONNECTED)
            self._emit_data(readings)
            return readings

        except Exception as e:
            self.stats.failed_polls += 1
            self.stats.consecutive_fails += 1
            self.stats.last_error = str(e)
            self._set_status(DriverStatus.ERROR, str(e))
            logger.warning(
                f"[{self.device_id}] poll 오류 "
                f"(연속 {self.stats.consecutive_fails}회): {e}"
            )
            return []

    def get_info(self) -> dict:
        """드라이버 상태 정보 반환 (GUI 표시용)"""
        return {
            "device_id":        self.device_id,
            "protocol":         self.__class__.__name__.replace("Driver", "").lower(),
            "status":           self.status.value,
            "total_polls":      self.stats.total_polls,
            "success_rate":     round(self.stats.success_rate, 1),
            "total_readings":   self.stats.total_readings,
            "consecutive_fails": self.stats.consecutive_fails,
            "last_error":       self.stats.last_error,
            "uptime_sec":       round(self.stats.uptime_sec),
        }

# ── 드라이버 레지스트리 (Plugin 패턴) ────────────────────────────────

class DriverRegistry:
    """
    프로토콜 → 드라이버 클래스 매핑 레지스트리.

    신규 프로토콜 추가:
        @DriverRegistry.register("my_protocol")
        class MyDriver(BaseDriver): ...
    """
    _registry: dict[str, type[BaseDriver]] = {}

    @classmethod
    def register(cls, protocol: str):
        """데코레이터로 드라이버 등록"""
        def decorator(driver_cls: type[BaseDriver]):
            cls._registry[protocol.lower()] = driver_cls
            logger.debug(f"[Registry] 드라이버 등록: {protocol} → {driver_cls.__name__}")
            return driver_cls
        return decorator

    @classmethod
    def create(cls, protocol: str, device_id: str, config: dict) -> BaseDriver:
        """프로토콜명으로 드라이버 인스턴스 생성"""
        driver_cls = cls._registry.get(protocol.lower())
        if not driver_cls:
            raise ValueError(
                f"미지원 프로토콜: '{protocol}'. "
                f"지원 목록: {list(cls._registry.keys())}"
            )
        return driver_cls(device_id, config)

    @classmethod
    def list_protocols(cls) -> list[str]:
        return list(cls._registry.keys())