# Portal Scraper Service - Node.js/Puppeteer Implementation

## Overview

This is a Node.js implementation of the SOA Student Portal scraper, replacing the Python/Selenium version with native Node.js using Puppeteer for browser automation.

## Features

- **Puppeteer Browser Automation**: Native Node.js solution using Puppeteer
- **Advanced CAPTCHA Solving**: Uses both Google Vision API and Tesseract.js OCR
- **Human-like Behavior**: Implements random delays and typing patterns to avoid detection
- **Fallback Mechanism**: Falls back to Tesseract.js if Google Vision API fails
- **Rate Limiting**: Built-in rate limiting to prevent abuse
- **Error Handling**: Comprehensive error handling and status codes

## Installation

The required dependencies are already installed:

```bash
npm install puppeteer tesseract.js sharp axios
```

Note: Puppeteer requires Chrome/Chromium. In production environments, you may need to:

1. Install Chromium: `apt-get install chromium-browser`
2. Set environment variable: `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser`

## Configuration

### Environment Variables

```bash
# Portal URL (default: https://soaportals.com/StudentPortalSOA/#/)
PORTAL_URL=https://soaportals.com/StudentPortalSOA/#/

# Google Vision API Key for CAPTCHA solving (optional, has default)
GOOGLE_VISION_API_KEY=your_api_key_here

# Scraper service port (default: 5001)
SCRAPER_PORT=5001

# Main server scraper service URL
SCRAPER_SERVICE_URL=http://localhost:5001

# Puppeteer executable path (optional, for custom Chrome installation)
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

## Running the Scraper Service

### Development

```bash
npm run dev:scraper
```

### Production

```bash
npm run start:scraper
```

### With the Main Server

The scraper service runs independently. Start both:

```bash
# Terminal 1: Main server
npm run start:server

# Terminal 2: Scraper service
npm run start:scraper
```

Or use PM2 for production:

```bash
pm2 start server/services/portal-scraper-server.js --name "scraper-service"
pm2 start server/index.js --name "main-server"
```

## API Endpoints

### POST /api/scrape

Main endpoint for scraping student portal data.

**Request:**
```json
{
  "reg_number": "25E111A45",
  "password": "your_password"
}
```

**Response (Success):**
```json
{
  "status": "SUCCESS",
  "data": {
    "profile": {
      "name": "Student Name",
      "registration_number": "25E111A45",
      "email": "student@iter.ac.in",
      "department": "CSE"
    },
    "marks": [...],
    "attendance": [...],
    "timetable": [...],
    "courses": [...],
    "results": [...],
    "notifications": [...]
  }
}
```

**Response (Auth Failed):**
```json
{
  "status": "AUTH_FAILED",
  "message": "Invalid credentials"
}
```

**Response (Portal Unreachable):**
```json
{
  "status": "PORTAL_UNREACHABLE",
  "message": "Student portal is currently unreachable"
}
```

**Response (Scrape Error):**
```json
{
  "status": "SCRAPE_ERROR",
  "message": "Error details"
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "student-portal-scraper-nodejs",
  "timestamp": "2025-12-09T13:00:00.000Z",
  "version": "2.0.0"
}
```

### POST /api/test-captcha

Test CAPTCHA solving capability.

**Request (optional):**
```json
{
  "image_url": "https://example.com/captcha.png"
}
```

**Response:**
```json
{
  "status": "ok",
  "api_key_configured": true,
  "api_key_length": 39,
  "captcha_text": "ABC123"
}
```

## CAPTCHA Solving

The scraper uses a dual-approach for CAPTCHA solving:

1. **Google Vision API** (Primary): More accurate, cloud-based OCR
2. **Tesseract.js** (Fallback): Local OCR processing

### Improving CAPTCHA Accuracy

To improve CAPTCHA solving accuracy:

1. **Get a Google Vision API Key**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Enable Vision API
   - Create an API key
   - Set `GOOGLE_VISION_API_KEY` environment variable

2. **Image Preprocessing**: The service automatically:
   - Converts to grayscale
   - Normalizes contrast
   - Applies threshold filtering

3. **Multiple Retries**: The scraper automatically retries CAPTCHA solving up to 3 times

## Integration with Main Application

The portal controller (`server/controllers/portal.controller.js`) automatically uses this service:

```javascript
// Environment variable for scraper service
const SCRAPER_SERVICE_URL = process.env.SCRAPER_SERVICE_URL || 'http://localhost:5001';

