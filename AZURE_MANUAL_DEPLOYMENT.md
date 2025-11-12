# Manual Step-by-Step Azure Deployment
# Use this if you prefer clicking through Azure Portal instead of using CLI

## Overview
This guide walks you through deploying the ITER College Management System using the Azure Portal web interface.

---

## Part 1: Create Azure Resources via Portal

### Step 1: Login to Azure Portal
1. Go to https://portal.azure.com
2. Sign in with your Microsoft account
3. Verify your subscription is active (top-right dropdown)

### Step 2: Create Resource Group
1. Click **"+ Create a resource"**
2. Search for **"Resource group"**
3. Click **"Create"**
4. Fill in:
   - **Subscription:** Your subscription
   - **Resource group:** `iter-college-rg`
   - **Region:** Choose nearest (e.g., `East US`, `West Europe`)
5. Click **"Review + Create"** → **"Create"**

### Step 3: Create MySQL Database
1. In the resource group, click **"+ Create"**
2. Search for **"Azure Database for MySQL Flexible Server"**
3. Click **"Create"**
4. Fill in **Basics** tab:
   - **Subscription:** Your subscription
   - **Resource group:** `iter-college-rg`
   - **Server name:** `iter-mysql-db` (must be globally unique)
   - **Region:** Same as resource group
   - **MySQL version:** `8.0`
   - **Workload type:** `For development or hobby projects`
   - **Compute + Storage:** Click **"Configure server"**
     - Select: **Burstable, B1ms (1 vCore, 2 GiB RAM)**
     - Storage: **32 GiB**
   - **Admin username:** `adminuser`
   - **Password:** Create a strong password (save it!)
5. Click **"Next: Networking"**
6. **Networking** tab:
   - **Connectivity method:** Public access
   - **Firewall rules:**
     - Check ☑ **"Allow public access from any Azure service"**
     - Add rule: Name=`AllowAll`, Start IP=`0.0.0.0`, End IP=`255.255.255.255`
       (⚠️ Restrict this later for security!)
7. Click **"Review + Create"** → **"Create"**
8. Wait 5-10 minutes for deployment

#### Create Database Schema
1. After deployment, go to your MySQL server
2. Click **"Databases"** in left menu
3. Click **"+ Add"**
4. Database name: `iter_college_db`
5. Click **"Save"**

### Step 4: Create Storage Account
1. In resource group, click **"+ Create"**
2. Search for **"Storage account"**
3. Click **"Create"**
4. Fill in **Basics** tab:
   - **Subscription:** Your subscription
   - **Resource group:** `iter-college-rg`
   - **Storage account name:** `iterstore123456` (must be unique, lowercase, no spaces)
   - **Region:** Same as others
   - **Performance:** Standard
   - **Redundancy:** Locally-redundant storage (LRS)
5. Click **"Review + Create"** → **"Create"**

#### Create Blob Container
1. Go to your storage account
2. Click **"Containers"** in left menu
3. Click **"+ Container"**
4. Name: `uploads`
5. Public access level: **"Blob"**
6. Click **"Create"**

#### Get Connection String
1. In storage account, click **"Access keys"** in left menu
2. Click **"Show"** next to **Connection string** under **key1**
3. Click **copy icon** to copy connection string
4. **SAVE THIS** - you'll need it later

### Step 5: Create App Service
1. In resource group, click **"+ Create"**
2. Search for **"Web App"**
3. Click **"Create"**
4. Fill in **Basics** tab:
   - **Subscription:** Your subscription
   - **Resource group:** `iter-college-rg`
   - **Name:** `iter-college-app-123` (must be globally unique)
   - **Publish:** Code
   - **Runtime stack:** Node 18 LTS
   - **Operating System:** Linux
   - **Region:** Same as others
   - **Pricing Plan:** Click **"Create new"**
     - Name: `iter-app-plan`
     - Pricing tier: Click **"Explore pricing plans"**
       - For testing: **F1 (Free)**
       - For production: **B1 (Basic)** or **S1 (Standard)**
     - Click **"Select"**
5. Click **"Review + Create"** → **"Create"**

---

## Part 2: Configure App Service

### Step 6: Configure Environment Variables
1. Go to your App Service (`iter-college-app-123`)
2. Click **"Configuration"** in left menu under Settings
3. Click **"+ New application setting"** for each variable below:

**Add these settings one by one:**

