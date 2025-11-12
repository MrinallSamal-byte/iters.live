# Azure Deployment Script for ITER College Management System
# This script automates the complete deployment to Microsoft Azure

param(
    [string]$ResourceGroup = "iter-college-rg",
    [string]$Location = "eastus",
    [string]$AppName = "iter-college-$(Get-Random -Minimum 1000 -Maximum 9999)",
    [string]$DBName = "iter-mysql-$(Get-Random -Minimum 1000 -Maximum 9999)",
    [string]$StorageName = "iterstore$(Get-Random -Minimum 100000 -Maximum 999999)",
    [string]$DBAdminUser = "adminuser",
    [string]$DBAdminPassword = "",
    [switch]$SkipDatabaseInit,
    [switch]$DryRun
)

# Color output functions
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Write-Step($message) {
    Write-ColorOutput Yellow "`n==> $message"
}

function Write-Success($message) {
    Write-ColorOutput Green "✓ $message"
}

function Write-Error($message) {
    Write-ColorOutput Red "✗ $message"
}

function Write-Info($message) {
    Write-ColorOutput Cyan "ℹ $message"
}

# Banner
Write-ColorOutput Cyan @"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🚀 ITER College Management System - Azure Deployment       ║
║                                                               ║
║   Deploying to Microsoft Azure Cloud Platform                ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
"@

# Check if Azure CLI is installed
Write-Step "Checking prerequisites..."
try {
    $azVersion = az version --output json | ConvertFrom-Json
    Write-Success "Azure CLI installed: $($azVersion.'azure-cli')"
} catch {
    Write-Error "Azure CLI is not installed!"
    Write-Info "Please install from: https://aka.ms/installazurecliwindows"
    exit 1
}

# Check if logged in to Azure
Write-Step "Checking Azure login status..."
$accountInfo = az account show 2>$null
if (-not $accountInfo) {
    Write-Info "Not logged in to Azure. Initiating login..."
    az login
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Azure login failed!"
        exit 1
    }
} else {
    $account = $accountInfo | ConvertFrom-Json
    Write-Success "Logged in as: $($account.user.name)"
    Write-Success "Subscription: $($account.name)"
}

# Generate secure database password if not provided
if (-not $DBAdminPassword) {
    Add-Type -AssemblyName 'System.Web'
    $DBAdminPassword = [System.Web.Security.Membership]::GeneratePassword(16, 4)
    Write-Info "Generated secure database password"
}

# Display deployment configuration
Write-Step "Deployment Configuration"
Write-Info "Resource Group: $ResourceGroup"
Write-Info "Location: $Location"
Write-Info "App Name: $AppName"
Write-Info "Database Name: $DBName"
Write-Info "Storage Name: $StorageName"
Write-Info "Database Admin User: $DBAdminUser"

if ($DryRun) {
    Write-ColorOutput Yellow "`n[DRY RUN MODE - No resources will be created]"
    exit 0
}

# Confirm deployment
Write-ColorOutput Yellow "`n⚠ This will create Azure resources and may incur costs."
$confirm = Read-Host "Continue with deployment? (yes/no)"
if ($confirm -ne "yes") {
    Write-Info "Deployment cancelled by user."
    exit 0
}

# Start deployment
Write-ColorOutput Green "`n🚀 Starting deployment...`n"

# Step 1: Create Resource Group
Write-Step "Step 1: Creating Resource Group..."
az group create --name $ResourceGroup --location $Location --output table
if ($LASTEXITCODE -eq 0) {
    Write-Success "Resource group created successfully"
} else {
    Write-Error "Failed to create resource group"
    exit 1
}

# Step 2: Create MySQL Database
Write-Step "Step 2: Creating Azure Database for MySQL (this may take 5-10 minutes)..."
az mysql flexible-server create `
    --resource-group $ResourceGroup `
    --name $DBName `
    --location $Location `
    --admin-user $DBAdminUser `
    --admin-password $DBAdminPassword `
    --sku-name Standard_B1ms `
    --tier Burstable `
    --version 8.0.21 `
    --storage-size 32 `
    --public-access 0.0.0.0-255.255.255.255 `
    --yes `
    --output table

if ($LASTEXITCODE -eq 0) {
    Write-Success "MySQL server created successfully"
} else {
    Write-Error "Failed to create MySQL server"
    exit 1
}

# Create database
Write-Step "Creating database schema..."
az mysql flexible-server db create `
    --resource-group $ResourceGroup `
    --server-name $DBName `
    --database-name iter_college_db `
    --output table

if ($LASTEXITCODE -eq 0) {
    Write-Success "Database created successfully"
} else {
    Write-Error "Failed to create database"
    exit 1
}

