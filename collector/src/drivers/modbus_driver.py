"""
modbus_driver.py
────────────────
Modbus TCP / Modbus RTU 드라이버

지원 레지스터:
  - Holding Register (FC 03)
  - Input Register   (FC 04)
  - Coil             (FC 01)
  - Discrete Input   (FC 02)

지원 데이터 타입:
  - int16, uint16, int32, uint32, float32, float64, boolean
"""
from __future__ import annotations

import logging
import struct
import time
from typing import Any, Dict, List, Optional

from pymodbus.client import ModbusTcpClient, ModbusSerialClient
from pymodbus.exceptions import ModbusException, ConnectionException
from pymodbus.constants import Endian
from pymodbus.payload import BinaryPayloadDecoder

from .base_driver import BaseDriver, DriverRegistry, DriverStatus
from ..buffer.local_buffer import Reading

logger = logging.getLogger(__name__)

# ── 데이터 타입 디코더 ────────────────────────────────────────────────

def _decode_registers(registers: list, data_type: str, byte_order=Endian.BIG, word_order=Endian.BIG) -> float:
    """Modbus 레지스터 값 → Python float 변환"""
    decoder = BinaryPayloadDecoder.fromRegisters(registers, byteorder=byte_order, wordorder=word_order)
    dt = data_type.lower()
    if dt == "float32":  return decoder.decode_32bit_float()
    if dt == "float64":  return decoder.decode_64bit_float()
    if dt == "int16":    return float(decoder.decode_16bit_int())
    if dt == "uint16":   return float(decoder.decode_16bit_uint())
    if dt == "int32":    return float(decoder.decode_32bit_int())
    if dt == "uint32":   return float(decoder.decode_32bit_uint())
    if dt == "boolean":  return float(bool(registers[0]))
    raise ValueError(f"미지원 데이터 타입: {data_type}")

def _reg_count(data_type: str) -> int:
    """데이터 타입별 레지스터 소비 수"""
    if data_type.lower() in ("float64", "int64", "uint64"): return 4
    if data_type.lower() in ("float32", "int32", "uint32"): return 2
    return 1

# ── Modbus TCP 드라이버 ───────────────────────────────────────────────

