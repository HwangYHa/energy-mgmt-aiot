# -*- mode: python ; coding: utf-8 -*-
# ────────────────────────────────────────────────────────────────
# PyInstaller 빌드 스펙 — Windows EXE 단일 파일 배포
#
# 빌드:
#   pyinstaller collector.spec
#
# 결과: dist/TansoEum-Collector.exe
# ────────────────────────────────────────────────────────────────

import sys
from pathlib import Path

block_cipher = None

# 숨겨진 임포트 (동적 로딩 드라이버)
hidden_imports = [
    "src.drivers.modbus_driver",
    "src.drivers.mqtt_driver",
    "src.drivers.http_driver",
    "src.drivers.opcua_driver",
    "apscheduler.schedulers.background",
    "apscheduler.triggers.interval",
    "pymodbus.client",
    "pymodbus.client.tcp",
    "pymodbus.client.serial",
    "paho.mqtt.client",
    "asyncua",
    "ttkbootstrap",
    "ttkbootstrap.themes",
    "ttkbootstrap.dialogs",
    "PIL._tkinter_finder",
]

a = Analysis(
    ["src/main.py"],
    pathex=[str(Path(".").resolve())],
    binaries=[],
    datas=[
        ("config/config.example.yaml", "config"),
    ],
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["matplotlib", "numpy", "pandas", "scipy", "IPython"],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="TansoEum-Collector",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,          # GUI 모드: 콘솔 창 숨김
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,              # icon="assets/icon.ico" 로 변경 가능
    version=None,
)