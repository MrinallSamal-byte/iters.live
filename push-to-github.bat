@echo off
echo ========================================
echo  ITER College Management System (EduHub)
echo  GitHub Push Script
echo ========================================
echo.
echo This script will push your code to GitHub.
echo You'll need to provide your GitHub credentials.
echo.
echo Repository: https://github.com/MrinallSamal-byte/ITER_Live.git
echo Branch: main
echo.
pause
echo.
echo Pushing to GitHub...
git push -u origin main
echo.
if %ERRORLEVEL% EQU 0 (
    echo ========================================
    echo  SUCCESS! Code pushed to GitHub
    echo ========================================
    echo.
    echo Your ITER College Management System is now available at:
    echo https://github.com/MrinallSamal-byte/ITER_Live
    echo.
) else (
    echo ========================================
    echo  PUSH FAILED
    echo ========================================
    echo.
    echo Please check your GitHub credentials and try again.
    echo You may need to:
    echo 1. Set up a Personal Access Token
    echo 2. Use GitHub CLI (gh auth login)
    echo 3. Or use GitHub Desktop
    echo.
)
pause