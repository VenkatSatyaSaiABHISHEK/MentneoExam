@echo off
title ExamS - Database Restore Tool
echo ============================================================
echo ExamS Database Restore Utility (PostgreSQL 17)
echo ============================================================
echo.
echo Available backups in \backups:
dir /b /o-d "%~dp0backups\*.sql"
echo.
echo ============================================================
echo WARNING: Restoring will overwrite existing data with the backup.
echo ============================================================
set /p BACKUP_NAME="Enter backup filename (e.g., exams_db_2026-11-21.sql): "

if not exist "%~dp0backups\%BACKUP_NAME%" (
    echo.
    echo ERROR: File not found in backups directory: %BACKUP_NAME%
    pause
    exit /b 1
)

set PGPASSWORD=postgres
echo.
echo Restoring %BACKUP_NAME% into exams_db...
"C:\Users\Abhishek\pgsql\bin\psql.exe" -U postgres -h localhost -p 5432 -d exams_db -f "%~dp0backups\%BACKUP_NAME%"

if "%ERRORLEVEL%"=="0" (
    echo.
    echo ============================================================
    echo SUCCESS: Database restored successfully from %BACKUP_NAME%!
    echo ============================================================
) else (
    echo.
    echo ERROR: Restore encountered issues. Check PostgreSQL status.
)

echo.
pause

