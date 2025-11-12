#!/usr/bin/env pwsh
# Automated Testing Script for ITER EduHub
# Run this script to perform automated tests

Write-Host "
╔═══════════════════════════════════════════════════════╗
║     ITER EduHub - Automated Testing Script          ║
║     Comprehensive System Verification               ║
╚═══════════════════════════════════════════════════════╝
" -ForegroundColor Cyan

# Test configuration
$baseUrl = "http://localhost:5000"
$testResults = @()

function Test-Endpoint {
    param(
        [string]$Url,
        [string]$Name
    )
    
    Write-Host "Testing: $Name..." -NoNewline
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            Write-Host " ✅ PASS" -ForegroundColor Green
            $testResults += [PSCustomObject]@{
                Test = $Name
                Status = "PASS"
                Code = $response.StatusCode
            }
            return $true
        }
    } catch {
        Write-Host " ❌ FAIL - $_" -ForegroundColor Red
        $testResults += [PSCustomObject]@{
            Test = $Name
            Status = "FAIL"
            Code = $_.Exception.Response.StatusCode.value__
        }
        return $false
    }
}

function Test-ApiEndpoint {
    param(
        [string]$Url,
        [string]$Name,
        [string]$Method = "GET",
        [hashtable]$Headers = @{},
        [string]$Body
    )
    
    Write-Host "Testing API: $Name..." -NoNewline
    try {
        $params = @{
            Uri = "$baseUrl/api$Url"
            Method = $Method
            UseBasicParsing = $true
            TimeoutSec = 5
            Headers = $Headers
        }
        
        if ($Body) {
            $params.Body = $Body
            $params.ContentType = "application/json"
        }
        
        $response = Invoke-WebRequest @params
        if ($response.StatusCode -in @(200, 201)) {
            Write-Host " ✅ PASS" -ForegroundColor Green
            $testResults += [PSCustomObject]@{
                Test = $Name
                Status = "PASS"
                Code = $response.StatusCode
            }
            return $true
        }
    } catch {
        # Some endpoints return 401/403 without auth - that's expected
        if ($_.Exception.Response.StatusCode.value__ -in @(401, 403)) {
            Write-Host " ⚠️  AUTH REQUIRED (Expected)" -ForegroundColor Yellow
            $testResults += [PSCustomObject]@{
                Test = $Name
                Status = "AUTH"
                Code = $_.Exception.Response.StatusCode.value__
            }
            return $true
        }
        Write-Host " ❌ FAIL - $_" -ForegroundColor Red
        $testResults += [PSCustomObject]@{
            Test = $Name
            Status = "FAIL"
            Code = $_.Exception.Response.StatusCode.value__
        }
        return $false
    }
}

# ============================================
# 1. Server Health Check
# ============================================
Write-Host "`n📡 Phase 1: Server Health Check" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

Test-Endpoint "$baseUrl/health" "Server Health Endpoint"

# ============================================
# 2. Static Page Tests
# ============================================
Write-Host "`n🌐 Phase 2: Static Page Tests" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan

Test-Endpoint "$baseUrl/" "Landing Page (index.html)"
Test-Endpoint "$baseUrl/login.html" "Login Page"
Test-Endpoint "$baseUrl/register.html" "Registration Page"
Test-Endpoint "$baseUrl/dashboard/student.html" "Student Dashboard HTML"
Test-Endpoint "$baseUrl/dashboard/teacher.html" "Teacher Dashboard HTML"
Test-Endpoint "$baseUrl/dashboard/admin.html" "Admin Dashboard HTML"

# ============================================
# 3. Static Asset Tests
# ============================================
Write-Host "`n🎨 Phase 3: Static Asset Tests" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan

