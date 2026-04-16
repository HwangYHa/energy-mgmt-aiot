"""
app.py
──────
탄소이음 Collector GUI — 산업용 현장 운영자 인터페이스

탭 구성:
  1. 대시보드  — 실시간 장치 상태 + 최신 측정값
  2. 장치 관리 — 장치 목록 + 등록 + 연결 테스트
  3. 로그 콘솔 — 실시간 수집 로그 + 오류 표시
  4. 설정      — 클라우드 연결 / 수집 주기 / 버퍼 설정

기술 스택:
  - ttkbootstrap (모던 다크 테마)
  - tkinter.ttk
  - threading (엔진 ↔ GUI 비동기 브릿지)
"""
from __future__ import annotations

import logging
import queue
import threading
import tkinter as tk
from datetime import datetime
from tkinter import ttk, messagebox, filedialog
from typing import Dict, List, Optional

try:
    import ttkbootstrap as ttkb
    from ttkbootstrap.constants import *
    HAS_TTKB = True
except ImportError:
    HAS_TTKB = False

from ..buffer.local_buffer import Reading
from ..config.config_manager import CollectorConfig, DeviceConfig, load_config
from ..engine.collector_engine import CollectorEngine, EngineStatus
from ..drivers.base_driver import DriverStatus

logger = logging.getLogger(__name__)

# ── 색상 팔레트 ─────────────────────────────────────────────────────

COLOR = {
    "bg":          "#0D1117",
    "surface":     "#161B22",
    "border":      "#21262D",
    "text":        "#C9D1D9",
    "text_dim":    "#8B949E",
    "green":       "#3FB950",
    "red":         "#F85149",
    "yellow":      "#D29922",
    "blue":        "#58A6FF",
    "purple":      "#BC8CFF",
}

STATUS_COLOR = {
    "connected":    COLOR["green"],
    "polling":      COLOR["blue"],
    "connecting":   COLOR["yellow"],
    "disconnected": COLOR["text_dim"],
    "error":        COLOR["red"],
    "idle":         COLOR["text_dim"],
}

# ── GUI 이벤트 큐 (스레드 → GUI 전달) ────────────────────────────────

gui_queue: queue.Queue = queue.Queue(maxsize=2000)

def post(event_type: str, data: dict):
    """엔진 스레드 → GUI 큐에 이벤트 등록"""
    try:
        gui_queue.put_nowait({"type": event_type, "data": data})
    except queue.Full:
        pass  # GUI 처리 지연 시 드롭 (로그 이벤트는 손실 허용)

# ── 메인 애플리케이션 ────────────────────────────────────────────────

