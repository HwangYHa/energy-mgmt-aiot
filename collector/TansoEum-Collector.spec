# -*- mode: python ; coding: utf-8 -*-
#
# --onefile 빌드: 단일 EXE 배포용
#
# 빌드 명령:
#   cd collector
#   pyinstaller TansoEum-Collector.spec
#
# 배포:
#   dist\TansoEum-Collector.exe → public/downloads/TansoEum-Collector.exe
#
# 주의:
#   - runtime_tmpdir을 Temp가 아닌 고정 경로로 지정 → Windows Defender 오탐 방지
#   - 최초 실행 전 C:\TansoEum\ 폴더를 바이러스 검사 제외 목록에 추가 권장

a = Analysis(
    ['src\\main.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
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
    upx_exclude=[],
    runtime_tmpdir='C:\\TansoEum\\runtime',
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)
