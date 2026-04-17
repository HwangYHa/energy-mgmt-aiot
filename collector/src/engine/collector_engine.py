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
    ├── CloudSync       → 클라우드 전송 + 하트비트
    └── OtaCache        → 오프라인 내성 OTA 설정 캐시

데이터 흐름:
  장치 → Driver.safe_poll() → Reading []
       → LocalBuffer.push()
       → on_data callback (GUI 실시간 표시)
       ← CloudSync 배치 전송 (별도 스레드)

OTA 설정 우선순위 (start() 시):
  1. 플랫폼 API (online) → OtaCache에 저장
  2. OtaCache (offline) → 마지막 성공 설정 사용
  3. config.yaml devices → 수동 폴백
"""
from __future__ import annotations

import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Callable, Dict, List, Optional, Set

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from ..buffer.local_buffer import LocalBuffer, Reading
from ..config.config_manager import CollectorConfig, ConnectionConfig, DeviceConfig, RegisterConfig
from ..drivers import DriverRegistry
from ..drivers.base_driver import BaseDriver, DriverStatus
from ..sync.cloud_sync import CloudSync
from ..sync.ota_cache import OtaCache

logger = logging.getLogger(__name__)

# OTA 설정 폴링 주기 (초)
OTA_POLL_INTERVAL_SEC = 300   # 5분

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
        self._on_ota_update_cb: Optional[Callable[[int, str], None]] = None  # (device_count, hash)

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

        # OTA 설정 캐시 (오프라인 내성)
        self.ota_cache = OtaCache("data/ota_config_cache.json")
        self._ota_source: str = "none"   # "platform" | "cache" | "config_yaml" | "none"

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

    def on_ota_update(self, callback: Callable[[int, str], None]):
        """OTA 설정 갱신 콜백: callback(device_count, config_hash)"""
        self._on_ota_update_cb = callback

    # ── 엔진 생명주기 ─────────────────────────────────────────────────

    def start(self):
        if self.status == EngineStatus.RUNNING:
            logger.warning("[Engine] 이미 실행 중")
            return

        self._set_engine_status(EngineStatus.STARTING)

        # ── OTA 설정 로드 (우선순위: 플랫폼 → 캐시 → config.yaml) ──────
        devices = self._load_devices_with_ota()
        logger.info(f"[Engine] 시작 — 장치 {len(devices)}개 (소스: {self._ota_source})")

        # 드라이버 초기화 + 스케줄러 등록
        for dev_cfg in devices:
            if dev_cfg.enabled:
                self._register_device(dev_cfg)

        # 스케줄러 시작
        self._scheduler.start()

        # 유지보수 작업 (1시간마다)
        self._scheduler.add_job(
            self._maintenance, trigger=IntervalTrigger(hours=1),
            id="__maintenance__", replace_existing=True,
        )

        # OTA 폴링 작업 (5분마다)
        self._scheduler.add_job(
            self._ota_poll, trigger=IntervalTrigger(seconds=OTA_POLL_INTERVAL_SEC),
            id="__ota_poll__", replace_existing=True,
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

    # ── OTA 설정 로드 ─────────────────────────────────────────────────

    def _load_devices_with_ota(self) -> List[DeviceConfig]:
        """
        OTA 우선순위로 장치 목록 로드.

        1. 플랫폼 API 시도 (온라인)
        2. OtaCache 폴백 (오프라인)
        3. config.yaml devices 폴백 (수동 설정)
        """
        # 1) 플랫폼 OTA 시도
        ota_data = self.cloud_sync.fetch_ota_config()
        if ota_data and ota_data.get("devices") is not None:
            self.ota_cache.save(ota_data)
            self._ota_source = "platform"
            devices = self._parse_ota_devices(ota_data["devices"])
            logger.info(
                f"[OTA] 플랫폼 설정 적용: {len(devices)}개 장치 "
                f"(hash: {ota_data.get('config_hash', '?')})"
            )
            return devices

        # 2) 로컬 캐시 폴백
        cached = self.ota_cache.load()
        if cached and cached.get("devices"):
            self._ota_source = "cache"
            devices = self._parse_ota_devices(cached["devices"])
            logger.warning(
                f"[OTA] 오프라인 — 캐시 설정 적용: {len(devices)}개 장치 "
                f"(저장: {cached.get('saved_at', '?')[:19]})"
            )
            return devices

        # 3) config.yaml 폴백
        if self.config.devices:
            self._ota_source = "config_yaml"
            logger.warning(
                f"[OTA] 캐시 없음 — config.yaml 장치 {len(self.config.devices)}개 사용. "
                "플랫폼에 게이트웨이를 등록하고 장치를 추가하세요."
            )
            return self.config.devices

        # 4) 장치 없음
        self._ota_source = "none"
        logger.warning("[OTA] 장치 설정 없음 — 플랫폼 연결 또는 config.yaml 설정 필요")
        return []

    def _parse_ota_devices(self, raw_devices: list) -> List[DeviceConfig]:
        """OTA API 응답의 devices[] → DeviceConfig 목록 변환"""
        result: List[DeviceConfig] = []
        for d in raw_devices:
            try:
                conn_raw = d.get("connection", {})
                # subscribe_topics 배열 → topic_pattern (첫 번째 항목)
                if "subscribe_topics" in conn_raw:
                    topics = conn_raw.pop("subscribe_topics")
                    if isinstance(topics, list) and topics:
                        conn_raw.setdefault("topic_pattern", topics[0])

                registers = []
                for r in d.get("registers", []):
                    try:
                        registers.append(RegisterConfig(**r))
                    except Exception as e:
                        logger.debug(f"[OTA] 레지스터 파싱 오류 ({d.get('id')}, addr={r.get('address')}): {e}")

                dev = DeviceConfig(
                    id=d["id"],
                    name=d.get("name", d["id"]),
                    protocol=d.get("protocol", "modbus_tcp"),
                    enabled=d.get("enabled", True),
                    poll_interval_ms=d.get("poll_interval_ms", 5000),
                    connection=ConnectionConfig(**conn_raw),
                    registers=registers,
                )
                result.append(dev)
            except Exception as e:
                logger.warning(f"[OTA] 장치 파싱 오류 ({d.get('id', '?')}): {e}")
        return result

    def _ota_poll(self):
        """5분마다 실행: OTA 설정 변경 확인 → 변경 시 hot-swap"""
        try:
            ota_data = self.cloud_sync.fetch_ota_config()
            if not ota_data:
                return   # 오프라인 — 현재 설정 유지

            new_hash = ota_data.get("config_hash", "")
            if not self.ota_cache.is_changed(new_hash):
                logger.debug(f"[OTA] 설정 변경 없음 (hash: {new_hash})")
                return   # 변경 없음 — 건너뜀

            logger.info(f"[OTA] 설정 변경 감지 (hash: {new_hash}) — hot-swap 시작")
            self.ota_cache.save(ota_data)
            new_devices = self._parse_ota_devices(ota_data.get("devices", []))
            self._apply_ota_hotswap(new_devices)

            if self._on_ota_update_cb:
                try:
                    self._on_ota_update_cb(len(new_devices), new_hash)
                except Exception:
                    pass

        except Exception as e:
            logger.error(f"[OTA] 폴링 오류: {e}")

    def _apply_ota_hotswap(self, new_devices: List[DeviceConfig]):
        """
        실행 중 장치 목록 변경 (무중단 hot-swap).

        - 새 장치 추가
        - 삭제된 장치 제거
        - 기존 장치 설정 변경 시 재등록
        """
        with self._driver_lock:
            current_ids: Set[str] = set(self._drivers.keys())
        new_ids: Set[str] = {d.id for d in new_devices if d.enabled}

        # 삭제된 장치 제거
        for removed_id in current_ids - new_ids:
            self.remove_device(removed_id)
            logger.info(f"[OTA] 장치 제거: {removed_id}")

        # 새 장치 추가 / 변경된 장치 재등록
        for dev_cfg in new_devices:
            if not dev_cfg.enabled:
                if dev_cfg.id in current_ids:
                    self.remove_device(dev_cfg.id)
                continue

            if dev_cfg.id in current_ids:
                # 연결 설정이 바뀐 경우만 재등록 (불필요한 재연결 방지)
                with self._driver_lock:
                    existing = self._drivers.get(dev_cfg.id)
                existing_conn = existing.config.get("connection", {}) if existing else {}
                new_conn = dev_cfg.connection.model_dump(exclude_none=True)
                if existing_conn != new_conn:
                    logger.info(f"[OTA] 장치 설정 변경 — 재등록: {dev_cfg.id}")
                    self.remove_device(dev_cfg.id)
                    self._register_device(dev_cfg)
                # 설정 동일 → 건너뜀
            else:
                # 신규 장치
                logger.info(f"[OTA] 신규 장치 추가: {dev_cfg.id} ({dev_cfg.name})")
                self._register_device(dev_cfg)

        logger.info(
            f"[OTA] hot-swap 완료 — 활성 장치: {len(new_ids)}개 "
            f"(추가: {len(new_ids - current_ids)}, 제거: {len(current_ids - new_ids)})"
        )

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
            "ota": {
                "source":        self._ota_source,
                **self.ota_cache.stats(),
            },
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