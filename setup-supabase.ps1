# Supabase Complete Setup Script
# This script helps you set up Supabase integration

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Supabase Integration Setup" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "STEP 1: Create Supabase Project" -ForegroundColor Yellow
Write-Host "Go to: https://supabase.com/dashboard" -ForegroundColor White
Write-Host ""

$openSupabase = Read-Host "Open Supabase Dashboard? (y/n)"
if ($openSupabase -eq "y") {
    Start-Process "https://supabase.com/dashboard"
    Write-Host "✅ Opened Supabase Dashboard" -ForegroundColor Green
}

Write-Host ""
Write-Host "Please complete these steps in Supabase:" -ForegroundColor Yellow
Write-Host "1. Sign up / Login (use GitHub for easy setup)" -ForegroundColor White
Write-Host "2. Click 'New Project'" -ForegroundColor White
Write-Host "3. Project Name: iter-college-management" -ForegroundColor White
Write-Host "4. Set a strong database password (SAVE IT!)" -ForegroundColor White
Write-Host "5. Select region (ap-south-1 for India)" -ForegroundColor White
Write-Host "6. Click 'Create new project'" -ForegroundColor White
Write-Host "7. Wait 2-3 minutes for setup" -ForegroundColor White
Write-Host ""

Read-Host "Press Enter when project is created..."

Write-Host ""
Write-Host "STEP 2: Get Supabase Credentials" -ForegroundColor Yellow
Write-Host ""
Write-Host "In Supabase Dashboard, go to:" -ForegroundColor White
Write-Host "Settings -> API" -ForegroundColor Cyan
Write-Host ""

Write-Host "Enter your Supabase URL:" -ForegroundColor Yellow
Write-Host "Example: https://abcdefghijklmnop.supabase.co" -ForegroundColor Gray
$supabaseUrl = Read-Host "SUPABASE_URL"

Write-Host ""
Write-Host "Enter your Supabase Anon Key:" -ForegroundColor Yellow
Write-Host "(Settings -> API -> anon/public key)" -ForegroundColor Gray
$supabaseAnonKey = Read-Host "SUPABASE_ANON_KEY"

Write-Host ""
Write-Host "Enter your Supabase Service Role Key:" -ForegroundColor Yellow
Write-Host "(Settings -> API -> service_role key)" -ForegroundColor Gray
$supabaseServiceKey = Read-Host "SUPABASE_SERVICE_KEY"

Write-Host ""
Write-Host "Now go to: Settings -> Database" -ForegroundColor White
Write-Host ""

Write-Host "Enter database host:" -ForegroundColor Yellow
Write-Host "Example: db.abcdefghijklmnop.supabase.co" -ForegroundColor Gray
$dbHost = Read-Host "DB_HOST"

Write-Host ""
Write-Host "Enter database password:" -ForegroundColor Yellow
Write-Host "(The password you set when creating project)" -ForegroundColor Gray
$dbPassword = Read-Host "DB_PASSWORD" -AsSecureString
$dbPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPassword))

Write-Host ""
Write-Host "Creating .env file with Supabase configuration..." -ForegroundColor Cyan

$envContent = @"
# Supabase Configuration
SUPABASE_URL=$supabaseUrl
SUPABASE_ANON_KEY=$supabaseAnonKey
SUPABASE_SERVICE_KEY=$supabaseServiceKey

# Database Configuration (PostgreSQL)
DATABASE_URL=postgresql://postgres:$dbPasswordPlain@$dbHost:5432/postgres
DB_HOST=$dbHost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=$dbPasswordPlain
DB_NAME=postgres

# JWT Configuration
JWT_SECRET=prod-jwt-secret-change-this-in-production-8f4b2c9d1e7a3f6b
JWT_REFRESH_SECRET=prod-refresh-secret-change-this-in-production-3e7c1f9b4d2a
JWT_EXPIRE=1h
JWT_REFRESH_EXPIRE=7d

