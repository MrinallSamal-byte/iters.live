@echo off
echo ====================================
echo Installing Notes Database Schema
echo ====================================
echo.
echo Database: iter_college_db
echo User: root
echo.

mysql -u root -pMrinall@1123 iter_college_db < server\database\schema\notes-schema.sql

if %errorlevel% equ 0 (
    echo.
    echo ====================================
    echo SUCCESS! Notes tables created.
    echo ====================================
) else (
    echo.
    echo ====================================
    echo ERROR! Schema installation failed.
    echo ====================================
)

pause