Test-Endpoint "$baseUrl/css/style.css" "Main Stylesheet"
Test-Endpoint "$baseUrl/css/animations.css" "Animations CSS"
Test-Endpoint "$baseUrl/css/profile.css" "Profile CSS"
Test-Endpoint "$baseUrl/js/main.js" "Main JavaScript"
Test-Endpoint "$baseUrl/js/student.js" "Student Dashboard JS"
Test-Endpoint "$baseUrl/js/teacher.js" "Teacher Dashboard JS"
Test-Endpoint "$baseUrl/js/admin.js" "Admin Dashboard JS"
Test-Endpoint "$baseUrl/assets/logo.svg" "Logo SVG"
Test-Endpoint "$baseUrl/uploads/avatars/default-avatar.svg" "Default Avatar SVG"
Test-Endpoint "$baseUrl/manifest.json" "PWA Manifest"

# ============================================
# 4. API Endpoint Tests (No Auth)
# ============================================
Write-Host "`n🔌 Phase 4: Public API Tests" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan

Test-ApiEndpoint "/events" "Public Events List"
Test-ApiEndpoint "/health" "API Health Check"

# ============================================
# 5. API Endpoint Tests (Auth Required)
# ============================================
Write-Host "`n🔐 Phase 5: Protected API Tests" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

Test-ApiEndpoint "/attendance/student/1" "Student Attendance Endpoint"
Test-ApiEndpoint "/marks/student/1" "Student Marks Endpoint"
Test-ApiEndpoint "/assignments/student" "Student Assignments Endpoint"
Test-ApiEndpoint "/timetable" "Timetable Endpoint"
Test-ApiEndpoint "/files" "Files Endpoint"
Test-ApiEndpoint "/admin/stats" "Admin Stats Endpoint"
Test-ApiEndpoint "/teacher/stats" "Teacher Stats Endpoint"

# ============================================
# 6. Results Summary
# ============================================
Write-Host "`n
╔═══════════════════════════════════════════════════════╗
║              TEST RESULTS SUMMARY                    ║
╚═══════════════════════════════════════════════════════╝
" -ForegroundColor Cyan

$passed = ($testResults | Where-Object { $_.Status -eq "PASS" }).Count
$authRequired = ($testResults | Where-Object { $_.Status -eq "AUTH" }).Count
$failed = ($testResults | Where-Object { $_.Status -eq "FAIL" }).Count
$total = $testResults.Count

Write-Host "✅ PASSED: $passed / $total" -ForegroundColor Green
Write-Host "⚠️  AUTH REQUIRED: $authRequired / $total (Expected)" -ForegroundColor Yellow
Write-Host "❌ FAILED: $failed / $total" -ForegroundColor Red

if ($failed -eq 0) {
    Write-Host "`n🎉 ALL TESTS PASSED! System is ready for use." -ForegroundColor Green
} else {
    Write-Host "`n⚠️  Some tests failed. Review errors above." -ForegroundColor Yellow
}

# Display detailed results
Write-Host "`n📊 Detailed Results:" -ForegroundColor Cyan
$testResults | Format-Table -AutoSize

# ============================================
# 7. Manual Testing Instructions
# ============================================
Write-Host "
╔═══════════════════════════════════════════════════════╗
║           MANUAL TESTING REQUIRED                    ║
╚═══════════════════════════════════════════════════════╝

The automated tests verify that pages load and APIs respond.
Please perform these MANUAL tests in a browser:

📋 Registration Test:
   1. Open: http://localhost:5000/register.html
   2. Fill form and submit
   3. Verify redirect to login

🔐 Login Tests:
   1. Open: http://localhost:5000/login.html
   2. Test Student: STU20250001 / Student@123
   3. Test Teacher: TEA20250001 / Teacher@123
   4. Test Admin: ADM20250001 / Admin@123
   5. Verify dashboard redirects

📊 Dashboard Tests:
   • Student: Check attendance, marks, assignments
   • Teacher: Check stats, student list, marking
   • Admin: Check approvals, users, analytics

🎯 Console Tests:
   • Open DevTools (F12) on each page
   • Verify NO errors in Console tab
   • Verify NO 404s in Network tab

🔄 Navigation Tests:
   • Test: Landing → Register → Login → Dashboard
   • Test: Dashboard → Logout → Landing
   • Verify no redirect loops

" -ForegroundColor Yellow

Write-Host "Test script completed. Review results above.`n" -ForegroundColor Cyan