class CollectorApp:
    """메인 애플리케이션 윈도우"""

    def __init__(self, config=None):
        from ..config.config_manager import CollectorConfig
        if isinstance(config, CollectorConfig):
            self.config = config
        else:
            self.config = load_config(config) if config else load_config()
        self.engine:     Optional[CollectorEngine] = None
        self._running    = False

        # GUI 루트 설정
        if HAS_TTKB:
            self.root = ttkb.Window(
                title="탄소이음 Collector",
                themename="darkly",
                size=(1280, 800),
                minsize=(900, 600),
            )
        else:
            self.root = tk.Tk()
            self.root.title("탄소이음 Collector")
            self.root.geometry("1280x800")
            self.root.configure(bg=COLOR["bg"])

        self.root.protocol("WM_DELETE_WINDOW", self._on_close)

        # 상태바 변수
        self.var_engine_status = tk.StringVar(value="■ 정지")
        self.var_buffer_count  = tk.StringVar(value="버퍼: 0건")
        self.var_sent_count    = tk.StringVar(value="전송: 0건")
        self.var_cloud_status  = tk.StringVar(value="클라우드: 대기")

        # 장치 상태 캐시
        self._device_status: Dict[str, str] = {}
        self._latest_readings: Dict[str, Dict[str, float]] = {}

        self._build_ui()
        self._start_queue_processor()

    # ── UI 빌드 ──────────────────────────────────────────────────────

    def _build_ui(self):
        # ── 상단 헤더 ─────────────────────────────────────────────────
        header = tk.Frame(self.root, bg="#0F1923", height=56)
        header.pack(fill="x")
        header.pack_propagate(False)

        tk.Label(
            header, text="⚡ 탄소이음 Collector",
            font=("Pretendard", 16, "bold"), fg=COLOR["blue"], bg="#0F1923",
        ).pack(side="left", padx=20, pady=12)

        # 엔진 제어 버튼
        btn_frame = tk.Frame(header, bg="#0F1923")
        btn_frame.pack(side="right", padx=20)

        self.btn_start = self._btn(btn_frame, "▶ 시작", self._start_engine, COLOR["green"])
        self.btn_start.pack(side="left", padx=4)
        self.btn_stop  = self._btn(btn_frame, "■ 정지", self._stop_engine, COLOR["red"])
        self.btn_stop.pack(side="left", padx=4)
        self.btn_stop.config(state="disabled")

        # ── 상태바 ────────────────────────────────────────────────────
        statusbar = tk.Frame(self.root, bg="#0A0F1A", height=30)
        statusbar.pack(fill="x", side="bottom")
        statusbar.pack_propagate(False)

        for var, fg in [
            (self.var_engine_status, COLOR["text"]),
            (self.var_buffer_count,  COLOR["yellow"]),
            (self.var_sent_count,    COLOR["green"]),
            (self.var_cloud_status,  COLOR["blue"]),
        ]:
            tk.Label(statusbar, textvariable=var, font=("Consolas", 9),
                     fg=fg, bg="#0A0F1A").pack(side="left", padx=16, pady=4)

        # ── 노트북 탭 ─────────────────────────────────────────────────
        notebook = ttk.Notebook(self.root)
        notebook.pack(fill="both", expand=True, padx=0, pady=0)

        self.tab_dashboard = DashboardTab(notebook, self)
        self.tab_devices   = DevicesTab(notebook, self)
        self.tab_logs      = LogsTab(notebook, self)
        self.tab_settings  = SettingsTab(notebook, self)

        notebook.add(self.tab_dashboard, text="  📊 대시보드  ")
        notebook.add(self.tab_devices,   text="  🔌 장치 관리  ")
        notebook.add(self.tab_logs,      text="  📋 로그 콘솔  ")
        notebook.add(self.tab_settings,  text="  ⚙  설정  ")

    def _btn(self, parent, text, cmd, color) -> tk.Button:
        return tk.Button(
            parent, text=text, command=cmd,
            font=("Pretendard", 10, "bold"),
            fg="white", bg=color,
            relief="flat", bd=0, padx=14, pady=6,
            cursor="hand2", activebackground=color,
        )

    # ── 엔진 제어 ────────────────────────────────────────────────────

    def _start_engine(self):
        if self._running:
            return
        self._running = True
        self.btn_start.config(state="disabled")
        self.btn_stop.config(state="normal")

        def _run():
            try:
                self.engine = CollectorEngine(self.config)
                self.engine.on_data(self._on_data)
                self.engine.on_device_status(self._on_device_status)
                self.engine.on_engine_status(self._on_engine_status)
                self.engine.start()
            except Exception as e:
                post("log", {"level": "ERROR", "msg": f"엔진 시작 실패: {e}"})
                self._running = False

        threading.Thread(target=_run, daemon=True, name="EngineThread").start()

    def _stop_engine(self):
        self._running = False
        self.btn_start.config(state="normal")
        self.btn_stop.config(state="disabled")
        if self.engine:
            threading.Thread(target=self.engine.stop, daemon=True).start()
            self.engine = None

    # ── 엔진 콜백 (스레드 → GUI 큐) ──────────────────────────────────

    def _on_data(self, device_id: str, readings: List[Reading]):
        post("data", {"device_id": device_id, "readings": [
            {"sensor_code": r.sensor_code, "metric_key": r.metric_key,
             "value": r.value, "unit": r.unit, "quality": r.quality,
             "timestamp": r.timestamp}
            for r in readings
        ]})

    def _on_device_status(self, device_id: str, status: str, message: str):
        post("device_status", {"device_id": device_id, "status": status, "message": message})
        if message:
            post("log", {"level": "WARNING" if status == "error" else "INFO",
                         "msg": f"[{device_id}] {status}: {message}"})

    def _on_engine_status(self, status: str):
        post("engine_status", {"status": status})
        post("log", {"level": "INFO", "msg": f"엔진 상태: {status}"})

    # ── GUI 큐 처리 ────────────────────────────────────────────────────

    def _start_queue_processor(self):
        """16ms 간격으로 GUI 이벤트 큐 처리 (약 60fps)"""
        self.root.after(16, self._process_queue)

    def _process_queue(self):
        processed = 0
        while not gui_queue.empty() and processed < 50:
            try:
                event = gui_queue.get_nowait()
                self._dispatch(event)
                processed += 1
            except queue.Empty:
                break

        # 상태바 1초마다 갱신
        self._update_statusbar()
        self.root.after(100, self._process_queue)

    def _dispatch(self, event: dict):
        etype = event["type"]
        data  = event["data"]

        if etype == "data":
            self.tab_dashboard.update_readings(data)
        elif etype == "device_status":
            self._device_status[data["device_id"]] = data["status"]
            self.tab_dashboard.update_device_status(data)
            self.tab_devices.update_status(data)
        elif etype == "engine_status":
            status = data["status"]
            icons  = {
                EngineStatus.RUNNING:  "● 실행 중",
                EngineStatus.STOPPED:  "■ 정지",
                EngineStatus.STARTING: "◌ 시작 중...",
                EngineStatus.STOPPING: "◌ 종료 중...",
                EngineStatus.ERROR:    "✕ 오류",
            }
            self.var_engine_status.set(icons.get(status, status))
        elif etype == "log":
            self.tab_logs.append(data["level"], data["msg"])

    def _update_statusbar(self):
        if self.engine:
            status = self.engine.cloud_sync.get_status()
            self.var_buffer_count.set(f"버퍼: {self.engine.buffer.pending_count():,}건")
            self.var_sent_count.set(f"전송: {status['total_sent']:,}건")
            icon = "●" if status["is_healthy"] else "✕"
            self.var_cloud_status.set(f"클라우드: {icon} {'정상' if status['is_healthy'] else '오류'}")

    def _on_close(self):
        if messagebox.askokcancel("종료 확인", "Collector를 종료하시겠습니까?\n미전송 데이터는 버퍼에 보존됩니다."):
            if self.engine:
                self.engine.stop()
            self.root.destroy()

    def run(self):
        self.root.mainloop()


