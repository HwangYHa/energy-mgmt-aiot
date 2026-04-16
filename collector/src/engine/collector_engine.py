"""
collector_engine.py
───────────────────
수집 엔진 핵심 — 장치별 폴링 스케줄 관리 + 데이터 흐름 조정

구조:
  CollectorEngine
    ├── DriverRegistry  → 프로토콜별 드라이버 로드
    ├── ThreadPoolExecutor (max_workers=20)
    ├── APScheduler     → 장치별 독립 폴링 주기
    ├── LocalBuffer     → 로컬 SQLite 버퍼
    └── CloudSync       → 클라우드 전송 + 하트비트

데이터 흐름:
  장치 → Driver.safe_poll() → Reading []
       → LocalBuffer.push()
       → on_data callback (GUI 실시간 표시)
       ← CloudSync 배치 전송 (별도 스레드)
"""
from __future__ import annotations

import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Callable, Dict, List, Optional

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from ..buffer.local_buffer import LocalBuffer, Reading
from ..config.config_manager import CollectorConfig, DeviceConfig
from ..drivers import DriverRegistry
from ..drivers.base_driver import BaseDriver, DriverStatus
from ..sync.cloud_sync import CloudSync

logger = logging.getLogger(__name__)

# ── 엔진 상태 ─────────────────────────────────────────────────────────

class EngineStatus:
    STOPPED  = "stopped"
    STARTING = "starting"
    RUNNING  = "running"
    STOPPING = "stopping"
    ERROR    = "error"


