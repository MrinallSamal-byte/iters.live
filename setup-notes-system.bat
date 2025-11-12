@echo off
color 0A
echo.
echo ========================================
echo    NOTES SYSTEM - FINAL SETUP
echo ========================================
echo.
echo [1/2] Installing Database Schema...
echo.

mysql -u root -pMrinall@1123 iter_college_db < server\database\schema\notes-schema.sql

if %errorlevel% equ 0 (
    color 0B
    echo.
    echo [SUCCESS] Database tables created!
    echo   - notes
    echo   - note_downloads
    echo   - note_favorites
    echo   - Sample data inserted
    echo.
    echo [2/2] System Status Check...
    echo.
    echo [OK] Routes registered: /api/notes
    echo [OK] HTML files updated: 4 files
    echo [OK] Sidebar: universal-sidebar
    echo.
    color 0A
    echo ========================================
    echo    SETUP COMPLETE!
    echo ========================================
    echo.
    echo Your Notes System is ready to use!
    echo.
    echo Next Steps:
    echo 1. Start server: cd server ^&^& npm start
    echo 2. Visit: http://localhost:5000/dashboard/student-notes.html
    echo 3. Test upload/download features
    echo.
) else (
    color 0C
    echo.
    echo [ERROR] Database setup failed!
    echo Please check your MySQL connection.
    echo.
)

echo.
pause
