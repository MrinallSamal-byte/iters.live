# Portal Scraper - Quick Start Guide

## What is this?

This is a Node.js service that automatically fetches student data from the SOA Student Portal (https://soaportals.com/StudentPortalSOA/#/) using browser automation and AI-powered CAPTCHA solving.

## Quick Start (5 minutes)

### Step 1: Start the Scraper Service

Open a terminal and run:

```bash
npm run start:scraper
```

You should see:
```
Portal Scraper Service running on port 5001
Health check: http://localhost:5001/health
```

### Step 2: Test the Service

In another terminal, run:

```bash
npm run test:scraper
```

This will verify the service is working correctly.

### Step 3: Use in Your Application

The portal controller already integrates with the scraper service. Just use the existing API endpoints:

```bash
# Example: Login and fetch portal data
curl -X POST http://localhost:3000/api/portal/login \
  -H "Content-Type: application/json" \
  -d '{
    "reg_number": "25E111A45",
    "password": "your_password"
  }'
```

## How It Works

```
Your App → Portal Controller → Scraper Service → SOA Portal
         ← Returns Data ←      ← Scrapes Data ←
```

1. **Your application** calls the portal controller
2. **Portal controller** sends credentials to scraper service
3. **Scraper service** uses Puppeteer to:
   - Open the SOA portal
   - Solve CAPTCHA using AI (Google Vision + Tesseract)
   - Login with credentials
   - Extract student data
4. **Data returned** back to your application

## What if Portal Login Fails?

The system has a 3-attempt retry mechanism with automatic fallback:

1. **Attempt 1-2**: Retry portal login
2. **Attempt 3**: After final failure, automatically:
   - Try to load backup data from Google Drive
   - Try to load backup data from Google Sheets
   - Fall back to dummy/demo data

Your users always get data, even if portal is down!

## Configuration

### Basic (No Setup Required)

The service works out of the box with:
- Default portal URL
- Built-in CAPTCHA solving
- Rate limiting enabled

### Advanced (Optional)

Create a `.env` file or set environment variables:

```bash
# Portal URL (default is SOA portal)
PORTAL_URL=https://soaportals.com/StudentPortalSOA/#/

# Google Vision API Key (for better CAPTCHA accuracy)
GOOGLE_VISION_API_KEY=your_api_key_here

# Scraper service port
SCRAPER_PORT=5001

# For custom Chrome installation
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

## Troubleshooting

### "Failed to launch browser"

**Linux/Ubuntu:**
```bash
sudo apt-get install chromium-browser
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

**Docker:**
Add to your Dockerfile:
```dockerfile
RUN apt-get update && apt-get install -y chromium-browser
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

### "Portal is unreachable"

1. Check if https://soaportals.com/StudentPortalSOA/ is accessible in your browser
2. Check your network/firewall settings
3. Verify you can access the site from your server

### CAPTCHA Solving Fails

The service uses dual CAPTCHA solving:
1. Google Vision API (more accurate)
2. Tesseract.js (fallback)

To improve accuracy, set up Google Vision API:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable Vision API
3. Create API key
4. Set `GOOGLE_VISION_API_KEY` environment variable

### Service Won't Start

Check if port 5001 is in use:
```bash
# Linux/Mac
lsof -i :5001

# Windows
netstat -ano | findstr :5001
```

Change port if needed:
```bash
SCRAPER_PORT=5002 npm run start:scraper
```

## Testing with Real Credentials

```bash
# Method 1: Using test script
TEST_REG_NUMBER=your_reg TEST_PASSWORD=your_pass npm run test:scraper

# Method 2: Direct API call
curl -X POST http://localhost:5001/api/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "reg_number": "your_registration_number",
    "password": "your_password"
  }'
```

## Production Deployment

### Using PM2

```bash
pm2 start server/services/portal-scraper-server.js --name scraper-service
pm2 save
```

### Using Docker

```yaml
services:
  scraper:
    build: .
    command: node server/services/portal-scraper-server.js
    ports:
      - "5001:5001"
    environment:
      - GOOGLE_VISION_API_KEY=${GOOGLE_VISION_API_KEY}