# Configure firewall
Write-Step "Configuring database firewall..."
az mysql flexible-server firewall-rule create `
    --resource-group $ResourceGroup `
    --name $DBName `
    --rule-name AllowAzureServices `
    --start-ip-address 0.0.0.0 `
    --end-ip-address 0.0.0.0 `
    --output table

Write-Success "Database firewall configured"

# Step 3: Create Storage Account
Write-Step "Step 3: Creating Azure Storage Account..."
az storage account create `
    --name $StorageName `
    --resource-group $ResourceGroup `
    --location $Location `
    --sku Standard_LRS `
    --kind StorageV2 `
    --output table

if ($LASTEXITCODE -eq 0) {
    Write-Success "Storage account created successfully"
} else {
    Write-Error "Failed to create storage account"
    exit 1
}

# Create blob container
Write-Step "Creating blob container for uploads..."
az storage container create `
    --name uploads `
    --account-name $StorageName `
    --public-access blob `
    --output table

Write-Success "Blob container created"

# Get storage connection string
Write-Step "Retrieving storage connection string..."
$StorageConnectionString = az storage account show-connection-string `
    --name $StorageName `
    --resource-group $ResourceGroup `
    --query connectionString `
    --output tsv

Write-Success "Storage connection string retrieved"

# Step 4: Create App Service Plan
Write-Step "Step 4: Creating App Service Plan..."
az appservice plan create `
    --name "$AppName-plan" `
    --resource-group $ResourceGroup `
    --location $Location `
    --sku B1 `
    --is-linux `
    --output table

if ($LASTEXITCODE -eq 0) {
    Write-Success "App Service Plan created successfully"
} else {
    Write-Error "Failed to create App Service Plan"
    exit 1
}

# Step 5: Create Web App
Write-Step "Step 5: Creating Web App..."
az webapp create `
    --name $AppName `
    --resource-group $ResourceGroup `
    --plan "$AppName-plan" `
    --runtime "NODE:18-lts" `
    --output table

if ($LASTEXITCODE -eq 0) {
    Write-Success "Web App created successfully"
} else {
    Write-Error "Failed to create Web App"
    exit 1
}

# Step 6: Configure App Settings
Write-Step "Step 6: Configuring environment variables..."

# Generate JWT secrets
$JwtSecret = [System.Guid]::NewGuid().ToString() + [System.Guid]::NewGuid().ToString()
$JwtRefreshSecret = [System.Guid]::NewGuid().ToString() + [System.Guid]::NewGuid().ToString()
$AppUrl = "https://$AppName.azurewebsites.net"

az webapp config appsettings set `
    --name $AppName `
    --resource-group $ResourceGroup `
    --settings `
        NODE_ENV=production `
        PORT=8080 `
        DB_HOST="$DBName.mysql.database.azure.com" `
        DB_PORT=3306 `
        DB_USER=$DBAdminUser `
        DB_PASSWORD=$DBAdminPassword `
        DB_NAME=iter_college_db `
        JWT_SECRET=$JwtSecret `
        JWT_REFRESH_SECRET=$JwtRefreshSecret `
        JWT_EXPIRE=1h `
        JWT_REFRESH_EXPIRE=7d `
        STORAGE_MODE=azure `
        AZURE_STORAGE_CONNECTION_STRING=$StorageConnectionString `
        AZURE_STORAGE_CONTAINER=uploads `
        CLIENT_URL=$AppUrl `
        CORS_WHITELIST=$AppUrl `
        SOCKET_CORS_ORIGIN=$AppUrl `
        ADMIN_EMAIL="admin@iter.edu" `
        ADMIN_PASSWORD="Admin@123456" `
    --output none

Write-Success "Environment variables configured"

