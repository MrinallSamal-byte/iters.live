@echo off
echo ================================
echo DUMMY DATA VERIFICATION SCRIPT
echo ================================
echo.
echo This script will help you verify that all dummy data is displaying correctly.
echo.
echo TESTING INSTRUCTIONS:
echo =====================
echo.
echo 1. START THE SERVER
echo    Run: npm start
echo.
echo 2. LOGIN AS STUDENT
echo    URL: http://localhost:3000/login.html
echo    Credentials: STU20250001 / Student@123
echo.
echo 3. CHECK STUDENT PAGES:
echo    - Dashboard: Check stats show numbers (not --)
echo    - Dashboard: Verify attendance chart displays
echo    - Dashboard: Check today's schedule has classes
echo    - Dashboard: Verify recent activity shows 5 items
echo    - Attendance: Verify 6 subjects in table
echo    - Attendance: Check pie chart renders
echo    - Marks: Verify CGPA/SGPA displayed
echo    - Marks: Check performance trend chart
echo    - Marks: Verify semester history cards
echo.
echo 4. LOGIN AS TEACHER
echo    Credentials: TCH2025001 / Teacher@123
echo.
echo 5. CHECK TEACHER PAGES:
echo    - Dashboard: Verify all stats show numbers
echo    - Dashboard: Check attendance trend chart
echo    - Dashboard: Verify pending submissions table
echo    - Dashboard: Check performance distribution chart
echo.
echo 6. LOGIN AS ADMIN
echo    Credentials: ADM2025001 / Admin@123456
echo.
echo 7. CHECK ADMIN PAGES:
echo    - Dashboard: Verify all system stats
echo    - Dashboard: Check user distribution chart
echo    - Dashboard: Verify department chart
echo    - Dashboard: Check pending approvals table
echo    - Dashboard: Verify recent activity feed
echo.
echo ================================
echo EXPECTED RESULTS
echo ================================
echo.
echo All pages should display:
echo [√] Numbers in stat boxes (not --)
echo [√] Charts rendering with data
echo [√] Tables populated with rows
echo [√] Activity feeds showing items
echo [√] No "Loading..." messages stuck
echo [√] No console errors
echo.
echo ================================
echo QUICK TEST COMMANDS
echo ================================
echo.
echo Open these URLs after logging in:
echo.
echo STUDENT:
echo   http://localhost:3000/dashboard/student.html
echo   http://localhost:3000/dashboard/student-attendance.html
echo   http://localhost:3000/dashboard/student-marks.html
echo.
echo TEACHER:
echo   http://localhost:3000/dashboard/teacher.html
echo.
echo ADMIN:
echo   http://localhost:3000/dashboard/admin.html
echo.
echo ================================
echo If you see any issues:
echo 1. Check browser console (F12)
echo 2. Verify dummy-data.js is loaded
echo 3. Check network tab for errors
echo ================================
echo.
pause
