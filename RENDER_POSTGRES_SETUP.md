# 🎯 Setup Render PostgreSQL with Vercel

## ⚠️ Important Note

You're using **Render PostgreSQL** instead of Vercel Postgres/Neon. This may still have DNS resolution issues in Vercel's serverless environment, but let's try it!

---

## Step 1: Add Environment Variables to Vercel

### Via Vercel Dashboard (Recommended):

1. Go to: https://vercel.com/dashboard
2. Select project: **iter-college-management**
3. Click **Settings** → **Environment Variables**
4. Add these variables (click "Add New" for each):

```env
DATABASE_URL
Value: postgresql://iter_college_db_user:93UqDvuxyr57TKtxgvBWIVSj3CcAJe6B@dpg-d3o80g3e5dus73agr8q0-a.ohio-postgres.render.com/iter_college_db
Environments: ✅ Production ✅ Preview

POSTGRES_URL
Value: postgresql://iter_college_db_user:93UqDvuxyr57TKtxgvBWIVSj3CcAJe6B@dpg-d3o80g3e5dus73agr8q0-a.ohio-postgres.render.com/iter_college_db
Environments: ✅ Production ✅ Preview

POSTGRES_URL_NON_POOLING
Value: postgresql://iter_college_db_user:93UqDvuxyr57TKtxgvBWIVSj3CcAJe6B@dpg-d3o80g3e5dus73agr8q0-a.ohio-postgres.render.com/iter_college_db
Environments: ✅ Production ✅ Preview

DB_HOST
Value: dpg-d3o80g3e5dus73agr8q0-a.ohio-postgres.render.com
Environments: ✅ Production ✅ Preview

DB_PORT
Value: 5432
Environments: ✅ Production ✅ Preview

DB_USER
Value: iter_college_db_user
Environments: ✅ Production ✅ Preview

DB_PASSWORD
Value: 93UqDvuxyr57TKtxgvBWIVSj3CcAJe6B
Environments: ✅ Production ✅ Preview

DB_NAME
Value: iter_college_db
Environments: ✅ Production ✅ Preview

POSTGRES_HOST
Value: dpg-d3o80g3e5dus73agr8q0-a.ohio-postgres.render.com
Environments: ✅ Production ✅ Preview

POSTGRES_USER
Value: iter_college_db_user
Environments: ✅ Production ✅ Preview

POSTGRES_PASSWORD
Value: 93UqDvuxyr57TKtxgvBWIVSj3CcAJe6B
Environments: ✅ Production ✅ Preview

POSTGRES_DATABASE
Value: iter_college_db
Environments: ✅ Production ✅ Preview
```

---

## Step 2: Create Schema in Render Database

We need to create the database schema (18 tables) in your Render database.

### Update the schema creation script for Render:

Run this command:
```powershell
node create-render-schema.js
```

I'll create this script for you.

---

## Step 3: Migrate Data from Supabase to Render

Run:
```powershell
node migrate-supabase-to-render.js
```

This will migrate all 15,452 records from Supabase to Render PostgreSQL.

---

## Step 4: Update Backend

The hybrid db.js should automatically detect the POSTGRES_URL and use it.

---

## Step 5: Deploy to Vercel

```powershell
vercel --prod
```

---

## Step 6: Test

Visit: https://iter-college-management.vercel.app

Try logging in:
- Admin: ADM2025001 / Admin@123456
- Teacher: TCH2025001 / Teacher@123
- Student: STU2025001 / Student@123

---

## ⚠️ If DNS Issues Occur

If you see `ENOTFOUND dpg-d3o80g3e5dus73agr8q0-a.ohio-postgres.render.com` error:

### Solution: Deploy Backend to Render

1. Keep database on Render
2. Deploy Node.js backend to Render
3. Keep frontend on Vercel
4. Vercel calls Render API (no direct database connection)

This architecture works because:
- Render → Render database: ✅ Same network, no DNS issues
- Vercel frontend → Render API: ✅ HTTP calls, no DNS issues

---

## Next Steps

Let me know when you've added the environment variables to Vercel, and I'll create the migration scripts!
