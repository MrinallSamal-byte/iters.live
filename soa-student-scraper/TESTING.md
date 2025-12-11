# SOA Student Portal Scraper - Testing Guide

This guide covers testing the application locally and in production.

## Table of Contents
- [Local Testing](#local-testing)
- [API Testing](#api-testing)
- [Frontend Testing](#frontend-testing)
- [Integration Testing](#integration-testing)
- [Production Testing](#production-testing)

---

## Local Testing

### Backend Testing

1. **Start the backend server**
   ```bash
   cd soa-student-scraper/backend
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

2. **Test health endpoint**
   ```bash
   curl http://localhost:8000/health
   ```
   
   Expected response:
   ```json
   {
     "status": "healthy",
     "service": "soa-student-scraper",
     "version": "1.0.0",
     "timestamp": "2024-01-15T10:30:00.000Z"
   }
   ```

3. **Test dummy data endpoint**
   ```bash
   curl http://localhost:8000/api/dummy-data
   ```
   
   Expected: JSON response with sample student data

4. **Test scrape endpoint (requires valid credentials)**
   ```bash
   curl -X POST http://localhost:8000/api/scrape-portal \
     -H "Content-Type: application/json" \
     -d '{
       "registration_number": "YOUR_REG_NUMBER",
       "password": "YOUR_PASSWORD"
     }'
   ```
   
   **Note:** Only use your own credentials for testing

### Frontend Testing

1. **Start the development server**
   ```bash
   cd soa-student-scraper/frontend
   npm run dev
   ```

2. **Open browser**
   - Navigate to `http://localhost:3000`
   - Should see the login form

3. **Test dummy data mode**
   - Click "Load Dummy Data" button
   - Should see sample student profile
   - Banner should show "Demo Mode Active"

4. **Test production build**
   ```bash
   npm run build
   npm run preview
   ```

---

## API Testing

### Using curl

**1. Health Check**
```bash
curl -X GET http://localhost:8000/health
```

**2. Get Dummy Data**
```bash
curl -X GET http://localhost:8000/api/dummy-data
```

**3. Scrape Portal (Live Data)**
```bash
curl -X POST http://localhost:8000/api/scrape-portal \
  -H "Content-Type: application/json" \
  -d '{
    "registration_number": "2461XXXXXXX",
    "password": "your_password"
  }'
```

### Using Python

```python
import requests

# Test health endpoint
response = requests.get("http://localhost:8000/health")
print(f"Health: {response.status_code}")
print(response.json())

# Test dummy data
response = requests.get("http://localhost:8000/api/dummy-data")
print(f"Dummy Data: {response.status_code}")
data = response.json()
print(f"Success: {data['success']}, IsDemo: {data['isDemo']}")

# Test scraping (use your own credentials)
response = requests.post(
    "http://localhost:8000/api/scrape-portal",
    json={
        "registration_number": "YOUR_REG_NUMBER",
        "password": "YOUR_PASSWORD"
    }
)
print(f"Scrape: {response.status_code}")
print(response.json())
```

### Using JavaScript/Node.js

```javascript
const fetch = require('node-fetch');

// Test health endpoint
async function testHealth() {
  const response = await fetch('http://localhost:8000/health');
  const data = await response.json();
  console.log('Health:', data);
}

// Test dummy data
async function testDummy() {
  const response = await fetch('http://localhost:8000/api/dummy-data');
  const data = await response.json();
  console.log('Dummy Data:', data.success, data.isDemo);
}

// Test scraping (use your own credentials)
async function testScrape() {
  const response = await fetch('http://localhost:8000/api/scrape-portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      registration_number: 'YOUR_REG_NUMBER',
      password: 'YOUR_PASSWORD'
    })
  });
  const data = await response.json();
  console.log('Scrape Result:', data);
}

testHealth();
testDummy();
// testScrape(); // Uncomment to test with real credentials
```

---

## Frontend Testing

### Manual Testing Checklist

**1. Initial Load**
- [ ] Page loads without errors
- [ ] Header displays correctly
- [ ] Form is visible and styled properly
- [ ] Both buttons are present and enabled

**2. Form Validation**
- [ ] Try submitting empty form → should show validation error
- [ ] Enter registration number < 6 chars → should show error
- [ ] Enter password only → should show error for registration number
- [ ] Enter both fields → no validation errors

**3. Dummy Data Mode**
- [ ] Click "Load Dummy Data" button
- [ ] Loading spinner appears
- [ ] Demo banner appears (purple, "Demo Mode Active")
- [ ] Student profile displays with sample data
- [ ] Attendance table shows 6 subjects
- [ ] SGPA table shows 4 semesters
- [ ] "Fetch Different Data" button appears

**4. Live Data Mode** (Use your own credentials)
- [ ] Enter your registration number and password
- [ ] Click "Fetch Live Data"
- [ ] Loading spinner appears with status message
- [ ] If successful:
  - [ ] Success banner appears (green)
  - [ ] Shows masked registration number
  - [ ] Displays your actual data
  - [ ] No "Demo" badge visible
- [ ] If failed:
  - [ ] Error banner appears (red)
  - [ ] Shows attempt count (e.g., "Attempt 1/3")
  - [ ] Remaining attempts displayed

**5. Retry Logic**
- [ ] Deliberately enter wrong credentials
- [ ] First attempt shows "Attempt 1/3 — 2 attempts remaining"
- [ ] Second attempt shows "Attempt 2/3 — 1 attempt remaining"
- [ ] Third attempt shows "Attempt 3/3 — 0 attempts remaining"
- [ ] After 3 attempts, suggests "Load Dummy Data"

**6. Reset Functionality**
- [ ] After loading data (dummy or live), click "Fetch Different Data"
- [ ] Form reappears
- [ ] All state is reset
- [ ] Can fetch data again

**7. Responsive Design**
- [ ] Test on mobile screen (< 768px)
- [ ] Test on tablet screen (768px - 1024px)
- [ ] Test on desktop screen (> 1024px)
- [ ] All elements should be properly sized
- [ ] Tables should be scrollable on mobile

**8. Browser Compatibility**
- [ ] Test on Chrome
- [ ] Test on Firefox
- [ ] Test on Safari
- [ ] Test on Edge

---

## Integration Testing

### Full Stack Integration

**Test Scenario 1: Dummy Data Flow**
1. Start backend server
2. Start frontend server
3. Click "Load Dummy Data"
4. Verify:
   - API request to `/api/dummy-data`
   - Response has `isDemo: true`
   - UI shows demo banner
   - All data renders correctly

**Test Scenario 2: Live Data Flow** (Use your credentials)
1. Enter valid credentials
2. Click "Fetch Live Data"
3. Verify:
   - API request to `/api/scrape-portal`
   - Loading states appear
   - Browser automation happens (backend)
   - CAPTCHA is solved
   - Login succeeds
   - Data is extracted
   - Response has `isDemo: false`
   - UI shows success banner

**Test Scenario 3: Error Handling**
1. Enter invalid credentials
2. Verify:
   - Error response from API
   - Error banner appears
   - Attempt counter increments
   - Can retry up to 3 times

**Test Scenario 4: CORS**
1. Deploy frontend to different domain
2. Verify:
   - No CORS errors
   - API requests succeed
   - `ALLOWED_ORIGINS` is configured correctly

---

## Production Testing

### Pre-deployment Checks

**Backend:**
```bash
# Test with production-like settings
cd soa-student-scraper/backend
source venv/bin/activate

# Set production environment
export ALLOWED_ORIGINS=https://your-frontend-domain.com
export DEBUG=false

# Start server
uvicorn main:app --host 0.0.0.0 --port 8000

# Test endpoints
curl http://localhost:8000/health
curl http://localhost:8000/api/dummy-data
```

**Frontend:**
```bash
cd soa-student-scraper/frontend

# Set production API URL
export VITE_API_URL=https://your-backend-domain.com

# Build for production
npm run build

# Preview production build
npm run preview

# Test in browser at http://localhost:4173
```

### Post-deployment Checks

**1. Backend Health**
```bash
curl https://your-backend.onrender.com/health
```

**2. Frontend Accessibility**
- Open `https://your-frontend.vercel.app`
- Check console for errors
- Verify all assets load (check Network tab)

**3. API Integration**
- Test dummy data from production frontend
- Verify API calls go to correct backend URL
- Check CORS headers in Network tab

**4. End-to-End Flow**
- Complete dummy data flow
- (Optional) Test with real credentials in a safe manner

### Performance Testing

**Backend Performance:**
```bash
# Install Apache Bench
sudo apt-get install apache2-utils

# Test dummy data endpoint
ab -n 100 -c 10 https://your-backend.onrender.com/api/dummy-data

# Expected:
# - Requests per second: > 10
# - Mean time per request: < 1000ms
```

**Frontend Performance:**
- Use Lighthouse in Chrome DevTools
- Target scores:
  - Performance: > 90
  - Accessibility: > 95
  - Best Practices: > 90
  - SEO: > 90

### Security Testing

**1. HTTPS Verification**
- [ ] Backend uses HTTPS
- [ ] Frontend uses HTTPS
- [ ] No mixed content warnings

**2. Credential Security**
- [ ] Passwords are masked in UI
- [ ] No credentials in browser console
- [ ] No credentials in network logs
- [ ] No credentials stored locally

**3. CORS Configuration**
- [ ] Only allowed origins can access API
- [ ] Test from unauthorized domain (should fail)

**4. Input Validation**
- [ ] Try SQL injection patterns → should be rejected
- [ ] Try XSS patterns → should be sanitized
- [ ] Try extremely long inputs → should be rejected

---

## Automated Testing

### Backend Unit Tests

Create `backend/test_main.py`:
```python
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_dummy_data():
    response = client.get("/api/dummy-data")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] == True
    assert data["isDemo"] == True
    assert "data" in data

def test_scrape_invalid_credentials():
    response = client.post(
        "/api/scrape-portal",
        json={"registration_number": "invalid", "password": "wrong"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] == False
```

Run tests:
```bash
cd backend
source venv/bin/activate
pip install pytest
pytest test_main.py -v
```

### Frontend Unit Tests

Create `frontend/src/App.test.jsx`:
```javascript
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders login form', () => {
  render(<App />);
  expect(screen.getByText(/SOA Student Portal/i)).toBeInTheDocument();
  expect(screen.getByText(/Fetch Live Data/i)).toBeInTheDocument();
  expect(screen.getByText(/Load Dummy Data/i)).toBeInTheDocument();
});
```

---

## Troubleshooting Guide

### Common Issues

**1. "CAPTCHA_FAILED" error**
- CAPTCHA solving may fail occasionally
- Retry the request
- Check tesseract installation: `tesseract --version`
- Verify Pillow is installed: `pip show Pillow`

**2. "PORTAL_UNREACHABLE" error**
- Check internet connection
- Verify portal URL is accessible
- Check if portal is down for maintenance

**3. "AUTH_FAILED" error**
- Verify credentials are correct
- Check if password has special characters
- Ensure registration number format is correct

**4. Frontend can't connect to backend**
- Verify backend is running
- Check `VITE_API_URL` is set correctly
- Verify CORS configuration
- Check browser console for errors

**5. Playwright browser not found**
- Run `playwright install chromium`
- Check `PLAYWRIGHT_BROWSERS_PATH` environment variable
- Verify disk space (browsers need ~2GB)

---

## Test Coverage Goals

- **Backend:** > 80% code coverage
- **Frontend:** > 70% code coverage
- **Integration:** All critical user flows tested
- **E2E:** Main scenarios automated

---

**Last Updated:** December 2024
