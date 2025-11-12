# Setup Vercel Environment Variables for Railway MySQL
# This script configures all required environment variables for Vercel deployment

Write-Host "`n🚀 Setting up Vercel Environment Variables..." -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Cyan

# Database Configuration
Write-Host "📊 Setting Database Configuration..." -ForegroundColor Yellow
vercel env add DB_HOST production
# When prompted, enter: mysql.railway.internal

vercel env add DB_PORT production
# When prompted, enter: 3306

vercel env add DB_USER production
# When prompted, enter: root

vercel env add DB_PASSWORD production
# When prompted, enter: NlEpRBhwEHsSHrDWEEfahDOMcEzfIdLh

vercel env add DB_NAME production
# When prompted, enter: railway

# Security Configuration
Write-Host "`n🔐 Setting Security Configuration..." -ForegroundColor Yellow
vercel env add JWT_SECRET production
# When prompted, enter: prod-jwt-secret-change-this-in-production-8f4b2c9d1e7a3f6b

vercel env add JWT_REFRESH_SECRET production
# When prompted, enter: prod-refresh-secret-change-this-in-production-3e7c1f9b4d2a

vercel env add JWT_EXPIRE production
# When prompted, enter: 1h

vercel env add JWT_REFRESH_EXPIRE production
# When prompted, enter: 7d

# Application Configuration
Write-Host "`n⚙️ Setting Application Configuration..." -ForegroundColor Yellow
vercel env add NODE_ENV production
# When prompted, enter: production

vercel env add PORT production
# When prompted, enter: 5000

vercel env add CLIENT_URL production
# When prompted, enter: https://iter-college-management.vercel.app

vercel env add CORS_WHITELIST production
# When prompted, enter: https://iter-college-management.vercel.app

vercel env add RATE_LIMIT_WINDOW_MS production
# When prompted, enter: 900000

vercel env add RATE_LIMIT_MAX_REQUESTS production
# When prompted, enter: 100

Write-Host "`n✅ Environment variables setup complete!" -ForegroundColor Green
Write-Host "`n🔄 Now redeploying to Vercel..." -ForegroundColor Cyan
vercel --prod

Write-Host "`n✅ Deployment complete! Testing connection..." -ForegroundColor Green
Start-Sleep -Seconds 10
node test-vercel-deployment.js
