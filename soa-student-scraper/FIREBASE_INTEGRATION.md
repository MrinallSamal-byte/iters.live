# Firebase Integration for SOA Student Portal Scraper

## Overview

This guide explains how to integrate the Python FastAPI backend with the existing Firebase/Render deployment.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Render Deployment                            │
│                                                                   │
│  ┌────────────────────────┐         ┌──────────────────────────┐│
│  │  Node.js Backend       │  HTTP   │  Python Scraper Service  ││
│  │  (Express + Firebase)  │────────>│  (FastAPI + Playwright)  ││
│  │  Port: 5000            │         │  Port: 8000              ││
│  └────────────────────────┘         └──────────────────────────┘│
│             │                                     │               │
│             │ Firestore                          │ HTTPS         │
│             ▼                                     ▼               │
│  ┌────────────────────────┐         ┌──────────────────────────┐│
│  │  Firebase Firestore    │         │  SOA Portal              ││
│  │  (Database)            │         │  (soaportals.com)        ││
│  └────────────────────────┘         └──────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Integration Steps

### 1. Update Python Backend API Contract

The existing Node.js controller expects:

**Request to `/api/scrape`:**
```json
{
  "reg_number": "string",
  "password": "string"
}
```

**Success Response:**
```json
{
  "status": "SUCCESS",
  "data": {
    "profile": { ... },
    "marks": [ ... ],
    "attendance": [ ... ],
    "timetable": [ ... ],
    "courses": [ ... ],
    "results": [ ... ],
    "notifications": [ ... ]
  },
  "message": "Portal login successful"
}
```

**Error Response:**
```json
{
  "status": "AUTH_FAILED" | "SCRAPE_ERROR" | "PORTAL_UNREACHABLE",
  "message": "Error description"
}
```

### 2. Add Compatibility Endpoint

Our Python backend needs a `/api/scrape` endpoint that matches this contract:

```python
# Add to backend/main.py

@app.post("/api/scrape")
async def scrape_portal_legacy(request: Request, scrape_request: ScrapeRequest):
    """
    Legacy endpoint for compatibility with Node.js controller.
    Maps to our /api/scrape-portal endpoint.
    """
    # Call our existing scrape logic
    result = create_scraper().scrape_portal(
        registration_number=scrape_request.registration_number,
        password=scrape_request.password,
        attempt=1
    )
    
    # Map our response to expected format
    if result.success:
        return {
            "status": "SUCCESS",
            "data": result.data,
            "message": result.message
        }
    else:
        return {
            "status": result.status,
            "message": result.message
        }
```

### 3. Configure Node.js to Use Python Backend

Update `server/.env` or environment variables on Render:

```bash
# Point to Python scraper service
SCRAPER_SERVICE_URL=http://localhost:8000  # Local development
# OR
SCRAPER_SERVICE_URL=https://your-python-backend.onrender.com  # Production
```

### 4. Enable Portal Features

Update `server/config/featureFlags.js`:

```javascript
const PORTAL_FEATURES_ENABLED = process.env.PORTAL_FEATURES_ENABLED === 'true';
```

Set environment variable on Render:
```bash
PORTAL_FEATURES_ENABLED=true
```

### 5. Optional: Add Firebase Admin SDK to Python

If you want the Python backend to save directly to Firebase:

**Install Firebase Admin SDK:**
```bash
pip install firebase-admin
```

**Add to backend/requirements.txt:**
```
firebase-admin>=6.0.0
```

**Create backend/firebase_integration.py:**
```python
import firebase_admin
from firebase_admin import credentials, firestore
import os

# Initialize Firebase Admin SDK
def init_firebase():
    if os.getenv('FIREBASE_SERVICE_ACCOUNT'):
        import json
        cred_dict = json.loads(os.getenv('FIREBASE_SERVICE_ACCOUNT'))
        cred = credentials.Certificate(cred_dict)
    else:
        # Use service account file
        cred = credentials.Certificate('serviceAccountKey.json')
    
    firebase_admin.initialize_app(cred)
    return firestore.client()

# Save data to Firestore
def save_to_firestore(user_id, reg_number, data):
    db = firestore.client()
    doc_id = user_id or reg_number
    
    user_ref = db.collection('users').document(doc_id)
    user_ref.update({
        'profile': data.get('personalInfo', {}),
        'marks_data': data.get('results', {}).get('sgpa', []),
        'attendance_data': data.get('attendance', []),
        'isVerified': True,
        'portalConnected': True,
        'portal_last_synced': firestore.SERVER_TIMESTAMP
    })
```

