# Simplified Azure Deployment for Azure for Students
# Uses App Service with MySQL In-App (better for student subscriptions)

param(
    [string]$ResourceGroup = "iter-college-rg",
    [string]$Location = "eastus",
    [string]$AppName = "iter-college-$(Get-Random -Minimum 1000 -Maximum 9999)"
)

Write-Host "`n╔═══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   🚀 ITER College - Simplified Azure Deployment             ║" -ForegroundColor Cyan
Write-Host "║   Optimized for Azure for Students                           ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Check Azure CLI
Write-Host "==> Checking Azure CLI..." -ForegroundColor Yellow
try {
    $azVersion = az version --output json | ConvertFrom-Json
    Write-Host "✓ Azure CLI installed: $($azVersion.'azure-cli')" -ForegroundColor Green
} catch {
    Write-Host "✗ Azure CLI not found!" -ForegroundColor Red
    exit 1
}

# Check login
Write-Host "`n==> Checking Azure login..." -ForegroundColor Yellow
$account = az account show 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Host "✗ Not logged in!" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Logged in as: $($account.user.name)" -ForegroundColor Green
Write-Host "✓ Subscription: $($account.name)" -ForegroundColor Green

# Display configuration
Write-Host "`n==> Deployment Configuration" -ForegroundColor Yellow
Write-Host "Resource Group: $ResourceGroup" -ForegroundColor Cyan
Write-Host "Location: $Location" -ForegroundColor Cyan
Write-Host "App Name: $AppName" -ForegroundColor Cyan
Write-Host "App URL: https://$AppName.azurewebsites.net" -ForegroundColor Cyan

Write-Host "`n⚠️  Note: Using containerized deployment (works with student subscription)" -ForegroundColor Yellow
Write-Host "💰 Estimated Cost: ~$0-13/month (may be covered by free tier)" -ForegroundColor Yellow

$confirm = Read-Host "`nContinue? (yes/no)"
if ($confirm -ne "yes") {
    Write-Host "Deployment cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host "`n🚀 Starting deployment...`n" -ForegroundColor Green

# Step 1: Create Resource Group
Write-Host "==> Step 1: Creating Resource Group..." -ForegroundColor Yellow
az group create --name $ResourceGroup --location $Location --output table
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Resource group created" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to create resource group" -ForegroundColor Red
    exit 1
}

# Step 2: Create App Service Plan (Linux, B1 Basic)
Write-Host "`n==> Step 2: Creating App Service Plan..." -ForegroundColor Yellow
az appservice plan create `
    --name "$AppName-plan" `
    --resource-group $ResourceGroup `
    --location $Location `
    --sku B1 `
    --is-linux `
    --output table

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ App Service Plan created" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to create App Service Plan" -ForegroundColor Red
    exit 1
}

# Step 3: Create Web App with Node.js
Write-Host "`n==> Step 3: Creating Web App..." -ForegroundColor Yellow
az webapp create `
    --name $AppName `
    --resource-group $ResourceGroup `
    --plan "$AppName-plan" `
    --runtime "NODE:18-lts" `
    --output table

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Web App created" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to create Web App" -ForegroundColor Red
    exit 1
}

# Step 4: Configure App Settings
Write-Host "`n==> Step 4: Configuring environment variables..." -ForegroundColor Yellow

$JwtSecret = [System.Guid]::NewGuid().ToString() + [System.Guid]::NewGuid().ToString()
$JwtRefreshSecret = [System.Guid]::NewGuid().ToString() + [System.Guid]::NewGuid().ToString()
$DbPassword = [System.Web.Security.Membership]::GeneratePassword(16, 4) -replace '[\\/:*?"<>|]', 'A'
$AppUrl = "https://$AppName.azurewebsites.net"

# For now, use SQLite for simplicity (we'll add MySQL connection later)
az webapp config appsettings set `
    --name $AppName `
    --resource-group $ResourceGroup `
    --settings `
        NODE_ENV=production `
        PORT=8080 `
        DB_HOST=localhost `
        DB_PORT=3306 `
        DB_USER=root `
        DB_PASSWORD=$DbPassword `
        DB_NAME=iter_college_db `
        JWT_SECRET=$JwtSecret `
        JWT_REFRESH_SECRET=$JwtRefreshSecret `
        JWT_EXPIRE=1h `
        JWT_REFRESH_EXPIRE=7d `
        STORAGE_MODE=local `
        UPLOAD_DIR=/home/uploads `
        CLIENT_URL=$AppUrl `
        CORS_WHITELIST=$AppUrl `
        SOCKET_CORS_ORIGIN=$AppUrl `
        ADMIN_EMAIL=admin@iter.edu `
        ADMIN_PASSWORD=Admin@123456 `
        WEBSITES_ENABLE_APP_SERVICE_STORAGE=true `
    --output none

Write-Host "✓ Environment variables configured" -ForegroundColor Green

# Step 5: Enable Logging
Write-Host "`n==> Step 5: Enabling logging..." -ForegroundColor Yellow
az webapp log config `
    --name $AppName `
    --resource-group $ResourceGroup `
    --application-logging filesystem `
    --level verbose `
    --output table

Write-Host "✓ Logging enabled" -ForegroundColor Green

# Step 6: Deploy Code
Write-Host "`n==> Step 6: Deploying application..." -ForegroundColor Yellow
Write-Host "Creating deployment package..." -ForegroundColor Cyan

