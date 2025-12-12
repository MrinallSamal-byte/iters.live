# Portal Scraper Implementation Guide

## Overview

This document explains the real-time portal scraper service implementation that fetches student data from the SOA portal (https://soaportals.com/StudentPortalSOA/#/).

## Architecture

### Components

1. **Portal Scraper Service** (`server/services/portal-scraper.service.js`)
   - Axios-based HTTP client with cookie jar support
   - Tesseract.js OCR for CAPTCHA solving
   - Sharp image preprocessing
   - Session token management

2. **Portal Controller** (`server/controllers/portal.controller.js`)
   - Handles API requests for portal login and data fetching
   - Implements 3-attempt login system with fallback
   - Manages backup data and demo data

3. **Frontend Integration** (`client/js/connect-portal.js`)
   - "Live Data" option UI
   - Credential input and validation
   - Status display and error handling

4. **Feature Flags** (`server/config/featureFlags.js`)
   - Portal feature enable/disable toggle
   - Environment-based configuration

## Features

### 1. CAPTCHA Solving
- Uses Tesseract.js for OCR
- Image preprocessing with Sharp (grayscale, normalize, threshold, sharpen)
- 3 retry attempts
- Fails gracefully if CAPTCHA cannot be solved

### 2. Session Management
- Cookies stored in CookieJar (tough-cookie)
- Session tokens extracted and preserved
- Automatic cookie attachment to subsequent requests

### 3. Unified Data Fetcher
Fetches data from multiple portal endpoints:
- `/StudentProfile/Get` - Student profile information
- `/StudentAttendance/Get` - Attendance records
- `/StudentMarks/Get` - Marks and grades
- `/StudentBacklogs/Get` - Backlog subjects
- `/StudentSubjects/GetInternalMarks` - Internal assessment marks

### 4. Error Handling
- Portal unreachable detection
- Authentication failure handling
- CAPTCHA failure handling
- Automatic fallback to backup/demo data

## Configuration

### Environment Variables

```bash
# Enable/disable portal features
PORTAL_FEATURES_ENABLED=true  # Default: true

# Portal URL (optional)
PORTAL_URL=https://soaportals.com

# Node environment (affects logging verbosity)
NODE_ENV=production  # or development
```

### Enable Portal Features
```bash
# Enabled by default, no action needed
# To disable:
export PORTAL_FEATURES_ENABLED=false
```

### Disable Portal Features
```bash
export PORTAL_FEATURES_ENABLED=false
```

## API Endpoints

### 1. Login to Portal
```http
POST /api/portal/login
Content-Type: application/json

{
  "reg_number": "STUDENT_REG_NO",
  "password": "STUDENT_PASSWORD"
}
```

**Response (Success):**
```json
{
  "success": true,
  "status": "SUCCESS",
  "message": "Portal login successful",
  "data": {
    "profile": { ... },
    "attendance": [ ... ],
    "marks": [ ... ],
    "backlogs": [ ... ],
    "internal_assessments": [ ... ],
    "isVerified": true,
    "portalConnected": true,
    "dataSource": "live_portal"
  }
}
```

**Response (Auth Failed):**
```json
{
  "success": false,
  "status": "AUTH_FAILED",
  "message": "Invalid credentials",
  "attempt": 1,
  "attemptsRemaining": 2
}
```

**Response (CAPTCHA Failed):**
```json
{
  "success": false,
  "status": "SCRAPE_ERROR",
  "message": "Failed to solve CAPTCHA after multiple attempts"
}
```

**Response (Portal Unreachable):**
```json
{
  "success": false,
  "status": "PORTAL_UNREACHABLE",
  "message": "Student portal is currently unreachable"
}
```

### 2. Get Portal Status
```http
GET /api/portal/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "portalConnected": false,
    "isVerified": false,
    "lastSynced": null,
    "portalEnabled": true
  }
}
```

### 3. Get Demo Data
```http
GET /api/portal/demo
```

Always returns demo data for exploration (no authentication required).

## Frontend Usage

### Enable Live Data Option

The "Live Data" option is automatically enabled when:
1. Portal features are enabled on the server (`PORTAL_FEATURES_ENABLED=true`)
2. Server returns `portalEnabled: true` from `/api/portal/status`

### Disable Live Data Option

The "Live Data" option is automatically disabled when:
1. Server returns `portalEnabled: false`
2. User can still select "Demo Data" to explore the system

## Testing

### Test with Invalid Credentials
```bash
node test-scraper-basic.js
```

This will:
1. Create a scraper instance
2. Attempt login with invalid credentials
3. Verify proper error handling

### Manual Testing Flow

1. Navigate to `/connect-portal.html`
2. Select "Live Data" option
3. Enter registration number and password
4. Click "Fetch Data from SOA Portal"
5. Wait for CAPTCHA solving and login
6. View results or error messages

## Troubleshooting

### "Portal syncing is currently unavailable"
- Check if `PORTAL_FEATURES_ENABLED=true` in environment
- Verify server is running and `/api/portal/status` is accessible

### "Failed to solve CAPTCHA"
- CAPTCHA on the portal may be too complex for OCR
- Portal may have changed CAPTCHA implementation
- Try again or use demo data

### "Student portal is currently unreachable"
- SOA portal may be down for maintenance
- Network connectivity issues
- Use demo data or load backup data if available

### "Invalid credentials"
- Check registration number and password
- Ensure credentials are correct for SOA portal
- Maximum 3 attempts before fallback to backup/demo data

## Implementation Details

### Why Axios Instead of Puppeteer?

The initial implementation used Puppeteer, but we switched to Axios for:
- **Performance**: No browser overhead, faster response times
- **Memory**: Lower memory footprint (important for deployment)
- **Deployment**: No need for Chromium installation
- **Reliability**: More stable in CI/CD environments

### CAPTCHA Solving Pipeline

1. **Fetch** CAPTCHA image from portal
2. **Preprocess** image (grayscale → normalize → threshold → sharpen)
3. **OCR** using Tesseract.js
4. **Clean** text (remove non-alphanumeric characters)
5. **Validate** length (minimum 4 characters)
6. **Retry** up to 3 times if failed

### Session Flow

1. **Initialize** CookieJar
2. **Solve** CAPTCHA
3. **Login** with credentials + CAPTCHA
4. **Extract** session token from response
5. **Store** cookies in jar
6. **Reuse** cookies for subsequent API calls

## Security Considerations

### Credential Handling
- Credentials are only used for login, never stored on server
- Frontend stores credentials in localStorage with base64 encoding (obfuscation only)
- Users can clear saved credentials at any time

### Session Security
- Session cookies expire based on portal policy
- No long-term credential storage on backend
- All communication over HTTPS (when deployed)

### CAPTCHA Bypass
- OCR-based solving is legitimate use of portal access
- No malicious automation or scraping
- Respects portal rate limits

## Dependencies

Required npm packages:
- `axios` - HTTP client
- `axios-cookiejar-support` - Cookie jar integration
- `tough-cookie` - Cookie management
- `tesseract.js` - OCR engine
- `sharp` - Image processing

## Future Improvements

1. **Enhanced CAPTCHA Solving**
   - Deep learning models for better accuracy
   - Support for different CAPTCHA types
   - External solver API fallback

2. **Caching Strategy**
   - Cache portal data locally
   - Reduce portal requests
   - Faster data loading

3. **Background Sync**
   - Periodic automatic syncs
   - Push notifications for new data
   - Webhook integration

4. **Better Error Recovery**
   - Automatic retry with exponential backoff
   - Smart CAPTCHA refresh
   - Network resilience

## Support

For issues or questions:
1. Check this documentation
2. Review server logs
3. Test with demo data first
4. Report issues with detailed error messages

## License

This implementation is part of the ITER EduHub project and follows the same license terms.
