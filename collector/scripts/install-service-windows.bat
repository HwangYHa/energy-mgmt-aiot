@echo off
REM =============================================================================
REM EMS AIoT 수집기 — Windows NSSM 서비스 설치 스크립트
REM
REM 필요 조건:
REM   - NSSM (Non-Sucking Service Manager) 설치
REM     다운로드: https://nssm.cc/download
REM     또는: winget install nssm
REM   - Python 3.10+ 설치 (또는 dist/collector.exe 빌드본 사용)
REM   - 관리자 권한으로 실행
REM
REM 정전 대비 효과:
REM   - 서버 재부팅 시 자동 시작 (Start=SERVICE_AUTO_START)
REM   - 비정상 종료 시 30초 후 자동 재시작
REM   - Windows 이벤트 로그에 stdout/stderr 기록
REM =============================================================================

setlocal enabledelayedexpansion

REM --- 설정 (환경에 맞게 수정) ---
set SERVICE_NAME=EmsCollector
set DISPLAY_NAME=EMS AIoT 수집기
set DESCRIPTION=탄소이음 EMS AIoT 데이터 수집 에이전트 - 정전 후 자동 복구
set NSSM_EXE=nssm

REM 수집기 경로 (설치 위치에 맞게 수정)
set COLLECTOR_DIR=C:\EmsCollector
set PYTHON_EXE=%COLLECTOR_DIR%\venv\Scripts\python.exe
set COLLECTOR_MAIN=%COLLECTOR_DIR%\src\main.py
set CONFIG_FILE=%COLLECTOR_DIR%\config\config.yaml
set LOG_DIR=%COLLECTOR_DIR%\logs

REM 빌드된 exe 사용 시 아래 주석 해제
REM set APP_EXE=%COLLECTOR_DIR%\dist\collector.exe
REM set APP_ARGS=

REM --- 관리자 권한 확인 ---
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [오류] 관리자 권한으로 실행해주세요.
    echo 파일을 우클릭 후 "관리자 권한으로 실행" 선택
    pause
    exit /b 1
)

REM --- NSSM 존재 확인 ---
where %NSSM_EXE% >nul 2>&1
if %errorLevel% neq 0 (
    echo [오류] NSSM을 찾을 수 없습니다.
    echo 설치 방법:
    echo   1. https://nssm.cc/download 에서 다운로드
    echo   2. nssm.exe를 C:\Windows\System32\ 에 복사
    echo   또는: winget install nssm
    pause
    exit /b 1
)

REM --- 로그 디렉토리 생성 ---
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

REM --- 기존 서비스 제거 ---
%NSSM_EXE% status %SERVICE_NAME% >nul 2>&1
if %errorLevel% equ 0 (
    echo 기존 서비스 제거 중...
    %NSSM_EXE% stop %SERVICE_NAME% >nul 2>&1
    %NSSM_EXE% remove %SERVICE_NAME% confirm
)

REM --- 서비스 설치 ---
echo EMS 수집기 서비스 설치 중...
%NSSM_EXE% install %SERVICE_NAME% "%PYTHON_EXE%" "%COLLECTOR_MAIN%"

REM 서비스 표시 정보
%NSSM_EXE% set %SERVICE_NAME% DisplayName "%DISPLAY_NAME%"
%NSSM_EXE% set %SERVICE_NAME% Description "%DESCRIPTION%"

REM 작업 디렉토리
%NSSM_EXE% set %SERVICE_NAME% AppDirectory "%COLLECTOR_DIR%"

REM 환경변수
%NSSM_EXE% set %SERVICE_NAME% AppEnvironmentExtra "CONFIG_FILE=%CONFIG_FILE%"

REM 자동 시작 (정전 복구 핵심)
%NSSM_EXE% set %SERVICE_NAME% Start SERVICE_AUTO_START

REM 재시작 정책 (비정상 종료 시 30초 후 재시작)
%NSSM_EXE% set %SERVICE_NAME% AppExit Default Restart
%NSSM_EXE% set %SERVICE_NAME% AppRestartDelay 30000

REM stdout/stderr 로그
%NSSM_EXE% set %SERVICE_NAME% AppStdout "%LOG_DIR%\collector-stdout.log"
%NSSM_EXE% set %SERVICE_NAME% AppStderr "%LOG_DIR%\collector-stderr.log"
%NSSM_EXE% set %SERVICE_NAME% AppStdoutCreationDisposition 4
%NSSM_EXE% set %SERVICE_NAME% AppStderrCreationDisposition 4

REM 로그 로테이션 (10MB)
%NSSM_EXE% set %SERVICE_NAME% AppRotateFiles 1
%NSSM_EXE% set %SERVICE_NAME% AppRotateBytes 10485760

REM 종료 대기 (graceful shutdown)
%NSSM_EXE% set %SERVICE_NAME% AppStopMethodSkip 0
%NSSM_EXE% set %SERVICE_NAME% AppKillProcessTree 1

REM --- 서비스 시작 ---
echo 서비스 시작 중...
%NSSM_EXE% start %SERVICE_NAME%

echo.
echo ========================================
echo 설치 완료: %DISPLAY_NAME%
echo ========================================
echo 서비스 관리:
echo   시작: nssm start %SERVICE_NAME%
echo   중지: nssm stop %SERVICE_NAME%
echo   상태: nssm status %SERVICE_NAME%
echo   제거: nssm remove %SERVICE_NAME% confirm
echo   로그: %LOG_DIR%\
echo ========================================
echo.
echo [정전 대비] 서비스가 자동 시작으로 설정되었습니다.
echo Windows 재부팅 후 자동으로 수집기가 시작됩니다.
echo.
pause
