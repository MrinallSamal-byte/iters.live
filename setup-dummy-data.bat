@echo off
SETLOCAL EnableDelayedExpansion

REM Comprehensive Dummy Data Setup Script for Windows
REM This script sets up the complete database with realistic dummy data

echo ======================================================
echo   ITER College Management System
echo   Comprehensive Dummy Data Setup
echo ======================================================
echo.

REM Check if node is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

REM Check if npm is installed
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm is not installed. Please install npm first.
    pause
    exit /b 1
)

echo [INFO] Installing dependencies...
call npm install

echo.
echo [INFO] Setting up database with comprehensive dummy data...
echo.
echo [WARNING] This will create:
echo   - 3 Admin accounts
echo   - 50 Teacher accounts
echo   - 500 Student accounts
echo   - 150,000+ attendance records
echo   - 100,000+ marks records
echo   - Complete timetables, events, clubs
echo   - Notes, assignments, announcements
echo   - And much more!
echo.

set /p CONFIRM="Continue? (Y/N): "
if /i not "%CONFIRM%"=="Y" (
    echo Setup cancelled.
    pause
    exit /b 0
)

echo.
echo [INFO] Running comprehensive seed...
call npm run seed:comprehensive

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [SUCCESS] Database populated with realistic dummy data!
    echo.
    echo ======================================================
    echo   SUCCESS! Setup Complete!
    echo ======================================================
    echo.
    echo Demo Credentials:
    echo.
    echo Student:
    echo   Registration: STU20250001
    echo   Password: Student@123
    echo.
    echo Teacher:
    echo   Registration: TCH2025001
    echo   Password: Teacher@123
    echo.
    echo Admin:
    echo   Registration: ADM2025001
    echo   Password: Admin@123456
    echo.
    echo ======================================================
    echo Ready to go! Start the server with: npm start
    echo ======================================================
) else (
    echo.
    echo [ERROR] Setup failed. Please check the error messages above.
    pause
    exit /b 1
)

echo.
pause
