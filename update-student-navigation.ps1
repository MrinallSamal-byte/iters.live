# Update all student pages with navigation improvements
$files = @(
    "student-attendance.html",
    "student-marks.html",
    "student-timetable.html",
    "student-notes.html",
    "student-clubs.html",
    "student-events.html",
    "student-hostel-menu.html",
    "student-admit-card.html"
)

$basePath = "c:\All_In_One_College_Website\client\dashboard"

foreach ($file in $files) {
    $filePath = Join-Path $basePath $file
    
    if (Test-Path $filePath) {
        Write-Host "Updating $file..." -ForegroundColor Cyan
        
        $content = Get-Content $filePath -Raw
        
        # Add navigation CSS if not present
        if ($content -notmatch "student-navigation\.css") {
            $content = $content -replace '(<link rel="stylesheet" href="../css/student-improvements.css">)', "`$1`n    <link rel=`"stylesheet`" href=`"../css/student-navigation.css`">"
        }
        
        # Add navigation JS if not present
        if ($content -notmatch "student-navigation\.js") {
            $content = $content -replace '(<script src="../js/student-ui-enhancements.js"></script>)', "`$1`n    <script src=`"../js/student-navigation.js`"></script>"
        }
        
        # Add overlay if not present
        if ($content -notmatch "nav-overlay") {
            $content = $content -replace '(<div class="dashboard-bg">)', "<!-- Mobile Menu Overlay -->`n    <div class=`"nav-overlay`" id=`"navOverlay`"></div>`n    `n    `$1"
        }
        
        # Remove hide-mobile class from nav if present
        $content = $content -replace 'class="dashboard-nav glass-card fade-in-down hide-mobile"', 'class="dashboard-nav glass-card fade-in-down"'
        
        # Write back
        Set-Content -Path $filePath -Value $content -NoNewline
        
        Write-Host "Updated $file" -ForegroundColor Green
    } else {
        Write-Host "File not found: $file" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "All student pages updated with navigation improvements!" -ForegroundColor Green
