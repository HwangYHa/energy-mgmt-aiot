"""
ota_cache.py
────────────
OTA(Over-The-Air) 설정 로컬 캐시

오프라인 내성 핵심 — 플랫폼 연결 없이도 마지막으로 받은 설정으로 부팅 가능.

저장 위치: data/ota_config_cache.json
구조:
  {
    "gateway_id": "gw_xxx",
    "config_hash": "abc123",
    "saved_at": "ISO8601",
    "fetched_at": "ISO8601",   ← 플랫폼에서 받은 시각
    "devices": [...],           ← collector 형식 device 목록
  }

사용:
  cache = OtaCache("data/ota_config_cache.json")
  cache.save(ota_response)      # 플랫폼에서 받은 직후
  cached = cache.load()         # 부팅 시 또는 플랫폼 장애 시
  cache.is_stale(hours=48)      # 오래된 캐시 여부
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# 캐시 유효 경고 기준 (초과 시 로그 경고, 사용은 계속)
STALE_WARNING_HOURS = 24


class OtaCache:
    """OTA 설정 로컬 캐시 관리자"""

    def __init__(self, cache_path: str = "data/ota_config_cache.json"):
        self._path = Path(cache_path)
        self._current: Optional[dict] = None   # 메모리 캐시

    # ── 저장 ────────────────────────────────────────────────────

    def save(self, ota_response: dict) -> bool:
        """
        플랫폼 OTA 응답을 로컬에 저장.

        ota_response: GET /api/gateways/{id}/config 응답 JSON
        """
        try:
            self._path.parent.mkdir(parents=True, exist_ok=True)

            payload = {
                "gateway_id":  ota_response.get("gateway_id", ""),
                "config_hash": ota_response.get("config_hash", ""),
                "fetched_at":  ota_response.get("fetched_at", datetime.now(timezone.utc).isoformat()),
                "saved_at":    datetime.now(timezone.utc).isoformat(),
                "device_count": ota_response.get("device_count", 0),
                "devices":     ota_response.get("devices", []),
            }

            with open(self._path, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)

            self._current = payload
            logger.info(
                f"[OtaCache] 저장 완료: {len(payload['devices'])}개 장치 "
                f"(hash: {payload['config_hash']})"
            )
            return True

        except Exception as e:
            logger.error(f"[OtaCache] 저장 실패: {e}")
            return False

    # ── 로드 ────────────────────────────────────────────────────

    def load(self) -> Optional[dict]:
        """
        로컬 캐시 로드.

        반환값: {'devices': [...], 'config_hash': ..., 'saved_at': ...}
        캐시 없으면 None
        """
        # 메모리 캐시 우선
        if self._current:
            return self._current

        if not self._path.exists():
            logger.debug("[OtaCache] 캐시 파일 없음")
            return None

        try:
            with open(self._path, "r", encoding="utf-8") as f:
                data = json.load(f)

            self._current = data

            saved_at = data.get("saved_at", "알 수 없음")
            device_count = len(data.get("devices", []))
            logger.info(
                f"[OtaCache] 캐시 로드: {device_count}개 장치 "
                f"(저장: {saved_at[:19] if saved_at else '?'})"
            )

            # 오래된 캐시 경고
            if self.is_stale(hours=STALE_WARNING_HOURS):
                logger.warning(
                    f"[OtaCache] 캐시가 {STALE_WARNING_HOURS}시간 이상 경과했습니다. "
                    f"플랫폼 연결 후 갱신을 권장합니다."
                )

            return data

        except json.JSONDecodeError as e:
            logger.error(f"[OtaCache] 캐시 파일 손상: {e}")
            self._invalidate()
            return None
        except Exception as e:
            logger.error(f"[OtaCache] 캐시 로드 실패: {e}")
            return None

    # ── 변경 감지 ────────────────────────────────────────────────

    def is_changed(self, new_hash: str) -> bool:
        """새 hash가 캐시와 다르면 True (설정 변경 감지)"""
        if not self._current:
            cached = self.load()
        else:
            cached = self._current

        if not cached:
            return True   # 캐시 없으면 항상 변경으로 간주

        return cached.get("config_hash", "") != new_hash

    # ── 상태 조회 ────────────────────────────────────────────────

    def is_stale(self, hours: int = STALE_WARNING_HOURS) -> bool:
        """캐시가 hours 시간 이상 경과했으면 True"""
        cached = self._current or self.load()
        if not cached:
            return True

        saved_at_str = cached.get("saved_at")
        if not saved_at_str:
            return True

        try:
            saved_at = datetime.fromisoformat(saved_at_str.replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            elapsed_hours = (now - saved_at).total_seconds() / 3600
            return elapsed_hours > hours
        except Exception:
            return True

    def has_cache(self) -> bool:
        """유효한 캐시 존재 여부"""
        return self._path.exists() and self._path.stat().st_size > 10

    def get_device_count(self) -> int:
        """캐시된 장치 수"""
        cached = self._current or self.load()
        if not cached:
            return 0
        return len(cached.get("devices", []))

    def get_hash(self) -> str:
        """현재 캐시 hash"""
        cached = self._current or self.load()
        if not cached:
            return ""
        return cached.get("config_hash", "")

    def get_saved_at(self) -> Optional[str]:
        """캐시 저장 시각 (ISO8601)"""
        cached = self._current or self.load()
        if not cached:
            return None
        return cached.get("saved_at")

    def get_devices(self) -> list:
        """캐시된 장치 목록"""
        cached = self._current or self.load()
        if not cached:
            return []
        return cached.get("devices", [])

    # ── 내부 메서드 ──────────────────────────────────────────────

    def _invalidate(self):
        """메모리 캐시 무효화"""
        self._current = None

    def clear(self):
        """캐시 파일 삭제"""
        if self._path.exists():
            self._path.unlink()
        self._current = None
        logger.info("[OtaCache] 캐시 삭제 완료")

    def stats(self) -> dict:
        """캐시 상태 요약"""
        return {
            "has_cache":     self.has_cache(),
            "device_count":  self.get_device_count(),
            "config_hash":   self.get_hash(),
            "saved_at":      self.get_saved_at(),
            "is_stale":      self.is_stale(),
            "cache_path":    str(self._path),
        }