"""
mqtt_driver.py
──────────────
MQTT 구독 드라이버 (Push 방식)

토픽 패턴: sensors/{sensorCode}/{metricKey}
페이로드:  {"value": 245.7, "quality": "good", "unit": "kW", "timestamp": "..."}
           또는 단순 숫자: "245.7"

특징:
  - 별도 스레드에서 Paho MQTT 이벤트 루프 실행
  - QoS 1 (at-least-once)
  - 자동 재연결 (Last Will Testament 설정)
  - 토픽 → sensorCode/metricKey 파싱
"""
from __future__ import annotations

import json
import logging
import threading
import time
from datetime import datetime, timezone
from typing import List, Optional

import paho.mqtt.client as mqtt

from .base_driver import BaseDriver, DriverRegistry, DriverStatus
from ..buffer.local_buffer import Reading

logger = logging.getLogger(__name__)


@DriverRegistry.register("mqtt")
class MqttDriver(BaseDriver):
    """
    MQTT 구독 드라이버.

    설정 예시:
        connection:
          broker_host: "localhost"
          broker_port: 1883
          username: ""
          password: ""
          topic_pattern: "sensors/#"
          qos: 1
    """

    def __init__(self, device_id: str, config: dict):
        super().__init__(device_id, config)
        conn = config.get("connection", {})
        self._host    = conn.get("broker_host", "localhost")
        self._port    = int(conn.get("broker_port", 1883))
        self._user    = conn.get("username") or None
        self._pass    = conn.get("password") or None
        self._topic   = conn.get("topic_pattern", "sensors/#")
        self._qos     = int(conn.get("qos", 1))

        self._client: Optional[mqtt.Client] = None
        self._connected_event = threading.Event()
        self._pending: List[Reading] = []
        self._pending_lock = threading.Lock()

    # ── 연결 ──────────────────────────────────────────────────────────

    def connect(self) -> bool:
        self._set_status(DriverStatus.CONNECTING)
        try:
            client_id = f"collector-{self.device_id}-{int(time.time())}"
            self._client = mqtt.Client(client_id=client_id, protocol=mqtt.MQTTv311)

            if self._user:
                self._client.username_pw_set(self._user, self._pass)

            # Last Will Testament — 비정상 종료 감지
            self._client.will_set(
                f"collector/{self.device_id}/status",
                payload='{"online": false}',
                qos=1,
                retain=True,
            )

            self._client.on_connect    = self._on_connect
            self._client.on_disconnect = self._on_disconnect
            self._client.on_message    = self._on_message

            self._client.connect_async(self._host, self._port, keepalive=60)
            self._client.loop_start()   # 백그라운드 스레드

            # 연결 완료 대기 (최대 10초)
            connected = self._connected_event.wait(timeout=10)
            return connected

        except Exception as e:
            self._set_status(DriverStatus.ERROR, str(e))
            logger.error(f"[{self.device_id}] MQTT 연결 오류: {e}")
            return False

    def disconnect(self) -> None:
        if self._client:
            try:
                self._client.loop_stop()
                self._client.disconnect()
            except Exception:
                pass
            self._client = None
        self._connected_event.clear()
        self._set_status(DriverStatus.DISCONNECTED)

    # ── Poll (Push 방식 → 버퍼 flush) ────────────────────────────────

    def poll(self) -> List[Reading]:
        """
        MQTT는 Push 방식이므로 poll()은 수신 큐를 드레인하는 역할.
        엔진에서 주기적으로 호출 시 누적된 읽기 값 반환.
        """
        with self._pending_lock:
            readings   = self._pending.copy()
            self._pending.clear()
        return readings

    # ── MQTT 콜백 ─────────────────────────────────────────────────────

    def _on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            self._set_status(DriverStatus.CONNECTED)
            self._connected_event.set()
            self.stats.connect_at = time.time()
            client.subscribe(self._topic, qos=self._qos)
            logger.info(
                f"[{self.device_id}] MQTT 연결 성공: "
                f"{self._host}:{self._port}, 토픽: {self._topic}"
            )
            # 온라인 상태 발행
            client.publish(
                f"collector/{self.device_id}/status",
                '{"online": true}',
                qos=1, retain=True,
            )
        else:
            rc_msgs = {
                1: "프로토콜 버전 불일치",
                2: "클라이언트 ID 거부",
                3: "브로커 사용 불가",
                4: "인증 실패",
                5: "권한 없음",
            }
            msg = rc_msgs.get(rc, f"알 수 없는 오류 rc={rc}")
            self._set_status(DriverStatus.ERROR, msg)
            logger.error(f"[{self.device_id}] MQTT 연결 거부: {msg}")

    def _on_disconnect(self, client, userdata, rc):
        self._connected_event.clear()
        if rc != 0:
            self._set_status(DriverStatus.ERROR, f"비정상 연결 해제 rc={rc}")
            logger.warning(f"[{self.device_id}] MQTT 연결 해제 (rc={rc}) — 자동 재연결 대기")
        else:
            self._set_status(DriverStatus.DISCONNECTED)

    def _on_message(self, client, userdata, msg):
        """수신 메시지 파싱 → pending 큐에 추가"""
        try:
            topic   = msg.topic                     # e.g. sensors/TH-CO2-01-TEMP/temperature
            parts   = topic.split("/")
            # sensors/{sensorCode}/{metricKey} 패턴
            if len(parts) >= 3:
                sensor_code = parts[-2]
                metric_key  = parts[-1]
            elif len(parts) == 2:
                sensor_code = parts[-1]
                metric_key  = "value"
            else:
                sensor_code = topic.replace("/", "_")
                metric_key  = "value"

            payload_str = msg.payload.decode("utf-8", errors="replace").strip()

            # 페이로드 파싱: JSON 또는 단순 숫자
            quality   = "good"
            unit      = ""
            timestamp = datetime.now(timezone.utc).isoformat()

            try:
                data  = json.loads(payload_str)
                value = float(data.get("value", data) if isinstance(data, dict) else data)
                if isinstance(data, dict):
                    quality   = data.get("quality", "good")
                    unit      = data.get("unit", "")
                    timestamp = data.get("timestamp", timestamp)
            except (json.JSONDecodeError, ValueError):
                value = float(payload_str)

            reading = Reading(
                sensor_code=sensor_code,
                metric_key=metric_key,
                value=round(value, 6),
                unit=unit,
                quality=quality,
                timestamp=timestamp,
                device_id=self.device_id,
            )

            with self._pending_lock:
                self._pending.append(reading)

            # 실시간 콜백 즉시 호출 (Push 방식)
            self._emit_data([reading])

        except Exception as e:
            logger.warning(f"[{self.device_id}] 메시지 파싱 오류 (topic={msg.topic}): {e}")

    def get_info(self) -> dict:
        info = super().get_info()
        info["broker"] = f"{self._host}:{self._port}"
        info["topic"]  = self._topic
        return info