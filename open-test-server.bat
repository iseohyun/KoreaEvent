@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

cd /d "%~dp0"

echo ===============================================================
echo   KoreaEvent 로컬 테스트 서버 실행기 (Auto Port Finder)
echo ===============================================================
echo.

:: 1. 패키지 설치 여부 확인
if exist "node_modules\" goto :INIT_PORT
echo [초기화] node_modules 폴더가 없어 패키지 설치를 먼저 진행합니다...
call npm.cmd install
if errorlevel 1 (
    echo [오류] npm install 실행에 실패했습니다.
    pause
    exit /b 1
)
echo.

:INIT_PORT
:: 2. 기본 시작 포트 설정 (인자가 있으면 첫 번째 인자 사용, 없으면 5173)
set "PORT=5173"
if not "%~1"=="" set "PORT=%~1"

echo [포트 점검] 시작 포트 %PORT%번부터 사용 가능한 포트를 탐색합니다...

:CHECK_PORT
:: netstat으로 해당 포트가 LISTENING 상태인지 확인
netstat -ano | findstr /R /C:":!PORT! .*LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo   - 포트 !PORT!번이 이미 사용 중입니다. 다음 포트를 탐색합니다...
    set /a PORT+=1
    goto :CHECK_PORT
)

echo [포트 확정] 사용 가능한 빈 포트 !PORT!번을 찾았습니다!
echo [서버 시작] http://localhost:!PORT! 주소로 테스트 서버 및 브라우저를 엽니다...
echo ===============================================================
echo.

:: 3. 찾은 빈 포트로 Vite 개발 서버 실행 및 브라우저 자동 열기 (--open)
call npm.cmd run dev -- --port !PORT! --open

endlocal
pause
