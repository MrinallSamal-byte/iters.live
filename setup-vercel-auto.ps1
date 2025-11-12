# Automated Vercel Environment Variables Setup
# This script automatically configures all required environment variables

Write-Host "`n🚀 Automated Vercel Environment Setup" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Cyan

# Define all environment variables
$envVars = @{
    "DB_HOST" = "mysql.railway.internal"
    "DB_PORT" = "3306"
    "DB_USER" = "root"
    "DB_PASSWORD" = "NlEpRBhwEHsSHrDWEEfahDOMcEzfIdLh"
    "DB_NAME" = "railway"
    "JWT_SECRET" = "prod-jwt-secret-change-this-in-production-8f4b2c9d1e7a3f6b"
    "JWT_REFRESH_SECRET" = "prod-refresh-secret-change-this-in-production-3e7c1f9b4d2a"
    "JWT_EXPIRE" = "1h"
    "JWT_REFRESH_EXPIRE" = "7d"
    "NODE_ENV" = "production"
    "PORT" = "5000"
    "CLIENT_URL" = "https://iter-college-management.vercel.app"
    "CORS_WHITELIST" = "https://iter-college-management.vercel.app"
    "RATE_LIMIT_WINDOW_MS" = "900000"
    "RATE_LIMIT_MAX_REQUESTS" = "100"
}

Write-Host "📋 Environment Variables to be set:" -ForegroundColor Yellow
$envVars.GetEnumerator() | ForEach-Object {
    $displayValue = $_.Value
    if ($_.Key -eq "DB_PASSWORD" -or $_.Key -like "JWT*") {
        $displayValue = "********"
    }
    Write-Host "  • $($_.Key) = $displayValue" -ForegroundColor Gray
}

Write-Host "`n⚠️  IMPORTANT: You need to set these manually in Vercel Dashboard" -ForegroundColor Red
Write-Host "   Reason: Vercel CLI doesn't support non-interactive environment variable creation" -ForegroundColor Red

Write-Host "`n📝 Please follow these steps:" -ForegroundColor Cyan
Write-Host "`n1. Go to: https://vercel.com/dashboard" -ForegroundColor White
Write-Host "2. Select your project: iter-college-management" -ForegroundColor White
Write-Host "3. Go to: Settings → Environment Variables" -ForegroundColor White
Write-Host "4. Add each variable below:" -ForegroundColor White

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "DATABASE CONFIGURATION:" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "DB_HOST = mysql.railway.internal" -ForegroundColor Green
Write-Host "DB_PORT = 3306" -ForegroundColor Green
Write-Host "DB_USER = root" -ForegroundColor Green
Write-Host "DB_PASSWORD = NlEpRBhwEHsSHrDWEEfahDOMcEzfIdLh" -ForegroundColor Green
Write-Host "DB_NAME = railway" -ForegroundColor Green

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "SECURITY CONFIGURATION:" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "JWT_SECRET = prod-jwt-secret-change-this-in-production-8f4b2c9d1e7a3f6b" -ForegroundColor Green
Write-Host "JWT_REFRESH_SECRET = prod-refresh-secret-change-this-in-production-3e7c1f9b4d2a" -ForegroundColor Green
Write-Host "JWT_EXPIRE = 1h" -ForegroundColor Green
Write-Host "JWT_REFRESH_EXPIRE = 7d" -ForegroundColor Green

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "APPLICATION CONFIGURATION:" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "NODE_ENV = production" -ForegroundColor Green
Write-Host "PORT = 5000" -ForegroundColor Green
Write-Host "CLIENT_URL = https://iter-college-management.vercel.app" -ForegroundColor Green
Write-Host "CORS_WHITELIST = https://iter-college-management.vercel.app" -ForegroundColor Green
Write-Host "RATE_LIMIT_WINDOW_MS = 900000" -ForegroundColor Green
Write-Host "RATE_LIMIT_MAX_REQUESTS = 100" -ForegroundColor Green

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

Write-Host "`n5. After adding ALL variables, click 'Redeploy' on latest deployment" -ForegroundColor White

Write-Host "`n💡 TIP: You can copy-paste each line directly!" -ForegroundColor Cyan

$response = Read-Host "`nHave you added all environment variables in Vercel Dashboard? (y/n)"
if ($response -eq "y" -or $response -eq "Y") {
    Write-Host "`n🔄 Redeploying to Vercel..." -ForegroundColor Cyan
    vercel --prod
    
    Write-Host "`n⏳ Waiting for deployment to complete (30 seconds)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30
    
    Write-Host "`n✅ Testing Vercel deployment..." -ForegroundColor Green
    node test-vercel-deployment.js
} else {
    Write-Host "`n📌 Once you've added the variables, run: vercel --prod" -ForegroundColor Yellow
    Write-Host "   Then test with: node test-vercel-deployment.js" -ForegroundColor Yellow
}

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✅ Setup script complete!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Cyan
