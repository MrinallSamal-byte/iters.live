# Apply No-Animations to All Student Pages
# PowerShell script to add no-animations.css and no-animations.js to all student HTML files

$studentPages = @(
    "client\dashboard\student-notes.html",
    "client\dashboard\student-marks.html",
    "client\dashboard\student-timetable.html",
    "client\dashboard\student-hostel-menu.html",
    "client\dashboard\student-clubs.html",
    "client\dashboard\student-attendance.html",
    "client\dashboard\student-events.html",
    "client\dashboard\student-admit-card.html"
)

foreach ($page in $studentPages) {
    $filePath = Join-Path $PSScriptRoot $page
    
    if (Test-Path $filePath) {
        Write-Host "Processing: $page" -ForegroundColor Cyan
        
        $content = Get-Content $filePath -Raw
        
        # Add no-animations.css if not already present
        if ($content -notmatch "no-animations\.css") {
            $cssLine = "`n    <link rel=`"stylesheet`" href=`"../css/no-animations.css`">"
            $content = $content -replace '(<link rel="stylesheet" href="\.\./css/mobile\.css">)', "`$1$cssLine"
            Write-Host "  ✓ Added no-animations.css" -ForegroundColor Green
        }
        
        # Add no-animations.js if not already present
        if ($content -notmatch "no-animations\.js") {
            $scriptLines = "    <!-- NO ANIMATIONS - Load FIRST -->`n    <script src=`"../js/no-animations.js`"></script>`n`n"
            $content = $content -replace '(<script src="https://cdn\.jsdelivr\.net)', "$scriptLines`$1"
            Write-Host "  ✓ Added no-animations.js" -ForegroundColor Green
        }
        
        # Save the modified content
        Set-Content $filePath -Value $content -NoNewline
        Write-Host "  ✓ Saved $page" -ForegroundColor Green
    }
    else {
        Write-Host "  ✗ File not found: $page" -ForegroundColor Red
    }
}

Write-Host "`n✅ All student pages updated with no-animations!" -ForegroundColor Green
Write-Host "   - no-animations.css added to all pages" -ForegroundColor White
Write-Host "   - no-animations.js added to all pages" -ForegroundColor White