// The controller makes requests to the scraper service
const scraperResponse = await axios.post(
  `${SCRAPER_SERVICE_URL}/api/scrape`,
  { reg_number, password }
);
```

## Troubleshooting

### Puppeteer Chrome Not Found

If you get "Chrome not found" errors:

```bash
# On Ubuntu/Debian
sudo apt-get install chromium-browser

# Set environment variable
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

### CAPTCHA Solving Fails

1. Check if Google Vision API key is configured
2. Verify API key has Vision API enabled
3. Check network connectivity
4. Review CAPTCHA image quality

### Portal Unreachable

1. Check if https://soaportals.com/StudentPortalSOA/#/ is accessible
2. Verify network/firewall settings
3. Check DNS resolution
4. Try accessing from browser manually

### Rate Limiting

The service limits to 5 requests per minute per IP. If you need more:

1. Adjust `RATE_LIMIT_MAX` in `portal-scraper-server.js`
2. Implement Redis-based rate limiting for production

## Differences from Python/Selenium Version

| Feature | Python/Selenium | Node.js/Puppeteer |
|---------|----------------|-------------------|
| Language | Python | JavaScript/Node.js |
| Browser | Selenium WebDriver | Puppeteer |
| OCR | Google Vision API only | Google Vision + Tesseract.js |
| Dependencies | Many Python packages | Native Node.js packages |
| Integration | Flask microservice | Express.js microservice |
| Performance | Slower startup | Faster startup |

## Architecture

```
┌─────────────────────────────────────────────────┐
│          Main Server (Express)                   │
│     server/controllers/portal.controller.js      │
└────────────────┬────────────────────────────────┘
                 │
                 │ HTTP Request
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│       Scraper Service (Express)                  │
│  server/services/portal-scraper-server.js        │
└────────────────┬────────────────────────────────┘
                 │
                 │ Uses
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│       Portal Scraper (Puppeteer)                 │
│   server/services/portal-scraper.service.js      │
│                                                   │
│  ┌─────────────────┐    ┌──────────────────┐   │
│  │  Browser         │    │  CAPTCHA Solver   │   │
│  │  Automation      │◄───┤  - Google Vision  │   │
│  │  (Puppeteer)     │    │  - Tesseract.js   │   │
│  └─────────────────┘    └──────────────────┘   │
└─────────────────────────────────────────────────┘
                 │
                 │ Scrapes
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│        SOA Student Portal                        │
│   https://soaportals.com/StudentPortalSOA/       │
└─────────────────────────────────────────────────┘
```

## Production Deployment

### Using PM2

```bash
# Start both services
pm2 start ecosystem.config.js

# Or start individually
pm2 start server/services/portal-scraper-server.js --name scraper
pm2 start server/index.js --name main-server
```

### Using Docker

Add to your `docker-compose.yml`:

```yaml
services:
  scraper:
    build: .
    command: node server/services/portal-scraper-server.js
    ports:
      - "5001:5001"
    environment:
      - GOOGLE_VISION_API_KEY=${GOOGLE_VISION_API_KEY}
      - PORTAL_URL=${PORTAL_URL}
    depends_on:
      - main-server
```

## Future Enhancements

- [ ] Add more data extraction patterns for different portal sections
- [ ] Implement caching for frequently accessed data
- [ ] Add support for alternative CAPTCHA solving services
- [ ] Improve error recovery and retry logic
- [ ] Add metrics and monitoring
- [ ] Support for multiple portal instances
- [ ] WebSocket support for real-time updates

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review logs from the scraper service
3. Test the portal manually to verify it's accessible
4. Check CAPTCHA solving with `/api/test-captcha` endpoint

## License

Same as the main project.
