# Deploy ITER-AIO to Render using REST API
$ErrorActionPreference = "Stop"

$API_KEY = "rnd_L6BM6Z8KUdo5ZoXxxO2xmla5Hwsa"
$DB_URL = "postgresql://iter_college_db_user:93UqDvuxyr57TKtxgvBWIVSj3CcAJe6B@dpg-d3o80g3e5dus73agr8q0-a/iter_college_db"
$HEADERS = @{
    "Authorization" = "Bearer $API_KEY"
    "Content-Type" = "application/json"
    "Accept" = "application/json"
}

Write-Host "`nDeploying ITER-AIO to Render..." -ForegroundColor Cyan

# Generate secure secrets
$jwtSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})
$jwtRefreshSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})

Write-Host "`nCreating web service..." -ForegroundColor Yellow

# Simplified service creation payload
$serviceBody = @{
    type = "web_service"
    name = "iter-aio"
    serviceDetails = @{
        env = "node"
        plan = "free"
        region = "oregon"
        buildCommand = "npm install"
        startCommand = "node server/index.js"
        healthCheckPath = "/health"
        envVars = @(
            @{ key = "NODE_ENV"; value = "production" }
            @{ key = "PORT"; value = "10000" }
            @{ key = "DATABASE_URL"; value = $DB_URL }
            @{ key = "JWT_SECRET"; value = $jwtSecret }
            @{ key = "JWT_REFRESH_SECRET"; value = $jwtRefreshSecret }
            @{ key = "MAX_FILE_SIZE"; value = "10485760" }
            @{ key = "JWT_EXPIRE"; value = "24h" }
            @{ key = "JWT_REFRESH_EXPIRE"; value = "7d" }
        )
    }
} | ConvertTo-Json -Depth 10

Write-Host "Request body prepared" -ForegroundColor Gray

try {
    # First, let's test the API key by getting owner info
    Write-Host "Testing API key..." -ForegroundColor Gray
    $ownerResponse = Invoke-RestMethod -Uri "https://api.render.com/v1/owners" -Method GET -Headers $HEADERS
    $ownerId = $ownerResponse[0].id
    Write-Host "Owner ID: $ownerId" -ForegroundColor Green
    
    # Now create the service with the owner ID
    $serviceBody = @{
        type = "web_service"
        name = "iter-aio-$(Get-Random -Maximum 9999)"
        ownerId = $ownerId
        serviceDetails = @{
            env = "node"
            plan = "free"
            region = "oregon"
            buildCommand = "npm install"
            startCommand = "node server/index.js"
            healthCheckPath = "/health"
        }
    } | ConvertTo-Json -Depth 10
    
    Write-Host "Creating service..." -ForegroundColor Gray
    $response = Invoke-RestMethod -Uri "https://api.render.com/v1/services" -Method POST -Headers $HEADERS -Body $serviceBody
    $serviceId = $response.service.id
    $serviceUrl = $response.service.serviceDetails.url
    
    Write-Host "Service created successfully!" -ForegroundColor Green
    Write-Host "Service ID: $serviceId" -ForegroundColor Cyan
    Write-Host "URL: https://$serviceUrl" -ForegroundColor Cyan
    
    # Now add environment variables
    Write-Host "`nConfiguring environment variables..." -ForegroundColor Yellow
    
    $envVars = @(
        @{ key = "NODE_ENV"; value = "production" }
        @{ key = "PORT"; value = "10000" }
        @{ key = "DATABASE_URL"; value = $DB_URL }
        @{ key = "JWT_SECRET"; value = $jwtSecret }
        @{ key = "JWT_REFRESH_SECRET"; value = $jwtRefreshSecret }
        @{ key = "MAX_FILE_SIZE"; value = "10485760" }
        @{ key = "JWT_EXPIRE"; value = "24h" }
        @{ key = "JWT_REFRESH_EXPIRE"; value = "7d" }
    )
    
    foreach ($env in $envVars) {
        $envBody = $env | ConvertTo-Json
        try {
            Invoke-RestMethod -Uri "https://api.render.com/v1/services/$serviceId/env-vars" -Method POST -Headers $HEADERS -Body $envBody | Out-Null
            Write-Host "  Set $($env.key)" -ForegroundColor Gray
        } catch {
            Write-Host "  Warning: Could not set $($env.key)" -ForegroundColor Yellow
        }
    }
    
    # Save service details
    @{
        serviceId = $serviceId
        serviceUrl = "https://$serviceUrl"
        jwtSecret = $jwtSecret
        jwtRefreshSecret = $jwtRefreshSecret
    } | ConvertTo-Json | Out-File "render-service.json"
    
    Write-Host "`nDeployment initiated!" -ForegroundColor Green
    Write-Host "`nService will be live at: https://$serviceUrl" -ForegroundColor Green
    Write-Host "This may take 5-10 minutes for the first deployment." -ForegroundColor Yellow
    Write-Host "`nDemo Accounts:" -ForegroundColor Yellow
    Write-Host "  Student: STU20250001 / Student@123"
    Write-Host "  Teacher: TCH2025001 / Teacher@123"
    Write-Host "  Admin: ADM2025001 / Admin@123456"
    
} catch {
    Write-Host "`nDeployment failed!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Red
    }
}

Write-Host "`nSetup complete!" -ForegroundColor Green
