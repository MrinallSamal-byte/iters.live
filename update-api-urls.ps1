# Script to update frontend API URLs to point to Railway backend
# Usage: .\update-api-urls.ps1 -RailwayUrl "https://your-app.railway.app"

param(
    [Parameter(Mandatory=$true)]
    [string]$RailwayUrl
)

Write-Host "`n🔧 Updating Frontend API URLs" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Cyan

# Remove trailing slash from URL
$RailwayUrl = $RailwayUrl.TrimEnd('/')

Write-Host "Railway Backend URL: $RailwayUrl" -ForegroundColor Yellow
Write-Host ""

# Create API config file
$configContent = @"
// API Configuration
const API_CONFIG = {
    BASE_URL: '$RailwayUrl',
    API_URL: '$RailwayUrl/api',
    TIMEOUT: 30000
};

// Helper function to get API URL
function getApiUrl(endpoint) {
    // Remove leading slash if present
    endpoint = endpoint.replace(/^\//, '');
    return ``${API_CONFIG.API_URL}/``${endpoint}``;
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API_CONFIG;
}
"@

$configPath = "client\js\api-config.js"
Set-Content -Path $configPath -Value $configContent
Write-Host "✅ Created API config: $configPath" -ForegroundColor Green

# Create example usage file
$exampleContent = @"
// Example: How to use the new API configuration

// Import the config (if using modules)
// import API_CONFIG from './api-config.js';

// Or include in HTML:
// <script src="/client/js/api-config.js"></script>

// Example API calls:

// 1. Login
async function login(registrationNumber, password) {
    const response = await fetch(getApiUrl('auth/login'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            registration_number: registrationNumber,
            password: password
        })
    });
    return await response.json();
}

// 2. Get User Profile
async function getProfile(token) {
    const response = await fetch(getApiUrl('profile'), {
        method: 'GET',
        headers: {
            'Authorization': ``Bearer ``${token}``,
            'Content-Type': 'application/json'
        }
    });
    return await response.json();
}

// 3. Get Attendance
async function getAttendance(token) {
    const response = await fetch(getApiUrl('attendance'), {
        method: 'GET',
        headers: {
            'Authorization': ``Bearer ``${token}``,
            'Content-Type': 'application/json'
        }
    });
    return await response.json();
}
"@

Set-Content -Path "client\js\api-usage-example.js" -Value $exampleContent
Write-Host "✅ Created usage example: client\js\api-usage-example.js" -ForegroundColor Green

# Update index.html to include config
Write-Host ""
Write-Host "📝 Manual Updates Required:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Add this to your HTML files (before other scripts):" -ForegroundColor White
Write-Host "   <script src='/client/js/api-config.js'></script>" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Update your API calls to use getApiUrl():" -ForegroundColor White
Write-Host "   OLD: fetch('/api/auth/login', ...)" -ForegroundColor Red
Write-Host "   NEW: fetch(getApiUrl('auth/login'), ...)" -ForegroundColor Green
Write-Host ""

# Create a find and replace guide
$replaceGuide = @"
# API URL Find and Replace Guide

## Common Patterns to Replace:

### Pattern 1: fetch('/api/...
Find:    fetch('/api/
Replace: fetch(getApiUrl('

### Pattern 2: fetch("/api/...
Find:    fetch("/api/
Replace: fetch(getApiUrl("

### Pattern 3: axios.get('/api/...
Find:    axios.get('/api/
Replace: axios.get(getApiUrl('

### Pattern 4: axios.post('/api/...
Find:    axios.post('/api/
Replace: axios.post(getApiUrl('

### Pattern 5: \$.ajax({ url: '/api/...
Find:    url: '/api/
Replace: url: getApiUrl('

## Files to Update:

Search in these directories:
- client/html/*.html
- client/js/*.js
- Any custom script files

## VS Code Find and Replace:

1. Press Ctrl+Shift+F (Find in Files)
2. Search for: /api/
3. Check each occurrence
4. Replace with getApiUrl() wrapper

## Test After Update:

1. Open browser console
2. Try login
3. Check Network tab for API calls
4. Verify they point to: $RailwayUrl/api/...
"@

Set-Content -Path "API-UPDATE-GUIDE.txt" -Value $replaceGuide
Write-Host "✅ Created update guide: API-UPDATE-GUIDE.txt" -ForegroundColor Green

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✅ API Configuration Created!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Add api-config.js to your HTML files" -ForegroundColor White
Write-Host "2. Update API calls to use getApiUrl()" -ForegroundColor White
Write-Host "3. Test in browser" -ForegroundColor White
Write-Host "4. Deploy to Vercel: vercel --prod" -ForegroundColor White
Write-Host ""
Write-Host "Backend URL: $RailwayUrl" -ForegroundColor Cyan
Write-Host ""
