#!/usr/bin/env pwsh

param(
    [switch]$Release,
    [switch]$SkipUnitTests,
    [switch]$SkipCopy
)

$ErrorActionPreference = "Stop"

$androidAppDir = Join-Path $PSScriptRoot "android-app"
$appBuildGradle = Join-Path $androidAppDir "app\build.gradle"

if (-not (Test-Path $androidAppDir)) {
    Write-Host "android-app directory not found in the repository root." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $appBuildGradle)) {
    Write-Host "Missing Android module file: $appBuildGradle" -ForegroundColor Red
    exit 1
}

$gradleText = Get-Content $appBuildGradle -Raw
$minSdkMatch = [regex]::Match($gradleText, "minSdk(?:Version)?\s+(\d+)")
if (-not $minSdkMatch.Success) {
    Write-Host "Unable to determine minSdk from android-app/app/build.gradle." -ForegroundColor Red
    exit 1
}

$minSdk = [int]$minSdkMatch.Groups[1].Value
if ($minSdk -lt 29) {
    Write-Host "The Android module must target Android 10+ (minSdk 29+). Found minSdk $minSdk." -ForegroundColor Red
    exit 1
}

$androidHome = $env:ANDROID_HOME
if (-not $androidHome) {
    $androidHome = $env:ANDROID_SDK_ROOT
}

if (-not $androidHome) {
    Write-Host "ANDROID_HOME / ANDROID_SDK_ROOT is not set. Android Studio or the Android SDK must be installed." -ForegroundColor Yellow
}

Set-Location $androidAppDir

if (-not (Test-Path "gradlew.bat")) {
    Write-Host "Gradle wrapper not found in android-app/." -ForegroundColor Red
    exit 1
}

$gradleTasks = @()
if (-not $SkipUnitTests) {
    $gradleTasks += "testDebugUnitTest"
}

$buildTask = if ($Release) { "assembleRelease" } else { "assembleDebug" }
$gradleTasks += $buildTask

Write-Host "Building the native Android client..." -ForegroundColor Cyan
Write-Host "Gradle tasks: $($gradleTasks -join ' ')" -ForegroundColor White

& .\gradlew.bat @gradleTasks --no-daemon

if ($LASTEXITCODE -ne 0) {
    Write-Host "Native Android build failed." -ForegroundColor Red
    exit 1
}

$artifactPath = if ($Release) {
    "app\build\outputs\apk\release\app-release.apk"
} else {
    "app\build\outputs\apk\debug\app-debug.apk"
}

if (-not (Test-Path $artifactPath)) {
    Write-Host "Build completed, but no APK was found at $artifactPath." -ForegroundColor Yellow
    Write-Host "Collect the produced output directly from android-app/app/build/outputs if you built an AAB instead." -ForegroundColor Yellow
    exit 0
}

$apkSize = (Get-Item $artifactPath).Length / 1MB
$apkSizeStr = "{0:N2} MB" -f $apkSize

Write-Host "Native Android build completed." -ForegroundColor Green
Write-Host "APK: $artifactPath" -ForegroundColor White
Write-Host "Size: $apkSizeStr" -ForegroundColor White

if (-not $SkipCopy) {
    $releasesDir = Join-Path $PSScriptRoot "releases\android"
    if (-not (Test-Path $releasesDir)) {
        New-Item -ItemType Directory -Path $releasesDir -Force | Out-Null
    }

    $releaseApkName = if ($Release) { "ITERasn-hub-native-release.apk" } else { "ITERasn-hub-native-debug.apk" }
    $releaseApkPath = Join-Path $releasesDir $releaseApkName

    Copy-Item $artifactPath $releaseApkPath -Force
    Write-Host "Copied APK to: $releaseApkPath" -ForegroundColor Green
}

Write-Host "This script now builds the native Android app only. It no longer rewrites WebView URLs or generates TWA/Bubblewrap output." -ForegroundColor Cyan

Set-Location $PSScriptRoot
