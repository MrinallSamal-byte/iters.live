# 🔗 Get Your Neon Database Connection String

## Steps to Get Neon URL from Vercel Dashboard

### 1. Open Vercel Dashboard
Go to: https://vercel.com/dashboard

### 2. Select Your Project
Click on: **iter-college-management**

### 3. Go to Storage Tab
Click: **Storage** (in the top navigation)

### 4. Find Your Neon Database
You should see a database listed. Click on it.

### 5. Copy Connection String
- Click the **".env.local"** tab
- Find the variable: `POSTGRES_URL`
- Copy the ENTIRE value

It will look like this:
```
postgres://username:password@ep-xxxxx-xxxxx.us-east-2.aws.neon.tech/database?sslmode=require
```

### 6. Alternative: Use Vercel CLI

Run this command to see all environment variables:
```powershell
vercel env pull .env.production
```

Then check the `.env.production` file for `POSTGRES_URL`

---

## ✅ Once You Have It

**Option 1: Tell me the connection string**
I'll add it to your `.env` file and proceed with migration.

**Option 2: Add it yourself**
Add this line to your `.env` file:
```env
# Neon PostgreSQL (Vercel Native)
NEON_DATABASE_URL=postgres://username:password@ep-xxxxx.us-east-2.aws.neon.tech/database?sslmode=require
```

Then tell me "Ready!" and I'll start the migration.

---

## 🔍 Troubleshooting

**Don't see a database?**
- Check the "Integrations" tab
- Look for "Neon" or "Postgres"
- If missing, we can create one quickly

**Can't find .env.local tab?**
- Click on the database name
- Look for tabs: "Overview", "Quickstart", ".env.local"
- The connection string will be under ".env.local"

---

**Ready to proceed? Get the connection string and let me know!** 🚀
