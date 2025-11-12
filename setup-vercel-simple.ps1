# Vercel Environment Variables Setup
# Run this script to get all variables formatted for easy copy-paste

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "   Vercel Environment Setup Guide" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "INSTRUCTIONS:" -ForegroundColor Yellow
Write-Host "1. Go to: https://vercel.com/dashboard" -ForegroundColor White
Write-Host "2. Select project: iter-college-management" -ForegroundColor White
Write-Host "3. Go to: Settings -> Environment Variables" -ForegroundColor White
Write-Host "4. Copy-paste each variable below" -ForegroundColor White
Write-Host ""

Write-Host "======================================" -ForegroundColor Green
Write-Host "DATABASE CONFIGURATION (5 variables)" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
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

Write-Host "======================================" -ForegroundColor Green
Write-Host "SECURITY CONFIGURATION (4 variables)" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
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

Write-Host "======================================" -ForegroundColor Green
Write-Host "APPLICATION CONFIG (7 variables)" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
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
Write-Host "CORS_WHITELIST" -ForegroundColor Cyan
Write-Host "https://iter-college-management.vercel.app" -ForegroundColor White
Write-Host ""
Write-Host "RATE_LIMIT_WINDOW_MS" -ForegroundColor Cyan
Write-Host "900000" -ForegroundColor White
Write-Host ""
Write-Host "RATE_LIMIT_MAX_REQUESTS" -ForegroundColor Cyan
Write-Host "100" -ForegroundColor White
Write-Host ""

Write-Host "======================================" -ForegroundColor Yellow
Write-Host "IMPORTANT: Total 16 variables" -ForegroundColor Yellow
Write-Host "======================================" -ForegroundColor Yellow
Write-Host ""

$response = Read-Host "Have you added all variables in Vercel Dashboard? (y/n)"

if ($response -eq "y" -or $response -eq "Y") {
    Write-Host ""
    Write-Host "Redeploying to Vercel..." -ForegroundColor Cyan
    vercel --prod
    
    Write-Host ""
    Write-Host "Waiting 30 seconds for deployment..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30
    
    Write-Host ""
    Write-Host "Testing deployment..." -ForegroundColor Green
    node test-vercel-deployment.js
} else {
    Write-Host ""
    Write-Host "After adding variables, run these commands:" -ForegroundColor Yellow
    Write-Host "  vercel --prod" -ForegroundColor White
    Write-Host "  node test-vercel-deployment.js" -ForegroundColor White
    Write-Host ""
}
