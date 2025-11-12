# Railway Backend Deployment Guide

## 🚀 Deploy Backend API to Railway

Since Vercel cannot connect to Railway MySQL, we'll deploy the backend to Railway where it CAN connect to the database.

---

## 📋 Step-by-Step Deployment

### Step 1: Create New Railway Service

1. Go to **Railway Dashboard**: https://railway.app/dashboard
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose repository: **ITER_Live** (or your repo name)
5. Railway will detect Node.js automatically

### Step 2: Configure Environment Variables

Add these in Railway Dashboard → Variables:

```bash
DB_HOST=mysql.railway.internal
DB_PORT=3306
DB_USER=root
DB_PASSWORD=NlEpRBhwEHsSHrDWEEfahDOMcEzfIdLh
DB_NAME=railway
JWT_SECRET=prod-jwt-secret-change-this-in-production-8f4b2c9d1e7a3f6b
JWT_REFRESH_SECRET=prod-refresh-secret-change-this-in-production-3e7c1f9b4d2a
JWT_EXPIRE=1h
JWT_REFRESH_EXPIRE=7d
NODE_ENV=production
PORT=5000
CLIENT_URL=https://iter-college-management.vercel.app
CORS_WHITELIST=https://iter-college-management.vercel.app,https://www.iters.live
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

**Important:** Use `mysql.railway.internal` for DB_HOST (internal Railway connection).

### Step 3: Wait for Deployment

Railway will:
- Install dependencies (`npm install`)
- Build the project
- Start the server (`npm start`)
- Assign a public URL

### Step 4: Get Your Railway URL

After deployment, Railway provides a URL like:
```
https://iter-live-production.up.railway.app
```

Copy this URL - you'll need it for the frontend!

### Step 5: Test Backend API

Open in browser:
```
https://YOUR-RAILWAY-URL/api/health
```

Should return:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-16T...",
  "uptime": 123.45
}
```

---

## 🔧 Update Frontend to Use Railway Backend

### Option A: Update via Environment Variable (Recommended)

Add this to Vercel environment variables:
```
VITE_API_URL=https://YOUR-RAILWAY-URL
```

### Option B: Update API Config File

Edit `client/js/config.js` or wherever API URL is defined:
```javascript
const API_URL = 'https://YOUR-RAILWAY-URL';
```

### Option C: Update All API Calls

Find and replace in frontend files:
- Find: `/api/`
- Replace: `https://YOUR-RAILWAY-URL/api/`

---

## 🎯 Architecture After Deployment

```
┌─────────────────┐
│  User Browser   │
└────────┬────────┘
         │
         ├─────────────────┐
         │                 │
    [HTML/CSS/JS]      [API Calls]
         │                 │
         ▼                 ▼
┌─────────────────┐ ┌──────────────────┐
│ Vercel (Static) │ │ Railway (Backend)│
│  - index.html   │ │  - Node.js API   │
│  - CSS files    │ │  - Express routes│
│  - JS files     │ │  - Auth logic    │
└─────────────────┘ └────────┬─────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Railway MySQL DB │
                    │  - 553 users     │
                    │  - 15K+ records  │
                    └──────────────────┘
```

**Frontend (Vercel)** → **Backend (Railway)** → **Database (Railway)**

---

## ✅ Verification Checklist

After deployment, test these:

- [ ] Backend API accessible: `https://YOUR-RAILWAY-URL/api/health`
- [ ] Database connection working: Check API logs in Railway
- [ ] Login endpoint: `POST /api/auth/login` with credentials
- [ ] Frontend can call backend: Open browser console, check API calls
- [ ] CORS configured: No CORS errors in browser console
- [ ] Demo accounts work: Test login with ADM2025001 / Admin@123456

---

## 🔍 Testing Commands

### Test Railway Backend Directly:

```powershell
# Test health endpoint
curl https://YOUR-RAILWAY-URL/api/health

# Test login (replace URL)
$body = @{
    registration_number = "ADM2025001"
    password = "Admin@123456"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://YOUR-RAILWAY-URL/api/auth/login" -Method POST -Body $body -ContentType "application/json"
```

---

## 📝 Files Prepared

I've created these files for Railway deployment:
- ✅ `Procfile` - Process definition
- ✅ `railway.json` - Railway configuration (already exists)
- ✅ `railway.toml` - Build settings (if needed)

---

## 🚨 Important Notes

### CORS Configuration:
Make sure `CORS_WHITELIST` includes:
- `https://iter-college-management.vercel.app`
- `https://www.iters.live` (if you have custom domain)

### Database Connection:
- Railway backend uses `mysql.railway.internal` (internal network)
- This is FAST and FREE within Railway
- No external bandwidth charges

### Cost:
- Railway free tier: $5 credit/month
- Your app should stay within free tier easily

---

## 🎯 Next Steps

1. **Deploy to Railway** (follow steps above)
2. **Get Railway URL** from deployment
3. **Update frontend** API endpoints
4. **Test end-to-end** login and data fetching
5. **Redeploy Vercel** with updated API URLs

---

## 🆘 Troubleshooting

### Backend won't start:
- Check Railway logs for errors
- Verify all environment variables are set
- Ensure `package.json` has correct start script

### Database connection fails:
- Verify `DB_HOST=mysql.railway.internal`
- Check MySQL service is in same Railway project
- Ensure DB credentials are correct

### CORS errors:
- Add Vercel URL to `CORS_WHITELIST`
- Check backend logs for CORS rejection messages
- Verify `CLIENT_URL` is set correctly

### Frontend can't reach backend:
- Check Railway URL is correct
- Verify Railway service is public (not private)
- Test backend URL in browser first

---

## 📞 Support

**Railway Dashboard:** https://railway.app/dashboard  
**Railway Docs:** https://docs.railway.app  
**Railway Discord:** https://discord.gg/railway

Once you deploy and get the Railway URL, I'll help you update the frontend!

**Ready to deploy? Follow Step 1 above!**
