# PowerShell script to find and replace in HTML files
$files = Get-ChildItem -Path "C:\All_In_One_College_Website\client" -Filter "*.html" -Recurse

$cssFind = "../css/student-sidebar.css"
$cssReplace = "../css/universal-sidebar.css"

$jsFind = "../js/student-sidebar.js"
$jsReplace = "../js/universal-sidebar.js"

$updatedFiles = @()

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    
    $content = $content -replace [regex]::Escape($cssFind), $cssReplace
    $content = $content -replace [regex]::Escape($jsFind), $jsReplace
    
    if ($content -ne $originalContent) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        $updatedFiles += $file.FullName
        Write-Host "✓ Updated: $($file.Name)" -ForegroundColor Green
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Total files updated: $($updatedFiles.Count)" -ForegroundColor Yellow
Write-Host "`nUpdated files:" -ForegroundColor Yellow
$updatedFiles | ForEach-Object { Write-Host "  - $_" -ForegroundColor White }
Write-Host "`n✓ All replacements complete!" -ForegroundColor Green
