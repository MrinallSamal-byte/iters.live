@echo off
REM ITER EduHub - Enhancement Quick Setup Script
REM Run this script to set up all new enhancements

echo.
echo ========================================================
echo   ITER EduHub - Security ^& Performance Enhancement
echo   Quick Setup Script v2.0.0
echo ========================================================
echo.

REM Check if Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo [1/6] Checking Node.js version...
node --version
echo.

REM Check if npm is available
where npm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] npm is not available
    pause
    exit /b 1
)

echo [2/6] Installing new dependencies...
echo This may take a few minutes...
echo.
call npm install
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)
echo.
echo [SUCCESS] Dependencies installed successfully!
echo.

echo [3/6] Checking database configuration...
if not exist ".env" (
    echo [WARNING] .env file not found
    echo Please create .env file with your database configuration
    echo See .env.example for reference
    pause
) else (
    echo [OK] .env file found
)
echo.

echo [4/6] Database Migration Options:
echo.
echo Choose an option:
echo   1. Run automated migration (recommended)
echo   2. Show SQL to run manually
echo   3. Skip migration (I'll do it later)
echo.
set /p migration_choice="Enter your choice (1-3): "

if "%migration_choice%"=="1" (
    echo.
    echo Running automated database migration...
    echo.
    call node server/scripts/migrate-security.js
    if %ERRORLEVEL% neq 0 (
        echo [WARNING] Migration completed with warnings
        echo Please check the output above
        pause
    ) else (
        echo [SUCCESS] Migration completed successfully!
    )
) else if "%migration_choice%"=="2" (
    echo.
    echo Opening migration file...
    start notepad server\database\migrations\security-enhancements.sql
    echo.
    echo Please run the SQL commands in your MySQL client
    echo Database: iter_college_db
    pause
) else (
    echo.
    echo Skipping migration. Remember to run:
    echo   npm run migrate:security
    echo or manually execute:
    echo   server/database/migrations/security-enhancements.sql
    echo.
)

echo.
echo [5/6] Creating required directories...
if not exist "logs" mkdir logs
if not exist "uploads" mkdir uploads
if not exist "uploads\notes" mkdir uploads\notes
if not exist "uploads\pyqs" mkdir uploads\pyqs
if not exist "uploads\assignments" mkdir uploads\assignments
if not exist "uploads\profiles" mkdir uploads\profiles
echo [OK] Directories created
echo.

echo [6/6] Environment Configuration Check...
echo.
echo Checking required environment variables...

REM Basic validation
findstr /C:"JWT_SECRET" .env >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [!] JWT_SECRET not found in .env
) else (
    echo [OK] JWT_SECRET configured
)

findstr /C:"DB_NAME" .env >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [!] Database configuration incomplete
) else (
    echo [OK] Database configured
)

echo.
echo ========================================================
echo   Setup Complete!
echo ========================================================
echo.
echo New Features Added:
echo   [*] Advanced Security (Rate Limiting, Audit Logs)
echo   [*] Notification Center (Real-time Updates)
echo   [*] Global Search Engine
echo   [*] Performance Caching
echo   [*] Input Validation
echo.
echo New API Endpoints:
echo   - GET  /api/notifications
echo   - GET  /api/search?q=query
echo   - GET  /api/notifications/unread-count
echo.
echo Next Steps:
echo   1. Update .env with new configuration (see guide)
echo   2. Start server: npm run dev
echo   3. Visit: http://localhost:5000
echo   4. Check notifications: http://localhost:5000/api/notifications
echo   5. Test search: http://localhost:5000/api/search?q=test
echo.
echo Documentation:
echo   - Installation Guide: ENHANCEMENT_INSTALLATION_GUIDE.md
echo   - Feature Summary: ENHANCEMENT_SUMMARY.md
echo.
echo ========================================================
echo.

set /p start_server="Do you want to start the development server now? (y/n): "
if /i "%start_server%"=="y" (
    echo.
    echo Starting development server...
    echo Press Ctrl+C to stop the server
    echo.
    call npm run dev
) else (
    echo.
    echo To start the server later, run: npm run dev
    echo.
)

pause
