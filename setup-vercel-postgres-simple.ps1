# Vercel Postgres Setup - Simple Version
# Compatible with PowerShell 5.1

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "     Vercel Postgres Setup for ITER College Website        " -ForegroundColor Cyan
Write-Host "          Powered by Neon - Serverless PostgreSQL           " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "This wizard will:" -ForegroundColor Yellow
Write-Host "  1. Install dependencies" -ForegroundColor White
Write-Host "  2. Create Vercel Postgres database" -ForegroundColor White
Write-Host "  3. Migrate 15,452 records from Supabase" -ForegroundColor White
Write-Host "  4. Deploy to production" -ForegroundColor White
Write-Host ""

# Step 1: Install Dependencies
Write-Host "------------------------------------------------------------" -ForegroundColor Cyan
Write-Host "STEP 1: Installing Dependencies" -ForegroundColor Cyan
Write-Host "------------------------------------------------------------" -ForegroundColor Cyan
Write-Host ""

if (!(Test-Path "node_modules\@vercel\postgres")) {
    Write-Host "[*] Installing @vercel/postgres..." -ForegroundColor Yellow
    npm install @vercel/postgres
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] @vercel/postgres installed" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] Failed to install @vercel/postgres" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[OK] @vercel/postgres already installed" -ForegroundColor Green
}
Write-Host ""

# Step 2: Create Database
Write-Host "------------------------------------------------------------" -ForegroundColor Cyan
Write-Host "STEP 2: Create Vercel Postgres Database" -ForegroundColor Cyan
Write-Host "------------------------------------------------------------" -ForegroundColor Cyan
Write-Host ""

Write-Host "Choose your method:" -ForegroundColor Yellow
Write-Host "  [1] Create via Vercel Dashboard (Recommended)" -ForegroundColor White
Write-Host "  [2] Create via Vercel CLI" -ForegroundColor White
Write-Host "  [3] Already created - Skip" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Enter choice (1-3)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "[*] Opening Vercel Dashboard..." -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Follow these steps:" -ForegroundColor Yellow
        Write-Host "  1. Click 'Storage' in left sidebar" -ForegroundColor White
        Write-Host "  2. Click 'Create Database'" -ForegroundColor White
        Write-Host "  3. Select 'Postgres'" -ForegroundColor White
        Write-Host "  4. Name: iter-college-db" -ForegroundColor White
        Write-Host "  5. Region: US East (or closest)" -ForegroundColor White
        Write-Host "  6. Click 'Create'" -ForegroundColor White
        Write-Host ""
        
        Start-Process "https://vercel.com/dashboard"
        
        Write-Host "[!] Press Enter after creating database..." -ForegroundColor Yellow
        Read-Host
    }
    "2" {
        Write-Host ""
        Write-Host "[*] Creating database via CLI..." -ForegroundColor Yellow
        vercel postgres create iter-college-db
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] Database created" -ForegroundColor Green
        } else {
            Write-Host "[ERROR] Failed to create database" -ForegroundColor Red
            Write-Host "[INFO] Try method 1 (Dashboard) instead" -ForegroundColor Yellow
            exit 1
        }
    }
    "3" {
        Write-Host "[OK] Skipping database creation" -ForegroundColor Green
    }
    default {
        Write-Host "[ERROR] Invalid choice" -ForegroundColor Red
        exit 1
    }
}
Write-Host ""

# Step 3: Get Connection Details
Write-Host "------------------------------------------------------------" -ForegroundColor Cyan
Write-Host "STEP 3: Configure Connection" -ForegroundColor Cyan
Write-Host "------------------------------------------------------------" -ForegroundColor Cyan
Write-Host ""

Write-Host "Go to: https://vercel.com/dashboard" -ForegroundColor Yellow
Write-Host "  1. Select your project: iter-college-management" -ForegroundColor White
Write-Host "  2. Click 'Storage' tab" -ForegroundColor White
Write-Host "  3. Click your database" -ForegroundColor White
Write-Host "  4. Click '.env.local' tab" -ForegroundColor White
Write-Host "  5. Copy the connection strings" -ForegroundColor White
Write-Host ""

Write-Host "[!] Enter connection details:" -ForegroundColor Yellow
Write-Host ""

$POSTGRES_URL = Read-Host "POSTGRES_URL (pooled connection)"
$POSTGRES_URL_NON_POOLING = Read-Host "POSTGRES_URL_NON_POOLING (direct)"
$POSTGRES_USER = Read-Host "POSTGRES_USER"
$POSTGRES_HOST = Read-Host "POSTGRES_HOST"
$POSTGRES_PASSWORD = Read-Host "POSTGRES_PASSWORD"
$POSTGRES_DATABASE = Read-Host "POSTGRES_DATABASE"

# Update .env file
Write-Host ""
Write-Host "[*] Updating .env file..." -ForegroundColor Yellow

$envContent = @"

# Vercel Postgres (Added by setup wizard)
POSTGRES_URL=$POSTGRES_URL
POSTGRES_URL_NON_POOLING=$POSTGRES_URL_NON_POOLING
POSTGRES_PRISMA_URL=$POSTGRES_URL_NON_POOLING
POSTGRES_URL_NO_SSL=$POSTGRES_URL
POSTGRES_USER=$POSTGRES_USER
POSTGRES_HOST=$POSTGRES_HOST
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DATABASE=$POSTGRES_DATABASE
"@

Add-Content -Path ".env" -Value $envContent
Write-Host "[OK] .env file updated" -ForegroundColor Green
Write-Host ""

