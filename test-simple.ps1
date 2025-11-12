# Simple Test Script for ITER EduHub
Write-Host "ITER EduHub - System Test" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan

$baseUrl = "http://localhost:5000"

Write-Host "`nTesting Server Health..." -ForegroundColor Yellow
try {
    $health = Invoke-WebRequest -Uri "$baseUrl/health" -UseBasicParsing
    Write-Host "Server Health: OK" -ForegroundColor Green
} catch {
    Write-Host "Server Health: FAILED" -ForegroundColor Red
    exit 1
}

Write-Host "`nTesting Pages..." -ForegroundColor Yellow
$pages = @(
    "/",
    "/login.html",
    "/register.html",
    "/dashboard/student.html",
    "/dashboard/teacher.html",
    "/dashboard/admin.html"
)

foreach ($page in $pages) {
    try {
        $response = Invoke-WebRequest -Uri "$baseUrl$page" -UseBasicParsing
        Write-Host "  $page - OK" -ForegroundColor Green
    } catch {
        Write-Host "  $page - FAILED" -ForegroundColor Red
    }
}

Write-Host "`nTesting Assets..." -ForegroundColor Yellow
$assets = @(
    "/css/style.css",
    "/js/main.js",
    "/assets/logo.svg",
    "/manifest.json"
)

foreach ($asset in $assets) {
    try {
        $response = Invoke-WebRequest -Uri "$baseUrl$asset" -UseBasicParsing
        Write-Host "  $asset - OK" -ForegroundColor Green
    } catch {
        Write-Host "  $asset - FAILED" -ForegroundColor Red
    }
}

Write-Host "`nTest Complete!" -ForegroundColor Cyan
Write-Host "`nManual Testing Required:" -ForegroundColor Yellow
Write-Host "1. Open http://localhost:5000 in browser" -ForegroundColor White
Write-Host "2. Test registration and login" -ForegroundColor White
Write-Host "3. Verify dashboards load correctly" -ForegroundColor White
Write-Host "4. Check browser console for errors (F12)" -ForegroundColor White
