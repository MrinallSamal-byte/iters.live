# Add Render PostgreSQL Environment Variables to Vercel
Write-Host "Adding Render PostgreSQL environment variables to Vercel..." -ForegroundColor Cyan
Write-Host ""

$DATABASE_URL = "postgresql://iter_college_db_user:93UqDvuxyr57TKtxgvBWIVSj3CcAJe6B@dpg-d3o80g3e5dus73agr8q0-a.ohio-postgres.render.com/iter_college_db"

# Add to all environments
$envVars = @{
    "DATABASE_URL" = $DATABASE_URL
    "POSTGRES_URL" = $DATABASE_URL
    "POSTGRES_URL_NON_POOLING" = $DATABASE_URL
    "DB_HOST" = "dpg-d3o80g3e5dus73agr8q0-a.ohio-postgres.render.com"
    "DB_PORT" = "5432"
    "DB_USER" = "iter_college_db_user"
    "DB_PASSWORD" = "93UqDvuxyr57TKtxgvBWIVSj3CcAJe6B"
    "DB_NAME" = "iter_college_db"
    "POSTGRES_HOST" = "dpg-d3o80g3e5dus73agr8q0-a.ohio-postgres.render.com"
    "POSTGRES_USER" = "iter_college_db_user"
    "POSTGRES_PASSWORD" = "93UqDvuxyr57TKtxgvBWIVSj3CcAJe6B"
    "POSTGRES_DATABASE" = "iter_college_db"
}

foreach ($key in $envVars.Keys) {
    $value = $envVars[$key]
    Write-Host "[*] Adding $key..." -ForegroundColor Yellow
    
    # Add to production
    echo $value | vercel env add $key production
    
    # Add to preview
    echo $value | vercel env add $key preview
    
    Write-Host "[OK] $key added" -ForegroundColor Green
    Write-Host ""
}

Write-Host "============================================================" -ForegroundColor Green
Write-Host "Environment variables added to Vercel successfully!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
