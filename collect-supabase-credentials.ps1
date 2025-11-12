# Supabase Credentials Collector

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Collecting Supabase Credentials" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "I can see you have these keys:" -ForegroundColor Green
Write-Host "✅ Publishable Key: sb_publishable_uz7cuSyyraLQtynkNrILYA_gNsic5HD" -ForegroundColor Gray
Write-Host "✅ Secret Key: sb_secret_RW5pRdOOrV4vFAQCmsixhg_A87SITI_" -ForegroundColor Gray
Write-Host ""

Write-Host "Now I need a few more details from Supabase Dashboard:" -ForegroundColor Yellow
Write-Host ""

Write-Host "1. Go to Settings -> API" -ForegroundColor White
Write-Host ""
Write-Host "Enter your Project URL:" -ForegroundColor Yellow
Write-Host "Example: https://abcdefghijklmnop.supabase.co" -ForegroundColor Gray
$supabaseUrl = Read-Host "SUPABASE_URL"

Write-Host ""
Write-Host "Enter your anon/public key:" -ForegroundColor Yellow
Write-Host "(This is different from publishable key - look for 'anon' key)" -ForegroundColor Gray
Write-Host "Example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." -ForegroundColor Gray
$anonKey = Read-Host "SUPABASE_ANON_KEY"

Write-Host ""
Write-Host "Enter your service_role key:" -ForegroundColor Yellow
Write-Host "(This is the secret key with full access)" -ForegroundColor Gray
Write-Host "Example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." -ForegroundColor Gray
$serviceKey = Read-Host "SUPABASE_SERVICE_KEY"

Write-Host ""
Write-Host "2. Now go to Settings -> Database" -ForegroundColor White
Write-Host ""

Write-Host "Enter your Database Host:" -ForegroundColor Yellow
Write-Host "Example: db.abcdefghijklmnop.supabase.co" -ForegroundColor Gray
$dbHost = Read-Host "DB_HOST"

Write-Host ""
Write-Host "Enter your Database Password:" -ForegroundColor Yellow
Write-Host "(The password you set when creating the project)" -ForegroundColor Gray
$dbPassword = Read-Host "DB_PASSWORD" -MaskInput

Write-Host ""
Write-Host "Creating .env file..." -ForegroundColor Cyan

$envContent = @"
# Supabase Configuration
SUPABASE_URL=$supabaseUrl
SUPABASE_ANON_KEY=$anonKey
SUPABASE_SERVICE_KEY=$serviceKey
SUPABASE_PUBLISHABLE_KEY=sb_publishable_uz7cuSyyraLQtynkNrILYA_gNsic5HD
SUPABASE_SECRET_KEY=sb_secret_RW5pRdOOrV4vFAQCmsixhg_A87SITI_

# Database Configuration (PostgreSQL)
DATABASE_URL=postgresql://postgres:$dbPassword@$dbHost:5432/postgres
DB_HOST=$dbHost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=$dbPassword
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
Write-Host "✅ Created .env file with Supabase configuration" -ForegroundColor Green

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host " Credentials Saved!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Create database schema" -ForegroundColor White
Write-Host "2. Migrate data from Railway" -ForegroundColor White
Write-Host "3. Update Vercel" -ForegroundColor White
Write-Host "4. Deploy and test" -ForegroundColor White
Write-Host ""

$continue = Read-Host "Continue with setup? (y/n)"
if ($continue -eq "y") {
    Write-Host ""
    Write-Host "Step 1: Creating Database Schema" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Opening Supabase SQL Editor..." -ForegroundColor Yellow
    Start-Process "$supabaseUrl/project/default/sql"
    
    Write-Host ""
    Write-Host "Opening schema file..." -ForegroundColor Yellow
    code supabase-schema.sql
    
    Write-Host ""
    Write-Host "INSTRUCTIONS:" -ForegroundColor Yellow
    Write-Host "1. Copy ALL contents from supabase-schema.sql" -ForegroundColor White
    Write-Host "2. Paste into Supabase SQL Editor" -ForegroundColor White
    Write-Host "3. Click 'Run' button" -ForegroundColor White
    Write-Host "4. Wait for 'Success' message" -ForegroundColor White
    Write-Host ""
    
    Read-Host "Press Enter when schema is created..."
    
    Write-Host ""
    Write-Host "Step 2: Migrating Data from Railway" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "This will migrate:" -ForegroundColor Yellow
    Write-Host "- 553 Users (3 admin, 50 teacher, 500 student)" -ForegroundColor White
    Write-Host "- 13,050 Attendance records" -ForegroundColor White
    Write-Host "- 1,740 Marks records" -ForegroundColor White
    Write-Host "- 104 Assignments" -ForegroundColor White
    Write-Host "- 5 Events" -ForegroundColor White
    Write-Host "- All other data" -ForegroundColor White
    Write-Host ""
    
    $migrate = Read-Host "Start migration? (y/n)"
    if ($migrate -eq "y") {
        node migrate-to-supabase.js
    }
    
    Write-Host ""
    Write-Host "Step 3: Updating Vercel Environment Variables" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
    
    $updateVercel = Read-Host "Update Vercel env variables? (y/n)"
    if ($updateVercel -eq "y") {
        Write-Host ""
        Write-Host "Removing old MySQL variables..." -ForegroundColor Yellow
        vercel env rm DB_HOST production --yes 2>$null
        vercel env rm DB_PORT production --yes 2>$null
        vercel env rm DB_USER production --yes 2>$null
        vercel env rm DB_PASSWORD production --yes 2>$null
        vercel env rm DB_NAME production --yes 2>$null
        
        Write-Host "Adding Supabase variables..." -ForegroundColor Yellow
        echo $supabaseUrl | vercel env add SUPABASE_URL production
        echo $anonKey | vercel env add SUPABASE_ANON_KEY production
        echo $serviceKey | vercel env add SUPABASE_SERVICE_KEY production
        echo $dbHost | vercel env add DB_HOST production
        echo "5432" | vercel env add DB_PORT production
        echo "postgres" | vercel env add DB_USER production
        echo $dbPassword | vercel env add DB_PASSWORD production
        echo "postgres" | vercel env add DB_NAME production
        echo "postgresql://postgres:$dbPassword@$dbHost:5432/postgres" | vercel env add DATABASE_URL production
        
        Write-Host "✅ Vercel environment variables updated" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "Step 4: Deploy to Vercel" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
    
    $deploy = Read-Host "Deploy to Vercel now? (y/n)"
    if ($deploy -eq "y") {
        Write-Host ""
        Write-Host "Deploying..." -ForegroundColor Yellow
        vercel --prod
        
        Write-Host ""
        Write-Host "Waiting 30 seconds for deployment..." -ForegroundColor Yellow
        Start-Sleep -Seconds 30
        
        Write-Host ""
        Write-Host "Testing deployment..." -ForegroundColor Yellow
        node test-vercel-deployment.js
    }
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host " Setup Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Test your website:" -ForegroundColor Cyan
Write-Host "https://iter-college-management.vercel.app" -ForegroundColor White
Write-Host ""
Write-Host "Login with:" -ForegroundColor Cyan
Write-Host "Registration: ADM2025001" -ForegroundColor White
Write-Host "Password: Admin@123456" -ForegroundColor White
Write-Host ""
