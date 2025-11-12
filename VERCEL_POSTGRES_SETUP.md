# 🚀 Vercel Postgres Setup Guide

## Why Vercel Postgres?

Vercel Postgres (powered by Neon) is **natively integrated** with Vercel and solves the DNS resolution issues we encountered with both Railway and Supabase external databases.

**Advantages:**
- ✅ No DNS resolution issues in serverless
- ✅ Automatic connection pooling optimized for serverless
- ✅ Built-in Vercel integration
- ✅ Free tier: 256 MB storage, 60 hours compute/month
- ✅ Same PostgreSQL compatibility as Supabase

## Quick Setup (3 Steps)

### Step 1: Create Vercel Postgres Database

```powershell
# Install Vercel Postgres
npm install @vercel/postgres

# Navigate to your project
cd C:\All_In_One_College_Website

# Create a Postgres database via Vercel dashboard:
# 1. Visit: https://vercel.com/dashboard
# 2. Select your project: iter-college-management
# 3. Go to "Storage" tab
# 4. Click "Create Database" → Choose "Postgres"
# 5. Name it: iter-college-db
# 6. Select region: US East (closest to your users)
# 7. Click "Create"
```

**OR use Vercel CLI:**

```powershell
vercel link
vercel postgres create iter-college-db
```

### Step 2: Get Connection Details

After creating the database, Vercel will automatically add these environment variables to your project:

```
POSTGRES_URL
POSTGRES_PRISMA_URL
POSTGRES_URL_NON_POOLING
POSTGRES_USER
POSTGRES_HOST
POSTGRES_PASSWORD
POSTGRES_DATABASE
```

### Step 3: Import Your Data

We'll migrate the existing Supabase data to Vercel Postgres.

## Detailed Migration Steps

### 1️⃣ Install Dependencies

```powershell
npm install @vercel/postgres
```

### 2️⃣ Get Vercel Postgres Connection String

After creating the database in Vercel dashboard:

1. Go to your project → Storage → Your Postgres database
2. Click ".env.local" tab
3. Copy the connection strings
4. You'll see something like:

```env
POSTGRES_URL="postgresql://default:abc123@ep-cool-name-123456.us-east-1.postgres.vercel-storage.com:5432/verceldb"
POSTGRES_PRISMA_URL="postgresql://default:abc123@ep-cool-name-123456-pooler.us-east-1.postgres.vercel-storage.com:5432/verceldb?pgbouncer=true&connect_timeout=15"
POSTGRES_URL_NON_POOLING="postgresql://default:abc123@ep-cool-name-123456.us-east-1.postgres.vercel-storage.com:5432/verceldb"
POSTGRES_USER="default"
POSTGRES_HOST="ep-cool-name-123456.us-east-1.postgres.vercel-storage.com"
POSTGRES_PASSWORD="abc123"
POSTGRES_DATABASE="verceldb"
```

### 3️⃣ Update Local .env

Add to your `.env` file:

```env
# Vercel Postgres (add these)
POSTGRES_URL=<paste from Vercel>
POSTGRES_PRISMA_URL=<paste from Vercel>
POSTGRES_URL_NON_POOLING=<paste from Vercel>
POSTGRES_USER=<paste from Vercel>
POSTGRES_HOST=<paste from Vercel>
POSTGRES_PASSWORD=<paste from Vercel>
POSTGRES_DATABASE=<paste from Vercel>
```

### 4️⃣ Migrate Schema to Vercel Postgres

Use the migration script (we'll create it):

```powershell
# This script will:
# 1. Connect to Vercel Postgres
# 2. Create all tables from supabase-schema.sql
# 3. Migrate all 15,452 records from Supabase
node migrate-supabase-to-vercel-postgres.js
```

### 5️⃣ Update Backend Code

The backend will automatically use Vercel Postgres when deployed to Vercel.

### 6️⃣ Deploy

```powershell
vercel --prod
```

## Environment Variables

Vercel automatically manages these when you create a Postgres database:

| Variable | Description | Auto-Set |
|----------|-------------|----------|
| `POSTGRES_URL` | Full connection string with pooling | ✅ |
| `POSTGRES_PRISMA_URL` | Connection string optimized for Prisma | ✅ |
| `POSTGRES_URL_NON_POOLING` | Direct connection (non-pooled) | ✅ |
| `POSTGRES_USER` | Database username | ✅ |
| `POSTGRES_HOST` | Database hostname | ✅ |
| `POSTGRES_PASSWORD` | Database password | ✅ |
| `POSTGRES_DATABASE` | Database name | ✅ |

## Updated Database Connection

The `db.js` file will be updated to use Vercel Postgres:

```javascript
const { sql } = require('@vercel/postgres');

// Vercel Postgres automatically handles connection pooling
// Just use the sql template literal:
const users = await sql`SELECT * FROM users WHERE id = ${userId}`;
```

## Cost Comparison

| Provider | Free Tier | Monthly Cost |
|----------|-----------|--------------|
| **Vercel Postgres** | 256 MB, 60 compute hours | $0 (Free tier) |
| Supabase | 500 MB, Unlimited hours | $0 (Free tier) |
| Railway | 500 MB, $5 credit | ~$5-10/month |

## Advantages of Vercel Postgres

✅ **Native Integration**: No DNS issues  
✅ **Automatic Connection Pooling**: Optimized for serverless  
✅ **Built-in Monitoring**: See queries in Vercel dashboard  
✅ **Automatic Backups**: Point-in-time recovery  
✅ **Same Project**: Database and app in one place  
✅ **Zero Configuration**: Environment variables auto-set  

## Migration Safety

Your data is safe:
- ✅ Original data remains in Supabase (backup)
- ✅ Migration script verifies all records
- ✅ Can rollback if needed

## Next Steps

Run this command to start the setup:

```powershell
.\setup-vercel-postgres.ps1
```

This will guide you through:
1. Creating the Vercel Postgres database
2. Migrating your 15,452 records
3. Updating environment variables
4. Deploying to production

---

**Need Help?**
- Vercel Postgres Docs: https://vercel.com/docs/storage/vercel-postgres
- Neon (underlying provider): https://neon.tech/docs