# ── 대시보드 탭 ──────────────────────────────────────────────────────

class DashboardTab(tk.Frame):
    def __init__(self, parent, app: CollectorApp):
        super().__init__(parent, bg=COLOR["bg"])
        self.app = app
        self._device_rows: Dict[str, dict] = {}
        self._build()

    def _build(self):
        # ── 상단: 요약 KPI ────────────────────────────────────────────
        kpi_frame = tk.Frame(self, bg=COLOR["bg"])
        kpi_frame.pack(fill="x", padx=16, pady=(12, 4))

        self.kpi_vars = {}
        kpis = [
            ("총 장치",      "devices",   COLOR["blue"]),
            ("온라인",        "online",    COLOR["green"]),
            ("오류",          "error",     COLOR["red"]),
            ("총 수집 건",    "readings",  COLOR["purple"]),
            ("버퍼 잔여",     "buffer",    COLOR["yellow"]),
        ]
        for label, key, color in kpis:
            frame = tk.Frame(kpi_frame, bg=COLOR["surface"], padx=18, pady=10)
            frame.pack(side="left", padx=6)
            tk.Label(frame, text=label, font=("Pretendard", 9), fg=COLOR["text_dim"], bg=COLOR["surface"]).pack()
            var = tk.StringVar(value="0")
            self.kpi_vars[key] = var
            tk.Label(frame, textvariable=var, font=("Consolas", 20, "bold"),
                     fg=color, bg=COLOR["surface"]).pack()

        # ── 장치 상태 테이블 ──────────────────────────────────────────
        cols_frame = tk.Frame(self, bg=COLOR["bg"])
        cols_frame.pack(fill="both", expand=True, padx=16, pady=8)

        cols = ("장치명", "프로토콜", "상태", "최근 값", "단위", "수집 건수", "성공률", "마지막 오류")
        self.tree = ttk.Treeview(cols_frame, columns=cols, show="headings", height=20)
        widths = (180, 100, 90, 120, 60, 80, 70, 200)
        for col, w in zip(cols, widths):
            self.tree.heading(col, text=col)
            self.tree.column(col, width=w, minwidth=50)

        vsb = ttk.Scrollbar(cols_frame, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=vsb.set)
        self.tree.pack(side="left", fill="both", expand=True)
        vsb.pack(side="right", fill="y")

        # 태그 색상
        self.tree.tag_configure("connected",    foreground=COLOR["green"])
        self.tree.tag_configure("error",        foreground=COLOR["red"])
        self.tree.tag_configure("disconnected", foreground=COLOR["text_dim"])
        self.tree.tag_configure("polling",      foreground=COLOR["blue"])

    def update_readings(self, data: dict):
        device_id = data["device_id"]
        for r in data.get("readings", []):
            key = f"{device_id}:{r['metric_key']}"
            # 테이블 업데이트
            if device_id in self._device_rows:
                iid = self._device_rows[device_id].get("iid")
                if iid and self.app.tree_exists(iid):
                    try:
                        vals = list(self.tree.item(iid, "values"))
                        vals[3] = f"{r['value']:.3f}"
                        vals[4] = r.get("unit", "")
                        count = int(vals[5] or 0) + 1
                        vals[5] = str(count)
                        self.tree.item(iid, values=vals)
                    except Exception:
                        pass

        # KPI 갱신
        if self.app.engine:
            status = self.app.engine.get_status()
            drivers = status.get("drivers", {})
            online  = sum(1 for d in drivers.values() if d["status"] == "connected")
            errors  = sum(1 for d in drivers.values() if d["status"] == "error")
            total_r = sum(d["total_readings"] for d in drivers.values())
            self.kpi_vars["devices"].set(str(len(drivers)))
            self.kpi_vars["online"].set(str(online))
            self.kpi_vars["error"].set(str(errors))
            self.kpi_vars["readings"].set(f"{total_r:,}")
            self.kpi_vars["buffer"].set(f"{self.app.engine.buffer.pending_count():,}")

    def update_device_status(self, data: dict):
        device_id = data["device_id"]
        status    = data["status"]

        if device_id not in self._device_rows:
            # 새 행 추가
            iid = self.tree.insert("", "end", values=(
                device_id, "—", status, "—", "—", "0", "—", ""
            ), tags=(status,))
            self._device_rows[device_id] = {"iid": iid}
        else:
            iid = self._device_rows[device_id].get("iid")
            if iid:
                vals = list(self.tree.item(iid, "values"))
                vals[2] = status
                if data.get("message") and status == "error":
                    vals[7] = data["message"][:50]
                self.tree.item(iid, values=vals, tags=(status,))


