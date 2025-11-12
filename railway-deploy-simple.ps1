# Railway Backend Deployment - Simple Guide

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host " Railway Backend Deployment Helper" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "STEP 1: Open Railway Dashboard" -ForegroundColor Yellow
Write-Host "URL: https://railway.app/dashboard" -ForegroundColor White
Write-Host ""

$open = Read-Host "Open Railway Dashboard now? (y/n)"
if ($open -eq "y") {
    Start-Process "https://railway.app/dashboard"
    Write-Host "✅ Opened Railway Dashboard" -ForegroundColor Green
}

Write-Host ""
Write-Host "STEP 2: Create New Project" -ForegroundColor Yellow
Write-Host "1. Click 'New Project'" -ForegroundColor White
Write-Host "2. Select 'Deploy from GitHub repo'" -ForegroundColor White
Write-Host "3. Choose: ITER_Live repository" -ForegroundColor White
Write-Host "4. Railway will detect Node.js automatically" -ForegroundColor White
Write-Host ""

Read-Host "Press Enter when project is created..."

Write-Host ""
Write-Host "STEP 3: Add Environment Variables" -ForegroundColor Yellow
Write-Host "Go to: Project Settings -> Variables" -ForegroundColor White
Write-Host ""
Write-Host "Copy-paste each variable below:" -ForegroundColor White
Write-Host ""

Write-Host "DB_HOST" -ForegroundColor Cyan
Write-Host "mysql.railway.internal" -ForegroundColor White
Write-Host ""
Write-Host "DB_PORT" -ForegroundColor Cyan
Write-Host "3306" -ForegroundColor White
Write-Host ""
Write-Host "DB_USER" -ForegroundColor Cyan
Write-Host "root" -ForegroundColor White
Write-Host ""
Write-Host "DB_PASSWORD" -ForegroundColor Cyan
Write-Host "NlEpRBhwEHsSHrDWEEfahDOMcEzfIdLh" -ForegroundColor White
Write-Host ""
Write-Host "DB_NAME" -ForegroundColor Cyan
Write-Host "railway" -ForegroundColor White
Write-Host ""
Write-Host "JWT_SECRET" -ForegroundColor Cyan
Write-Host "prod-jwt-secret-change-this-in-production-8f4b2c9d1e7a3f6b" -ForegroundColor White
Write-Host ""
Write-Host "JWT_REFRESH_SECRET" -ForegroundColor Cyan
Write-Host "prod-refresh-secret-change-this-in-production-3e7c1f9b4d2a" -ForegroundColor White
Write-Host ""
Write-Host "JWT_EXPIRE" -ForegroundColor Cyan
Write-Host "1h" -ForegroundColor White
Write-Host ""
Write-Host "JWT_REFRESH_EXPIRE" -ForegroundColor Cyan
Write-Host "7d" -ForegroundColor White
Write-Host ""
Write-Host "NODE_ENV" -ForegroundColor Cyan
Write-Host "production" -ForegroundColor White
Write-Host ""
Write-Host "PORT" -ForegroundColor Cyan
Write-Host "5000" -ForegroundColor White
Write-Host ""
Write-Host "CLIENT_URL" -ForegroundColor Cyan
Write-Host "https://iter-college-management.vercel.app" -ForegroundColor White
Write-Host ""

Read-Host "Press Enter when all variables are added..."

Write-Host ""
Write-Host "STEP 4: Wait for Deployment" -ForegroundColor Yellow
Write-Host "Railway will automatically build and deploy" -ForegroundColor White
Write-Host "This takes about 2-3 minutes" -ForegroundColor White
Write-Host ""

Read-Host "Press Enter when deployment is complete..."

Write-Host ""
Write-Host "STEP 5: Get Railway URL" -ForegroundColor Yellow
Write-Host "In Railway dashboard, find your deployment URL" -ForegroundColor White
Write-Host "Example: https://iter-live-production.up.railway.app" -ForegroundColor Gray
Write-Host ""

$railwayUrl = Read-Host "Enter your Railway URL (or press Enter to skip)"

if ($railwayUrl) {
    Write-Host ""
    Write-Host "Testing Railway backend..." -ForegroundColor Cyan
    try {
        $response = Invoke-WebRequest -Uri "$railwayUrl/api/health" -TimeoutSec 10
        Write-Host "✅ Backend is working!" -ForegroundColor Green
        Write-Host "Response: $($response.Content)" -ForegroundColor Gray
        
        Write-Host ""
        Write-Host "Next step: Update frontend API URLs" -ForegroundColor Yellow
        Write-Host "Run: .\update-api-urls.ps1 -RailwayUrl '$railwayUrl'" -ForegroundColor Cyan
    } catch {
        Write-Host "⚠️  Could not reach backend yet" -ForegroundColor Yellow
        Write-Host "Wait a minute and try: $railwayUrl/api/health" -ForegroundColor White
    }
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host " Deployment Complete!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "What's Next:" -ForegroundColor Yellow
Write-Host "1. Test: YOUR-RAILWAY-URL/api/health" -ForegroundColor White
Write-Host "2. Update frontend: .\update-api-urls.ps1" -ForegroundColor White
Write-Host "3. Deploy Vercel: vercel --prod" -ForegroundColor White
Write-Host ""
