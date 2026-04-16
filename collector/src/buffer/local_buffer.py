"""
local_buffer.py
───────────────
SQLite 기반 로컬 버퍼

특징:
  - WAL 모드 + 멀티스레드 안전
  - 클라우드 전송 실패 시 데이터 보존
  - 최대 레코드 수 초과 시 오래된 항목 자동 삭제
  - 72시간 경과 미전송 데이터 자동 만료
  - 통계 조회 지원
"""
from __future__ import annotations

import json
import logging
import sqlite3
import threading
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

logger = logging.getLogger(__name__)

# ── 데이터 클래스 ─────────────────────────────────────────────────────

@dataclass
class Reading:
    sensor_code:  str
    metric_key:   str
    value:        float
    unit:         str        = ""
    quality:      str        = "good"   # good | bad | uncertain
    timestamp:    str        = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    device_id:    str        = ""
    # 내부 필드 (DB 자동 부여)
    row_id:       Optional[int] = field(default=None, repr=False)
    sent:         bool          = field(default=False, repr=False)

    def to_api_dict(self) -> dict:
        """POST /api/gateways/{id}/data readings[] 형식"""
        return {
            "sensorId":  self.sensor_code,
            "metricKey": self.metric_key,
            "value":     self.value,
            "quality":   self.quality,
            "timestamp": self.timestamp,
            "unit":      self.unit,
        }

# ── 버퍼 클래스 ───────────────────────────────────────────────────────

CREATE_DDL = """
CREATE TABLE IF NOT EXISTS readings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    sensor_code TEXT    NOT NULL,
    metric_key  TEXT    NOT NULL,
    value       REAL    NOT NULL,
    unit        TEXT    DEFAULT '',
    quality     TEXT    DEFAULT 'good',
    timestamp   TEXT    NOT NULL,
    device_id   TEXT    DEFAULT '',
    sent        INTEGER DEFAULT 0,
    created_at  INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_sent       ON readings(sent);
CREATE INDEX IF NOT EXISTS idx_created_at ON readings(created_at);
"""