# ── 장치 관리 탭 ─────────────────────────────────────────────────────

class DevicesTab(tk.Frame):
    def __init__(self, parent, app: CollectorApp):
        super().__init__(parent, bg=COLOR["bg"])
        self.app  = app
        self._build()

    def _build(self):
        # 툴바
        toolbar = tk.Frame(self, bg=COLOR["surface"])
        toolbar.pack(fill="x", padx=0, pady=0)

        self._btn(toolbar, "＋ 장치 추가",    self._add_device).pack(side="left", padx=8, pady=8)
        self._btn(toolbar, "✏  편집",          self._edit_device).pack(side="left", padx=4, pady=8)
        self._btn(toolbar, "⚡ 연결 테스트",   self._test_connection).pack(side="left", padx=4, pady=8)
        self._btn(toolbar, "⟳ 재연결",         self._reconnect).pack(side="left", padx=4, pady=8)
        self._btn(toolbar, "🗑 제거",          self._remove_device, COLOR["red"]).pack(side="left", padx=4, pady=8)

        # 장치 목록
        cols = ("ID", "이름", "프로토콜", "상태", "폴링주기", "성공률", "총수집", "연속실패")
        self.tree = ttk.Treeview(self, columns=cols, show="headings")
        widths    = (160, 180, 110, 100, 90, 80, 80, 80)
        for col, w in zip(cols, widths):
            self.tree.heading(col, text=col)
            self.tree.column(col, width=w)

        vsb = ttk.Scrollbar(self, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=vsb.set)

        self.tree.pack(side="left", fill="both", expand=True, padx=8, pady=8)
        vsb.pack(side="right", fill="y", pady=8)

        self.tree.tag_configure("connected",    foreground=COLOR["green"])
        self.tree.tag_configure("error",        foreground=COLOR["red"])
        self.tree.tag_configure("disconnected", foreground=COLOR["text_dim"])

        # 설정에서 장치 초기 로드
        for dev in self.app.config.devices:
            self.tree.insert("", "end", iid=dev.id, values=(
                dev.id, dev.name, dev.protocol, "대기",
                f"{dev.poll_interval_ms}ms", "—", "0", "0",
            ), tags=("idle",))

    def _btn(self, parent, text, cmd, bg=None):
        bg = bg or COLOR["surface"]
        return tk.Button(parent, text=text, command=cmd,
                         font=("Pretendard", 9), fg=COLOR["text"], bg=bg,
                         relief="flat", padx=10, pady=4, cursor="hand2")

    def update_status(self, data: dict):
        device_id = data["device_id"]
        status    = data["status"]
        if self.tree.exists(device_id):
            vals = list(self.tree.item(device_id, "values"))
            vals[3] = status
            if self.app.engine:
                driver = self.app.engine.get_driver(device_id)
                if driver:
                    info   = driver.get_info()
                    vals[5] = f"{info['success_rate']:.1f}%"
                    vals[6] = str(info['total_readings'])
                    vals[7] = str(info['consecutive_fails'])
            self.tree.item(device_id, values=vals, tags=(status,))

    def _test_connection(self):
        sel = self.tree.selection()
        if not sel:
            messagebox.showwarning("선택 없음", "테스트할 장치를 선택하세요.")
            return
        device_id = sel[0]
        if not self.app.engine:
            messagebox.showinfo("엔진 정지", "엔진을 먼저 시작하세요.")
            return

        def _test():
            ok, msg = self.app.engine.test_device_connection(device_id)
            level = "INFO" if ok else "ERROR"
            post("log", {"level": level, "msg": f"[테스트] {device_id}: {msg}"})
            messagebox.showinfo("연결 테스트", f"{'✅ 성공' if ok else '❌ 실패'}\n{msg}")

        threading.Thread(target=_test, daemon=True).start()

    def _reconnect(self):
        sel = self.tree.selection()
        if not sel or not self.app.engine:
            return
        device_id = sel[0]
        driver = self.app.engine.get_driver(device_id)
        if driver:
            threading.Thread(target=driver.connect, daemon=True).start()
            post("log", {"level": "INFO", "msg": f"[{device_id}] 수동 재연결 시도"})

    def _add_device(self):
        DeviceDialog(self.app.root, self.app, mode="add")

    def _edit_device(self):
        sel = self.tree.selection()
        if not sel:
            return
        DeviceDialog(self.app.root, self.app, mode="edit", device_id=sel[0])

    def _remove_device(self):
        sel = self.tree.selection()
        if not sel:
            return
        device_id = sel[0]
        if messagebox.askyesno("삭제 확인", f"{device_id}를 제거하시겠습니까?"):
            if self.app.engine:
                self.app.engine.remove_device(device_id)
            self.tree.delete(device_id)


