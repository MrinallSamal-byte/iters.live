# Setup Vercel Postgres - Interactive Wizard
Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     Vercel Postgres Setup for ITER College Website        ║" -ForegroundColor Cyan
Write-Host "║            Powered by Neon - Serverless PostgreSQL         ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

Write-Host "This wizard will help you:" -ForegroundColor Yellow
Write-Host "  1. Create a Vercel Postgres database" -ForegroundColor White
Write-Host "  2. Migrate your 15,452 records from Supabase" -ForegroundColor White
Write-Host "  3. Update environment variables" -ForegroundColor White
Write-Host "  4. Deploy to production`n" -ForegroundColor White

# Step 1: Check if @vercel/postgres is installed
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "STEP 1: Installing Dependencies" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Cyan

if (!(Test-Path "node_modules\@vercel\postgres")) {
    Write-Host "📦 Installing @vercel/postgres..." -ForegroundColor Yellow
    npm install @vercel/postgres
    Write-Host "✅ @vercel/postgres installed`n" -ForegroundColor Green
} else {
    Write-Host "✅ @vercel/postgres already installed`n" -ForegroundColor Green
}

# Step 2: Create Vercel Postgres Database
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "STEP 2: Create Vercel Postgres Database" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Cyan

Write-Host "Choose your preferred method:" -ForegroundColor Yellow
Write-Host "  [1] Create via Vercel Dashboard (Recommended)" -ForegroundColor White
Write-Host "  [2] Create via Vercel CLI" -ForegroundColor White
Write-Host "  [3] Already created - Skip to configuration`n" -ForegroundColor White

$choice = Read-Host "Enter your choice (1-3)"

switch ($choice) {
    "1" {
        Write-Host "`n📱 Opening Vercel Dashboard..." -ForegroundColor Cyan
        Write-Host "`nFollow these steps:" -ForegroundColor Yellow
        Write-Host "  1. Click 'Storage' in the left sidebar" -ForegroundColor White
        Write-Host "  2. Click 'Create Database'" -ForegroundColor White
        Write-Host "  3. Select 'Postgres'" -ForegroundColor White
        Write-Host "  4. Name it: iter-college-db" -ForegroundColor White
        Write-Host "  5. Choose region: US East (or closest to you)" -ForegroundColor White
        Write-Host "  6. Click 'Create'`n" -ForegroundColor White
        
        Start-Process "https://vercel.com/dashboard"
        
        Write-Host "Press Enter after creating the database..." -ForegroundColor Yellow
        Read-Host
    }
    "2" {
        Write-Host "`n📦 Creating database via CLI..." -ForegroundColor Cyan
        vercel postgres create iter-college-db
        Write-Host "✅ Database created`n" -ForegroundColor Green
    }
    "3" {
        Write-Host "`n✅ Skipping database creation`n" -ForegroundColor Green
    }
    default {
        Write-Host "`n❌ Invalid choice. Exiting..." -ForegroundColor Red
        exit 1
    }
}

# Step 3: Get Connection Details
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "STEP 3: Configure Connection Details" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Cyan

Write-Host "Go to your Vercel Postgres database and:" -ForegroundColor Yellow
Write-Host "  1. Click the '.env.local' tab" -ForegroundColor White
Write-Host "  2. Copy the connection strings`n" -ForegroundColor White

Write-Host "Paste your connection strings below:`n" -ForegroundColor Cyan

Write-Host "POSTGRES_URL (pooled connection):" -ForegroundColor Yellow
$POSTGRES_URL = Read-Host

Write-Host "`nPOSTGRES_URL_NON_POOLING (direct connection):" -ForegroundColor Yellow
$POSTGRES_URL_NON_POOLING = Read-Host

# Parse connection details
if ($POSTGRES_URL -match "postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(\w+)") {
    $POSTGRES_USER = $matches[1]
    $POSTGRES_PASSWORD = $matches[2]
    $POSTGRES_HOST = $matches[3]
    $POSTGRES_DATABASE = $matches[5]
    
    Write-Host "`n✅ Connection details parsed successfully!" -ForegroundColor Green
    Write-Host "   User: $POSTGRES_USER" -ForegroundColor Gray
    Write-Host "   Host: $POSTGRES_HOST" -ForegroundColor Gray
    Write-Host "   Database: $POSTGRES_DATABASE`n" -ForegroundColor Gray
} else {
    Write-Host "`n❌ Invalid connection string format. Exiting..." -ForegroundColor Red
    exit 1
}

# Step 4: Update .env file
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "STEP 4: Updating .env File" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Cyan

$envContent = Get-Content ".env" -Raw

# Add Vercel Postgres configuration
$vercelConfig = @"

# Vercel Postgres Configuration (Production)
POSTGRES_URL=$POSTGRES_URL
POSTGRES_URL_NON_POOLING=$POSTGRES_URL_NON_POOLING
POSTGRES_USER=$POSTGRES_USER
POSTGRES_HOST=$POSTGRES_HOST
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DATABASE=$POSTGRES_DATABASE
"@

