@echo off
title ExamS Server - Laptop Host
echo ============================================================
echo Starting ExamS Local Server Engine
echo ============================================================

REM Always ensure we run from the project root directory
cd /d "%~dp0"
if not exist "package.json" (
    cd /d "E:\project\ExamS"
)

REM 1. Check if Primary Raspberry Pi Node (192.168.29.130) is online
powershell -NoProfile -Command "$t = Test-Connection -ComputerName 192.168.29.130 -Count 1 -Quiet; exit ($t ? 0 : 1)"
if "%ERRORLEVEL%"=="0" (
    echo [Cluster Mode] Raspberry Pi 4 (192.168.29.130) is ONLINE!
    echo Connecting laptop server directly to Raspberry Pi master database.
    echo Both machines will share identical database state simultaneously.
    set "DATABASE_URL=postgresql://postgres:postgres@192.168.29.130:5432/exams_db"
    goto cluster_ready
)

echo [Failover Mode] Raspberry Pi 4 is unreachable (Power cut or network drop).
echo Falling back to Laptop Local PostgreSQL 17...

REM Verify and start Local PostgreSQL 17
"C:\Users\Abhishek\pgsql\bin\pg_isready.exe" -h 127.0.0.1 -p 5432 >nul 2>&1
if "%ERRORLEVEL%"=="0" (
    echo [1/3] Local PostgreSQL 17 is active and accepting connections.
    goto pg_done
)

echo [1/3] Starting Local PostgreSQL 17 engine...
taskkill /F /IM postgres.exe >nul 2>&1
if exist "C:\Users\Abhishek\pgsql\data\postmaster.pid" del /f /q "C:\Users\Abhishek\pgsql\data\postmaster.pid" >nul 2>&1
start /b "" "C:\Users\Abhishek\pgsql\bin\postgres.exe" -D "C:\Users\Abhishek\pgsql\data" > "E:\project\ExamS\pgsql.log" 2>&1

set /a PG_RETRIES=0
:pg_wait_loop
timeout /t 1 /nobreak >nul
"C:\Users\Abhishek\pgsql\bin\pg_isready.exe" -h 127.0.0.1 -p 5432 >nul 2>&1
if "%ERRORLEVEL%"=="0" goto pg_ready
set /a PG_RETRIES+=1
if %PG_RETRIES% lss 10 goto pg_wait_loop

:pg_ready
echo [1/3] Local PostgreSQL 17 is ready.
:pg_done

REM Start local Cloudflare Tunnel failover
tasklist /FI "IMAGENAME eq cloudflared.exe" 2>NUL | find /I /N "cloudflared.exe">NUL
if not "%ERRORLEVEL%"=="0" (
    echo [2/3] Starting Cloudflare Tunnel failover on laptop...
    start /b "" "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel run --token eyJhIjoiZWQzYTVjYmY4YjBmMGMwYTk4ZGFhY2E3OTg0MGQwZjkiLCJ0IjoiZjFmYjJkZmMtYmNhMS00ZjgzLWJmM2YtMTAxY2MyMjQ5ZTcwIiwicyI6IllUVXlNREl3WVdFdFl6a3lOeTAwTVdZNExXRTRaRGt0TmpJMk5URmlaVGRrWlRoaSJ9 > "E:\project\ExamS\cloudflared.log" 2>&1
    timeout /t 2 /nobreak >nul
)

:cluster_ready
REM Ensure port 3000 is free before starting Next.js
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

REM Start Next.js Production Server
echo [3/3] Starting Next.js Production Server on port 3000...
echo.
echo ============================================================
echo ExamS is LIVE!
echo Public URL : https://exam.inducodes.tech
echo Local URL  : http://localhost:3000
echo Admin PIN  : 31012005
echo ============================================================
echo Keep this window open while conducting exams.
echo Run Stop_ExamS_Server.bat to stop all background services.
echo.

npm start
