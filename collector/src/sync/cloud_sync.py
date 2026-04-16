"""
cloud_sync.py
─────────────
탄소이음 SaaS API 동기화 서비스

역할:
  1. 로컬 버퍼에서 미전송 레코드를 배치로 읽어 클라우드에 전송
  2. 하트비트(30초) — 게이트웨이 온라인 상태 갱신
  3. 전송 실패 시 지수 백오프 재시도
  4. 클라우드에서 최신 장치 설정 조회 (OTA 설정 반영)

엔드포인트:
  POST /api/gateways/{gateway_id}/data  → 수집 데이터 전송
  GET  /api/gateways/{gateway_id}       → 장치 설정 조회
"""
from __future__ import annotations

import json
import logging
import threading
import time
from datetime import datetime, timezone
from typing import Callable, Dict, List, Optional

import httpx
from tenacity import (
    retry, stop_after_attempt, wait_exponential,
    retry_if_exception_type, before_sleep_log,
)

from ..buffer.local_buffer import LocalBuffer, Reading

logger = logging.getLogger(__name__)

# ── 동기화 통계 ────────────────────────────────────────────────────────

class SyncStats:
    def __init__(self):
        self.total_sent:    int   = 0
        self.total_failed:  int   = 0
        self.last_sync_at:  float = 0.0
        self.last_error:    str   = ""
        self.consecutive_fails: int = 0

    @property
    def is_healthy(self) -> bool:
        return self.consecutive_fails < 5

# ── 클라우드 동기화 서비스 ────────────────────────────────────────────

