#!/usr/bin/env pwsh
# Build Android APK for ITER EduHub
# This script automates the Android app build process

param(
    [switch]$Release,
    [switch]$Debug,
    [string]$WebsiteUrl = "https://your-domain.com"
)

$ErrorActionPreference = "Stop"

Write-Host "🤖 ITER EduHub - Android Build Script" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
$androidAppDir = Join-Path $PSScriptRoot "android-app"
if (-not (Test-Path $androidAppDir)) {
    Write-Host "❌ Error: android-app directory not found!" -ForegroundColor Red
    Write-Host "Please run this script from the project root." -ForegroundColor Yellow
    exit 1
}

# Check for Android Studio / SDK
$androidHome = $env:ANDROID_HOME
if (-not $androidHome) {
    $androidHome = $env:ANDROID_SDK_ROOT
}

if (-not $androidHome) {
    Write-Host "⚠️  Warning: ANDROID_HOME not set" -ForegroundColor Yellow
    Write-Host "Please install Android Studio or set ANDROID_HOME environment variable" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Download Android Studio: https://developer.android.com/studio" -ForegroundColor Cyan
    
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne "y") {
        exit 1
    }
}

# Update website URL in MainActivity.java
Write-Host "📝 Updating website URL to: $WebsiteUrl" -ForegroundColor Green
$mainActivityPath = Join-Path $androidAppDir "app\src\main\java\edu\iter\eduhub\MainActivity.java"

if (Test-Path $mainActivityPath) {
    $content = Get-Content $mainActivityPath -Raw
    $content = $content -replace 'private static final String WEBSITE_URL = ".*";', "private static final String WEBSITE_URL = `"$WebsiteUrl`";"
    Set-Content -Path $mainActivityPath -Value $content
    Write-Host "✓ Website URL updated" -ForegroundColor Green
} else {
    Write-Host "⚠️  MainActivity.java not found, skipping URL update" -ForegroundColor Yellow
}

# Navigate to android-app directory
Set-Location $androidAppDir

# Check for Gradle wrapper
if (-not (Test-Path "gradlew.bat")) {
    Write-Host "❌ Error: Gradle wrapper not found!" -ForegroundColor Red
    Write-Host "Please open the project in Android Studio first to initialize Gradle." -ForegroundColor Yellow
    exit 1
}

# Determine build type
$buildType = "Debug"
if ($Release) {
    $buildType = "Release"
    Write-Host "🔨 Building RELEASE APK..." -ForegroundColor Yellow
} else {
    Write-Host "🔨 Building DEBUG APK..." -ForegroundColor Yellow
}

Write-Host ""

# Clean previous builds
Write-Host "🧹 Cleaning previous builds..." -ForegroundColor Cyan
& .\gradlew.bat clean

# Build APK
Write-Host ""
Write-Host "⚙️  Building APK (this may take a few minutes)..." -ForegroundColor Cyan
Write-Host ""

if ($Release) {
    & .\gradlew.bat assembleRelease
} else {
    & .\gradlew.bat assembleDebug
}

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

# Find the APK
$apkPath = ""
if ($Release) {
    $apkPath = "app\build\outputs\apk\release\app-release-unsigned.apk"
    if (Test-Path "app\build\outputs\apk\release\app-release.apk") {
        $apkPath = "app\build\outputs\apk\release\app-release.apk"
    }
} else {
    $apkPath = "app\build\outputs\apk\debug\app-debug.apk"
}

if (-not (Test-Path $apkPath)) {
    Write-Host ""
    Write-Host "❌ APK not found at expected location!" -ForegroundColor Red
    exit 1
}

# Get APK size
$apkSize = (Get-Item $apkPath).Length / 1MB
$apkSizeStr = "{0:N2} MB" -f $apkSize

Write-Host ""
Write-Host "✅ Build successful!" -ForegroundColor Green
Write-Host ""
Write-Host "📦 APK Details:" -ForegroundColor Cyan
Write-Host "   Location: $apkPath" -ForegroundColor White
Write-Host "   Size: $apkSizeStr" -ForegroundColor White
Write-Host "   Type: $buildType" -ForegroundColor White
Write-Host ""

# Copy to releases folder
$releasesDir = Join-Path $PSScriptRoot "releases"
if (-not (Test-Path $releasesDir)) {
    New-Item -ItemType Directory -Path $releasesDir | Out-Null
}

$releaseApkName = "ITER-EduHub-v1.0.0-$buildType.apk"
$releaseApkPath = Join-Path $releasesDir $releaseApkName

Copy-Item $apkPath $releaseApkPath -Force
Write-Host "📋 Copied to: $releaseApkPath" -ForegroundColor Green

# Installation instructions
Write-Host ""
Write-Host "📱 Installation Instructions:" -ForegroundColor Cyan
Write-Host ""
Write-Host "Method 1 - USB Installation:" -ForegroundColor Yellow
Write-Host "   1. Connect Android device via USB" -ForegroundColor White
Write-Host "   2. Enable USB Debugging in Developer Options" -ForegroundColor White
Write-Host "   3. Run: adb install `"$releaseApkPath`"" -ForegroundColor White
Write-Host ""
Write-Host "Method 2 - Direct Installation:" -ForegroundColor Yellow
Write-Host "   1. Transfer APK to your Android device" -ForegroundColor White
Write-Host "   2. Open the APK file on device" -ForegroundColor White
Write-Host "   3. Tap 'Install' (may need to enable 'Unknown Sources')" -ForegroundColor White
Write-Host ""

# Offer to install via ADB
if (Get-Command adb -ErrorAction SilentlyContinue) {
    $devices = & adb devices | Select-Object -Skip 1 | Where-Object { $_ -match "device$" }
    
    if ($devices) {
        Write-Host "🔌 Android device detected!" -ForegroundColor Green
        $install = Read-Host "Install APK now? (y/n)"
        
        if ($install -eq "y") {
            Write-Host ""
            Write-Host "📲 Installing APK..." -ForegroundColor Cyan
            & adb install -r $releaseApkPath
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ Installation successful!" -ForegroundColor Green
                Write-Host "The app should now appear on your device." -ForegroundColor Green
            } else {
                Write-Host "❌ Installation failed!" -ForegroundColor Red
            }
        }
    }
}

Write-Host ""
Write-Host "✅ All done!" -ForegroundColor Green
Write-Host ""

# Return to original directory
Set-Location $PSScriptRoot
