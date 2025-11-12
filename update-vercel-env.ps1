# Update Vercel Environment Variables for Supabase
Write-Host "`n🔄 Updating Vercel Environment Variables for Supabase...`n" -ForegroundColor Cyan

# Read .env file
$envFile = Get-Content ".env"
$envVars = @{}

foreach ($line in $envFile) {
    if ($line -match "^([^#][^=]+)=(.*)$") {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        $envVars[$key] = $value
    }
}

# Remove old MySQL variables
Write-Host "🗑️  Removing old database variables..." -ForegroundColor Yellow
$oldVars = @(
    "DB_HOST",
    "DB_PORT",
    "DB_USER",
    "DB_PASSWORD",
    "DB_NAME"
)

foreach ($var in $oldVars) {
    vercel env rm $var production --yes 2>$null
    Write-Host "   Removed $var"
}

# Add new Supabase variables
Write-Host "`n📝 Adding Supabase variables..." -ForegroundColor Green

$supabaseVars = @{
    "DB_HOST" = $envVars["DB_HOST"]
    "DB_PORT" = "5432"
    "DB_USER" = "postgres"
    "DB_PASSWORD" = $envVars["DB_PASSWORD"]
    "DB_NAME" = "postgres"
    "SUPABASE_URL" = $envVars["SUPABASE_URL"]
    "SUPABASE_ANON_KEY" = $envVars["SUPABASE_ANON_KEY"]
    "SUPABASE_SERVICE_KEY" = $envVars["SUPABASE_SERVICE_KEY"]
    "DATABASE_URL" = "postgresql://postgres:$($envVars['DB_PASSWORD'])@$($envVars['DB_HOST']):5432/postgres?sslmode=require"
}

foreach ($key in $supabaseVars.Keys) {
    $value = $supabaseVars[$key]
    if ($value) {
        Write-Output $value | vercel env add $key production
        Write-Host "   ✅ Added $key" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Skipped $key (no value)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "✅ Vercel environment variables updated!" -ForegroundColor Green
Write-Host ""
Write-Host "Next step: Run vercel to deploy" -ForegroundColor Cyan
