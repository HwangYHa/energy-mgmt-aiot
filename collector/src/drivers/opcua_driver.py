"""
opcua_driver.py
───────────────
OPC-UA 드라이버 (asyncua 라이브러리 사용)

PLC, SCADA, 스마트 인버터, 에너지 관리 컨트롤러 연동에 사용.
async 기반이나 스레드에서 이벤트 루프를 별도 생성하여 동기처럼 동작.
"""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import List, Optional

from .base_driver import BaseDriver, DriverRegistry, DriverStatus
from ..buffer.local_buffer import Reading

logger = logging.getLogger(__name__)

try:
    from asyncua import Client as OpcUaClient
    from asyncua.ua.uatypes import NodeId
    HAS_OPCUA = True
except ImportError:
    HAS_OPCUA = False
    logger.warning("[OPC-UA] asyncua 미설치 — pip install asyncua")


@DriverRegistry.register("opcua")
class OpcUaDriver(BaseDriver):
    """
    OPC-UA 드라이버.

    설정 예시:
        connection:
          endpoint: "opc.tcp://192.168.1.200:4840"
          security_mode: "None"
          username: ""
          password: ""
        registers:
          - address: "ns=2;i=1001"    # NodeId
            sensor_code: "PLC-01-POWER"
            metric_key: power_active
            unit: kW
            scale: 1.0
    """

    def __init__(self, device_id: str, config: dict):
        super().__init__(device_id, config)
        conn = config.get("connection", {})
        self._endpoint = conn.get("endpoint", "opc.tcp://localhost:4840")
        self._user     = conn.get("username") or None
        self._pass     = conn.get("password") or None
        self._nodes    = config.get("registers", [])   # registers 필드 재사용
        self._timeout  = config.get("connection_timeout_sec", 10)
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._client: Optional["OpcUaClient"] = None

    def _get_loop(self) -> asyncio.AbstractEventLoop:
        """스레드 전용 이벤트 루프"""
        if self._loop is None or self._loop.is_closed():
            self._loop = asyncio.new_event_loop()
        return self._loop

    def connect(self) -> bool:
        if not HAS_OPCUA:
            self._set_status(DriverStatus.ERROR, "asyncua 미설치")
            return False
        self._set_status(DriverStatus.CONNECTING)
        try:
            loop = self._get_loop()
            ok   = loop.run_until_complete(self._async_connect())
            return ok
        except Exception as e:
            self._set_status(DriverStatus.ERROR, str(e))
            logger.error(f"[{self.device_id}] OPC-UA 연결 오류: {e}")
            return False

    async def _async_connect(self) -> bool:
        self._client = OpcUaClient(url=self._endpoint, timeout=self._timeout)
        if self._user:
            self._client.set_user(self._user)
            self._client.set_password(self._pass or "")
        await self._client.connect()
        self._set_status(DriverStatus.CONNECTED)
        self.stats.connect_at = time.time()
        logger.info(f"[{self.device_id}] OPC-UA 연결 성공: {self._endpoint}")
        return True

    def disconnect(self) -> None:
        if self._client and self._loop:
            try:
                self._loop.run_until_complete(self._client.disconnect())
            except Exception:
                pass
        self._client = None
        self._set_status(DriverStatus.DISCONNECTED)

    def poll(self) -> List[Reading]:
        if not self._client:
            if not self.connect():
                return []
        try:
            loop = self._get_loop()
            return loop.run_until_complete(self._async_poll())
        except Exception as e:
            logger.warning(f"[{self.device_id}] OPC-UA poll 오류: {e}")
            self._client = None   # 강제 재연결 트리거
            return []

    async def _async_poll(self) -> List[Reading]:
        readings: List[Reading] = []
        ts = datetime.now(timezone.utc).isoformat()

        for node_cfg in self._nodes:
            node_id     = node_cfg.get("address") or node_cfg.get("node_id")
            sensor_code = node_cfg["sensor_code"]
            metric_key  = node_cfg["metric_key"]
            scale       = float(node_cfg.get("scale", 1.0))
            unit        = node_cfg.get("unit", "")

            try:
                node  = self._client.get_node(node_id)
                dv    = await node.read_data_value()
                raw   = float(dv.Value.Value)
                value = round(raw * scale, 6)

                readings.append(Reading(
                    sensor_code=sensor_code,
                    metric_key=metric_key,
                    value=value,
                    unit=unit,
                    quality="good",
                    timestamp=ts,
                    device_id=self.device_id,
                ))
            except Exception as e:
                logger.warning(f"[{self.device_id}] 노드 읽기 실패 ({node_id}): {e}")

        return readings