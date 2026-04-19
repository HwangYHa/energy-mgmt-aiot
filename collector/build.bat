@echo off
chcp 65001 >nul 2>&1
:: =============================================================================
:: TansoEum Collector - Windows Build Script
:: Output: dist\TansoEum-Collector.exe
::
:: Usage:
::   build.bat              <- normal build
::   build.bat --clean      <- delete cache then build
::   build.bat --deploy     <- build + copy to ..\public\downloads\
::   build.bat --clean --deploy
::
:: Run from collector\ directory:
::   PowerShell: cd G:\Dev\react-workspace\energy-mgmt-aiot\collector
::               .\build.bat --clean --deploy
::   CMD:        cd /d G:\Dev\react-workspace\energy-mgmt-aiot\collector
::               build.bat --clean --deploy
:: =============================================================================

set SPEC=TansoEum-Collector.spec
set OUTPUT_EXE=dist\TansoEum-Collector.exe
set DEPLOY_DIR=..\public\downloads
set VENV_PYINSTALLER=.venv\Scripts\pyinstaller.exe
set VENV_PYTHON=.venv\Scripts\python.exe

echo.
echo  ============================================================
echo   TansoEum Collector - PyInstaller Build
echo  ============================================================
echo.

:: Check we are in the right directory
if not exist "%SPEC%" (
    echo [ERROR] %SPEC% not found.
    echo         Run this script from the collector\ directory.
    echo         Example: cd /d G:\Dev\...\collector ^&^& build.bat
    pause
    exit /b 1
)

:: Python version
if exist "%VENV_PYTHON%" (
    echo [OK] Using venv Python
    set PYINSTALLER=%VENV_PYINSTALLER%
    set PYTHON=%VENV_PYTHON%
) else (
    echo [WARN] venv not found - using system Python
    set PYINSTALLER=pyinstaller
    set PYTHON=python
)

%PYTHON% --version
%PYINSTALLER% --version
echo.

:: --clean: delete previous build cache
for %%A in (%*) do (
    if "%%A"=="--clean" goto :do_clean
)
goto :start_build

:do_clean
echo [*] Removing previous build cache...
if exist build    rmdir /s /q build
if exist dist     rmdir /s /q dist
echo [OK] Cleaned.
echo.

:start_build
echo [*] Starting PyInstaller build...
%PYINSTALLER% %SPEC% --clean --noconfirm

if errorlevel 1 (
    echo.
    echo [ERROR] Build failed!
    echo   1. pip install -r requirements.txt
    echo   2. pip install pyinstaller
    echo   3. Check Python DLL: python -c "import sys; print(sys.base_prefix)"
    pause
    exit /b 1
)

if not exist "%OUTPUT_EXE%" (
    echo [ERROR] EXE not found: %OUTPUT_EXE%
    pause
    exit /b 1
)

for %%F in (%OUTPUT_EXE%) do set EXE_SIZE=%%~zF
set /a EXE_MB=%EXE_SIZE% / 1048576

echo.
echo  ============================================================
echo   Build SUCCESS
echo   File : %OUTPUT_EXE%
echo   Size : %EXE_MB% MB
echo  ============================================================

:: --deploy: copy to public/downloads
for %%A in (%*) do (
    if "%%A"=="--deploy" goto :do_deploy
)
goto :done

:do_deploy
if not exist "%DEPLOY_DIR%" mkdir "%DEPLOY_DIR%"
echo.
echo [*] Deploying to %DEPLOY_DIR%\TansoEum-Collector.exe
copy /Y "%OUTPUT_EXE%" "%DEPLOY_DIR%\TansoEum-Collector.exe"
if errorlevel 1 (
    echo [ERROR] Copy failed
    pause
    exit /b 1
)
echo [OK] Deployed: %DEPLOY_DIR%\TansoEum-Collector.exe

:done
echo.
echo [Guide] Installation steps:
echo   1. Create folder: C:\TansoEum\
echo   2. Copy TansoEum-Collector.exe to C:\TansoEum\
echo   3. Copy config.yaml to C:\TansoEum\  (from gateway settings)
echo   4. Add C:\TansoEum\ to Windows Defender exclusions
echo   5. Run C:\TansoEum\TansoEum-Collector.exe
echo.
pause
