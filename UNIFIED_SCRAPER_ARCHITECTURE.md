# Unified Scraper Architecture

This project now uses a **single unified scraping architecture** based on Playwright.

## Overview

All legacy scrapers have been removed. The system now uses only ONE scraper implementation:

- **Location:** `server/services/soa-scraper.service.js`
- **Technology:** Node.js + Playwright
- **Authentication:** User-provided CAPTCHA (no auto-solving)

## What Was Removed

The following legacy implementations were removed:

| Component | Technology | Status |
|-----------|-----------|--------|
| `/scraper/` | Python Flask + Selenium | ❌ Deleted |
| `/soa-student-scraper/` | Python FastAPI + Playwright | ❌ Deleted |
| `portal-scraper.service.js` | Node.js + Axios + Tesseract OCR | ❌ Deleted |
| `portal-scraper-server.js` | Express microservice | ❌ Deleted |

## Unified Scraper

### Single Implementation

```
server/services/soa-scraper.service.js
```

**Features:**
- ✅ Playwright-based browser automation
- ✅ User-provided CAPTCHA flow
- ✅ Session management with automatic cleanup
- ✅ Standardized JSON responses
- ✅ Comprehensive data extraction

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/soa/status` | GET | Check scraper availability |
| `/api/soa/captcha` | GET | Create session and get CAPTCHA |
| `/api/soa/login` | POST | Login with credentials and CAPTCHA |
| `/api/soa/refresh-captcha` | POST | Refresh CAPTCHA for existing session |
| `/api/soa/session/:id` | DELETE | Close an active session |

### API Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   GET /captcha  │────▶│ Returns sessionId │────▶│ Display CAPTCHA │
└─────────────────┘     │ + captchaImage   │     │ to user         │
                        └──────────────────┘     └────────┬────────┘
                                                          │
                                                          ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ POST /login     │◀────│ User enters      │◀────│ User solves     │
│ with sessionId, │     │ credentials      │     │ CAPTCHA         │
│ credentials,    │     └──────────────────┘     └─────────────────┘
│ captcha         │
└────────┬────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────┐
│ Response: { success, status, data: { profile, attendance, ... } }│
└──────────────────────────────────────────────────────────────────┘
```

### Response Format

**Success Response:**
```json
{
  "success": true,
  "status": "SUCCESS",
  "message": "Data fetched successfully from SOA portal",
  "data": {
    "profile": { ... },
    "attendance": [ ... ],
    "marks": [ ... ],
    "internalAssessments": [ ... ],
    "timetable": [ ... ],
    "subjects": [ ... ],
    "notifications": [ ... ],
    "fetchedAt": "2024-01-01T00:00:00.000Z",
    "dataSource": "live_soa_portal"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "status": "AUTH_FAILED",
  "message": "Invalid credentials. Please check your registration number and password."
}
```

### Status Codes

| Status | Description |
|--------|-------------|
| `SUCCESS` | Data fetched successfully |
| `CAPTCHA_REQUIRED` | CAPTCHA verification needed |
| `AUTH_FAILED` | Invalid credentials |
| `SESSION_EXPIRED` | Session timed out (10 min) |
| `PORTAL_UNREACHABLE` | Portal not accessible |
| `SCRAPE_ERROR` | General scraping error |

## Frontend Integration

### Example: Connect Portal Page

```html
<div id="captcha-container">
  <img id="captcha-image" alt="CAPTCHA" />
  <button onclick="refreshCaptcha()">Refresh</button>
</div>

<form id="login-form">
  <input type="text" name="regNo" placeholder="Registration Number" required>
  <input type="password" name="password" placeholder="Password" required>
  <input type="text" name="captcha" placeholder="Enter CAPTCHA" required>
  <button type="submit">Login</button>
</form>
```

```javascript
let sessionId = null;

// Load CAPTCHA on page load
async function loadCaptcha() {
  const response = await fetch('/api/soa/captcha');
  const data = await response.json();
  
  if (data.success) {
    sessionId = data.sessionId;
    document.getElementById('captcha-image').src = data.captchaImage;
  }
}

// Refresh CAPTCHA
async function refreshCaptcha() {
  if (sessionId) {
    const response = await fetch('/api/soa/refresh-captcha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    });
    const data = await response.json();
    document.getElementById('captcha-image').src = data.captchaImage;
  } else {
    loadCaptcha();
  }
}

// Submit login
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  
  const response = await fetch('/api/soa/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      regNo: formData.get('regNo'),
      password: formData.get('password'),
      captcha: formData.get('captcha')
    })
  });
  
  const result = await response.json();
  
  if (result.success) {
    // Use result.data
    console.log('Portal data:', result.data);
  } else {
    alert(result.message);
    if (result.status === 'SESSION_EXPIRED') {
      loadCaptcha();
    }
  }
});

// Initialize
loadCaptcha();
```

## Security

- **Credentials are NEVER stored or logged**
- **Session contexts are closed after data extraction**
- **Fresh browser session for each CAPTCHA request**
- **Sessions expire after 10 minutes**
- **Automatic session cleanup**

## Dependencies

```json
{
  "playwright": "^1.57.0"
}
```

Install Playwright browsers:
```bash
npx playwright install chromium
```

## Feature Flag

Portal scraping can be disabled via environment variable:
```bash
PORTAL_FEATURES_ENABLED=false
```

When disabled, all portal endpoints return demo data instead.
