# ITER-AIO Render Deployment Guide

## Quick Manual Deployment (5 minutes)

Since you already have:
- ✅ Database created and seeded with demo accounts
- ✅ Code ready with PostgreSQL support
- ✅ render.yaml configuration file

### Step 1: Push Code to GitHub (if not already done)
```bash
git init
git add .
git commit -m "Initial commit - ITER-AIO with PostgreSQL"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

### Step 2: Deploy via Render Dashboard

1. **Go to Render Dashboard**: https://dashboard.render.com
2. **Click "New +" → "Web Service"**
3. **Connect your GitHub repository** (authorize if needed)
4. **Configure the service:**
   - **Name**: `iter-aio`
   - **Region**: Oregon (US West)
   - **Branch**: `main` (or `master`)
   - **Root Directory**: (leave empty)
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server/index.js`
   - **Plan**: Free

5. **Add Environment Variables** (click "Advanced"):
   ```
   NODE_ENV=production
   PORT=10000
   DATABASE_URL=postgresql://iter_college_db_user:93UqDvuxyr57TKtxgvBWIVSj3CcAJe6B@dpg-d3o80g3e5dus73agr8q0-a/iter_college_db
   JWT_SECRET=<generate-random-64-char-string>
   JWT_REFRESH_SECRET=<generate-random-64-char-string>
   MAX_FILE_SIZE=10485760
   JWT_EXPIRE=24h
   JWT_REFRESH_EXPIRE=7d
   CORS_WHITELIST=<will-be-your-render-url>
   ```

6. **Add Persistent Disk** (in Advanced settings):
   - **Name**: `uploads`
   - **Mount Path**: `/opt/render/project/src/uploads`
   - **Size**: 1 GB

7. **Click "Create Web Service"**

### Step 3: Update CORS After Deployment

Once deployed, get your Render URL (e.g., `https://iter-aio.onrender.com`) and:
1. Go to **Environment** tab
2. Edit `CORS_WHITELIST` variable
3. Set it to your full Render URL
4. Save (this will trigger a redeploy)

---

## Alternative: Deploy from Blueprint (render.yaml)

If you prefer automated deployment:

1. **Go to**: https://dashboard.render.com/blueprints
2. **Click "New Blueprint Instance"**
3. **Connect your GitHub repo** with the render.yaml file
4. **Render will auto-detect** the configuration
5. **Fill in environment variables** when prompted
6. **Click "Apply"**

---

## Generated Secrets

Use these for JWT_SECRET and JWT_REFRESH_SECRET:

**JWT_SECRET:**
```
$((-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})))
```

**JWT_REFRESH_SECRET:**
```
$((-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})))
```

Or run in PowerShell:
```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

---

## After Deployment

### Test Your Deployment

1. **Health Check**: `https://your-app.onrender.com/health`
   - Should return: `{"status": "ok", "database": "connected"}`

2. **Test Login**:
   ```bash
   curl -X POST https://your-app.onrender.com/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"userId": "STU20250001", "password": "Student@123"}'
   ```

3. **Access the App**: Navigate to your Render URL in a browser

### Demo Accounts Ready

- **Student**: STU20250001 / Student@123
- **Teacher**: TCH2025001 / Teacher@123  
- **Admin**: ADM2025001 / Admin@123456

Each account has pre-loaded data that varies slightly on each login!

---

## Troubleshooting

### If deployment fails:

1. **Check Logs**: Render Dashboard → Your Service → Logs tab
2. **Common issues**:
   - Missing environment variables
   - Wrong DATABASE_URL format
   - Node version mismatch (use Node 18+)

### If database connection fails:

- Verify DATABASE_URL is the **Internal** URL from your Render PostgreSQL dashboard
- Check that the database has the schema (18 tables should exist)

### Need help?

Your database is already set up with:
- ✅ Complete schema (18 tables)
- ✅ Demo accounts seeded (ids: 1, 4, 54)
- ✅ Internal URL configured for low-latency access

Just deploy the web service and it will work immediately!