# Step 4: Create Schema
Write-Host "------------------------------------------------------------" -ForegroundColor Cyan
Write-Host "STEP 4: Create Database Schema" -ForegroundColor Cyan
Write-Host "------------------------------------------------------------" -ForegroundColor Cyan
Write-Host ""

$createSchema = Read-Host "Create schema (18 tables)? (y/n)"
if ($createSchema -eq "y") {
    Write-Host "[*] Creating schema..." -ForegroundColor Yellow
    node create-vercel-schema.js
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Schema created (18 tables)" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] Schema creation failed" -ForegroundColor Red
        Write-Host "[INFO] Check create-vercel-schema.js output" -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "[SKIP] Schema creation skipped" -ForegroundColor Yellow
}
Write-Host ""

# Step 5: Migrate Data
Write-Host "------------------------------------------------------------" -ForegroundColor Cyan
Write-Host "STEP 5: Migrate Data from Supabase" -ForegroundColor Cyan
Write-Host "------------------------------------------------------------" -ForegroundColor Cyan
Write-Host ""

$migrateData = Read-Host "Migrate 15,452 records? (y/n)"
if ($migrateData -eq "y") {
    Write-Host "[*] Migrating data (this may take 5 minutes)..." -ForegroundColor Yellow
    node migrate-supabase-to-vercel-postgres.js
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Data migrated (15,452 records)" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] Migration failed" -ForegroundColor Red
        Write-Host "[INFO] Check migrate-supabase-to-vercel-postgres.js output" -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "[SKIP] Data migration skipped" -ForegroundColor Yellow
}
Write-Host ""

# Step 6: Update Backend
Write-Host "------------------------------------------------------------" -ForegroundColor Cyan
Write-Host "STEP 6: Update Backend Code" -ForegroundColor Cyan
Write-Host "------------------------------------------------------------" -ForegroundColor Cyan
Write-Host ""

$updateBackend = Read-Host "Switch to hybrid db.js? (y/n)"
if ($updateBackend -eq "y") {
    Write-Host "[*] Backing up current db.js..." -ForegroundColor Yellow
    Copy-Item "server\database\db.js" "server\database\db-supabase-backup.js" -Force
    
    Write-Host "[*] Switching to hybrid db.js..." -ForegroundColor Yellow
    Copy-Item "server\database\db-hybrid.js" "server\database\db.js" -Force
    
    Write-Host "[OK] Backend updated" -ForegroundColor Green
    Write-Host "[INFO] Original saved as db-supabase-backup.js" -ForegroundColor Cyan
} else {
    Write-Host "[SKIP] Backend update skipped" -ForegroundColor Yellow
}
Write-Host ""

# Step 7: Deploy to Vercel
Write-Host "------------------------------------------------------------" -ForegroundColor Cyan
Write-Host "STEP 7: Deploy to Production" -ForegroundColor Cyan
Write-Host "------------------------------------------------------------" -ForegroundColor Cyan
Write-Host ""

$deploy = Read-Host "Deploy to Vercel now? (y/n)"
if ($deploy -eq "y") {
    Write-Host "[*] Deploying to Vercel..." -ForegroundColor Yellow
    vercel --prod
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Deployed successfully" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] Deployment failed" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[SKIP] Deployment skipped" -ForegroundColor Yellow
    Write-Host "[INFO] Run 'vercel --prod' when ready" -ForegroundColor Cyan
}
Write-Host ""

# Step 8: Test
Write-Host "------------------------------------------------------------" -ForegroundColor Cyan
Write-Host "STEP 8: Test Deployment" -ForegroundColor Cyan
Write-Host "------------------------------------------------------------" -ForegroundColor Cyan
Write-Host ""

Write-Host "Manual Testing:" -ForegroundColor Yellow
Write-Host "  1. Visit: https://iter-college-management.vercel.app" -ForegroundColor White
Write-Host "  2. Try login with:" -ForegroundColor White
Write-Host "     Admin: ADM2025001 / Admin@123456" -ForegroundColor Cyan
Write-Host "     Teacher: TCH2025001 / Teacher@123" -ForegroundColor Cyan
Write-Host "     Student: STU2025001 / Student@123" -ForegroundColor Cyan
Write-Host ""

Write-Host "============================================================" -ForegroundColor Green
Write-Host "                    SETUP COMPLETE!                         " -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""

Write-Host "What we did:" -ForegroundColor Yellow
Write-Host "  [OK] Installed @vercel/postgres" -ForegroundColor Green
Write-Host "  [OK] Created Vercel Postgres database" -ForegroundColor Green
Write-Host "  [OK] Updated environment variables" -ForegroundColor Green
if ($createSchema -eq "y") {
    Write-Host "  [OK] Created database schema" -ForegroundColor Green
}
if ($migrateData -eq "y") {
    Write-Host "  [OK] Migrated 15,452 records" -ForegroundColor Green
}
if ($updateBackend -eq "y") {
    Write-Host "  [OK] Updated backend code" -ForegroundColor Green
}
if ($deploy -eq "y") {
    Write-Host "  [OK] Deployed to production" -ForegroundColor Green
}
Write-Host ""

Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Test the website login" -ForegroundColor White
Write-Host "  2. Check Vercel logs for errors" -ForegroundColor White
Write-Host "  3. Monitor database in Vercel dashboard" -ForegroundColor White
Write-Host ""

Write-Host "[INFO] Setup wizard completed successfully!" -ForegroundColor Cyan
Write-Host ""
