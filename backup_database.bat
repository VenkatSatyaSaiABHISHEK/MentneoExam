@echo off
title ExamS - Database Backup Tool
echo ============================================================
echo ExamS Database Backup Utility (PostgreSQL 17)
echo ============================================================

REM Create backups directory if it does not exist
if not exist "%~dp0backups" mkdir "%~dp0backups"

REM Format current timestamp (YYYY-MM-DD_HH-MM-SS)
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set TIMESTAMP=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%_%datetime:~8,2%-%datetime:~10,2%-%datetime:~12,2%
set BACKUP_FILE=%~dp0backups\exams_db_%TIMESTAMP%.sql

echo Backing up database 'exams_db' to:
echo %BACKUP_FILE%
echo.

set PGPASSWORD=postgres
"C:\Users\Abhishek\pgsql\bin\pg_dump.exe" -U postgres -h localhost -p 5432 exams_db > "%BACKUP_FILE%"

if "%ERRORLEVEL%"=="0" (
    echo ============================================================
    echo SUCCESS: Database backup created successfully!
    echo File: %BACKUP_FILE%
    echo ============================================================
) else (
    echo ============================================================
    echo ERROR: Failed to create database backup.
    echo Ensure PostgreSQL 17 is running on port 5432.
    echo ============================================================
)

echo.
pause

