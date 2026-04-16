"""
main.py
───────
탄소이음 Collector Service 진입점

사용법:
  # GUI 모드 (현장 운용자용)
  python -m src.main --gui

  # 헤드리스 모드 (서버/Docker 배포)
  python -m src.main --headless

  # 설정 파일 지정
  python -m src.main --gui --config /path/to/config.yaml

  # 상태 확인만
  python -m src.main --status
"""
from __future__ import annotations

import argparse
import logging
import logging.handlers
import os
import signal
import sys
import time
from pathlib import Path

# ── 경로 설정 ─────────────────────────────────────────────────────────────
ROOT = Path(__file__).parent.parent   # collector/
sys.path.insert(0, str(ROOT))

from src.config.config_manager import load_config

logger = logging.getLogger(__name__)


# ── 로깅 초기화 ───────────────────────────────────────────────────────────

def _setup_logging(log_level: str, log_file: str | None = None):
    """루트 로거 설정 — 콘솔 + 선택적 파일 핸들러"""
    level = getattr(logging, log_level.upper(), logging.INFO)

    fmt = logging.Formatter(
        fmt="%(asctime)s [%(levelname)-8s] %(name)s — %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    handlers: list[logging.Handler] = []

    # 콘솔
    ch = logging.StreamHandler(sys.stdout)
    ch.setFormatter(fmt)
    handlers.append(ch)

    # 파일 (옵션)
    if log_file:
        Path(log_file).parent.mkdir(parents=True, exist_ok=True)
        fh = logging.handlers.RotatingFileHandler(
            log_file,
            maxBytes=10 * 1024 * 1024,   # 10 MB
            backupCount=5,
            encoding="utf-8",
        )
        fh.setFormatter(fmt)
        handlers.append(fh)

    logging.basicConfig(level=level, handlers=handlers, force=True)

    # 외부 라이브러리 노이즈 억제
    for noisy in ("apscheduler", "pymodbus", "paho", "httpx", "asyncua"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


# ── 헤드리스 모드 ─────────────────────────────────────────────────────────

def run_headless(config_path: str | None):
    """
    GUI 없이 백그라운드 서비스로 실행.
    Docker / systemd / Windows Service 환경에 적합.
    """
    config = load_config(config_path) if config_path else load_config()

    _setup_logging(
        log_level=config.logging.level,
        log_file=config.logging.file if config.logging.file else None,
    )

    logger.info("=" * 60)
    logger.info("탄소이음 Collector Service (헤드리스 모드)")
    logger.info(f"게이트웨이 ID : {config.cloud.gateway_id}")
    logger.info(f"클라우드 URL  : {config.cloud.api_url}")
    logger.info(f"장치 수       : {len(config.devices)}개")
    logger.info("=" * 60)

    from src.engine.collector_engine import CollectorEngine

    engine = CollectorEngine(config)

    # 종료 시그널 처리 (Linux/Docker SIGTERM)
    stop_flag = {"stop": False}

    def _on_signal(sig, frame):
        logger.info(f"[Main] 종료 시그널 수신 ({sig})")
        stop_flag["stop"] = True

    signal.signal(signal.SIGTERM, _on_signal)
    signal.signal(signal.SIGINT,  _on_signal)

    engine.on_engine_status(lambda s: logger.info(f"[Engine] 상태: {s}"))
    engine.start()

    logger.info("[Main] 수집 시작 — Ctrl+C 또는 SIGTERM으로 종료")

    try:
        while not stop_flag["stop"]:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        logger.info("[Main] 종료 중...")
        engine.stop()
        logger.info("[Main] 종료 완료")


# ── GUI 모드 ──────────────────────────────────────────────────────────────

def run_gui(config_path: str | None):
    """
    ttkbootstrap GUI 운용자 인터페이스 실행.
    현장 PC / 태블릿 (Windows/Linux Desktop) 환경에 적합.
    """
    import logging.handlers

    # GUI 실행 전 기본 로깅 (GUI 핸들러가 이후에 추가됨)
    _setup_logging("INFO")

    try:
        config = load_config(config_path) if config_path else load_config()
    except Exception as e:
        logger.error(f"설정 파일 로드 실패: {e}")
        _show_error_dialog(str(e))
        sys.exit(1)

    try:
        from src.gui.app import launch_gui
        launch_gui(config)
    except ImportError as e:
        logger.error(f"GUI 패키지 임포트 실패: {e}")
        logger.error("  pip install ttkbootstrap 을 실행하세요.")
        sys.exit(1)


# ── 상태 조회 ─────────────────────────────────────────────────────────────

def run_status(config_path: str | None):
    """현재 버퍼 상태 + 설정을 콘솔에 출력 (운영 진단용)"""
    _setup_logging("WARNING")
    config = load_config(config_path) if config_path else load_config()

    from src.buffer.local_buffer import LocalBuffer

    buf = LocalBuffer(
        db_path=config.buffer.db_path,
        max_records=config.buffer.max_records,
        retention_hours=config.buffer.retention_hours,
    )
    stats = buf.stats()

    print("\n──── 탄소이음 Collector 상태 ────")
    print(f"  게이트웨이 ID  : {config.cloud.gateway_id}")
    print(f"  클라우드 URL   : {config.cloud.api_url}")
    print(f"  장치 수        : {len(config.devices)}개 (활성: {sum(1 for d in config.devices if d.enabled)}개)")
    print(f"  버퍼 DB        : {config.buffer.db_path}")
    print(f"  미전송 레코드  : {stats.get('pending_count', 0):,}건")
    print(f"  전체 레코드    : {stats.get('total_count', 0):,}건")
    print(f"  DB 크기        : {stats.get('db_size_kb', 0):.1f} KB")
    print("─────────────────────────────────\n")

    for dev in config.devices:
        status = "✓" if dev.enabled else "✗"
        print(f"  [{status}] {dev.name:<30} {dev.protocol:<12} {dev.poll_interval_ms}ms")
    print()


# ── 에러 다이얼로그 (GUI 없을 때 폴백) ───────────────────────────────────

def _show_error_dialog(message: str):
    try:
        import tkinter as tk
        from tkinter import messagebox
        root = tk.Tk()
        root.withdraw()
        messagebox.showerror("Collector 시작 실패", message)
        root.destroy()
    except Exception:
        print(f"\n[오류] {message}\n", file=sys.stderr)


# ── CLI 파서 ──────────────────────────────────────────────────────────────

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="collector",
        description="탄소이음 IoT Collector Service — 현장 에너지 데이터 수집기",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
예시:
  python -m src.main --gui                     # GUI 모드
  python -m src.main --headless                # 헤드리스(서버) 모드
  python -m src.main --headless --config /etc/collector/config.yaml
  python -m src.main --status                  # 버퍼 상태 확인
  python -m src.main --version                 # 버전 출력
        """,
    )
    p.add_argument(
        "--gui", action="store_true",
        help="GUI 운용자 인터페이스 실행 (기본값)",
    )
    p.add_argument(
        "--headless", action="store_true",
        help="GUI 없이 백그라운드 서비스로 실행",
    )
    p.add_argument(
        "--status", action="store_true",
        help="버퍼 상태 및 장치 설정 출력 후 종료",
    )
    p.add_argument(
        "--config", metavar="PATH",
        default=None,
        help="설정 파일 경로 (기본: 환경변수 COLLECTOR_CONFIG 또는 config/config.yaml)",
    )
    p.add_argument(
        "--version", action="version",
        version="탄소이음 Collector 1.0.0",
    )
    return p


# ── 진입점 ────────────────────────────────────────────────────────────────

def main():
    parser = build_parser()
    args = parser.parse_args()

    config_path = args.config or os.environ.get("COLLECTOR_CONFIG")

    if args.status:
        run_status(config_path)
    elif args.headless:
        run_headless(config_path)
    else:
        # --gui 명시 또는 인수 없음 → GUI 모드
        run_gui(config_path)


if __name__ == "__main__":
    main()