@DriverRegistry.register("modbus_tcp")
class ModbusTcpDriver(BaseDriver):
    """
    Modbus TCP 드라이버.

    설정 예시:
        connection:
          host: "192.168.1.100"
          port: 502
          unit_id: 1
        registers:
          - address: 0x0000
            type: input
            data_type: float32
            sensor_code: "EM3P-01-POWER"
            metric_key: power_active
            scale: 0.1
            unit: kW
    """

    def __init__(self, device_id: str, config: dict):
        super().__init__(device_id, config)
        conn    = config.get("connection", {})
        self._host     = conn.get("host", "127.0.0.1")
        self._port     = int(conn.get("port", 502))
        self._unit_id  = int(conn.get("unit_id", 1))
        self._timeout  = int(config.get("connection_timeout_sec", 10))
        self._registers = config.get("registers", [])
        self._client: Optional[ModbusTcpClient] = None

    def connect(self) -> bool:
        self._set_status(DriverStatus.CONNECTING)
        try:
            self._client = ModbusTcpClient(
                host=self._host,
                port=self._port,
                timeout=self._timeout,
            )
            ok = self._client.connect()
            if ok:
                self._set_status(DriverStatus.CONNECTED)
                self.stats.connect_at = time.time()
                logger.info(f"[{self.device_id}] Modbus TCP 연결 성공: {self._host}:{self._port}")
            else:
                self._set_status(DriverStatus.ERROR, "연결 거부")
            return ok
        except Exception as e:
            self._set_status(DriverStatus.ERROR, str(e))
            logger.error(f"[{self.device_id}] Modbus TCP 연결 오류: {e}")
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
        if not self._client or not self._client.connected:
            # 자동 재연결 시도
            if not self.connect():
                return []

        readings: List[Reading] = []
        ts = __import__("datetime").datetime.now(
            __import__("datetime").timezone.utc
        ).isoformat()

        for reg_cfg in self._registers:
            try:
                reading = self._read_register(reg_cfg, ts)
                if reading:
                    readings.append(reading)
            except Exception as e:
                logger.warning(f"[{self.device_id}] 레지스터 읽기 실패 "
                               f"(addr={reg_cfg.get('address')}): {e}")

        return readings

    def _read_register(self, reg_cfg: dict, ts: str) -> Optional[Reading]:
        address    = int(reg_cfg["address"])
        reg_type   = reg_cfg.get("type", "holding").lower()
        data_type  = reg_cfg.get("data_type", "float32")
        count      = _reg_count(data_type)
        scale      = float(reg_cfg.get("scale", 1.0))
        sensor_code = reg_cfg["sensor_code"]
        metric_key = reg_cfg["metric_key"]
        unit       = reg_cfg.get("unit", "")

        # 레지스터 타입별 읽기
        if reg_type == "holding":
            result = self._client.read_holding_registers(address, count, slave=self._unit_id)
        elif reg_type == "input":
            result = self._client.read_input_registers(address, count, slave=self._unit_id)
        elif reg_type == "coil":
            result = self._client.read_coils(address, count, slave=self._unit_id)
        elif reg_type == "discrete":
            result = self._client.read_discrete_inputs(address, count, slave=self._unit_id)
        else:
            raise ValueError(f"미지원 레지스터 타입: {reg_type}")

        if result.isError():
            logger.warning(f"[{self.device_id}] Modbus 오류 응답: {result}")
            return None

        # 값 디코딩
        if reg_type in ("coil", "discrete"):
            raw = float(result.bits[0]) if result.bits else 0.0
        else:
            raw = _decode_registers(result.registers, data_type)

        value   = raw * scale
        quality = "good" if abs(value) < 1e9 else "uncertain"

        return Reading(
            sensor_code=sensor_code,
            metric_key=metric_key,
            value=round(value, 6),
            unit=unit,
            quality=quality,
            timestamp=ts,
            device_id=self.device_id,
        )

    def write_value(self, address: int, value: float) -> bool:
        """Holding Register 쓰기 (제어 출력)"""
        if not self._client or not self._client.connected:
            return False
        try:
            int_val = int(value)
            result  = self._client.write_register(address, int_val, slave=self._unit_id)
            return not result.isError()
        except Exception as e:
            logger.error(f"[{self.device_id}] 쓰기 오류 (addr={address}): {e}")
            return False

# ── Modbus RTU 드라이버 ───────────────────────────────────────────────

@DriverRegistry.register("modbus_rtu")
class ModbusRtuDriver(ModbusTcpDriver):
    """
    Modbus RTU 드라이버 (RS-485 시리얼 통신).

    설정 예시:
        connection:
          serial_port: "COM3"     # Windows; Linux: /dev/ttyUSB0
          baudrate: 9600
          parity: "N"             # N=없음, E=짝수, O=홀수
          stopbits: 1
          unit_id: 1
    """

    def __init__(self, device_id: str, config: dict):
        # TCP 부모 초기화 건너뜀 — RTU 전용 설정
        BaseDriver.__init__(self, device_id, config)
        conn = config.get("connection", {})
        self._serial_port = conn.get("serial_port") or conn.get("port", "COM1")
        self._baudrate    = int(conn.get("baudrate", 9600))
        self._parity      = conn.get("parity", "N")
        self._stopbits    = int(conn.get("stopbits", 1))
        self._unit_id     = int(conn.get("unit_id", 1))
        self._timeout     = int(config.get("connection_timeout_sec", 10))
        self._registers   = config.get("registers", [])
        self._client: Optional[ModbusSerialClient] = None

    def connect(self) -> bool:
        self._set_status(DriverStatus.CONNECTING)
        try:
            self._client = ModbusSerialClient(
                port=self._serial_port,
                baudrate=self._baudrate,
                parity=self._parity,
                stopbits=self._stopbits,
                timeout=self._timeout,
            )
            ok = self._client.connect()
            if ok:
                self._set_status(DriverStatus.CONNECTED)
                self.stats.connect_at = time.time()
                logger.info(
                    f"[{self.device_id}] Modbus RTU 연결 성공: "
                    f"{self._serial_port} {self._baudrate}bps"
                )
            else:
                self._set_status(DriverStatus.ERROR, f"시리얼 포트 연결 실패: {self._serial_port}")
            return ok
        except Exception as e:
            self._set_status(DriverStatus.ERROR, str(e))
            logger.error(f"[{self.device_id}] Modbus RTU 연결 오류: {e}")
            return False