| Name | Value |
|------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `8080` |
| `DB_HOST` | `iter-mysql-db.mysql.database.azure.com` *(replace with your server name)* |
| `DB_PORT` | `3306` |
| `DB_USER` | `adminuser` |
| `DB_PASSWORD` | `YOUR_MYSQL_PASSWORD` |
| `DB_NAME` | `iter_college_db` |
| `JWT_SECRET` | Generate: https://www.uuidgenerator.net/ (generate 2 and combine) |
| `JWT_REFRESH_SECRET` | Generate another UUID combination |
| `JWT_EXPIRE` | `1h` |
| `JWT_REFRESH_EXPIRE` | `7d` |
| `STORAGE_MODE` | `azure` |
| `AZURE_STORAGE_CONNECTION_STRING` | Paste the connection string from Step 4 |
| `AZURE_STORAGE_CONTAINER` | `uploads` |
| `CLIENT_URL` | `https://iter-college-app-123.azurewebsites.net` *(your app URL)* |
| `CORS_WHITELIST` | `https://iter-college-app-123.azurewebsites.net` |
| `SOCKET_CORS_ORIGIN` | `https://iter-college-app-123.azurewebsites.net` |
| `ADMIN_EMAIL` | `admin@iter.edu` |
| `ADMIN_PASSWORD` | `Admin@123456` |

4. Click **"Save"** at the top
5. Click **"Continue"** when prompted (app will restart)