# Step 7: Enable Logging
Write-Step "Step 7: Enabling application logging..."
az webapp log config `
    --name $AppName `
    --resource-group $ResourceGroup `
    --application-logging filesystem `
    --level verbose `
    --output table

Write-Success "Application logging enabled"

# Step 8: Configure Deployment
Write-Step "Step 8: Configuring deployment..."

# Create .deployment file
@"
[config]
SCM_DO_BUILD_DURING_DEPLOYMENT=true
"@ | Out-File -FilePath ".deployment" -Encoding utf8

Write-Success "Deployment configuration created"

# Step 9: Deploy Application
Write-Step "Step 9: Deploying application (this may take 5-10 minutes)..."

# Create ZIP deployment package
Write-Info "Creating deployment package..."
$excludeDirs = @("node_modules", "coverage", ".git", ".vscode", "logs", "uploads", "backups")
$files = Get-ChildItem -Path . -Recurse -File | Where-Object { 
    $file = $_
    -not ($excludeDirs | Where-Object { $file.FullName -like "*\$_\*" })
}

# Create temporary deployment directory
$deployDir = ".\azure-deploy-temp"
if (Test-Path $deployDir) {
    Remove-Item -Recurse -Force $deployDir
}
New-Item -ItemType Directory -Path $deployDir | Out-Null

# Copy files
Write-Info "Copying application files..."
foreach ($file in $files) {
    $relativePath = $file.FullName.Substring((Get-Location).Path.Length + 1)
    $destPath = Join-Path $deployDir $relativePath
    $destDir = Split-Path $destPath
    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }
    Copy-Item $file.FullName $destPath
}

# Create ZIP
$zipPath = ".\deploy.zip"
if (Test-Path $zipPath) {
    Remove-Item $zipPath
}
Compress-Archive -Path "$deployDir\*" -DestinationPath $zipPath

# Cleanup temp directory
Remove-Item -Recurse -Force $deployDir

Write-Success "Deployment package created"

# Deploy to Azure
Write-Info "Uploading to Azure..."
az webapp deployment source config-zip `
    --name $AppName `
    --resource-group $ResourceGroup `
    --src $zipPath `
    --timeout 600

if ($LASTEXITCODE -eq 0) {
    Write-Success "Application deployed successfully"
} else {
    Write-Error "Failed to deploy application"
    exit 1
}

# Cleanup ZIP
Remove-Item $zipPath

# Step 10: Initialize Database
if (-not $SkipDatabaseInit) {
    Write-Step "Step 10: Initializing database..."
    Write-Info "Database will be initialized on first application start"
    Write-Info "Or you can manually run: npm run seed:comprehensive via SSH"
}

# Step 11: Verify Deployment
Write-Step "Step 11: Verifying deployment..."
Start-Sleep -Seconds 10

try {
    $response = Invoke-WebRequest -Uri "$AppUrl/health" -TimeoutSec 30
    if ($response.StatusCode -eq 200) {
        Write-Success "Application health check passed!"
    }
} catch {
    Write-Info "Health check pending (application may still be starting)"
}

# Deployment Summary
Write-ColorOutput Green @"

╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ✅ DEPLOYMENT SUCCESSFUL!                                   ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

🌐 Application URL: $AppUrl

📊 Azure Portal:
   https://portal.azure.com/#@/resource/subscriptions/YOUR_SUB/resourceGroups/$ResourceGroup

🔐 Credentials:
   Database Server: $DBName.mysql.database.azure.com
   Database Name: iter_college_db
   Database User: $DBAdminUser
   Database Password: $DBAdminPassword
   
   Admin Login:
   Email: admin@iter.edu
   Password: Admin@123456 (⚠ CHANGE THIS IMMEDIATELY!)

🔑 JWT Secrets (SAVE THESE):
   JWT_SECRET: $JwtSecret
   JWT_REFRESH_SECRET: $JwtRefreshSecret

📦 Azure Resources Created:
   ✓ Resource Group: $ResourceGroup
   ✓ MySQL Database: $DBName
   ✓ Storage Account: $StorageName
   ✓ App Service: $AppName
   ✓ App Service Plan: $AppName-plan

💰 Estimated Monthly Cost: ~$100-110/month
   (B1 App Service + Basic MySQL + Storage)

📝 Next Steps:
   1. Visit: $AppUrl
   2. Login with admin credentials
   3. Change default admin password
   4. Configure email settings
   5. Upload college logo and branding
   6. Create student/teacher accounts
   7. Test all features

📖 View Logs:
   az webapp log tail --name $AppName --resource-group $ResourceGroup

🔧 SSH into App:
   az webapp ssh --name $AppName --resource-group $ResourceGroup

📊 Monitor:
   Azure Portal → $AppName → Monitoring → Metrics

⚠ Important Security Notes:
   - Change the default admin password immediately
   - Restrict database firewall rules to specific IPs if possible
   - Enable Azure Key Vault for secrets management
   - Set up Azure AD authentication for additional security
   - Enable backup policies for database and storage

🎉 Your ITER College Management System is now live on Azure!

"@

# Save deployment info
$deploymentInfo = @{
    Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    ResourceGroup = $ResourceGroup
    Location = $Location
    AppName = $AppName
    AppUrl = $AppUrl
    DBName = $DBName
    DBServer = "$DBName.mysql.database.azure.com"
    DBUser = $DBAdminUser
    DBPassword = $DBAdminPassword
    StorageName = $StorageName
    JwtSecret = $JwtSecret
    JwtRefreshSecret = $JwtRefreshSecret
} | ConvertTo-Json

$deploymentInfo | Out-File -FilePath "azure-deployment-info.json" -Encoding utf8
Write-Success "Deployment information saved to: azure-deployment-info.json"
Write-ColorOutput Red "⚠ KEEP THIS FILE SECURE - Contains sensitive credentials!"

# Open app in browser
Write-Info "Opening application in browser..."
Start-Process $AppUrl

Write-ColorOutput Green "`n✨ Deployment complete! ✨`n"
