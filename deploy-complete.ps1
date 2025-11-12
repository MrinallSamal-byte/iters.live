# Complete Railway Deployment - Working Version

Write-Host ""
Write-Host "======================================"
Write-Host " Railway Deployment Assistant"
Write-Host "======================================"
Write-Host ""

# Step 1
Write-Host "STEP 1: Opening Railway Dashboard..." -ForegroundColor Yellow
Start-Process "https://railway.app/dashboard"
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "In Railway Dashboard, do:" -ForegroundColor White
Write-Host "1. Click 'New Project'"
Write-Host "2. Select 'Deploy from GitHub repo'"
Write-Host "3. Choose 'ITER_Live'"
Write-Host ""
Read-Host "Press Enter when project created"

# Step 2
Write-Host ""
Write-Host "STEP 2: Environment Variables" -ForegroundColor Yellow

$envVars = "DB_HOST=mysql.railway.internal`nDB_PORT=3306`nDB_USER=root`nDB_PASSWORD=NlEpRBhwEHsSHrDWEEfahDOMcEzfIdLh`nDB_NAME=railway`nJWT_SECRET=prod-jwt-secret-change-this-in-production-8f4b2c9d1e7a3f6b`nJWT_REFRESH_SECRET=prod-refresh-secret-change-this-in-production-3e7c1f9b4d2a`nJWT_EXPIRE=1h`nJWT_REFRESH_EXPIRE=7d`nNODE_ENV=production`nPORT=5000`nCLIENT_URL=https://iter-college-management.vercel.app`nCORS_WHITELIST=https://iter-college-management.vercel.app`nRATE_LIMIT_WINDOW_MS=900000`nRATE_LIMIT_MAX_REQUESTS=100"

Write-Host $envVars
Write-Host ""

try {
    $envVars | Set-Clipboard
    Write-Host "Copied to clipboard! Paste in Railway RAW Editor" -ForegroundColor Green
} catch {
    Write-Host "Copy manually from above" -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Press Enter when variables added"

# Step 3
Write-Host ""
Write-Host "STEP 3: Waiting 3 minutes for deployment..." -ForegroundColor Yellow
Start-Sleep -Seconds 180
Write-Host "Deployment should be ready!" -ForegroundColor Green

# Step 4
Write-Host ""
Write-Host "STEP 4: Enter Railway URL" -ForegroundColor Yellow
$railwayUrl = Read-Host "Enter your Railway URL (e.g., https://xyz.railway.app)"
$railwayUrl = $railwayUrl.TrimEnd('/')

# Step 5
Write-Host ""
Write-Host "STEP 5: Testing backend..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$railwayUrl/api/health" -TimeoutSec 15
    Write-Host "Backend is healthy!" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json)
} catch {
    Write-Host "Warning: Could not reach backend yet" -ForegroundColor Yellow
}

# Step 6
Write-Host ""
Write-Host "STEP 6: Creating API config..." -ForegroundColor Yellow

$config = @"
const API_CONFIG = {
    BASE_URL: '$railwayUrl',
    API_URL: '$railwayUrl/api'
};
function getApiUrl(endpoint) {
    return API_CONFIG.API_URL + '/' + endpoint.replace(/^\//, '');
}
"@

if (-not (Test-Path "client\js")) {
    New-Item -Path "client\js" -ItemType Directory -Force | Out-Null
}

Set-Content -Path "client\js\api-config.js" -Value $config
Write-Host "Created api-config.js" -ForegroundColor Green

# Step 7
Write-Host ""
Write-Host "STEP 7: Deploying to Vercel..." -ForegroundColor Yellow
vercel --prod

# Step 8
Write-Host ""
Write-Host "======================================"
Write-Host " COMPLETE!"
Write-Host "======================================"
Write-Host ""
Write-Host "Frontend: https://iter-college-management.vercel.app"
Write-Host "Backend:  $railwayUrl"
Write-Host ""
Write-Host "Test login with:"
Write-Host "  Registration: ADM2025001"
Write-Host "  Password: Admin@123456"
Write-Host ""

Start-Process "https://iter-college-management.vercel.app/login.html"
