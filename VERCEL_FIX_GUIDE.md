# 🔧 QUICK FIX: Vercel Database Connection Error

## ⚠️ Problem
- Vercel returns **503 Database connection error**
- Login/Registration endpoints failing

## ✅ Solution: Configure Environment Variables

### Option 1: Automated Script (Recommended)

Run this PowerShell script:
```powershell
.\setup-vercel-auto.ps1
```

This will display all variables you need to copy-paste into Vercel Dashboard.

---

### Option 2: Manual Configuration

#### Step 1: Open Vercel Dashboard
1. Go to: **https://vercel.com/dashboard**
2. Select: **iter-college-management** project
3. Navigate to: **Settings** → **Environment Variables**

#### Step 2: Add Variables (Click "Add" for each)

**DATABASE (5 variables):**
```
DB_HOST = mysql.railway.internal
DB_PORT = 3306
DB_USER = root
DB_PASSWORD = NlEpRBhwEHsSHrDWEEfahDOMcEzfIdLh
DB_NAME = railway
```

**SECURITY (4 variables):**
```
JWT_SECRET = prod-jwt-secret-change-this-in-production-8f4b2c9d1e7a3f6b
JWT_REFRESH_SECRET = prod-refresh-secret-change-this-in-production-3e7c1f9b4d2a
JWT_EXPIRE = 1h
JWT_REFRESH_EXPIRE = 7d
```

**APPLICATION (7 variables):**
```
NODE_ENV = production
PORT = 5000
CLIENT_URL = https://iter-college-management.vercel.app
CORS_WHITELIST = https://iter-college-management.vercel.app
RATE_LIMIT_WINDOW_MS = 900000
RATE_LIMIT_MAX_REQUESTS = 100
```

#### Step 3: Redeploy
After adding ALL 16 variables:
```powershell
vercel --prod
```

#### Step 4: Test
Wait 30 seconds, then run:
```powershell
node test-vercel-deployment.js
```

---

## 📋 Checklist

- [ ] Added all 16 environment variables in Vercel Dashboard
- [ ] Saved each variable (click Save after each one)
- [ ] Redeployed with `vercel --prod`
- [ ] Waited 30 seconds for deployment to complete
- [ ] Tested with `node test-vercel-deployment.js`
- [ ] All tests passing (login works, no 503 errors)

---

## 🎯 Expected Result

After configuration, the test should show:
```
✓ Website is accessible (Status: 200)
✓ API is healthy
✓ admin login successful
✓ teacher login successful
✓ student login successful
```

---

## 🔍 Troubleshooting

**Still getting 503 errors?**
- Check all 16 variables are saved in Vercel
- Ensure `DB_HOST = mysql.railway.internal` (NOT shortline.proxy.rlwy.net)
- Wait 1-2 minutes after redeployment
- Check Vercel deployment logs for errors

**Registration endpoint 404?**
- This is expected - registration uses `/api/auth/register-student` endpoint
- Login works with registration numbers (e.g., ADM2025001)

---

## 📞 Quick Help

Run the automated script to see all variables formatted:
```powershell
.\setup-vercel-auto.ps1
```

Test current deployment status:
```powershell
node test-vercel-deployment.js
```

Check Railway database:
```powershell
node check-railway-db.js
```
