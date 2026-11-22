@echo off
title ExamS Server - Graceful Shutdown
echo ============================================================
echo Stopping ExamS Engine and Background Services
echo ============================================================

cd /d "%~dp0"
if not exist "package.json" (
    cd /d "E:\project\ExamS"
)

REM 1. Stop Cloudflare Tunnel
echo [1/3] Stopping Cloudflare Tunnel...
taskkill /F /IM cloudflared.exe >nul 2>&1
if "%ERRORLEVEL%"=="0" (
    echo       Cloudflare Tunnel stopped.
) else (
    echo       Cloudflare Tunnel was not running.
)

REM 2. Stop Node.js processes on port 3000
echo [2/3] Stopping Node.js server on port 3000...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
echo       Port 3000 freed.

REM 3. Stop PostgreSQL 17 Gracefully
echo [3/3] Stopping PostgreSQL 17...
"C:\Users\Abhishek\pgsql\bin\pg_ctl.exe" stop -D "C:\Users\Abhishek\pgsql\data" -m fast >nul 2>&1
tasklist /FI "IMAGENAME eq postgres.exe" 2>NUL | find /I /N "postgres.exe">NUL
if "%ERRORLEVEL%"=="0" (
    taskkill /F /IM postgres.exe >nul 2>&1
)
echo       PostgreSQL 17 stopped.

echo.
echo ============================================================
echo All ExamS services have been cleanly shut down.
echo You can restart anytime using Start_ExamS_Server.bat.
echo ============================================================
pause
