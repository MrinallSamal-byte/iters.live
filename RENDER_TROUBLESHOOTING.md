# 🔧 Render Deployment Troubleshooting - Database Connection Error

## Issue: "Database connection error. Please try again later."

This 503 error means the server can't connect to the PostgreSQL database.

---

## ✅ Quick Fix Checklist

### 1. Verify Environment Variables in Render

Go to your Render service → **Environment** tab and check:

**Required variables:**
```
DATABASE_URL=postgresql://iter_college_db_user:93UqDvuxyr57TKtxgvBWIVSj3CcAJe6B@dpg-d3o80g3e5dus73agr8q0-a/iter_college_db
NODE_ENV=production
PORT=10000
JWT_SECRET=LXfbTAoqz0WlSa7QeIn6Khrdyp3JvsZ4k2tuxjHMiVwOEmR5BGgDUC18cPFNY9
JWT_REFRESH_SECRET=uqwGFrHbNfMo1YdpjOSg7K8Wi9VkUhs4xDeI5LARvan2lEBzy0QPC3mTZX6tcJ
MAX_FILE_SIZE=10485760
JWT_EXPIRE=24h
JWT_REFRESH_EXPIRE=7d
```

**⚠️ CRITICAL: Check DATABASE_URL**
- Should start with `postgresql://`
- Should use the **INTERNAL** database URL (not external)
- Should NOT have `.render.com` in the hostname (that's external)

### 2. Use the Correct Database URL

Your database is in **Ohio region**, same as your web service. You need the **INTERNAL** URL:

```
postgresql://iter_college_db_user:93UqDvuxyr57TKtxgvBWIVSj3CcAJe6B@dpg-d3o80g3e5dus73agr8q0-a/iter_college_db
```

❌ **WRONG** (External URL - higher latency, may fail):
```
postgresql://iter_college_db_user:...@dpg-d3o80g3e5dus73agr8q0-a.ohio-postgres.render.com/iter_college_db
```

### 3. Check Render Logs

1. Go to your Render service dashboard
2. Click **Logs** tab
3. Look for database connection messages:
   - ✓ Should see: `✓ Database connected successfully`
   - ✗ If you see: `✗ Database connection attempt failed`

Common error messages and fixes:

**Error: "no pg_hba.conf entry"**
- Your DATABASE_URL is using external hostname
- Switch to internal URL (no `.render.com`)

**Error: "timeout"**
- Database might be sleeping (free tier spins down)
- Wait 30 seconds and try again
- Check if database and web service are in same region

**Error: "password authentication failed"**
- DATABASE_URL has wrong credentials
- Verify the URL exactly matches your database credentials

**Error: "database does not exist"**
- Database name is wrong in the URL
- Should end with `/iter_college_db`

### 4. Verify Database is Running

1. Go to Render Dashboard → **PostgreSQL** → `iter_college_db`
2. Check status - should be **Available**
3. If it says "Suspended", click to wake it up

### 5. Push Updated Code

I just fixed the Dockerfile to use port 10000 properly. Push the changes:

```powershell
git add Dockerfile server/database/db.js
git commit -m "Fix: Use PORT env var in Dockerfile, improve DB connection logging"
git push origin main
```

Render will auto-deploy the update.

---

## 🔍 Debug Steps

### Step 1: Check Render Service Logs

Look for startup logs. You should see:

```
✓ Database connected successfully (PostgreSQL)
Connected to: dpg-d3o80g3e5dus73agr8q0-a
Server running on port 10000
```

### Step 2: Test Health Endpoint

Once deployed, visit: `https://your-service.onrender.com/health`

**Expected response:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-16T...",
  "database": "connected",
  "uptime": 123
}
```

**If you get an error:**
- Check that PORT=10000 is set
- Check DATABASE_URL is correct
- Check server logs for connection errors

### Step 3: Verify Database Schema

Your database should have these tables:
```
users, attendance, marks, assignments, assignment_submissions, 
events, event_registrations, timetable, admit_cards, files, 
hostel_menu, fees, clubs, achievements, announcements, 
activity_log, system_settings, refresh_tokens
```

If tables are missing, run the schema script again.

---

## 🚀 Common Solutions

### Solution 1: Update DATABASE_URL (Most Common)

If you're using the external URL with `.ohio-postgres.render.com`, change it to internal:

**In Render Dashboard:**
1. Go to Environment tab
2. Find `DATABASE_URL`
3. Change to: `postgresql://iter_college_db_user:93UqDvuxyr57TKtxgvBWIVSj3CcAJe6B@dpg-d3o80g3e5dus73agr8q0-a/iter_college_db`
4. Save (will trigger redeploy)

### Solution 2: Add Missing Environment Variables

Make sure ALL these are set:
- NODE_ENV
- PORT  
- DATABASE_URL
- JWT_SECRET
- JWT_REFRESH_SECRET

### Solution 3: Check Database Region Match

- Database: Ohio
- Web Service: Should be Ohio (same region for internal networking)

If they're in different regions, the internal URL won't work.

---

## 📊 Expected Deployment Timeline

1. **Build**: 2-3 minutes (Docker image)
2. **Deploy**: 1-2 minutes (container startup)
3. **DB Connect**: 5-10 seconds (connection pool setup)
4. **Ready**: Service should be live

**Free tier note:** First request may take 30-60 seconds if service was idle.

---

## ✅ Verification Checklist

- [ ] DATABASE_URL uses internal hostname (no `.render.com`)
- [ ] DATABASE_URL starts with `postgresql://` (not `postgres://`)
- [ ] PORT=10000 is set in environment variables
- [ ] Database and web service are in same region (Ohio)
- [ ] Database status is "Available" (not suspended)
- [ ] All 8 environment variables are present
- [ ] Latest code is pushed to GitHub
- [ ] Render logs show "Database connected successfully"
- [ ] /health endpoint returns 200 OK

---

## 🆘 Still Not Working?

### Check Render Service Logs for These Specific Lines:

1. **Database connection:**
   ```
   ✓ Database connected successfully (PostgreSQL)
   Connected to: dpg-d3o80g3e5dus73agr8q0-a
   ```

2. **Server startup:**
   ```
   Server running on port 10000
   Environment: production
   ```

3. **Health check:**
   ```
   Health check passed
   ```

### If you see "Database connection failed":

The logs will now show the full error. Look for:
- Error code (ECONNREFUSED, ENOTFOUND, etc.)
- Connection details
- Full error message

**Share those logs** and I can diagnose the exact issue!

---

## 💡 Pro Tips

1. **Internal URLs are faster**: 0.1ms vs 20-50ms latency
2. **Use same region**: Always deploy DB and web service in same region
3. **Free tier limitations**: 
   - Services sleep after 15 min inactivity
   - First request after sleep takes 30+ seconds
   - Database connections limited
4. **Upgrade to Starter ($7/mo)** for:
   - No sleep
   - Persistent disk for uploads
   - Better performance

---

Your database is already set up with schema and demo data. Once the connection is working, the app will be fully functional! 🎉