```

### Environment Variables for Production

```bash
NODE_ENV=production
SCRAPER_PORT=5001
GOOGLE_VISION_API_KEY=your_production_key
PORTAL_URL=https://soaportals.com/StudentPortalSOA/#/
```

## API Reference

### POST /api/scrape

Scrape portal data for a student.

**Request:**
```json
{
  "reg_number": "25E111A45",
  "password": "student_password"
}
```

**Success Response:**
```json
{
  "status": "SUCCESS",
  "data": {
    "profile": { "name": "...", "email": "..." },
    "marks": [...],
    "attendance": [...],
    "timetable": [...],
    "courses": [...],
    "results": [...],
    "notifications": [...]
  }
}
```

### GET /health

Check service health.

**Response:**
```json
{
  "status": "ok",
  "service": "student-portal-scraper-nodejs",
  "version": "2.0.0"
}
```

## Architecture

```
┌─────────────────────────┐
│   Your Application       │
│   (Express Server)       │
└───────────┬─────────────┘
            │
            │ HTTP Request
            ▼
┌─────────────────────────┐
│  Portal Controller       │
│  (portal.controller.js)  │
└───────────┬─────────────┘
            │
            │ HTTP Request
            ▼
┌─────────────────────────┐
│  Scraper Service         │
│  (port 5001)             │
│                          │
│  ┌──────────────────┐   │
│  │  Puppeteer       │   │
│  │  Browser         │   │
│  └──────────────────┘   │
│                          │
│  ┌──────────────────┐   │
│  │  CAPTCHA Solver  │   │
│  │  - Google Vision │   │
│  │  - Tesseract.js  │   │
│  └──────────────────┘   │
└───────────┬─────────────┘
            │
            │ Web Scraping
            ▼
┌─────────────────────────┐
│   SOA Student Portal     │
│   soaportals.com         │
└─────────────────────────┘
```

## Features

✅ **Automatic CAPTCHA Solving** - Uses AI/ML to solve CAPTCHAs
✅ **Human-like Behavior** - Random delays and typing patterns
✅ **Retry Logic** - 3 attempts before fallback
✅ **Rate Limiting** - Prevents abuse
✅ **Error Handling** - Comprehensive error messages
✅ **Fallback System** - Demo data if portal fails
✅ **Health Monitoring** - Built-in health check endpoint

## Next Steps

1. ✅ Service is running
2. ✅ Test with demo credentials
3. 🔄 Test with real student credentials
4. 🔄 Deploy to production
5. 🔄 Monitor CAPTCHA accuracy
6. 🔄 Set up Google Vision API for better accuracy

## Need Help?

1. Check the logs: The service prints detailed logs
2. Test the health endpoint: `curl http://localhost:5001/health`
3. Review full documentation: `PORTAL_SCRAPER_NODEJS.md`
4. Check portal accessibility: Open https://soaportals.com/StudentPortalSOA/ in browser

## Common Use Cases

### Case 1: Fresh Start

```bash
# Start everything fresh
npm run start:scraper  # Terminal 1
npm run start:server   # Terminal 2
npm run test:scraper   # Terminal 3
```

### Case 2: Development

```bash
# Auto-restart on changes
npm run dev:scraper    # Terminal 1
npm run dev            # Terminal 2
```

### Case 3: Production

```bash
# Using PM2
pm2 start server/services/portal-scraper-server.js --name scraper
pm2 start server/index.js --name server
pm2 save
pm2 startup
```

## Success Indicators

✅ Health endpoint returns 200 OK
✅ Test script passes health and CAPTCHA tests
✅ No errors in console logs
✅ Service accepts requests on port 5001
✅ Browser launches successfully (check logs)

---

**That's it!** You now have a working portal scraper service. 🎉
