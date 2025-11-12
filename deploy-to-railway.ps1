# Railway Backend Deployment Helper
# This script helps you prepare and deploy your backend to Railway

Write-Host ""
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   Railway Backend Deployment Helper" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Host "📋 Pre-Deployment Checklist:" -ForegroundColor Yellow
Write-Host ""

# Check if Railway CLI is installed
Write-Host "Checking for Railway CLI..." -ForegroundColor White
try {
    $railwayVersion = railway --version 2>$null
    Write-Host "✅ Railway CLI installed: $railwayVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Railway CLI not installed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Install Railway CLI:" -ForegroundColor Yellow
    Write-Host "  npm install -g @railway/cli" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Or use the web dashboard: https://railway.app/dashboard" -ForegroundColor Cyan
    Write-Host ""
}

# Check package.json
Write-Host ""
Write-Host "Checking package.json..." -ForegroundColor White
if (Test-Path "package.json") {
    $pkg = Get-Content "package.json" | ConvertFrom-Json
    Write-Host "✅ package.json found" -ForegroundColor Green
    Write-Host "   Name: $($pkg.name)" -ForegroundColor Gray
    Write-Host "   Version: $($pkg.version)" -ForegroundColor Gray
    
    if ($pkg.scripts.start) {
        Write-Host "✅ Start script: $($pkg.scripts.start)" -ForegroundColor Green
    } else {
        Write-Host "⚠️  No start script found" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ package.json not found" -ForegroundColor Red
}

# Check server files
Write-Host ""
Write-Host "Checking server files..." -ForegroundColor White
if (Test-Path "server.js") {
    Write-Host "✅ server.js found" -ForegroundColor Green
} elseif (Test-Path "index.js") {
    Write-Host "✅ index.js found" -ForegroundColor Green
} elseif (Test-Path "app.js") {
    Write-Host "✅ app.js found" -ForegroundColor Green
} else {
    Write-Host "⚠️  No main server file found" -ForegroundColor Yellow
}

# Check Railway config
Write-Host ""
Write-Host "Checking Railway configuration..." -ForegroundColor White
if (Test-Path "railway.json") {
    Write-Host "✅ railway.json found" -ForegroundColor Green
}
if (Test-Path "railway.toml") {
    Write-Host "✅ railway.toml found" -ForegroundColor Green
}
if (Test-Path "Procfile") {
    Write-Host "✅ Procfile found" -ForegroundColor Green
}

Write-Host ""
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   Deployment Options" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Host "Choose your deployment method:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Web Dashboard (Recommended for first deploy)" -ForegroundColor White
Write-Host "   - Go to: https://railway.app/dashboard" -ForegroundColor Gray
Write-Host "   - Click: New Project → Deploy from GitHub" -ForegroundColor Gray
Write-Host "   - Select your repository" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Railway CLI (For automated deploys)" -ForegroundColor White
Write-Host "   - Run: railway login" -ForegroundColor Gray
Write-Host "   - Run: railway link" -ForegroundColor Gray
Write-Host "   - Run: railway up" -ForegroundColor Gray
Write-Host ""

$choice = Read-Host "Which method? (1 for Web, 2 for CLI, or Enter to skip)"

if ($choice -eq "1") {
    Write-Host ""
    Write-Host "Opening Railway Dashboard..." -ForegroundColor Cyan
    Start-Process "https://railway.app/dashboard"
    
    Write-Host ""
    Write-Host "📝 Follow these steps in the dashboard:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Click 'New Project'" -ForegroundColor White
    Write-Host "2. Select 'Deploy from GitHub repo'" -ForegroundColor White
    Write-Host "3. Choose: ITER_Live (or your repo)" -ForegroundColor White
    Write-Host "4. Railway will auto-detect Node.js" -ForegroundColor White
    Write-Host "5. Add environment variables (see below)" -ForegroundColor White
    Write-Host "6. Click 'Deploy'" -ForegroundColor White
    Write-Host ""
    
} elseif ($choice -eq "2") {
    Write-Host ""
    Write-Host "Starting CLI deployment..." -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "Step 1: Login to Railway" -ForegroundColor Yellow
    railway login
    
    Write-Host ""
    Write-Host "Step 2: Link to project" -ForegroundColor Yellow
    railway link
    
    Write-Host ""
    Write-Host "Step 3: Deploy" -ForegroundColor Yellow
    railway up
    
    Write-Host ""
    Write-Host "✅ Deployment initiated!" -ForegroundColor Green
}

Write-Host ""
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   Environment Variables Required" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Add these in Railway Dashboard → Variables:" -ForegroundColor Yellow
Write-Host ""

$envVars = @"
DB_HOST=mysql.railway.internal
DB_PORT=3306
DB_USER=root
DB_PASSWORD=NlEpRBhwEHsSHrDWEEfahDOMcEzfIdLh
DB_NAME=railway
JWT_SECRET=prod-jwt-secret-change-this-in-production-8f4b2c9d1e7a3f6b
JWT_REFRESH_SECRET=prod-refresh-secret-change-this-in-production-3e7c1f9b4d2a
JWT_EXPIRE=1h
JWT_REFRESH_EXPIRE=7d
NODE_ENV=production
PORT=5000
CLIENT_URL=https://iter-college-management.vercel.app
CORS_WHITELIST=https://iter-college-management.vercel.app,https://www.iters.live
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
"@

Write-Host $envVars -ForegroundColor Cyan

Write-Host ""
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   After Deployment" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Get your Railway URL from the dashboard" -ForegroundColor White
Write-Host "   Example: https://iter-live-production.up.railway.app" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Test the API:" -ForegroundColor White
Write-Host "   https://YOUR-RAILWAY-URL/api/health" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Update frontend API URLs:" -ForegroundColor White
Write-Host "   .\update-api-urls.ps1 -RailwayUrl 'https://YOUR-RAILWAY-URL'" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Redeploy Vercel with updated URLs:" -ForegroundColor White
Write-Host "   vercel --prod" -ForegroundColor Gray
Write-Host ""

Write-Host "═══════════════════════════════════════════" -ForegroundColor Green
Write-Host "   Ready to Deploy!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════" -ForegroundColor Green
Write-Host ""

Write-Host "📚 Full guide: RAILWAY_BACKEND_DEPLOYMENT.md" -ForegroundColor Cyan
Write-Host ""