## Deployment on Render

### Option A: Two Separate Services (Recommended)

**Service 1: Node.js Backend (Existing)**
- Already deployed
- Environment: `SCRAPER_SERVICE_URL=https://soa-scraper-python.onrender.com`
- Port: 5000

**Service 2: Python Scraper**
- New service
- Root directory: `soa-student-scraper/backend`
- Build command: `pip install -r requirements.txt && playwright install chromium --with-deps`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Port: 8000 (or $PORT from Render)

### Option B: Single Service (Advanced)

Run both Node.js and Python in one service using Docker Compose:

```yaml
# docker-compose.yml for Render
version: '3.8'
services:
  nodejs:
    build: .
    ports:
      - "5000:5000"
    environment:
      - SCRAPER_SERVICE_URL=http://python:8000
  
  python:
    build: ./soa-student-scraper/backend
    ports:
      - "8000:8000"
```

## Testing Integration

### Local Testing

**Terminal 1 - Start Python backend:**
```bash
cd soa-student-scraper/backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 - Start Node.js backend:**
```bash
cd server
export SCRAPER_SERVICE_URL=http://localhost:8000
export PORTAL_FEATURES_ENABLED=true
npm start
```

**Terminal 3 - Test:**
```bash
# Test Python backend directly
curl -X POST http://localhost:8000/api/scrape-portal \
  -H "Content-Type: application/json" \
  -d '{"registration_number":"TEST","password":"test"}'

# Test through Node.js controller
curl -X POST http://localhost:5000/api/portal/login \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -d '{"reg_number":"TEST","password":"test"}'
```

### Production Testing

1. Deploy Python backend to Render
2. Get the URL (e.g., `https://soa-scraper.onrender.com`)
3. Update Node.js backend environment:
   - `SCRAPER_SERVICE_URL=https://soa-scraper.onrender.com`
   - `PORTAL_FEATURES_ENABLED=true`
4. Redeploy Node.js backend
5. Test from frontend

## Environment Variables Summary

### Node.js Backend (Render)
```bash
SCRAPER_SERVICE_URL=https://your-python-backend.onrender.com
PORTAL_FEATURES_ENABLED=true
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
```

### Python Backend (Render)
```bash
PLAYWRIGHT_BROWSERS_PATH=/opt/render/.cache/ms-playwright
ALLOWED_ORIGINS=https://your-frontend.vercel.app,https://your-nodejs-backend.onrender.com
PORT=8000
```

## Troubleshooting

### Python backend not reachable from Node.js
- Check SCRAPER_SERVICE_URL is correct
- Ensure Python backend is deployed and running
- Check Render logs for both services
- Verify CORS allows Node.js backend origin

### Portal features still disabled
- Confirm `PORTAL_FEATURES_ENABLED=true` is set
- Check feature flags in `server/config/featureFlags.js`
- Restart Node.js service after setting env var

### CAPTCHA solving fails
- Ensure tesseract-ocr is installed on Render
- Check Render build logs
- May need to add to Render build command:
  ```bash
  apt-get update && apt-get install -y tesseract-ocr
  ```

### Playwright browser not found
- Ensure `playwright install chromium --with-deps` runs in build
- Set `PLAYWRIGHT_BROWSERS_PATH=/opt/render/.cache/ms-playwright`
- Check disk space on Render (browsers need ~2GB)

## Security Considerations

1. **HTTPS Only**: Both services must use HTTPS in production
2. **CORS**: Configure ALLOWED_ORIGINS correctly
3. **Authentication**: Node.js handles Firebase auth; Python backend trusts Node.js
4. **Secrets**: Use environment variables for all secrets
5. **Rate Limiting**: Apply on both services
6. **Monitoring**: Monitor both service logs

## Next Steps After Integration

1. Test with real SOA portal credentials
2. Monitor success/failure rates
3. Optimize CAPTCHA solving accuracy
4. Add caching if needed
5. Set up alerting for service failures
6. Document user-facing features

---

**Last Updated:** December 11, 2024