class CollectorEngine:
    """
    수집 엔진 메인 클래스.

    사용:
        engine = CollectorEngine(config)
        engine.on_data(lambda device_id, readings: ...)
        engine.on_status_change(lambda device_id, status, msg: ...)
        engine.start()
        ...
        engine.stop()
    """

    def __init__(self, config: CollectorConfig):
        self.config    = config
        self.status    = EngineStatus.STOPPED

        # 드라이버 저장소 {device_id → BaseDriver}
        self._drivers:  Dict[str, BaseDriver] = {}
        self._driver_lock = threading.Lock()

        # 콜백
        self._on_data_cb:   Optional[Callable[[str, List[Reading]], None]] = None
        self._on_status_cb: Optional[Callable[[str, str, str], None]] = None
        self._on_engine_status_cb: Optional[Callable[[str], None]] = None

        # 로컬 버퍼
        self.buffer = LocalBuffer(
            db_path=config.buffer.db_path,
            max_records=config.buffer.max_records,
            retention_hours=config.buffer.retention_hours,
        )

        # 클라우드 동기화
        self.cloud_sync = CloudSync(
            buffer=self.buffer,
            api_url=config.cloud.api_url,
            gateway_id=config.cloud.gateway_id,
            gateway_token=config.cloud.gateway_token,
            sync_interval=config.cloud.sync_interval_sec,
            heartbeat_interval=config.cloud.heartbeat_interval_sec,
            batch_size=config.cloud.batch_size,
            timeout=config.cloud.timeout_sec,
        )

        # APScheduler (장치별 독립 폴링 주기)
        self._scheduler = BackgroundScheduler(
            job_defaults={"coalesce": True, "max_instances": 1, "misfire_grace_time": 5},
            timezone="UTC",
        )

        # 스레드 풀 (동시 폴링)
        self._executor = ThreadPoolExecutor(
            max_workers=config.engine.max_workers,
            thread_name_prefix="Collector",
        )

        # 정기 유지보수 플래그
        self._maintenance_counter = 0

    # ── 콜백 등록 ─────────────────────────────────────────────────────

    def on_data(self, callback: Callable[[str, List[Reading]], None]):
        """장치 데이터 수신 콜백: callback(device_id, readings)"""
        self._on_data_cb = callback

    def on_device_status(self, callback: Callable[[str, str, str], None]):
        """장치 상태 변경 콜백: callback(device_id, status, message)"""
        self._on_status_cb = callback

    def on_engine_status(self, callback: Callable[[str], None]):
        """엔진 상태 변경 콜백: callback(status)"""
        self._on_engine_status_cb = callback

    # ── 엔진 생명주기 ─────────────────────────────────────────────────

    def start(self):
        if self.status == EngineStatus.RUNNING:
            logger.warning("[Engine] 이미 실행 중")
            return

        self._set_engine_status(EngineStatus.STARTING)
        logger.info(f"[Engine] 시작 — 장치 {len(self.config.devices)}개")

        # 드라이버 초기화 + 스케줄러 등록
        for dev_cfg in self.config.devices:
            if dev_cfg.enabled:
                self._register_device(dev_cfg)

        # 스케줄러 시작
        self._scheduler.start()

        # 유지보수 작업 (1시간마다)
        self._scheduler.add_job(
            self._maintenance, trigger=IntervalTrigger(hours=1),
            id="__maintenance__", replace_existing=True,
        )

        # 클라우드 동기화 시작
        self.cloud_sync.start()

        self._set_engine_status(EngineStatus.RUNNING)
        logger.info("[Engine] 실행 중")

    def stop(self):
        if self.status == EngineStatus.STOPPED:
            return
        self._set_engine_status(EngineStatus.STOPPING)
        logger.info("[Engine] 종료 중...")

        # 스케줄러 정지
        if self._scheduler.running:
            self._scheduler.shutdown(wait=False)

        # 드라이버 연결 해제
        with self._driver_lock:
            for driver in self._drivers.values():
                try:
                    driver.disconnect()
                except Exception as e:
                    logger.warning(f"[Engine] 드라이버 종료 오류: {e}")
            self._drivers.clear()

        # 클라우드 동기화 정지
        self.cloud_sync.stop()

        # 스레드풀 종료
        self._executor.shutdown(wait=False)

        self._set_engine_status(EngineStatus.STOPPED)
        logger.info("[Engine] 종료 완료")

    # ── 장치 관리 ─────────────────────────────────────────────────────

    def _register_device(self, dev_cfg: DeviceConfig):
        """장치 드라이버 생성 + 스케줄러에 폴링 작업 등록"""
        try:
            driver = DriverRegistry.create(
                protocol=dev_cfg.protocol,
                device_id=dev_cfg.id,
                config=dev_cfg.model_dump(),
            )
            driver.on_data(self._handle_readings)
            driver.on_status_change(self._handle_driver_status)

            with self._driver_lock:
                self._drivers[dev_cfg.id] = driver

            # MQTT는 Push 방식 → 연결만 하고 폴링 주기 없음
            if dev_cfg.protocol == "mqtt":
                driver.connect()
                # MQTT 수신 큐 플러시용 주기적 호출
                interval_ms = max(dev_cfg.poll_interval_ms, 1000)
            else:
                interval_ms = max(dev_cfg.poll_interval_ms, 100)

            interval_sec = interval_ms / 1000.0

            self._scheduler.add_job(
                func=self._poll_device,
                args=[dev_cfg.id],
                trigger=IntervalTrigger(seconds=interval_sec),
                id=dev_cfg.id,
                replace_existing=True,
                max_instances=1,
                coalesce=True,
            )

            logger.info(
                f"[Engine] 장치 등록: {dev_cfg.name} ({dev_cfg.protocol}) "
                f"— {interval_ms}ms 주기"
            )

        except Exception as e:
            logger.error(f"[Engine] 장치 등록 실패 ({dev_cfg.id}): {e}")

    def add_device(self, dev_cfg: DeviceConfig):
        """런타임 장치 추가 (무중단)"""
        if dev_cfg.id in self._drivers:
            self.remove_device(dev_cfg.id)
        self._register_device(dev_cfg)
        logger.info(f"[Engine] 장치 동적 추가: {dev_cfg.id}")

    def remove_device(self, device_id: str):
        """런타임 장치 제거 (무중단)"""
        with self._driver_lock:
            driver = self._drivers.pop(device_id, None)
        if driver:
            driver.disconnect()
        try:
            self._scheduler.remove_job(device_id)
        except Exception:
            pass
        logger.info(f"[Engine] 장치 제거: {device_id}")

    # ── 폴링 실행 ─────────────────────────────────────────────────────

    def _poll_device(self, device_id: str):
        """스케줄러 → 스레드풀에서 실제 폴링 실행"""
        with self._driver_lock:
            driver = self._drivers.get(device_id)
        if not driver:
            return

        # 드라이버 연결 상태 확인 및 자동 재연결
        if driver.status in (DriverStatus.DISCONNECTED, DriverStatus.IDLE, DriverStatus.ERROR):
            if driver.stats.consecutive_fails > 0:
                # 지수 백오프 (최대 5분)
                delay = min(30 * (2 ** min(driver.stats.consecutive_fails - 1, 4)), 300)
                if time.time() - driver.stats.last_poll_at < delay:
                    return  # 아직 대기 중

            reconnected = driver.connect()
            if not reconnected:
                return

        # 스레드풀에서 폴링 실행
        future = self._executor.submit(driver.safe_poll)
        # 결과는 driver.safe_poll() 내부에서 _emit_data → _handle_readings 콜백으로 전달

    # ── 데이터 처리 ───────────────────────────────────────────────────

    def _handle_readings(self, device_id: str, readings: List[Reading]):
        """드라이버에서 읽기 완료 → 버퍼 저장 + GUI 콜백"""
        if not readings:
            return

        # 로컬 버퍼 저장
        stored = self.buffer.push(readings)
        if stored < len(readings):
            logger.warning(f"[Engine] 버퍼 저장 일부 실패: {stored}/{len(readings)}")

        # GUI 콜백
        if self._on_data_cb:
            try:
                self._on_data_cb(device_id, readings)
            except Exception as e:
                logger.error(f"[Engine] 데이터 콜백 오류: {e}")

    def _handle_driver_status(self, device_id: str, status: DriverStatus, message: str):
        """드라이버 상태 변경 → GUI 콜백"""
        if self._on_status_cb:
            try:
                self._on_status_cb(device_id, status.value, message)
            except Exception as e:
                logger.error(f"[Engine] 상태 콜백 오류: {e}")

    def _set_engine_status(self, status: str):
        self.status = status
        if self._on_engine_status_cb:
            try:
                self._on_engine_status_cb(status)
            except Exception:
                pass

    # ── 유지보수 ─────────────────────────────────────────────────────

    def _maintenance(self):
        """1시간마다 실행: 만료 데이터 정리 + VACUUM"""
        deleted = self.buffer.purge_expired()
        self._maintenance_counter += 1
        if self._maintenance_counter % 24 == 0:  # 24시간마다 VACUUM
            self.buffer.vacuum()

    # ── 상태 조회 ─────────────────────────────────────────────────────

    def get_status(self) -> dict:
        with self._driver_lock:
            drivers_info = {did: d.get_info() for did, d in self._drivers.items()}

        return {
            "engine_status":  self.status,
            "device_count":   len(self._drivers),
            "buffer":         self.buffer.stats(),
            "cloud_sync":     self.cloud_sync.get_status(),
            "drivers":        drivers_info,
            "supported_protocols": DriverRegistry.list_protocols(),
        }

    def get_driver(self, device_id: str) -> Optional[BaseDriver]:
        with self._driver_lock:
            return self._drivers.get(device_id)

    def list_devices(self) -> List[dict]:
        with self._driver_lock:
            return [d.get_info() for d in self._drivers.values()]

    def test_device_connection(self, device_id: str) -> tuple[bool, str]:
        """GUI 테스트 버튼용"""
        with self._driver_lock:
            driver = self._drivers.get(device_id)
        if not driver:
            return False, "등록된 장치 없음"
        return driver.test_connection()