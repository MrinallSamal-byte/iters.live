# Render Memory Optimization Guide

## Issue: SIGTERM Crash on Render Free Tier

### Problem
The application was experiencing SIGTERM crashes on Render's free tier (512MB RAM limit) due to Puppeteer's high memory requirements.

### Root Cause
- **Puppeteer Memory Usage**: Headless Chrome browser requires 200-300MB RAM just to launch
- **Render Free Tier**: Only 512MB RAM available
- **Result**: Memory spike during Puppeteer initialization causes Render to kill the process with SIGTERM

### Solution

#### 1. **Optional Dependencies**
Puppeteer and Tesseract.js have been moved to `optionalDependencies` in `package.json`:

```json
{
  "optionalDependencies": {
    "puppeteer": "^24.32.1",
    "tesseract.js": "^6.0.1"
  }
}
```

This allows the application to run without installing these heavy dependencies when not needed.

#### 2. **Build Configuration**
Updated `render.yaml` to skip optional dependencies:

```yaml
buildCommand: npm install --omit=optional
```

Additional environment variables:
- `PUPPETEER_SKIP_DOWNLOAD=true` - Prevents downloading Chromium binaries
- `PORTAL_FEATURES_ENABLED=false` - Disables portal scraping features by default

#### 3. **Graceful Degradation**
The portal scraper service now handles missing Puppeteer gracefully:

- Checks if Puppeteer is available before attempting to use it
- Returns appropriate error messages when scraping is unavailable
- Falls back to demo data when portal features are disabled

#### 4. **Memory-Efficient Puppeteer Configuration**
When Puppeteer IS needed, it now uses memory-optimized launch arguments:

```javascript
await puppeteer.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--single-process',  // Reduce process overhead
    '--no-zygote'        // Reduce memory usage
  ]
});
```

### Usage

#### Running WITHOUT Portal Scraping (Default - Render Free Tier)
```bash
# Environment variables
PORTAL_FEATURES_ENABLED=false
PUPPETEER_SKIP_DOWNLOAD=true

# Install dependencies (skips Puppeteer)
npm install --omit=optional

# Start server
npm start
```

**Memory Usage**: ~100-150MB (fits comfortably in 512MB)

#### Running WITH Portal Scraping (Paid Tier or Local Development)
```bash
# Environment variables
PORTAL_FEATURES_ENABLED=true
# Don't set PUPPETEER_SKIP_DOWNLOAD

# Install all dependencies (includes Puppeteer)
npm install

# Start server
npm start
```

**Memory Usage**: ~350-450MB peak (requires at least 1GB RAM)

### Feature Flags

Portal scraping features are controlled by the `PORTAL_FEATURES_ENABLED` environment variable:

- **Disabled (default)**: Portal sync endpoints return friendly error messages, application uses demo data
- **Enabled**: Portal scraping is available if Puppeteer is installed

### Deployment Checklist

#### For Render Free Tier (512MB RAM)
- [ ] Set `PORTAL_FEATURES_ENABLED=false`
- [ ] Set `PUPPETEER_SKIP_DOWNLOAD=true`
- [ ] Use `buildCommand: npm install --omit=optional`
- [ ] Use `startCommand: node server/index.js` (not auto-start.js)

#### For Render Paid Tier or Local Development (1GB+ RAM)
- [ ] Set `PORTAL_FEATURES_ENABLED=true`
- [ ] Remove `PUPPETEER_SKIP_DOWNLOAD` or set to `false`
- [ ] Use `buildCommand: npm install`
- [ ] Ensure adequate memory allocation

### Health Check

Check if portal scraping is available:

```bash
# Health check endpoint
curl https://your-app.onrender.com/health

# Scraper service health check
curl http://localhost:5001/health

# Response includes:
{
  "status": "ok",
  "scrapingAvailable": false,  // true if Puppeteer is installed
  "features": {
    "puppeteer": false,
    "apiBasedCaptcha": true
  }
}
```

### Alternative Solutions

If you need portal scraping on Render Free Tier:

1. **External Scraper Service**: Deploy scraper as a separate service on a paid tier
2. **API-Only CAPTCHA**: Use only Google Vision/Gemini APIs (no Puppeteer)
3. **Upgrade Tier**: Use Render's paid plans with more memory
4. **Different Platform**: Consider platforms with more generous free tiers

### Testing

Test the application without Puppeteer:

```bash
# Install without optional dependencies
npm install --omit=optional

# Verify Puppeteer is not installed
node -e "try { require('puppeteer'); console.log('FAIL'); } catch(e) { console.log('PASS - Puppeteer not available'); }"

# Start server
npm start

# Should see:
# "Puppeteer not installed (optional dependency). Portal scraping will be unavailable."
```

### Monitoring

Monitor memory usage on Render:

1. Go to your Render dashboard
2. Click on your service
3. Navigate to "Metrics" tab
4. Watch memory usage - should stay under 400MB consistently

### Troubleshooting

**Issue**: Server still crashes with SIGTERM
- Check Render logs for memory spikes
- Ensure `--no-optional` flag is in buildCommand
- Verify `PUPPETEER_SKIP_DOWNLOAD=true` is set
- Confirm `PORTAL_FEATURES_ENABLED=false`

**Issue**: Portal features not working
- This is expected on free tier
- Users should see friendly messages about feature being unavailable
- Demo data should load automatically

**Issue**: "AI service unavailable" in chatbot
- This is separate from portal scraping
- Check `OPENROUTER_API_KEY` and `GEMINI_API_KEY` environment variables
- These API-based features work fine without Puppeteer

### Related Documentation

- [Feature Flags Configuration](./server/config/featureFlags.js)
- [Portal Scraper Service](./server/services/portal-scraper.service.js)
- [Render Deployment Guide](./RENDER_DEPLOYMENT_MANUAL.md)
- [Render Troubleshooting](./RENDER_TROUBLESHOOTING.md)

---

**Last Updated**: December 2024  
**Tested On**: Render Free Tier (512MB RAM)  
**Status**: ✅ Working - Server runs stably without SIGTERM crashes
