# Deploy ITER-AIO to Render using REST API
$ErrorActionPreference = "Stop"

$API_KEY = "rnd_L6BM6Z8KUdo5ZoXxxO2xmla5Hwsa"
$DB_URL = "postgresql://iter_college_db_user:93UqDvuxyr57TKtxgvBWIVSj3CcAJe6B@dpg-d3o80g3e5dus73agr8q0-a/iter_college_db"
$HEADERS = @{
    "Authorization" = "Bearer $API_KEY"
    "Content-Type" = "application/json"
}

Write-Host "`nDeploying ITER-AIO to Render..." -ForegroundColor Cyan

# 1. Create Web Service
Write-Host "`nCreating web service..." -ForegroundColor Yellow

$serviceBody = @{
    type = "web_service"
    name = "iter-aio"
    ownerId = $null  # Will use default owner
    repo = "https://github.com/MrinallSamal-byte/ITER_Live"
    branch = "master"
    rootDir = ""
    buildCommand = "npm install"
    startCommand = "node server/index.js"
    envVars = @(
        @{ key = "NODE_ENV"; value = "production" }
        @{ key = "PORT"; value = "10000" }
        @{ key = "DATABASE_URL"; value = $DB_URL }
        @{ key = "JWT_SECRET"; value = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((New-Guid).Guid)) }
        @{ key = "JWT_REFRESH_SECRET"; value = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((New-Guid).Guid)) }
        @{ key = "CORS_WHITELIST"; value = "" }
        @{ key = "MAX_FILE_SIZE"; value = "10485760" }
        @{ key = "JWT_EXPIRE"; value = "24h" }
        @{ key = "JWT_REFRESH_EXPIRE"; value = "7d" }
    )
    serviceDetails = @{
        disk = @{
            name = "uploads"
            mountPath = "/opt/render/project/src/uploads"
            sizeGB = 1
        }
        env = "node"
        plan = "free"
        region = "oregon"
        healthCheckPath = "/health"
    }
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri "https://api.render.com/v1/services" -Method POST -Headers $HEADERS -Body $serviceBody
    $serviceId = $response.service.id
    $serviceUrl = $response.service.serviceDetails.url
    
    Write-Host "Service created successfully!" -ForegroundColor Green
    Write-Host "   Service ID: $serviceId" -ForegroundColor Cyan
    Write-Host "   URL: https://$serviceUrl" -ForegroundColor Cyan
    
    # Save service details
    @{
        serviceId = $serviceId
        serviceUrl = "https://$serviceUrl"
        apiKey = $API_KEY
    } | ConvertTo-Json | Out-File "render-service.json"
    
    Write-Host "`nDeployment initiated!" -ForegroundColor Green
    Write-Host "`nService will be live at: https://$serviceUrl" -ForegroundColor Green
    Write-Host "`nDemo Accounts:" -ForegroundColor Yellow
    Write-Host "  Student: STU20250001 / Student@123"
    Write-Host "  Teacher: TCH2025001 / Teacher@123"
    Write-Host "  Admin: ADM2025001 / Admin@123456"
    
} catch {
    Write-Host "`nDeployment failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host $_.Exception.Response.StatusCode -ForegroundColor Red
}

Write-Host "`nSetup complete!" -ForegroundColor Green