# ── 로그 콘솔 탭 ─────────────────────────────────────────────────────

class LogsTab(tk.Frame):
    MAX_LINES = 2000

    def __init__(self, parent, app: CollectorApp):
        super().__init__(parent, bg=COLOR["bg"])
        self.app = app
        self._build()

    def _build(self):
        toolbar = tk.Frame(self, bg=COLOR["surface"])
        toolbar.pack(fill="x")
        tk.Button(toolbar, text="지우기", command=self._clear,
                  font=("Pretendard", 9), fg=COLOR["text"], bg=COLOR["surface"],
                  relief="flat", padx=10, pady=4).pack(side="left", padx=8, pady=6)
        tk.Button(toolbar, text="저장", command=self._save,
                  font=("Pretendard", 9), fg=COLOR["text"], bg=COLOR["surface"],
                  relief="flat", padx=10, pady=4).pack(side="left", padx=4, pady=6)

        # 필터
        self.var_filter = tk.StringVar(value="ALL")
        for level in ("ALL", "INFO", "WARNING", "ERROR"):
            tk.Radiobutton(
                toolbar, text=level, variable=self.var_filter, value=level,
                font=("Pretendard", 9), fg=COLOR["text"], bg=COLOR["surface"],
                selectcolor=COLOR["surface"], activebackground=COLOR["surface"],
            ).pack(side="left", padx=4)

        # 로그 텍스트
        text_frame = tk.Frame(self, bg=COLOR["bg"])
        text_frame.pack(fill="both", expand=True, padx=8, pady=4)

        self.text = tk.Text(
            text_frame, bg="#0A0F1A", fg=COLOR["text"],
            font=("Consolas", 10), wrap="none",
            state="disabled", insertbackground=COLOR["text"],
        )
        vsb = ttk.Scrollbar(text_frame, orient="vertical", command=self.text.yview)
        hsb = ttk.Scrollbar(text_frame, orient="horizontal", command=self.text.xview)
        self.text.configure(yscrollcommand=vsb.set, xscrollcommand=hsb.set)

        self.text.grid(row=0, column=0, sticky="nsew")
        vsb.grid(row=0, column=1, sticky="ns")
        hsb.grid(row=1, column=0, sticky="ew")
        text_frame.rowconfigure(0, weight=1)
        text_frame.columnconfigure(0, weight=1)

        # 색상 태그
        self.text.tag_configure("INFO",    foreground=COLOR["text"])
        self.text.tag_configure("WARNING", foreground=COLOR["yellow"])
        self.text.tag_configure("ERROR",   foreground=COLOR["red"])
        self.text.tag_configure("DEBUG",   foreground=COLOR["text_dim"])
        self.text.tag_configure("time",    foreground=COLOR["text_dim"])

    def append(self, level: str, msg: str):
        filter_val = self.var_filter.get()
        if filter_val != "ALL" and level != filter_val:
            return

        ts   = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        line = f"[{ts}] [{level:<7}] {msg}\n"

        self.text.config(state="normal")
        self.text.insert("end", f"[{ts}] ", "time")
        self.text.insert("end", f"[{level:<7}] ", level)
        self.text.insert("end", f"{msg}\n")

        # 최대 라인 수 제한
        lines = int(self.text.index("end-1c").split(".")[0])
        if lines > self.MAX_LINES:
            self.text.delete("1.0", f"{lines - self.MAX_LINES}.0")

        self.text.config(state="disabled")
        self.text.see("end")

    def _clear(self):
        self.text.config(state="normal")
        self.text.delete("1.0", "end")
        self.text.config(state="disabled")

    def _save(self):
        path = filedialog.asksaveasfilename(
            defaultextension=".log",
            filetypes=[("Log files", "*.log"), ("Text files", "*.txt")],
            initialfile=f"collector_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log",
        )
        if path:
            content = self.text.get("1.0", "end")
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)


