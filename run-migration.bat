@echo off
echo Setting up environment variables from .env.migration...
for /f "tokens=*" %%a in (.env.migration) do set %%a

echo.
echo Starting migration...
node migrate-to-supabase.js

echo.
echo Migration script finished.
pause