### Step 7: Configure Deployment
1. Still in App Service, click **"Deployment Center"** in left menu
2. **Source:** Local Git
3. Click **"Save"**
4. Copy the **Git Clone Uri** (you'll need this)

### Step 8: Enable Logging
1. In App Service, click **"App Service logs"** in left menu
2. **Application logging:** `File System`
3. **Level:** `Verbose`
4. **Web server logging:** `File System`
5. **Retention Period:** `7` days
6. Click **"Save"**

---

## Part 3: Deploy Your Code

### Method A: Deploy via Visual Studio Code (Easiest)

#### Install Azure Extension
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for **"Azure App Service"**
4. Install the extension
5. Click Azure icon in left sidebar
6. Sign in to Azure

#### Deploy
1. Right-click on your App Service in Azure extension
2. Click **"Deploy to Web App"**
3. Select your project folder
4. Wait for deployment to complete

### Method B: Deploy via Git

#### Set Up Git Deployment
1. Open PowerShell in your project directory
2. Get deployment credentials:
   - In Azure Portal, go to App Service
   - Click **"Deployment Center"**
   - Click **"FTPS credentials"** tab
   - Copy **Username** and **Password**

3. Add Azure as git remote:
```powershell
# Replace with your Git Clone Uri from Step 7
git remote add azure https://YOUR_APP_NAME.scm.azurewebsites.net/YOUR_APP_NAME.git
```

4. Deploy:
```powershell
# Commit any changes
git add .
git commit -m "Deploy to Azure"

# Push to Azure (enter password when prompted)
git push azure main
```

### Method C: Deploy via ZIP

#### Create Deployment Package
1. Open PowerShell in project directory
2. Run:
```powershell
# Exclude unnecessary folders
$exclude = @('node_modules', '.git', 'coverage', 'logs', 'uploads', 'backups')
Get-ChildItem -Recurse | Where-Object { 
    $file = $_
    -not ($exclude | Where-Object { $file.FullName -like "*\$_\*" })
} | Compress-Archive -DestinationPath deploy.zip -Force
```

#### Upload via Azure Portal
1. Go to App Service in portal
2. Click **"Advanced Tools"** in left menu
3. Click **"Go"** (opens Kudu)
4. Click **"Tools"** → **"Zip Push Deploy"**
5. Drag and drop `deploy.zip` to the `/site/wwwroot/` area
6. Wait for upload and extraction

---

## Part 4: Initialize Database

### Option A: Using Azure Cloud Shell
1. In Azure Portal, click **Cloud Shell** icon (top right, looks like >_)
2. Select **PowerShell**
3. Run:
```powershell
# Connect to MySQL
mysql -h iter-mysql-db.mysql.database.azure.com -u adminuser -p

# Enter your password when prompted
# Then run:
USE iter_college_db;

# Copy and paste contents of server/database/init.sql
# Or upload the file and run:
source init.sql;
```

### Option B: Using SSH Console
1. In App Service, click **"SSH"** in left menu
2. Click **"Go"**
3. In the SSH console:
```bash
cd /home/site/wwwroot
npm install
npm run seed:comprehensive
```

### Option C: Using Local MySQL Client
1. Download MySQL Workbench or command-line client
2. Connect with:
   - **Host:** `iter-mysql-db.mysql.database.azure.com`
   - **Port:** `3306`
   - **Username:** `adminuser`
   - **Password:** Your password
   - **Database:** `iter_college_db`
3. Run the SQL files:
   - `server/database/init.sql`
   - `server/seed/seed.js` (via npm)

---

## Part 5: Verify Deployment

### Check Application Status
1. Go to App Service in portal
2. Click **"Overview"**
3. Check **Status** is **Running**
4. Click the **URL** (e.g., `https://iter-college-app-123.azurewebsites.net`)

### Test Login
1. Navigate to your app URL
2. Login with:
   - Email: `admin@iter.edu`
   - Password: `Admin@123456`
3. **Change this password immediately!**

### View Logs
1. In App Service, click **"Log stream"** in left menu
2. Watch for any errors
3. Verify application started successfully

---

## Part 6: Configure Custom Domain (Optional)

### Prerequisites
- You own a domain (e.g., `www.yourcollege.edu`)
- Access to domain DNS settings

### Steps
1. In App Service, click **"Custom domains"** in left menu
2. Click **"+ Add custom domain"**
3. Enter your domain: `www.yourcollege.edu`
4. Click **"Validate"**
5. Azure will show DNS records to add:
   - **CNAME record:** `www` → `iter-college-app-123.azurewebsites.net`
   - **TXT record:** `asuid.www` → `verification-code`
6. Add these records in your domain registrar's DNS settings
7. Wait for DNS propagation (5-30 minutes)
8. Click **"Add"** in Azure Portal

### Enable HTTPS
1. After domain is added, click **"TLS/SSL settings"** in left menu
2. Click **"Bindings"** tab
3. Click **"+ Add TLS/SSL binding"**
4. Select your domain
5. **TLS/SSL Type:** SNI SSL
6. Certificate: Create free managed certificate
7. Click **"Add binding"**

---

## Part 7: Set Up Monitoring

### Enable Application Insights
1. In resource group, click **"+ Create"**
2. Search for **"Application Insights"**
3. Fill in:
   - **Name:** `iter-app-insights`
   - **Resource group:** `iter-college-rg`
   - **Region:** Same as others
4. Click **"Review + Create"** → **"Create"**

### Connect to App Service
1. Go to App Service
2. Click **"Application Insights"** in left menu
3. Click **"Turn on Application Insights"**
4. Select your Application Insights resource
5. Click **"Apply"**

### Set Up Alerts
1. Go to Application Insights
2. Click **"Alerts"** in left menu
3. Click **"+ Create alert rule"**
4. Set up alerts for:
   - High response times
   - Failed requests
   - Exceptions
   - Server errors

---

## Part 8: Configure Backups

### Database Backup
1. Go to MySQL server in portal
2. Click **"Backup and restore"** in left menu
3. Backups are automatic (7-day retention by default)
4. To increase retention:
   - Click **"Server parameters"**
   - Find `backup_retention_days`
   - Set to desired value (7-35 days)
   - Click **"Save"**

### App Service Backup
1. Go to App Service
2. Click **"Backups"** in left menu
3. Click **"Configure"**
4. Choose storage account
5. Set schedule (e.g., daily)
6. Click **"Save"**

---

## Troubleshooting Common Issues

### Application Won't Start
1. Go to **App Service** → **Log stream**
2. Look for errors in startup
3. Common fixes:
   - Check Node.js version (should be 18)
   - Verify package.json has correct start script
   - Check environment variables

### Database Connection Failed
1. Verify MySQL firewall rules allow connections
2. Test connection string:
   - Go to **MySQL server** → **Connection security**
   - Temporarily allow your IP
   - Test with MySQL client

### 502 Bad Gateway Error
1. Application is starting or crashed
2. Check logs for errors
3. Restart app: **Overview** → **Restart**

### File Uploads Not Working
1. Verify storage connection string is correct
2. Check blob container exists and is public
3. Verify CORS settings on storage account:
   - **Storage account** → **CORS**
   - Add rule: GET, POST, PUT from any origin

---

## Security Best Practices

### Immediate Actions
- [ ] Change default admin password
- [ ] Restrict database firewall to App Service only
- [ ] Enable HTTPS only (disable HTTP)
- [ ] Review and minimize CORS whitelist
- [ ] Move secrets to Azure Key Vault

### Ongoing
- [ ] Regularly update Node.js packages
- [ ] Monitor security alerts
- [ ] Review access logs
- [ ] Rotate JWT secrets every 90 days
- [ ] Enable Azure AD authentication

---

## Cost Optimization Tips

1. **Start with lower tiers** - Upgrade as needed
2. **Use auto-scaling** - Pay for what you use
3. **Set spending limits** - Avoid surprises
4. **Monitor costs** - Azure Cost Management
5. **Clean up unused resources** - Delete test environments

---

## Next Steps

✅ **Application deployed!**

Now:
1. Test all features thoroughly
2. Change default passwords
3. Set up monitoring alerts
4. Configure email settings
5. Add custom domain (if needed)
6. Train users
7. Go live!

---

## Support Resources

- **Azure Documentation:** https://docs.microsoft.com/azure/
- **Azure Portal:** https://portal.azure.com
- **Cost Calculator:** https://azure.microsoft.com/pricing/calculator/
- **Support:** https://azure.microsoft.com/support/

---

**Congratulations! Your college management system is now running on Microsoft Azure! 🎉**