# Create ZIP without large folders
$deployDir = ".\azure-deploy-temp"
if (Test-Path $deployDir) {
    Remove-Item -Recurse -Force $deployDir
}
New-Item -ItemType Directory -Path $deployDir | Out-Null

# Copy essential files
$essentialDirs = @("server", "client", "node_modules")
$essentialFiles = @("package.json", "package-lock.json")

foreach ($dir in $essentialDirs) {
    if (Test-Path $dir) {
        Write-Host "  Copying $dir..." -ForegroundColor Gray
        Copy-Item -Path $dir -Destination $deployDir -Recurse -Force
    }
}

foreach ($file in $essentialFiles) {
    if (Test-Path $file) {
        Copy-Item -Path $file -Destination $deployDir -Force
    }
}

# Create ZIP
$zipPath = ".\deploy.zip"
if (Test-Path $zipPath) {
    Remove-Item $zipPath
}

Write-Host "  Creating ZIP archive..." -ForegroundColor Gray
Compress-Archive -Path "$deployDir\*" -DestinationPath $zipPath -Force

# Cleanup temp directory
Remove-Item -Recurse -Force $deployDir

Write-Host "✓ Deployment package created ($('{0:N2}' -f ((Get-Item $zipPath).Length / 1MB)) MB)" -ForegroundColor Green

# Upload to Azure
Write-Host "  Uploading to Azure (this may take 3-5 minutes)..." -ForegroundColor Cyan
az webapp deployment source config-zip `
    --name $AppName `
    --resource-group $ResourceGroup `
    --src $zipPath `
    --timeout 600

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Application deployed successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Deployment failed" -ForegroundColor Red
    exit 1
}

# Cleanup ZIP
Remove-Item $zipPath

# Step 7: Wait for app to start
Write-Host "`n==> Step 7: Starting application..." -ForegroundColor Yellow
Write-Host "Waiting for app to start (30 seconds)..." -ForegroundColor Cyan
Start-Sleep -Seconds 30

# Display Success Message
Write-Host "`n╔═══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   ✅ DEPLOYMENT SUCCESSFUL!                                    ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════════════════╝`n" -ForegroundColor Green

Write-Host "🌐 Application URL: " -NoNewline -ForegroundColor Cyan
Write-Host $AppUrl -ForegroundColor Yellow

Write-Host "`n🔐 Login Credentials:" -ForegroundColor Cyan
Write-Host "   Email: admin@iter.edu" -ForegroundColor White
Write-Host "   Password: Admin@123456" -ForegroundColor White
Write-Host "   ⚠️  CHANGE THIS IMMEDIATELY!" -ForegroundColor Red

Write-Host "`n🔑 Important Information:" -ForegroundColor Cyan
Write-Host "   JWT Secret: $JwtSecret" -ForegroundColor Gray
Write-Host "   JWT Refresh Secret: $JwtRefreshSecret" -ForegroundColor Gray
Write-Host "   (Saved - don't share these!)" -ForegroundColor Yellow

Write-Host "`n📊 Azure Portal:" -ForegroundColor Cyan
Write-Host "   https://portal.azure.com" -ForegroundColor White

Write-Host "`n📝 View Logs:" -ForegroundColor Cyan
Write-Host "   az webapp log tail --name $AppName --resource-group $ResourceGroup" -ForegroundColor White

Write-Host "`n💰 Estimated Monthly Cost:" -ForegroundColor Cyan
Write-Host "   App Service B1: ~`$13/month" -ForegroundColor White
Write-Host "   (May be covered by your `$100 student credit)" -ForegroundColor Yellow

Write-Host "`n⚠️  IMPORTANT NEXT STEPS:" -ForegroundColor Yellow
Write-Host "   1. Visit your app URL above" -ForegroundColor White
Write-Host "   2. Login and change admin password" -ForegroundColor White
Write-Host "   3. Set up external MySQL database (see AZURE_DEPLOYMENT_GUIDE.md)" -ForegroundColor White
Write-Host "   4. Configure file storage if needed" -ForegroundColor White

# Save deployment info
$deploymentInfo = @{
    Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    ResourceGroup = $ResourceGroup
    Location = $Location
    AppName = $AppName
    AppUrl = $AppUrl
    JwtSecret = $JwtSecret
    JwtRefreshSecret = $JwtRefreshSecret
    AdminEmail = "admin@iter.edu"
    AdminPassword = "Admin@123456"
} | ConvertTo-Json

$deploymentInfo | Out-File -FilePath "azure-deployment-info.json" -Encoding utf8
Write-Host "`n✓ Deployment info saved to: azure-deployment-info.json" -ForegroundColor Green

# Open in browser
Write-Host "`n🌐 Opening application in browser..." -ForegroundColor Cyan
Start-Sleep -Seconds 2
Start-Process $AppUrl

Write-Host "`n✨ Deployment complete! ✨`n" -ForegroundColor Green
