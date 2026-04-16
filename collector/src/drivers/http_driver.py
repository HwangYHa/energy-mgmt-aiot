"""
http_driver.py
──────────────
HTTP REST API 폴링 드라이버

외부 API, 서드파티 장비, EMS 시스템 등 HTTP로 노출된
데이터 소스를 주기적으로 폴링하여 수집.

JSON Path 지원: "data.power", "readings[0].value" 등
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

from .base_driver import BaseDriver, DriverRegistry, DriverStatus
from ..buffer.local_buffer import Reading

logger = logging.getLogger(__name__)


def _extract_by_path(data: Any, path: str) -> Optional[float]:
    """
    단순 JSON 경로 추출 (dotted notation + 배열 인덱스).
    예: "data.readings[0].power" → data["data"]["readings"][0]["power"]
    """
    current = data
    for part in path.replace("][", ".").replace("[", ".").replace("]", "").split("."):
        if part == "":
            continue
        try:
            if isinstance(current, list):
                current = current[int(part)]
            elif isinstance(current, dict):
                current = current[part]
            else:
                return None
        except (KeyError, IndexError, TypeError, ValueError):
            return None
    try:
        return float(current)
    except (TypeError, ValueError):
        return None


@DriverRegistry.register("http")
class HttpDriver(BaseDriver):
    """
    HTTP REST API 폴링 드라이버.

    설정 예시:
        connection:
          base_url: "https://api.example.com"
          api_key: "xxx"
          headers:
            Authorization: "Bearer token"
        endpoints:
          - path: "/v1/meters/current"
            method: "GET"
            value_path: "data.power"
            sensor_code: "EXT-PWR-01"
            metric_key: power_active
            unit: kW
    """

    def __init__(self, device_id: str, config: dict):
        super().__init__(device_id, config)
        conn = config.get("connection", {})
        self._base_url  = (conn.get("base_url") or "").rstrip("/")
        self._api_key   = conn.get("api_key")
        self._timeout   = config.get("connection_timeout_sec", 10)

        # 기본 헤더
        self._headers: Dict[str, str] = dict(conn.get("headers", {}))
        if self._api_key and "Authorization" not in self._headers:
            self._headers["Authorization"] = f"Bearer {self._api_key}"
        self._headers.setdefault("Accept", "application/json")
        self._headers.setdefault("User-Agent", "TansoEum-Collector/1.0")

        self._endpoints = config.get("endpoints", [])
        self._client: Optional[httpx.Client] = None

    def connect(self) -> bool:
        self._set_status(DriverStatus.CONNECTING)
        try:
            self._client = httpx.Client(
                base_url=self._base_url,
                headers=self._headers,
                timeout=self._timeout,
                follow_redirects=True,
            )
            # 연결 테스트: HEAD 또는 첫 엔드포인트 GET
            if self._endpoints:
                test_path = self._endpoints[0].get("path", "/")
                resp = self._client.head(test_path)
                if resp.status_code >= 500:
                    raise ConnectionError(f"서버 오류: HTTP {resp.status_code}")

            self._set_status(DriverStatus.CONNECTED)
            self.stats.connect_at = time.time()
            logger.info(f"[{self.device_id}] HTTP 연결 성공: {self._base_url}")
            return True

        except Exception as e:
            self._set_status(DriverStatus.ERROR, str(e))
            logger.error(f"[{self.device_id}] HTTP 연결 오류: {e}")
            return False

    def disconnect(self) -> None:
        if self._client:
            try:
                self._client.close()
            except Exception:
                pass
            self._client = None
        self._set_status(DriverStatus.DISCONNECTED)

    def poll(self) -> List[Reading]:
        if not self._client:
            if not self.connect():
                return []

        readings: List[Reading] = []
        ts = datetime.now(timezone.utc).isoformat()

        for ep in self._endpoints:
            try:
                reading = self._fetch_endpoint(ep, ts)
                if reading:
                    readings.append(reading)
            except Exception as e:
                logger.warning(f"[{self.device_id}] 엔드포인트 오류 ({ep.get('path')}): {e}")

        return readings

    def _fetch_endpoint(self, ep: dict, ts: str) -> Optional[Reading]:
        path       = ep.get("path", "/")
        method     = ep.get("method", "GET").upper()
        value_path = ep.get("value_path", "value")
        sensor_code = ep["sensor_code"]
        metric_key = ep["metric_key"]
        unit       = ep.get("unit", "")
        body       = ep.get("body")

        if method == "GET":
            resp = self._client.get(path)
        elif method == "POST":
            resp = self._client.post(path, json=body)
        else:
            raise ValueError(f"미지원 HTTP 메서드: {method}")

        resp.raise_for_status()
        data  = resp.json()
        value = _extract_by_path(data, value_path)

        if value is None:
            logger.warning(
                f"[{self.device_id}] 값 추출 실패: path='{value_path}', "
                f"응답 키: {list(data.keys()) if isinstance(data, dict) else type(data).__name__}"
            )
            return None

        return Reading(
            sensor_code=sensor_code,
            metric_key=metric_key,
            value=round(value, 6),
            unit=unit,
            quality="good",
            timestamp=ts,
            device_id=self.device_id,
        )