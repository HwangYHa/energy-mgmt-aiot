"""
config_manager.py
─────────────────
YAML 설정 파일 로드 + 환경변수 오버라이드 + Pydantic 검증

OTA 모드 (권장):
  config.yaml에 cloud.gateway_id + cloud.gateway_token만 설정하면
  플랫폼에서 장치 목록을 자동으로 가져옵니다 (devices 섹션 불필요).

수동 모드 (오프라인 또는 플랫폼 미사용):
  config.yaml의 devices 섹션에 직접 장치를 정의합니다.
  OTA를 사용하는 경우 이 섹션은 폴백으로만 사용됩니다.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

# ── 모델 정의 ─────────────────────────────────────────────────────────

class CloudConfig(BaseModel):
    api_url:               str   = "http://localhost:3000"
    gateway_id:            str   = ""
    gateway_token:         str   = ""
    sync_interval_sec:     int   = 10
    heartbeat_interval_sec: int  = 30
    batch_size:            int   = 500
    timeout_sec:           int   = 15
    max_retries:           int   = 5

class BufferConfig(BaseModel):
    db_path:           str = "data/collector_buffer.db"
    max_records:       int = 500_000
    retention_hours:   int = 72

class EngineConfig(BaseModel):
    max_workers:            int = 20
    default_poll_interval_ms: int = 5000
    connection_timeout_sec: int = 10
    reconnect_delay_sec:    int = 30

class LoggingConfig(BaseModel):
    level:        str = "INFO"
    file:         str = "logs/collector.log"
    max_bytes:    int = 10_485_760
    backup_count: int = 5

class RegisterConfig(BaseModel):
    address:     int
    type:        str    = "holding"   # holding|input|coil|discrete
    data_type:   str    = "float32"
    sensor_code: str
    metric_key:  str
    scale:       float  = 1.0
    unit:        str    = ""

class ConnectionConfig(BaseModel):
    # TCP / HTTP
    host:        Optional[str]  = None
    port:        Optional[int]  = None
    # RTU
    serial_port: Optional[str]  = None   # alias: port 로도 수신
    baudrate:    int             = 9600
    parity:      str             = "N"
    stopbits:    int             = 1
    # Modbus
    unit_id:     int             = 1
    # MQTT
    broker_host: Optional[str]  = None
    broker_port: int             = 1883
    username:    Optional[str]  = None
    password:    Optional[str]  = None
    topic_pattern: str          = "sensors/#"
    qos:         int             = 1
    # HTTP
    base_url:    Optional[str]  = None
    api_key:     Optional[str]  = None
    headers:     Dict[str, str] = Field(default_factory=dict)

    class Config:
        extra = "allow"   # YAML에 추가 필드 허용

class HttpEndpoint(BaseModel):
    path:        str
    method:      str = "GET"
    value_path:  str
    sensor_code: str
    metric_key:  str
    unit:        str = ""

class DeviceConfig(BaseModel):
    id:               str
    name:             str
    protocol:         str     # modbus_tcp|modbus_rtu|mqtt|http|opcua|bacnet
    enabled:          bool    = True
    poll_interval_ms: int     = 5000
    connection:       ConnectionConfig = Field(default_factory=ConnectionConfig)
    registers:        List[RegisterConfig]   = Field(default_factory=list)
    endpoints:        List[HttpEndpoint]     = Field(default_factory=list)
    tags:             Dict[str, str]         = Field(default_factory=dict)

class CollectorConfig(BaseModel):
    cloud:   CloudConfig   = Field(default_factory=CloudConfig)
    buffer:  BufferConfig  = Field(default_factory=BufferConfig)
    engine:  EngineConfig  = Field(default_factory=EngineConfig)
    logging: LoggingConfig = Field(default_factory=LoggingConfig)
    devices: List[DeviceConfig] = Field(default_factory=list)

# ── 로더 ──────────────────────────────────────────────────────────────

def _deep_merge(base: Dict, override: Dict) -> Dict:
    """중첩 dict 병합 (override 우선)"""
    result = {**base}
    for k, v in override.items():
        if k in result and isinstance(result[k], dict) and isinstance(v, dict):
            result[k] = _deep_merge(result[k], v)
        else:
            result[k] = v
    return result

def load_config(config_path: str = "config/config.yaml") -> CollectorConfig:
    """
    설정 로드 우선순위:
      1. config/config.yaml (기본)
      2. 환경변수 COLLECTOR_CONFIG (경로 오버라이드)
      3. 환경변수 직접 오버라이드 (CLOUD_API_URL, GATEWAY_ID, GATEWAY_TOKEN 등)
    """
    path = Path(os.environ.get("COLLECTOR_CONFIG", config_path))

    raw: Dict[str, Any] = {}
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            raw = yaml.safe_load(f) or {}
    else:
        print(f"[Config] 설정 파일 없음: {path} — 환경변수 + 기본값 사용")

    # 환경변수 오버라이드
    env_overrides: Dict[str, Any] = {}

    if os.environ.get("CLOUD_API_URL"):
        env_overrides.setdefault("cloud", {})["api_url"] = os.environ["CLOUD_API_URL"]
    if os.environ.get("GATEWAY_ID"):
        env_overrides.setdefault("cloud", {})["gateway_id"] = os.environ["GATEWAY_ID"]
    if os.environ.get("GATEWAY_TOKEN"):
        env_overrides.setdefault("cloud", {})["gateway_token"] = os.environ["GATEWAY_TOKEN"]
    if os.environ.get("BUFFER_DB_PATH"):
        env_overrides.setdefault("buffer", {})["db_path"] = os.environ["BUFFER_DB_PATH"]
    if os.environ.get("LOG_LEVEL"):
        env_overrides.setdefault("logging", {})["level"] = os.environ["LOG_LEVEL"]

    merged = _deep_merge(raw, env_overrides)

    # port → serial_port 별칭 처리 (RTU)
    for dev in merged.get("devices", []):
        conn = dev.get("connection", {})
        if dev.get("protocol") == "modbus_rtu" and "port" in conn and "serial_port" not in conn:
            conn["serial_port"] = conn.pop("port")

    cfg = CollectorConfig.model_validate(merged)
    return cfg