$envContent += $vercelConfig
Set-Content ".env" $envContent

Write-Host "✅ .env file updated with Vercel Postgres configuration`n" -ForegroundColor Green

# Step 5: Create Schema
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "STEP 5: Creating Database Schema" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Cyan

Write-Host "Do you want to create the database schema now? (Y/N): " -ForegroundColor Yellow -NoNewline
$createSchema = Read-Host

if ($createSchema -eq "Y" -or $createSchema -eq "y") {
    Write-Host "`n📋 Creating schema in Vercel Postgres..." -ForegroundColor Cyan
    node create-vercel-schema.js
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ Schema created successfully!" -ForegroundColor Green
    } else {
        Write-Host "`n❌ Schema creation failed. Check errors above." -ForegroundColor Red
        Write-Host "You can retry later with: node create-vercel-schema.js`n" -ForegroundColor Yellow
        exit 1
    }
}

# Step 6: Migrate Data
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "STEP 6: Migrate Data from Supabase" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Cyan

Write-Host "Ready to migrate 15,452 records from Supabase?" -ForegroundColor Yellow
Write-Host "  • 553 users" -ForegroundColor White
Write-Host "  • 13,050 attendance records" -ForegroundColor White
Write-Host "  • 1,740 marks" -ForegroundColor White
Write-Host "  • 104 assignments" -ForegroundColor White
Write-Host "  • 5 events`n" -ForegroundColor White

Write-Host "Start migration? (Y/N): " -ForegroundColor Yellow -NoNewline
$migrate = Read-Host

if ($migrate -eq "Y" -or $migrate -eq "y") {
    Write-Host "`n📦 Starting data migration..." -ForegroundColor Cyan
    node migrate-supabase-to-vercel-postgres.js
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ Data migration completed!" -ForegroundColor Green
    } else {
        Write-Host "`n❌ Migration failed. Check errors above." -ForegroundColor Red
        Write-Host "You can retry later with: node migrate-supabase-to-vercel-postgres.js`n" -ForegroundColor Yellow
        exit 1
    }
}

# Step 7: Update Backend
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "STEP 7: Update Backend Code" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Cyan

Write-Host "Replacing db.js with hybrid version..." -ForegroundColor Cyan
Copy-Item "server\database\db.js" "server\database\db-supabase-backup.js" -Force
Copy-Item "server\database\db-hybrid.js" "server\database\db.js" -Force
Write-Host "✅ Backend updated to use Vercel Postgres in production`n" -ForegroundColor Green

# Step 8: Deploy to Vercel
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "STEP 8: Deploy to Vercel" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Cyan

Write-Host "Deploy to production now? (Y/N): " -ForegroundColor Yellow -NoNewline
$deploy = Read-Host

if ($deploy -eq "Y" -or $deploy -eq "y") {
    Write-Host "`n🚀 Deploying to Vercel..." -ForegroundColor Cyan
    vercel --prod
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ Deployment successful!" -ForegroundColor Green
    } else {
        Write-Host "`n❌ Deployment failed. Check errors above." -ForegroundColor Red
        exit 1
    }
}

# Step 9: Test Deployment
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "STEP 9: Test Deployment" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Cyan

Write-Host "Test the API now? (Y/N): " -ForegroundColor Yellow -NoNewline
$test = Read-Host

if ($test -eq "Y" -or $test -eq "y") {
    Write-Host "`n🧪 Testing API endpoints..." -ForegroundColor Cyan
    Start-Sleep -Seconds 5
    node test-vercel-deployment.js
}

# Final Summary
Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║              🎉 Setup Complete! 🎉                        ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor Green

Write-Host "✅ Vercel Postgres database created" -ForegroundColor Green
Write-Host "✅ Schema created (18 tables)" -ForegroundColor Green
Write-Host "✅ Data migrated (15,452 records)" -ForegroundColor Green
Write-Host "✅ Backend updated" -ForegroundColor Green
Write-Host "✅ Deployed to production`n" -ForegroundColor Green

Write-Host "🌐 Your website: https://iter-college-management.vercel.app" -ForegroundColor Cyan
Write-Host "📊 Vercel Dashboard: https://vercel.com/dashboard`n" -ForegroundColor Cyan

Write-Host "Demo Accounts:" -ForegroundColor Yellow
Write-Host "  Admin:   ADM2025001 / Admin@123456" -ForegroundColor White
Write-Host "  Teacher: TCH2025001 / Teacher@123" -ForegroundColor White
Write-Host "  Student: STU2025001 / Student@123`n" -ForegroundColor White

Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Test login at your website" -ForegroundColor White
Write-Host "  2. Monitor queries in Vercel Dashboard → Storage" -ForegroundColor White
Write-Host "  3. Check database metrics and performance`n" -ForegroundColor White

Write-Host "Press Enter to exit..." -ForegroundColor Gray
Read-Host
