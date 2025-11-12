# PowerShell Script to Add table-responsive-global.css to All Dashboard HTML Files
# This ensures all tables are horizontally scrollable on mobile devices

Write-Host "Adding table-responsive-global.css to all dashboard HTML files..." -ForegroundColor Cyan

# Get all HTML files in the dashboard directory
$dashboardPath = "client\dashboard"
$htmlFiles = Get-ChildItem -Path $dashboardPath -Filter "*.html" -File

$count = 0
$skipped = 0

foreach ($file in $htmlFiles) {
    $filePath = $file.FullName
    $content = Get-Content -Path $filePath -Raw
    
    # Check if table-responsive-global.css is already included
    if ($content -match 'table-responsive-global\.css') {
        Write-Host "  [SKIP] $($file.Name) - Already includes table-responsive-global.css" -ForegroundColor Yellow
        $skipped++
        continue
    }
    
    # Check if the file has a <head> section with stylesheet links
    if ($content -match '<link rel="stylesheet".*?\.css">') {
        # Find the last stylesheet link and add our CSS after it
        $pattern = '(<link rel="stylesheet"[^>]*\.css">\s*)(\s*(?:<link rel="manifest"|<script|</head>))'
        
        if ($content -match $pattern) {
            $newContent = $content -replace $pattern, "`$1`n    <link rel=`"stylesheet`" href=`"../css/table-responsive-global.css`">`$2"
            
            # Write the updated content back to the file
            Set-Content -Path $filePath -Value $newContent -NoNewline
            Write-Host "  [OK] $($file.Name) - Added table-responsive-global.css" -ForegroundColor Green
            $count++
        } else {
            Write-Host "  [WARN] $($file.Name) - Could not find insertion point" -ForegroundColor Magenta
        }
    } else {
        Write-Host "  [WARN] $($file.Name) - No stylesheet links found" -ForegroundColor Magenta
    }
}

Write-Host "`nSummary:" -ForegroundColor Cyan
Write-Host "  Updated: $count files" -ForegroundColor Green
Write-Host "  Skipped: $skipped files (already included)" -ForegroundColor Yellow
Write-Host "`nTable responsiveness fix applied to all dashboard pages!" -ForegroundColor Green