# ── 설정 탭 ──────────────────────────────────────────────────────────

class SettingsTab(tk.Frame):
    def __init__(self, parent, app: CollectorApp):
        super().__init__(parent, bg=COLOR["bg"])
        self.app  = app
        self._vars: Dict[str, tk.StringVar] = {}
        self._build()

    def _build(self):
        scroll_frame = tk.Frame(self, bg=COLOR["bg"])
        scroll_frame.pack(fill="both", expand=True, padx=24, pady=16)

        def section(title):
            tk.Label(scroll_frame, text=title, font=("Pretendard", 12, "bold"),
                     fg=COLOR["blue"], bg=COLOR["bg"]).pack(anchor="w", pady=(16, 6))
            sep = tk.Frame(scroll_frame, bg=COLOR["border"], height=1)
            sep.pack(fill="x", pady=(0, 10))

        def field(label, key, default="", wide=False):
            row = tk.Frame(scroll_frame, bg=COLOR["bg"])
            row.pack(fill="x", pady=3)
            tk.Label(row, text=label, width=22, anchor="w",
                     font=("Pretendard", 10), fg=COLOR["text_dim"],
                     bg=COLOR["bg"]).pack(side="left")
            var = tk.StringVar(value=default)
            self._vars[key] = var
            width = 60 if wide else 40
            tk.Entry(row, textvariable=var, width=width,
                     font=("Consolas", 10), bg=COLOR["surface"],
                     fg=COLOR["text"], insertbackground=COLOR["text"],
                     relief="flat").pack(side="left", padx=4)
            return var

        # 클라우드 설정
        section("☁  클라우드 연결")
        field("API URL",        "cloud.api_url",       self.app.config.cloud.api_url, wide=True)
        field("게이트웨이 ID",  "cloud.gateway_id",    self.app.config.cloud.gateway_id, wide=True)
        field("게이트웨이 토큰","cloud.gateway_token", self.app.config.cloud.gateway_token, wide=True)
        field("동기화 주기(초)", "cloud.sync_interval", str(self.app.config.cloud.sync_interval_sec))
        field("하트비트(초)",   "cloud.heartbeat",     str(self.app.config.cloud.heartbeat_interval_sec))
        field("배치 크기",      "cloud.batch_size",    str(self.app.config.cloud.batch_size))

        # 엔진 설정
        section("⚙  수집 엔진")
        field("최대 스레드 수", "engine.max_workers",    str(self.app.config.engine.max_workers))
        field("기본 폴링(ms)",  "engine.poll_interval",  str(self.app.config.engine.default_poll_interval_ms))
        field("연결 타임아웃(초)","engine.conn_timeout", str(self.app.config.engine.connection_timeout_sec))
        field("재연결 대기(초)", "engine.reconnect",     str(self.app.config.engine.reconnect_delay_sec))

        # 버퍼 설정
        section("💾  로컬 버퍼")
        field("DB 경로",        "buffer.db_path",        self.app.config.buffer.db_path, wide=True)
        field("최대 레코드 수", "buffer.max_records",    str(self.app.config.buffer.max_records))
        field("보관 시간(시)",  "buffer.retention_hours",str(self.app.config.buffer.retention_hours))

        # 저장 버튼
        tk.Frame(scroll_frame, bg=COLOR["bg"], height=12).pack()
        tk.Button(
            scroll_frame, text="설정 저장",
            command=self._save_config,
            font=("Pretendard", 11, "bold"),
            fg="white", bg=COLOR["blue"],
            relief="flat", padx=24, pady=8, cursor="hand2",
        ).pack(anchor="w")

    def _save_config(self):
        try:
            cfg = self.app.config
            cfg.cloud.api_url              = self._vars["cloud.api_url"].get()
            cfg.cloud.gateway_id           = self._vars["cloud.gateway_id"].get()
            cfg.cloud.gateway_token        = self._vars["cloud.gateway_token"].get()
            cfg.cloud.sync_interval_sec    = int(self._vars["cloud.sync_interval"].get())
            cfg.cloud.heartbeat_interval_sec = int(self._vars["cloud.heartbeat"].get())
            cfg.cloud.batch_size           = int(self._vars["cloud.batch_size"].get())
            cfg.engine.max_workers         = int(self._vars["engine.max_workers"].get())
            cfg.engine.default_poll_interval_ms = int(self._vars["engine.poll_interval"].get())
            cfg.engine.connection_timeout_sec   = int(self._vars["engine.conn_timeout"].get())
            cfg.engine.reconnect_delay_sec      = int(self._vars["engine.reconnect"].get())
            cfg.buffer.db_path             = self._vars["buffer.db_path"].get()
            cfg.buffer.max_records         = int(self._vars["buffer.max_records"].get())
            cfg.buffer.retention_hours     = int(self._vars["buffer.retention_hours"].get())

            import yaml
            from pathlib import Path
            path = Path("config/config.yaml")
            path.parent.mkdir(exist_ok=True)
            with open(path, "w", encoding="utf-8") as f:
                yaml.dump(cfg.model_dump(), f, allow_unicode=True, default_flow_style=False)

            messagebox.showinfo("저장 완료", "설정이 저장되었습니다.\n엔진 재시작 시 반영됩니다.")
            post("log", {"level": "INFO", "msg": "설정 저장 완료"})
        except Exception as e:
            messagebox.showerror("저장 실패", str(e))


