# Update all student pages with improvements
$files = @(
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
        
        # Add CSS if not present
        if ($content -notmatch "student-improvements\.css") {
            $content = $content -replace '(<link rel="stylesheet" href="../css/futuristic-dashboard.css">)', "`$1`n    <link rel=`"stylesheet`" href=`"../css/student-improvements.css`">"
        }
        
        # Add JS if not present  
        if ($content -notmatch "student-ui-enhancements\.js") {
            $content = $content -replace '(<script src="../js/dummy-data.js"></script>)', "`$1`n    <script src=`"../js/student-ui-enhancements.js`"></script>"
        }
        
        # Write back
        Set-Content -Path $filePath -Value $content -NoNewline
        
        Write-Host "Updated $file" -ForegroundColor Green
    } else {
        Write-Host "File not found: $file" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "All student pages updated successfully!" -ForegroundColor Green