class LocalBuffer:
    """
    Thread-safe SQLite 로컬 버퍼

    사용:
        buf = LocalBuffer("data/buffer.db", max_records=500_000, retention_hours=72)
        buf.push(readings)
        batch = buf.pop_batch(500)
        buf.mark_sent([r.row_id for r in batch])
    """

    def __init__(
        self,
        db_path:         str = "data/collector_buffer.db",
        max_records:     int = 500_000,
        retention_hours: int = 72,
    ):
        self.db_path         = db_path
        self.max_records     = max_records
        self.retention_hours = retention_hours
        self._lock           = threading.Lock()

        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self._init_db()
        logger.info(f"[Buffer] 초기화 완료: {db_path} | 현재 미전송: {self.pending_count()}건")

    # ── 초기화 ──────────────────────────────────────────────────────

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=30, check_same_thread=False)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        conn.execute("PRAGMA cache_size=10000")
        return conn

    def _init_db(self):
        with self._get_conn() as conn:
            conn.executescript(CREATE_DDL)

    # ── 쓰기 ────────────────────────────────────────────────────────

    def push(self, readings: List[Reading]) -> int:
        """readings 목록을 버퍼에 저장. 저장된 건수 반환."""
        if not readings:
            return 0

        rows = [
            (r.sensor_code, r.metric_key, r.value, r.unit, r.quality, r.timestamp, r.device_id)
            for r in readings
        ]

        with self._lock:
            try:
                with self._get_conn() as conn:
                    conn.executemany(
                        "INSERT INTO readings (sensor_code, metric_key, value, unit, quality, timestamp, device_id) "
                        "VALUES (?, ?, ?, ?, ?, ?, ?)",
                        rows,
                    )
                    self._enforce_limits(conn)
                return len(rows)
            except Exception as e:
                logger.error(f"[Buffer] push 오류: {e}")
                return 0

    # ── 읽기 ────────────────────────────────────────────────────────

    def pop_batch(self, limit: int = 500) -> List[Reading]:
        """미전송 레코드를 최대 limit 건 반환 (전송 완료 후 mark_sent 필수)."""
        with self._lock:
            try:
                with self._get_conn() as conn:
                    rows = conn.execute(
                        "SELECT id, sensor_code, metric_key, value, unit, quality, timestamp, device_id "
                        "FROM readings WHERE sent=0 ORDER BY id ASC LIMIT ?",
                        (limit,),
                    ).fetchall()

                result = []
                for row in rows:
                    result.append(Reading(
                        row_id=row[0], sensor_code=row[1], metric_key=row[2],
                        value=row[3], unit=row[4], quality=row[5],
                        timestamp=row[6], device_id=row[7],
                    ))
                return result
            except Exception as e:
                logger.error(f"[Buffer] pop_batch 오류: {e}")
                return []

    # ── 상태 변경 ────────────────────────────────────────────────────

    def mark_sent(self, row_ids: List[int]) -> None:
        """전송 완료 표시 후 레코드 삭제."""
        if not row_ids:
            return
        placeholders = ",".join("?" * len(row_ids))
        with self._lock:
            try:
                with self._get_conn() as conn:
                    conn.execute(
                        f"DELETE FROM readings WHERE id IN ({placeholders})", row_ids
                    )
            except Exception as e:
                logger.error(f"[Buffer] mark_sent 오류: {e}")

    def mark_failed(self, row_ids: List[int]) -> None:
        """전송 실패 → sent=0 유지 (재시도 가능)"""
        pass  # 이미 sent=0 → 아무 작업 불필요

    # ── 통계 ────────────────────────────────────────────────────────

    def pending_count(self) -> int:
        """미전송 레코드 수"""
        try:
            with self._get_conn() as conn:
                row = conn.execute("SELECT COUNT(*) FROM readings WHERE sent=0").fetchone()
                return row[0] if row else 0
        except Exception:
            return 0

    def total_count(self) -> int:
        """전체 레코드 수"""
        try:
            with self._get_conn() as conn:
                row = conn.execute("SELECT COUNT(*) FROM readings").fetchone()
                return row[0] if row else 0
        except Exception:
            return 0

    def stats(self) -> dict:
        """버퍼 통계 조회"""
        try:
            with self._get_conn() as conn:
                total   = conn.execute("SELECT COUNT(*) FROM readings").fetchone()[0]
                pending = conn.execute("SELECT COUNT(*) FROM readings WHERE sent=0").fetchone()[0]
                oldest  = conn.execute(
                    "SELECT timestamp FROM readings WHERE sent=0 ORDER BY id ASC LIMIT 1"
                ).fetchone()
            return {
                "total":   total,
                "pending": pending,
                "sent":    total - pending,
                "oldest":  oldest[0] if oldest else None,
            }
        except Exception as e:
            return {"error": str(e)}

    # ── 유지보수 ─────────────────────────────────────────────────────

    def _enforce_limits(self, conn: sqlite3.Connection):
        """최대 레코드 수 초과 시 오래된 전송 완료 항목 삭제"""
        total = conn.execute("SELECT COUNT(*) FROM readings").fetchone()[0]
        if total > self.max_records:
            # 전송 완료 항목 먼저 삭제
            excess = total - self.max_records
            conn.execute(
                "DELETE FROM readings WHERE id IN "
                "(SELECT id FROM readings WHERE sent=1 ORDER BY id ASC LIMIT ?)",
                (excess,),
            )

    def purge_expired(self) -> int:
        """retention_hours 초과 미전송 데이터 삭제 (데이터 품질 저하 방지)"""
        cutoff = int(time.time()) - self.retention_hours * 3600
        with self._lock:
            try:
                with self._get_conn() as conn:
                    result = conn.execute(
                        "DELETE FROM readings WHERE sent=0 AND created_at < ?", (cutoff,)
                    )
                    deleted = result.rowcount
                if deleted:
                    logger.warning(f"[Buffer] 만료 레코드 {deleted}건 삭제 (>{self.retention_hours}시간)")
                return deleted
            except Exception as e:
                logger.error(f"[Buffer] purge_expired 오류: {e}")
                return 0

    def vacuum(self):
        """SQLite VACUUM — 디스크 공간 회수 (서비스 중단 시 실행 권장)"""
        with self._lock:
            try:
                with self._get_conn() as conn:
                    conn.execute("VACUUM")
                logger.info("[Buffer] VACUUM 완료")
            except Exception as e:
                logger.error(f"[Buffer] VACUUM 오류: {e}")