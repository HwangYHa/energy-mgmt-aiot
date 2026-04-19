# -*- mode: python ; coding: utf-8 -*-
#
# 탄소이음 Collector — PyInstaller 6.x + Python 3.13 호환 onefile 빌드 스펙
#
# 빌드 명령:
#   cd collector
#   pyinstaller TansoEum-Collector.spec --clean
#   (또는 build.bat 실행)
#
# 배포:
#   dist\TansoEum-Collector.exe  →  public/downloads/TansoEum-Collector.exe
#
# [중요] runtime_tmpdir=None 이유:
#   - C:\TansoEum\runtime 디렉토리가 최초 실행 전 존재하지 않으면
#     PyInstaller 6.x bootloader가 EXE 위치(_internal)로 폴백하여
#     "Failed to load Python DLL" 오류 발생
#   - None 설정 시 %TEMP%\\_MEIxxxxxx 를 사용 (항상 쓰기 가능)
#   - AV 오탐 방지는 config.yaml/EXE를 C:\TansoEum\ 에 배치하도록 안내로 해결

import sys
import os
from pathlib import Path

# ── Python DLL 명시적 수집 (PyInstaller 6.x + Python 3.13 호환) ──────────
# PyInstaller 6.x 는 python3XX.dll을 자동 수집하지 못하는 경우가 있음
_py_dll_name = f'python{sys.version_info.major}{sys.version_info.minor}.dll'
_search_dirs = [
    Path(sys.base_prefix),                   # 시스템 Python 설치 경로 (venv 우회)
    Path(sys.prefix),                        # venv 기준
    Path(sys.executable).parent,            # python.exe 위치
    Path(sys.base_prefix) / 'DLLs',
    Path(sys.prefix) / 'DLLs',
]
_python_dll_path: str | None = None
for _d in _search_dirs:
    _candidate = _d / _py_dll_name
    if _candidate.exists():
        _python_dll_path = str(_candidate)
        break

extra_binaries = [(_python_dll_path, '.')] if _python_dll_path else []

# ── 숨겨진 임포트 ─────────────────────────────────────────────────────────
hidden_imports = [
    # 드라이버 (동적 로딩)
    'src.drivers.modbus_driver',
    'src.drivers.mqtt_driver',
    'src.drivers.http_driver',
    'src.drivers.opcua_driver',
    # 스케줄러
    'apscheduler.schedulers.background',
    'apscheduler.triggers.interval',
    'apscheduler.executors.pool',
    # Modbus
    'pymodbus.client',
    'pymodbus.client.tcp',
    'pymodbus.client.serial',
    'pymodbus.framer',
    'pymodbus.framer.socket',
    # MQTT
    'paho.mqtt.client',
    'paho.mqtt.publish',
    # OPC-UA
    'asyncua',
    'asyncua.client',
    # GUI
    'ttkbootstrap',
    'ttkbootstrap.themes',
    'ttkbootstrap.dialogs',
    'PIL._tkinter_finder',
    'tkinter',
    'tkinter.ttk',
    'tkinter.messagebox',
    'tkinter.filedialog',
    # 기타
    'yaml',
    'pydantic',
    'pydantic.v1',
    'requests',
    'urllib3',
    'certifi',
]

# ── 데이터 파일 ──────────────────────────────────────────────────────────
datas = []
# config.example.yaml (설정 예시 — 최초 실행 시 참고용)
_config_example = Path('config/config.example.yaml')
if _config_example.exists():
    datas.append((str(_config_example), 'config'))

a = Analysis(
    ['src\\main.py'],
    pathex=[str(Path('.').resolve())],
    binaries=extra_binaries,
    datas=datas,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'matplotlib', 'numpy', 'pandas', 'scipy',
        'IPython', 'notebook', 'jupyter',
        'pytest', 'setuptools', 'pkg_resources',
    ],
    noarchive=False,
    optimize=1,         # 바이트코드 최적화 레벨 1 (assert 유지)
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='TansoEum-Collector',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=['python313.dll', 'tcl*.dll', 'tk*.dll'],  # UPX 압축 제외 (안정성)
    runtime_tmpdir=None,   # %TEMP%\_MEIxxxxxx 사용 — C:\TansoEum\runtime 미존재 시 오류 방지
    console=False,         # 윈도우 모드 (콘솔 창 없음)
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,             # icon='assets\\icon.ico' 로 변경 가능
    version=None,
    uac_admin=False,
    uac_uiaccess=False,
)