# Application Configuration
NODE_ENV=production
PORT=5000
CLIENT_URL=https://iter-college-management.vercel.app
CORS_WHITELIST=https://iter-college-management.vercel.app

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
"@

Set-Content -Path ".env" -Value $envContent
Write-Host "✅ Created .env file" -ForegroundColor Green

Write-Host ""
Write-Host "STEP 3: Create Database Schema" -ForegroundColor Yellow
Write-Host ""

$createSchema = Read-Host "Create database schema in Supabase? (y/n)"
if ($createSchema -eq "y") {
    Write-Host ""
    Write-Host "Go to Supabase Dashboard -> SQL Editor" -ForegroundColor Cyan
    Write-Host "Copy the contents of: supabase-schema.sql" -ForegroundColor White
    Write-Host "Paste in SQL Editor and click 'Run'" -ForegroundColor White
    Write-Host ""
    
    $openFile = Read-Host "Open supabase-schema.sql file? (y/n)"
    if ($openFile -eq "y") {
        code supabase-schema.sql
    }
    
    Read-Host "Press Enter when schema is created..."
}

Write-Host ""
Write-Host "STEP 4: Migrate Data from Railway" -ForegroundColor Yellow
Write-Host ""

$migrateData = Read-Host "Migrate data from Railway to Supabase? (y/n)"
if ($migrateData -eq "y") {
    Write-Host ""
    Write-Host "Starting data migration..." -ForegroundColor Cyan
    node migrate-to-supabase.js
}

Write-Host ""
Write-Host "STEP 5: Update Vercel Environment Variables" -ForegroundColor Yellow
Write-Host ""

Write-Host "Removing old MySQL variables..." -ForegroundColor Cyan
$oldVars = @("DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME")
foreach ($var in $oldVars) {
    try {
        vercel env rm $var production --yes 2>$null
    } catch {}
}

Write-Host "Adding Supabase variables..." -ForegroundColor Cyan

echo $supabaseUrl | vercel env add SUPABASE_URL production
echo $supabaseAnonKey | vercel env add SUPABASE_ANON_KEY production
echo $supabaseServiceKey | vercel env add SUPABASE_SERVICE_KEY production
echo $dbHost | vercel env add DB_HOST production
echo "5432" | vercel env add DB_PORT production
echo "postgres" | vercel env add DB_USER production
echo $dbPasswordPlain | vercel env add DB_PASSWORD production
echo "postgres" | vercel env add DB_NAME production
echo "postgresql://postgres:$dbPasswordPlain@$dbHost:5432/postgres" | vercel env add DATABASE_URL production

Write-Host "✅ Vercel environment variables updated" -ForegroundColor Green

Write-Host ""
Write-Host "STEP 6: Deploy to Vercel" -ForegroundColor Yellow
Write-Host ""

$deploy = Read-Host "Deploy to Vercel now? (y/n)"
if ($deploy -eq "y") {
    Write-Host ""
    Write-Host "Deploying to Vercel..." -ForegroundColor Cyan
    vercel --prod
    
    Write-Host ""
    Write-Host "Waiting for deployment..." -ForegroundColor Yellow
    Start-Sleep -Seconds 20
    
    Write-Host ""
    Write-Host "Testing deployment..." -ForegroundColor Cyan
    node test-vercel-deployment.js
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host " Setup Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

Write-Host "Your Supabase Configuration:" -ForegroundColor Cyan
Write-Host "URL: $supabaseUrl" -ForegroundColor White
Write-Host "Database: $dbHost" -ForegroundColor White
Write-Host ""

Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Test login at: https://iter-college-management.vercel.app" -ForegroundColor White
Write-Host "2. Use credentials:" -ForegroundColor White
Write-Host "   Registration: ADM2025001" -ForegroundColor Cyan
Write-Host "   Password: Admin@123456" -ForegroundColor Cyan
Write-Host ""

Write-Host "Supabase Dashboard: $supabaseUrl" -ForegroundColor Cyan
Write-Host "Vercel Dashboard: https://vercel.com/dashboard" -ForegroundColor Cyan
Write-Host ""
