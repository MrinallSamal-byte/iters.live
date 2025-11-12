# MySQL Password Reset Script for Windows
# Run this in PowerShell as Administrator

Write-Host "MySQL Password Reset Guide" -ForegroundColor Cyan
Write-Host "=" -NoNewline -ForegroundColor Cyan; Write-Host ("=" * 50) -ForegroundColor Cyan
Write-Host ""

Write-Host "Step 1: Stop MySQL Service" -ForegroundColor Yellow
Write-Host "Run: " -NoNewline
Write-Host "Stop-Service MySQL80" -ForegroundColor Green
Write-Host ""

Write-Host "Step 2: Start MySQL in Safe Mode" -ForegroundColor Yellow
Write-Host "Run: " -NoNewline
Write-Host 'mysqld --console --skip-grant-tables --shared-memory' -ForegroundColor Green
Write-Host "(Leave this window open and open a new PowerShell window)" -ForegroundColor Gray
Write-Host ""

Write-Host "Step 3: In the NEW window, connect to MySQL" -ForegroundColor Yellow
Write-Host "Run: " -NoNewline
Write-Host 'mysql -u root' -ForegroundColor Green
Write-Host ""

Write-Host "Step 4: Reset the password in MySQL" -ForegroundColor Yellow
Write-Host "Run these SQL commands:" -ForegroundColor Gray
Write-Host "  FLUSH PRIVILEGES;" -ForegroundColor Green
Write-Host "  ALTER USER 'root'@'localhost' IDENTIFIED BY 'newpassword123';" -ForegroundColor Green
Write-Host "  FLUSH PRIVILEGES;" -ForegroundColor Green
Write-Host "  EXIT;" -ForegroundColor Green
Write-Host ""

Write-Host "Step 5: Restart MySQL normally" -ForegroundColor Yellow
Write-Host "Close the safe mode window (Ctrl+C)" -ForegroundColor Gray
Write-Host "Run: " -NoNewline
Write-Host "Start-Service MySQL80" -ForegroundColor Green
Write-Host ""

Write-Host "Step 6: Update .env file" -ForegroundColor Yellow
Write-Host "Set: " -NoNewline
Write-Host "DB_PASSWORD=newpassword123" -ForegroundColor Green
Write-Host ""

Write-Host "=" -NoNewline -ForegroundColor Cyan; Write-Host ("=" * 50) -ForegroundColor Cyan