# ── 장치 편집 다이얼로그 ──────────────────────────────────────────────

class DeviceDialog(tk.Toplevel):
    def __init__(self, parent, app: CollectorApp, mode="add", device_id=None):
        super().__init__(parent)
        self.app       = app
        self.mode      = mode
        self.device_id = device_id
        self.title("장치 추가" if mode == "add" else "장치 편집")
        self.geometry("520x460")
        self.configure(bg=COLOR["bg"])
        self.grab_set()
        self._vars: Dict[str, tk.StringVar] = {}
        self._build()

    def _build(self):
        def field(parent, label, key, default=""):
            row = tk.Frame(parent, bg=COLOR["bg"])
            row.pack(fill="x", pady=4)
            tk.Label(row, text=label, width=18, anchor="w",
                     font=("Pretendard", 10), fg=COLOR["text_dim"], bg=COLOR["bg"]).pack(side="left")
            var = tk.StringVar(value=default)
            self._vars[key] = var
            tk.Entry(row, textvariable=var, width=36,
                     font=("Consolas", 10), bg=COLOR["surface"],
                     fg=COLOR["text"], insertbackground=COLOR["text"],
                     relief="flat").pack(side="left", padx=4)

        frame = tk.Frame(self, bg=COLOR["bg"], padx=20, pady=16)
        frame.pack(fill="both", expand=True)

        tk.Label(frame, text="기본 정보", font=("Pretendard", 11, "bold"),
                 fg=COLOR["blue"], bg=COLOR["bg"]).pack(anchor="w", pady=(0, 8))

        field(frame, "장치 ID",       "id",       f"dev_{int(__import__('time').time())}")
        field(frame, "이름",          "name",     "새 장치")
        field(frame, "프로토콜",      "protocol", "modbus_tcp")
        field(frame, "폴링 주기(ms)", "poll_ms",  "5000")

        tk.Label(frame, text="연결 설정", font=("Pretendard", 11, "bold"),
                 fg=COLOR["blue"], bg=COLOR["bg"]).pack(anchor="w", pady=(12, 8))

        field(frame, "호스트/포트",   "host",     "192.168.1.100")
        field(frame, "포트 번호",     "port",     "502")
        field(frame, "Unit ID",       "unit_id",  "1")

        tk.Frame(frame, bg=COLOR["bg"], height=8).pack()

        btn_row = tk.Frame(frame, bg=COLOR["bg"])
        btn_row.pack(fill="x")

        tk.Button(btn_row, text="저장", command=self._save,
                  font=("Pretendard", 10, "bold"), fg="white", bg=COLOR["blue"],
                  relief="flat", padx=20, pady=6).pack(side="right", padx=4)
        tk.Button(btn_row, text="취소", command=self.destroy,
                  font=("Pretendard", 10), fg=COLOR["text"], bg=COLOR["surface"],
                  relief="flat", padx=20, pady=6).pack(side="right", padx=4)

    def _save(self):
        try:
            dev_cfg = DeviceConfig(
                id=self._vars["id"].get(),
                name=self._vars["name"].get(),
                protocol=self._vars["protocol"].get(),
                poll_interval_ms=int(self._vars["poll_ms"].get()),
                connection={
                    "host":    self._vars["host"].get(),
                    "port":    int(self._vars["port"].get()),
                    "unit_id": int(self._vars["unit_id"].get()),
                },
            )
            if self.app.engine:
                self.app.engine.add_device(dev_cfg)
                self.app.tab_devices.tree.insert("", "end", iid=dev_cfg.id, values=(
                    dev_cfg.id, dev_cfg.name, dev_cfg.protocol, "대기",
                    f"{dev_cfg.poll_interval_ms}ms", "—", "0", "0",
                ))
            post("log", {"level": "INFO", "msg": f"장치 추가: {dev_cfg.id} ({dev_cfg.protocol})"})
            self.destroy()
        except Exception as e:
            messagebox.showerror("저장 실패", str(e))


# ── 진입점 ────────────────────────────────────────────────────────────

def launch_gui(config=None):
    # GUI 로깅 핸들러 (tkinter 큐 브릿지)
    class GUILogHandler(logging.Handler):
        def emit(self, record):
            level = record.levelname
            if level not in ("DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"):
                level = "INFO"
            post("log", {"level": level, "msg": self.format(record)})

    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG)
    handler = GUILogHandler()
    handler.setFormatter(logging.Formatter("%(name)s — %(message)s"))
    root_logger.addHandler(handler)

    app = CollectorApp(config)
    app.run()