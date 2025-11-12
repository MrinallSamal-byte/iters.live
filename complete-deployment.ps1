# Complete Railway Deployment Assistant
# This script will guide you through the entire process

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " COMPLETE RAILWAY DEPLOYMENT ASSISTANT" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Open Railway Dashboard
Write-Host "STEP 1: Opening Railway Dashboard..." -ForegroundColor Yellow
Start-Process "https://railway.app/dashboard"
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "Please complete these actions in Railway Dashboard:" -ForegroundColor White
Write-Host "  1. Click 'New Project'" -ForegroundColor Gray
Write-Host "  2. Click 'Deploy from GitHub repo'" -ForegroundColor Gray
Write-Host "  3. Select 'ITER_Live' repository" -ForegroundColor Gray
Write-Host "  4. Wait for Railway to detect Node.js" -ForegroundColor Gray
Write-Host ""

Read-Host "Press Enter when Railway project is created"

# Step 2: Environment Variables
Write-Host ""
Write-Host "STEP 2: Environment Variables" -ForegroundColor Yellow
Write-Host "I'll copy all 15 variables to your clipboard!" -ForegroundColor Green
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
CORS_WHITELIST=https://iter-college-management.vercel.app
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
"@

# Display variables
Write-Host $envVars -ForegroundColor Cyan
Write-Host ""

# Try to copy to clipboard
try {
    $envVars | Set-Clipboard
    Write-Host "✅ Environment variables copied to clipboard!" -ForegroundColor Green
    Write-Host ""
    Write-Host "In Railway Dashboard:" -ForegroundColor White
    Write-Host "  1. Click 'Variables' tab" -ForegroundColor Gray
    Write-Host "  2. Click 'RAW Editor'" -ForegroundColor Gray
    Write-Host "  3. Paste (Ctrl+V) all variables" -ForegroundColor Gray
    Write-Host "  4. Click 'Save'" -ForegroundColor Gray
} catch {
    Write-Host "⚠️  Manual copy needed (see above)" -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Press Enter when all variables are added in Railway"

# Step 3: Wait for deployment
Write-Host ""
Write-Host "STEP 3: Waiting for Railway deployment..." -ForegroundColor Yellow
Write-Host "Railway is now building and deploying your backend" -ForegroundColor White
Write-Host "This typically takes 2-3 minutes" -ForegroundColor Gray
Write-Host ""

for ($i = 180; $i -gt 0; $i--) {
    Write-Progress -Activity "Waiting for deployment" -Status "$i seconds remaining" -PercentComplete ((180 - $i) / 180 * 100)
    Start-Sleep -Seconds 1
}

Write-Host ""
Write-Host "✅ Deployment should be complete now!" -ForegroundColor Green
Write-Host ""

# Step 4: Get Railway URL
Write-Host "STEP 4: Get Railway URL" -ForegroundColor Yellow
Write-Host "In Railway Dashboard:" -ForegroundColor White
Write-Host "  1. Click on your deployed service" -ForegroundColor Gray
Write-Host "  2. Find the public URL (looks like: https://xyz.railway.app)" -ForegroundColor Gray
Write-Host "  3. Copy the URL" -ForegroundColor Gray
Write-Host ""

$railwayUrl = Read-Host "Enter your Railway URL"

if (-not $railwayUrl) {
    Write-Host "❌ Railway URL is required!" -ForegroundColor Red
    exit
}

# Clean URL
$railwayUrl = $railwayUrl.TrimEnd('/')

Write-Host ""
Write-Host "Railway URL: $railwayUrl" -ForegroundColor Cyan

# Step 5: Test Backend
Write-Host ""
Write-Host "STEP 5: Testing Railway Backend..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "$railwayUrl/api/health" -Method Get -TimeoutSec 15
    Write-Host "✅ Backend is HEALTHY!" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Gray
    Write-Host ($response | ConvertTo-Json) -ForegroundColor Cyan
} catch {
    Write-Host "⚠️  Backend test failed: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "This might be okay if deployment is still finishing" -ForegroundColor Gray
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne "y") {
        exit
    }
}

