@echo off
REM =============================================================================
REM EMS AIoT Collector - Windows NSSM Service Installer
REM
REM Prerequisites:
REM   - NSSM (Non-Sucking Service Manager)
REM     Download: https://nssm.cc/download
REM     Or: winget install nssm
REM   - Python 3.10+ (or use dist/collector.exe)
REM   - Run as Administrator
REM
REM Power-outage recovery:
REM   - Auto-start on Windows boot (SERVICE_AUTO_START)
REM   - Auto-restart 30s after abnormal exit
REM   - stdout/stderr logged to file
REM =============================================================================

setlocal enabledelayedexpansion

REM --- Configuration (edit to match your environment) ---
set SERVICE_NAME=EmsCollector
set DISPLAY_NAME=EMS AIoT Collector
set DESCRIPTION=Tanso-eum EMS AIoT data collection agent - auto-recovery after power outage
set NSSM_EXE=nssm

REM Collector installation path
set COLLECTOR_DIR=C:\EmsCollector
set PYTHON_EXE=%COLLECTOR_DIR%\venv\Scripts\python.exe
set COLLECTOR_MAIN=%COLLECTOR_DIR%\src\main.py
set CONFIG_FILE=%COLLECTOR_DIR%\config\config.yaml
set LOG_DIR=%COLLECTOR_DIR%\logs

REM Uncomment below to use pre-built EXE instead of Python
REM set APP_EXE=%COLLECTOR_DIR%\dist\collector.exe
REM set APP_ARGS=

REM --- Check administrator privileges ---
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Please run as Administrator.
    echo Right-click the file and select "Run as administrator"
    pause
    exit /b 1
)

REM --- Check NSSM is installed ---
where %NSSM_EXE% >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] NSSM not found.
    echo Install NSSM:
    echo   1. Download from https://nssm.cc/download
    echo   2. Copy nssm.exe to C:\Windows\System32\
    echo   Or run: winget install nssm
    pause
    exit /b 1
)

REM --- Create log directory ---
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

REM --- Remove existing service ---
%NSSM_EXE% status %SERVICE_NAME% >nul 2>&1
if %errorLevel% equ 0 (
    echo Removing existing service...
    %NSSM_EXE% stop %SERVICE_NAME% >nul 2>&1
    %NSSM_EXE% remove %SERVICE_NAME% confirm
)

REM --- Install service ---
echo Installing EMS Collector service...
%NSSM_EXE% install %SERVICE_NAME% "%PYTHON_EXE%" "%COLLECTOR_MAIN%"

REM Display name and description
%NSSM_EXE% set %SERVICE_NAME% DisplayName "%DISPLAY_NAME%"
%NSSM_EXE% set %SERVICE_NAME% Description "%DESCRIPTION%"

REM Working directory
%NSSM_EXE% set %SERVICE_NAME% AppDirectory "%COLLECTOR_DIR%"

REM Environment variables
%NSSM_EXE% set %SERVICE_NAME% AppEnvironmentExtra "CONFIG_FILE=%CONFIG_FILE%"

REM Auto-start on boot (key for power-outage recovery)
%NSSM_EXE% set %SERVICE_NAME% Start SERVICE_AUTO_START

REM Restart policy: restart 30s after abnormal exit
%NSSM_EXE% set %SERVICE_NAME% AppExit Default Restart
%NSSM_EXE% set %SERVICE_NAME% AppRestartDelay 30000

REM stdout/stderr logging
%NSSM_EXE% set %SERVICE_NAME% AppStdout "%LOG_DIR%\collector-stdout.log"
%NSSM_EXE% set %SERVICE_NAME% AppStderr "%LOG_DIR%\collector-stderr.log"
%NSSM_EXE% set %SERVICE_NAME% AppStdoutCreationDisposition 4
%NSSM_EXE% set %SERVICE_NAME% AppStderrCreationDisposition 4

REM Log rotation (10MB)
%NSSM_EXE% set %SERVICE_NAME% AppRotateFiles 1
%NSSM_EXE% set %SERVICE_NAME% AppRotateBytes 10485760

REM Graceful shutdown
%NSSM_EXE% set %SERVICE_NAME% AppStopMethodSkip 0
%NSSM_EXE% set %SERVICE_NAME% AppKillProcessTree 1

REM --- Start service ---
echo Starting service...
%NSSM_EXE% start %SERVICE_NAME%

echo.
echo ========================================
echo  Installed: %DISPLAY_NAME%
echo ========================================
echo  Service management:
echo    Start:  nssm start %SERVICE_NAME%
echo    Stop:   nssm stop %SERVICE_NAME%
echo    Status: nssm status %SERVICE_NAME%
echo    Remove: nssm remove %SERVICE_NAME% confirm
echo    Logs:   %LOG_DIR%\
echo ========================================
echo.
echo [Power-outage recovery] Service is set to AUTO_START.
echo The collector will start automatically after Windows reboot.
echo.
pause
