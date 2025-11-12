# 🚀 QUICK START: Deploy Backend to Railway

## ✅ What We're Doing

**Problem:** Vercel cannot connect to Railway MySQL (DNS issue)  
**Solution:** Deploy backend API to Railway where it CAN connect to database

**Architecture:**
```
Frontend (Vercel) → Backend API (Railway) → MySQL Database (Railway)
```

---

## 📋 5-Minute Deployment

### STEP 1: Open Railway Dashboard

Go to: **https://railway.app/dashboard**

### STEP 2: Create New Service

1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Choose **"ITER_Live"** (your repository)
4. Railway auto-detects Node.js ✅

### STEP 3: Add Environment Variables

Click **"Variables"** tab and add these **15 variables**:

| Variable | Value |
|----------|-------|
| `DB_HOST` | `mysql.railway.internal` |
| `DB_PORT` | `3306` |
| `DB_USER` | `root` |
| `DB_PASSWORD` | `NlEpRBhwEHsSHrDWEEfahDOMcEzfIdLh` |
| `DB_NAME` | `railway` |
| `JWT_SECRET` | `prod-jwt-secret-change-this-in-production-8f4b2c9d1e7a3f6b` |
| `JWT_REFRESH_SECRET` | `prod-refresh-secret-change-this-in-production-3e7c1f9b4d2a` |
| `JWT_EXPIRE` | `1h` |
| `JWT_REFRESH_EXPIRE` | `7d` |
| `NODE_ENV` | `production` |
| `PORT` | `5000` |
| `CLIENT_URL` | `https://iter-college-management.vercel.app` |
| `CORS_WHITELIST` | `https://iter-college-management.vercel.app` |
| `RATE_LIMIT_WINDOW_MS` | `900000` |
| `RATE_LIMIT_MAX_REQUESTS` | `100` |

**Important:** Use `mysql.railway.internal` for internal connection!

### STEP 4: Deploy

Railway automatically builds and deploys. Wait 2-3 minutes.

### STEP 5: Get Railway URL

Railway gives you a URL like:
```
https://iter-live-production.up.railway.app
```

### STEP 6: Test Backend

Open in browser:
```
https://YOUR-RAILWAY-URL/api/health
```

Should return:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-16T...",
  "uptime": 45.3
}
```

✅ **Backend is working!**

---

## 🔧 Update Frontend

Now we need to point frontend to Railway backend.

### Option A: Run Update Script (Automated)

```powershell
.\update-api-urls.ps1 -RailwayUrl "https://YOUR-RAILWAY-URL"
```

This creates `api-config.js` file with correct URLs.

### Option B: Manual Update

Create `client/js/api-config.js`:

```javascript
const API_CONFIG = {
    BASE_URL: 'https://YOUR-RAILWAY-URL',
    API_URL: 'https://YOUR-RAILWAY-URL/api'
};

function getApiUrl(endpoint) {
    return `${API_CONFIG.API_URL}/${endpoint.replace(/^\//, '')}`;
}
```

Then update your HTML files to include:
```html
<script src="/client/js/api-config.js"></script>
```

And update API calls:
```javascript
// OLD
fetch('/api/auth/login', ...)

// NEW
fetch(getApiUrl('auth/login'), ...)
```

---

## 🎯 Deploy Updated Frontend

```powershell
vercel --prod
```

---

## ✅ Test End-to-End

1. **Open Vercel website:** https://iter-college-management.vercel.app
2. **Try login with:**
   - Registration Number: `ADM2025001`
   - Password: `Admin@123456`
3. **Check browser console** - API calls should go to Railway URL
4. **Verify data loads** - Dashboard shows attendance, marks, etc.

---

## 🔍 Troubleshooting

### Backend won't start
- Check Railway logs for errors
- Verify all 15 environment variables added
- Check `package.json` has `npm start` script

### Database connection fails
- Verify `DB_HOST=mysql.railway.internal`
- Check MySQL service exists in same Railway project
- Test local connection: `node check-railway-db.js`

### CORS errors
- Add Vercel URL to `CORS_WHITELIST` variable
- Make sure no trailing slashes in URLs
- Check Railway logs for CORS messages

### Frontend still calls /api/
- Verify `api-config.js` is included in HTML
- Check all API calls use `getApiUrl()`
- Clear browser cache (Ctrl+Shift+R)

---

## 📝 Helper Scripts

**Deploy to Railway (Interactive):**
```powershell
.\railway-deploy-simple.ps1
```

**Update Frontend URLs:**
```powershell
.\update-api-urls.ps1 -RailwayUrl "https://YOUR-URL"
```

**Test Railway Connection:**
```powershell
node check-railway-db.js
```

**Test Backend API:**
```powershell
node test-vercel-deployment.js
# (Will test Railway backend once URL updated)
```

---

## 🎯 Summary

**What you're doing:**
1. ✅ Deploy backend to Railway (5 min)
2. ✅ Get Railway URL
3. ✅ Update frontend API calls
4. ✅ Redeploy Vercel
5. ✅ Test login and data

**Why this works:**
- Railway backend CAN connect to Railway MySQL ✅
- Vercel serves static files (fast) ✅
- API calls go to Railway (working) ✅

**Cost:**
- Railway: FREE (within $5 credit/month)
- Vercel: FREE (static hosting)
- Total: $0/month ✅

---

## 🆘 Need Help?

**Railway Dashboard:** https://railway.app/dashboard  
**Deployment Guide:** RAILWAY_BACKEND_DEPLOYMENT.md  
**Full Analysis:** RAILWAY_VERCEL_INCOMPATIBILITY.md

---

## ✅ Ready? Start Here:

1. **Open:** https://railway.app/dashboard
2. **Run:** `.\railway-deploy-simple.ps1`
3. **Follow the prompts!**

**You'll be done in 10 minutes!** 🚀
