@echo off
echo ========================================
echo   ITER EduHub Enhancement Setup
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo [1/5] Node.js found: 
node --version
echo.

REM Check if npm is available
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm is not installed!
    pause
    exit /b 1
)

echo [2/5] npm found:
npm --version
echo.

REM Install dependencies
echo [3/5] Installing dependencies...
echo This may take a few minutes...
echo.
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install dependencies!
    pause
    exit /b 1
)

echo.
echo [SUCCESS] Dependencies installed successfully!
echo.

REM Check if .env file exists
if not exist .env (
    echo [4/5] Creating .env file from template...
    copy .env.example .env >nul 2>nul
    if %ERRORLEVEL% NEQ 0 (
        echo [WARNING] No .env.example found. Please create .env manually.
    ) else (
        echo [SUCCESS] .env file created!
    )
) else (
    echo [4/5] .env file already exists
)
echo.

REM Create uploads directory if it doesn't exist
if not exist uploads (
    echo [5/5] Creating uploads directory...
    mkdir uploads
    mkdir uploads\assignments
    mkdir uploads\profiles
    mkdir uploads\documents
    echo [SUCCESS] Upload directories created!
) else (
    echo [5/5] Upload directories already exist
)
echo.

echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo Next steps:
echo.
echo 1. Configure your .env file:
echo    - Set DB_PASSWORD to your MySQL password
echo    - Add OPENAI_API_KEY for AI features
echo.
echo 2. Run database migration:
echo    mysql -u root -p iter_college_db ^< server/database/migrations/ai-features.sql
echo.
echo 3. Start the server:
echo    npm run dev
echo.
echo 4. Open your browser:
echo    http://localhost:5000
echo.
echo ========================================
echo   Enhanced Features Installed:
echo ========================================
echo [*] Advanced Animations System
echo [*] AI-Powered Study Assistant
echo [*] Mobile-First Navigation
echo [*] Enhanced UI/UX Components
echo [*] Real-time Updates Ready
echo [*] Analytics Infrastructure
echo.
echo For documentation, see:
echo ENHANCEMENT_IMPLEMENTATION.md
echo.
pause
