@echo off
:: =============================================================================
:: 탄소이음 Collector — Windows 빌드 스크립트
:: 결과: dist\TansoEum-Collector.exe
::
:: 사용법:
::   build.bat           <- 일반 빌드
::   build.bat --clean   <- 이전 빌드 캐시 삭제 후 빌드
::   build.bat --deploy  <- 빌드 후 public\downloads\ 에 자동 복사
:: =============================================================================

setlocal EnableDelayedExpansion

set SPEC=TansoEum-Collector.spec
set DIST_DIR=dist
set OUTPUT_EXE=dist\TansoEum-Collector.exe
set DEPLOY_DIR=..\public\downloads
set VENV_DIR=.venv

echo.
echo  ============================================================
echo   탄소이음 Collector - PyInstaller 빌드
echo  ============================================================
echo.

:: ── 가상환경 활성화 ──────────────────────────────────────────────────
if exist "%VENV_DIR%\Scripts\activate.bat" (
    call "%VENV_DIR%\Scripts\activate.bat"
    echo [OK] 가상환경 활성화: %VENV_DIR%
) else (
    echo [WARN] 가상환경 없음 - 시스템 Python 사용
)

:: ── Python / PyInstaller 버전 확인 ──────────────────────────────────
echo.
python --version
pyinstaller --version
echo.

:: ── 이전 빌드 정리 ──────────────────────────────────────────────────
if "%1"=="--clean" goto :clean_build
if "%2"=="--clean" goto :clean_build
goto :start_build

:clean_build
echo [*] 이전 빌드 캐시 삭제 중...
if exist build    rmdir /s /q build
if exist dist     rmdir /s /q dist
if exist __pycache__ rmdir /s /q __pycache__
echo [OK] 정리 완료
echo.

:start_build
:: ── PyInstaller 빌드 ────────────────────────────────────────────────
echo [*] PyInstaller 빌드 시작...
pyinstaller %SPEC% --clean --noconfirm

if errorlevel 1 (
    echo.
    echo [ERROR] 빌드 실패!
    echo   1. pip install -r requirements.txt 확인
    echo   2. pyinstaller 설치 확인: pip install pyinstaller
    echo   3. Python DLL 경로 확인: python -c "import sys; print(sys.prefix)"
    pause
    exit /b 1
)

:: ── 빌드 결과 확인 ──────────────────────────────────────────────────
if not exist "%OUTPUT_EXE%" (
    echo.
    echo [ERROR] EXE 파일 생성 실패: %OUTPUT_EXE%
    pause
    exit /b 1
)

for %%F in (%OUTPUT_EXE%) do set EXE_SIZE=%%~zF
set /a EXE_MB=!EXE_SIZE! / 1048576

echo.
echo  ============================================================
echo   빌드 성공!
echo   파일: %OUTPUT_EXE%
echo   크기: !EXE_MB! MB
echo  ============================================================

:: ── 배포 복사 ───────────────────────────────────────────────────────
if "%1"=="--deploy" goto :deploy
if "%2"=="--deploy" goto :deploy
goto :done

:deploy
if not exist "%DEPLOY_DIR%" mkdir "%DEPLOY_DIR%"
echo.
echo [*] 배포 복사: %OUTPUT_EXE% → %DEPLOY_DIR%\TansoEum-Collector.exe
copy /Y "%OUTPUT_EXE%" "%DEPLOY_DIR%\TansoEum-Collector.exe"
if errorlevel 1 (
    echo [ERROR] 복사 실패
    pause
    exit /b 1
)
echo [OK] 배포 완료: %DEPLOY_DIR%\TansoEum-Collector.exe

:done
echo.
echo [안내] 배포 방법:
echo   1. dist\TansoEum-Collector.exe 를 현장 PC의 C:\TansoEum\ 폴더에 복사
echo   2. config.yaml 을 같은 폴더에 배치 (게이트웨이 관리 > 수집기 다운로드)
echo   3. 백신에서 C:\TansoEum\ 폴더 검사 제외 설정
echo   4. TansoEum-Collector.exe 실행
echo.
pause