class CloudSync:
    """
    백그라운드 스레드에서 버퍼 → 클라우드 동기화 수행.

    사용:
        sync = CloudSync(buffer, "http://localhost:3000", "gw_xxx", "token")
        sync.start()
        # ... 프로그램 종료 시 ...
        sync.stop()
    """

    def __init__(
        self,
        buffer:           LocalBuffer,
        api_url:          str,
        gateway_id:       str,
        gateway_token:    str,
        sync_interval:    int = 10,
        heartbeat_interval: int = 30,
        batch_size:       int = 500,
        timeout:          int = 15,
        on_status_change: Optional[Callable[[str, dict], None]] = None,
    ):
        self.buffer             = buffer
        self.api_url            = api_url.rstrip("/")
        self.gateway_id         = gateway_id
        self.gateway_token      = gateway_token
        self.sync_interval      = sync_interval
        self.heartbeat_interval = heartbeat_interval
        self.batch_size         = batch_size
        self.timeout            = timeout
        self.on_status_change   = on_status_change

        self.stats              = SyncStats()
        self._running           = False
        self._sync_thread:      Optional[threading.Thread] = None
        self._heartbeat_thread: Optional[threading.Thread] = None
        self._stop_event        = threading.Event()

        self._client = httpx.Client(
            headers={
                "Authorization":  f"Bearer {gateway_token}",
                "X-Gateway-Token": gateway_token,
                "Content-Type":   "application/json",
                "User-Agent":     "TansoEum-Collector/1.0",
            },
            timeout=timeout,
        )

    # ── 생명주기 ──────────────────────────────────────────────────────

    def start(self):
        if self._running:
            return
        self._running = True
        self._stop_event.clear()

        self._sync_thread = threading.Thread(
            target=self._sync_loop, name="CloudSync", daemon=True
        )
        self._heartbeat_thread = threading.Thread(
            target=self._heartbeat_loop, name="Heartbeat", daemon=True
        )
        self._sync_thread.start()
        self._heartbeat_thread.start()
        logger.info(f"[CloudSync] 시작: {self.api_url} | 게이트웨이: {self.gateway_id}")

    def stop(self):
        self._running = False
        self._stop_event.set()
        if self._sync_thread:
            self._sync_thread.join(timeout=5)
        if self._heartbeat_thread:
            self._heartbeat_thread.join(timeout=5)
        self._client.close()
        logger.info("[CloudSync] 중지")

    # ── 동기화 루프 ───────────────────────────────────────────────────

    def _sync_loop(self):
        while not self._stop_event.is_set():
            try:
                self._do_sync()
            except Exception as e:
                logger.error(f"[CloudSync] 루프 예외: {e}")
            self._stop_event.wait(timeout=self.sync_interval)

    def _do_sync(self):
        """버퍼에서 배치 읽어 클라우드에 전송"""
        batch = self.buffer.pop_batch(limit=self.batch_size)
        if not batch:
            return

        success = self._send_batch(batch)
        if success:
            self.buffer.mark_sent([r.row_id for r in batch if r.row_id])
            self.stats.total_sent      += len(batch)
            self.stats.last_sync_at     = time.time()
            self.stats.consecutive_fails = 0
            logger.debug(f"[CloudSync] 전송 성공: {len(batch)}건 | 버퍼 잔여: {self.buffer.pending_count()}건")
        else:
            self.stats.total_failed    += len(batch)
            self.stats.consecutive_fails += 1
            # 버퍼에 유지 (mark_sent 호출 안 함)
            if self.stats.consecutive_fails % 10 == 1:
                logger.warning(
                    f"[CloudSync] 연속 {self.stats.consecutive_fails}회 실패 | "
                    f"버퍼 잔여: {self.buffer.pending_count()}건"
                )

    def _send_batch(self, batch: List[Reading]) -> bool:
        """POST /api/gateways/{id}/data"""
        url = f"{self.api_url}/api/gateways/{self.gateway_id}/data"
        payload = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "readings":  [r.to_api_dict() for r in batch],
            "meta": {
                "protocol":    "collector",
                "bufferCount": self.buffer.pending_count(),
                "firmwareVersion": "1.0.0",
            },
        }

        try:
            resp = self._client.post(url, content=json.dumps(payload))
            if resp.status_code == 200:
                return True
            elif resp.status_code == 401:
                logger.error("[CloudSync] 인증 실패 (401) — 게이트웨이 토큰 확인")
                self.stats.last_error = "인증 실패 (401)"
                return False
            elif resp.status_code == 404:
                logger.error(f"[CloudSync] 게이트웨이 없음 (404) — ID: {self.gateway_id}")
                self.stats.last_error = "게이트웨이 ID 없음 (404)"
                return False
            else:
                self.stats.last_error = f"HTTP {resp.status_code}"
                logger.warning(f"[CloudSync] 전송 실패: HTTP {resp.status_code} {resp.text[:200]}")
                return False

        except httpx.ConnectError as e:
            self.stats.last_error = f"연결 불가: {e}"
            logger.warning(f"[CloudSync] 서버 연결 불가: {e}")
            return False
        except httpx.TimeoutException:
            self.stats.last_error = "타임아웃"
            logger.warning("[CloudSync] 전송 타임아웃")
            return False
        except Exception as e:
            self.stats.last_error = str(e)
            logger.error(f"[CloudSync] 전송 예외: {e}")
            return False

    # ── 하트비트 루프 ─────────────────────────────────────────────────

    def _heartbeat_loop(self):
        while not self._stop_event.is_set():
            try:
                self._send_heartbeat()
            except Exception as e:
                logger.debug(f"[Heartbeat] 오류: {e}")
            self._stop_event.wait(timeout=self.heartbeat_interval)

    def _send_heartbeat(self):
        """게이트웨이 온라인 상태 갱신 — POST /api/gateways/{id}/heartbeat"""
        url = f"{self.api_url}/api/gateways/{self.gateway_id}/heartbeat"
        payload = {
            "status":          "online",
            "bufferedRecords": self.buffer.pending_count(),
            "firmwareVersion": "1.0.0",
        }
        try:
            resp = self._client.post(url, content=json.dumps(payload))
            if resp.status_code in (200, 204):
                logger.debug("[Heartbeat] 전송 성공")
            else:
                logger.debug(f"[Heartbeat] HTTP {resp.status_code}")
        except Exception:
            pass

    # ── 클라우드 설정 조회 (OTA) ─────────────────────────────────────

    def fetch_device_config(self) -> Optional[dict]:
        """
        클라우드에서 최신 게이트웨이 설정 조회.
        반환값: gateway.config JSON (프로토콜별 설정)
        """
        url = f"{self.api_url}/api/gateways/{self.gateway_id}"
        try:
            resp = self._client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                return data.get("data", {}).get("config")
        except Exception as e:
            logger.warning(f"[CloudSync] 설정 조회 실패: {e}")
        return None

    # ── 상태 조회 ─────────────────────────────────────────────────────

    def get_status(self) -> dict:
        return {
            "running":          self._running,
            "api_url":          self.api_url,
            "gateway_id":       self.gateway_id,
            "total_sent":       self.stats.total_sent,
            "total_failed":     self.stats.total_failed,
            "consecutive_fails": self.stats.consecutive_fails,
            "last_sync_at":     self.stats.last_sync_at,
            "last_error":       self.stats.last_error,
            "buffer_pending":   self.buffer.pending_count(),
            "is_healthy":       self.stats.is_healthy,
        }