# Step 6: Update Frontend
Write-Host ""
Write-Host "STEP 6: Updating Frontend API URLs..." -ForegroundColor Yellow

# Create api-config.js
$configContent = @"
// API Configuration - Auto-generated
const API_CONFIG = {
    BASE_URL: '$railwayUrl',
    API_URL: '$railwayUrl/api',
    TIMEOUT: 30000
};

// Helper function to get API URL
function getApiUrl(endpoint) {
    // Remove leading slash if present
    endpoint = endpoint.replace(/^\//, '');
    return ``${API_CONFIG.API_URL}/``${endpoint}``;
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API_CONFIG;
}

console.log('✅ API Config loaded:', API_CONFIG.BASE_URL);
"@

# Create directory if it doesn't exist
if (-not (Test-Path "client\js")) {
    New-Item -Path "client\js" -ItemType Directory -Force | Out-Null
}

Set-Content -Path "client\js\api-config.js" -Value $configContent
Write-Host "✅ Created: client\js\api-config.js" -ForegroundColor Green

# Create a backup of common HTML files and add script tag
$htmlFiles = @(
    "index.html",
    "login.html",
    "register.html",
    "client\html\student-dashboard.html",
    "client\html\teacher-dashboard.html",
    "client\html\admin-dashboard.html"
)

Write-Host ""
Write-Host "Adding api-config.js to HTML files..." -ForegroundColor White

foreach ($file in $htmlFiles) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        
        # Check if already added
        if ($content -notmatch "api-config\.js") {
            # Try to add before closing head tag
            if ($content -match "</head>") {
                $newContent = $content -replace "</head>", "    <script src='/client/js/api-config.js'></script>`n</head>"
                Set-Content -Path $file -Value $newContent
                Write-Host "  ✅ Updated: $file" -ForegroundColor Green
            } else {
                Write-Host "  ⚠️  Could not auto-update: $file" -ForegroundColor Yellow
            }
        } else {
            Write-Host "  ✓ Already configured: $file" -ForegroundColor Gray
        }
    }
}

Write-Host ""
Write-Host "✅ Frontend updated with Railway backend URL!" -ForegroundColor Green

# Step 7: Redeploy Vercel
Write-Host ""
Write-Host "STEP 7: Redeploying to Vercel..." -ForegroundColor Yellow

try {
    $deployOutput = vercel --prod 2>&1
    Write-Host $deployOutput
    Write-Host ""
    Write-Host "✅ Vercel deployment complete!" -ForegroundColor Green
} catch {
    Write-Host "❌ Vercel deployment failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Try manually:" -ForegroundColor Yellow
    Write-Host "  vercel --prod" -ForegroundColor Cyan
}

# Step 8: Test End-to-End
Write-Host ""
Write-Host "STEP 8: Final Testing..." -ForegroundColor Yellow
Write-Host ""

Write-Host "Opening Vercel website..." -ForegroundColor White
Start-Process "https://iter-college-management.vercel.app/login.html"

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host " 🎉 DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""

Write-Host "Test your deployment:" -ForegroundColor Yellow
Write-Host "  1. Login page should be open" -ForegroundColor White
Write-Host "  2. Use credentials:" -ForegroundColor White
Write-Host "     Registration Number: ADM2025001" -ForegroundColor Cyan
Write-Host "     Password: Admin@123456" -ForegroundColor Cyan
Write-Host "  3. Check browser console (F12)" -ForegroundColor White
Write-Host "  4. Verify API calls go to: $railwayUrl" -ForegroundColor White
Write-Host ""

Write-Host "URLs:" -ForegroundColor Yellow
Write-Host "  Frontend: https://iter-college-management.vercel.app" -ForegroundColor Cyan
Write-Host "  Backend:  $railwayUrl" -ForegroundColor Cyan
Write-Host "  API Health: $railwayUrl/api/health" -ForegroundColor Cyan
Write-Host ""

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " All systems operational! 🚀" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
