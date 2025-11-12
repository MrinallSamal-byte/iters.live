@echo off
REM Build Android APK for ITER EduHub

echo ========================================
echo   ITER EduHub - Android Build Script
echo ========================================
echo.

REM Check if android-app directory exists
if not exist "android-app" (
    echo ERROR: android-app directory not found!
    echo Please run this script from the project root.
    pause
    exit /b 1
)

REM Check for ANDROID_HOME
if "%ANDROID_HOME%"=="" (
    if "%ANDROID_SDK_ROOT%"=="" (
        echo WARNING: ANDROID_HOME not set
        echo Please install Android Studio or set ANDROID_HOME environment variable
        echo.
        echo Download: https://developer.android.com/studio
        echo.
        set /p continue="Continue anyway? (y/n): "
        if /i not "%continue%"=="y" exit /b 1
    )
)

cd android-app

REM Check for Gradle wrapper
if not exist "gradlew.bat" (
    echo ERROR: Gradle wrapper not found!
    echo Please open the project in Android Studio first.
    pause
    exit /b 1
)

echo Building Debug APK...
echo.

REM Clean
call gradlew.bat clean

REM Build
call gradlew.bat assembleDebug

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Build failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo   BUILD SUCCESSFUL!
echo ========================================
echo.
echo APK Location: app\build\outputs\apk\debug\app-debug.apk
echo.

REM Copy to releases
if not exist "..\releases" mkdir "..\releases"
copy "app\build\outputs\apk\debug\app-debug.apk" "..\releases\ITER-EduHub-v1.0.0-Debug.apk"

echo.
echo Copied to: releases\ITER-EduHub-v1.0.0-Debug.apk
echo.

pause
