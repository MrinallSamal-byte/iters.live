# 🚀 Microsoft Azure Deployment Guide
## ITER College Management System - Complete Deployment Instructions

---

## 📋 Table of Contents
1. [Prerequisites](#prerequisites)
2. [Azure Resources Needed](#azure-resources-needed)
3. [Deployment Methods](#deployment-methods)
4. [Method 1: Azure App Service (Recommended)](#method-1-azure-app-service-recommended)
5. [Method 2: Azure Container Instances](#method-2-azure-container-instances)
6. [Post-Deployment Steps](#post-deployment-steps)
7. [Cost Estimation](#cost-estimation)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 Prerequisites

### Required
- ✅ Active Azure Subscription ([Create Free Account](https://azure.microsoft.com/free/))
- ✅ Azure CLI installed ([Download](https://docs.microsoft.com/cli/azure/install-azure-cli))
- ✅ Git installed
- ✅ Node.js 18+ installed locally (for testing)

### Optional but Recommended
- ✅ Custom domain name
- ✅ Azure DevOps account for CI/CD
- ✅ VS Code with Azure extensions

---

## 🏗️ Azure Resources Needed

### Core Resources
1. **Resource Group** - Container for all resources
2. **Azure Database for MySQL** - Managed MySQL database
3. **Azure App Service** - Web application hosting
4. **Azure Storage Account** - File uploads storage
5. **Azure Key Vault** - Secrets management

### Optional Resources
- **Azure CDN** - Content delivery network
- **Azure Application Insights** - Monitoring
- **Azure Front Door** - Global load balancing
- **Azure Backup** - Database backups

---

## 🎨 Deployment Methods

### Method 1: Azure App Service ⭐ (Recommended)
**Best for:** Easy deployment, managed services, automatic scaling
**Cost:** ~$20-100/month depending on tier
**Difficulty:** ⭐⭐☆☆☆ Easy

### Method 2: Azure Container Instances
**Best for:** Docker expertise, custom configurations
**Cost:** ~$30-80/month
**Difficulty:** ⭐⭐⭐☆☆ Moderate

### Method 3: Azure Kubernetes Service
**Best for:** Large scale, microservices, complex deployments
**Cost:** ~$100+/month
**Difficulty:** ⭐⭐⭐⭐⭐ Advanced

---

## 📦 Method 1: Azure App Service (Recommended)

### Step 1: Install Azure CLI

**Windows (PowerShell):**
```powershell
# Download and install Azure CLI
Invoke-WebRequest -Uri https://aka.ms/installazurecliwindows -OutFile .\AzureCLI.msi
Start-Process msiexec.exe -Wait -ArgumentList '/I AzureCLI.msi /quiet'
rm .\AzureCLI.msi
```

**Or download from:** https://aka.ms/installazurecliwindows

### Step 2: Login to Azure

```powershell
# Login to Azure
az login

# Set your subscription (if you have multiple)
az account list --output table
az account set --subscription "YOUR_SUBSCRIPTION_ID"
```

### Step 3: Run Automated Deployment Script

**I've created a PowerShell script to automate everything!**

```powershell
# Navigate to your project directory
cd C:\All_In_One_College_Website

# Run the deployment script
.\deploy-to-azure.ps1
```

**The script will:**
1. ✅ Create Resource Group
2. ✅ Create Azure MySQL Database
3. ✅ Create Azure Storage Account
4. ✅ Create Azure App Service
5. ✅ Configure environment variables
6. ✅ Deploy your application
7. ✅ Initialize database
8. ✅ Configure SSL/HTTPS
9. ✅ Set up monitoring

### Step 4: Manual Deployment (Alternative)

If you prefer manual setup:

#### 4.1 Create Resource Group

```powershell
# Define variables
$RESOURCE_GROUP = "iter-college-rg"
$LOCATION = "eastus"  # Change to your preferred region
$APP_NAME = "iter-college-app"  # Must be globally unique
$DB_NAME = "iter-mysql-db"
$STORAGE_NAME = "itercollegestorage"  # Must be globally unique, lowercase, no hyphens

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION
```

#### 4.2 Create Azure MySQL Database

```powershell
# Create MySQL server
az mysql flexible-server create `
  --resource-group $RESOURCE_GROUP `
  --name $DB_NAME `
  --location $LOCATION `
  --admin-user adminuser `
  --admin-password "YourSecurePassword123!" `
  --sku-name Standard_B1ms `
  --tier Burstable `
  --version 8.0 `
  --storage-size 32 `
  --public-access 0.0.0.0-255.255.255.255

# Create database
az mysql flexible-server db create `
  --resource-group $RESOURCE_GROUP `
  --server-name $DB_NAME `
  --database-name iter_college_db

# Configure firewall to allow Azure services
az mysql flexible-server firewall-rule create `
  --resource-group $RESOURCE_GROUP `
  --name $DB_NAME `
  --rule-name AllowAzureServices `
  --start-ip-address 0.0.0.0 `
  --end-ip-address 0.0.0.0
```

#### 4.3 Create Azure Storage Account

```powershell
# Create storage account for file uploads
az storage account create `
  --name $STORAGE_NAME `
  --resource-group $RESOURCE_GROUP `
  --location $LOCATION `
  --sku Standard_LRS `
  --kind StorageV2

# Create blob container for uploads
az storage container create `
  --name uploads `
  --account-name $STORAGE_NAME `
  --public-access blob

# Get storage connection string
$STORAGE_CONNECTION_STRING = az storage account show-connection-string `
  --name $STORAGE_NAME `
  --resource-group $RESOURCE_GROUP `
  --query connectionString `
  --output tsv
```

#### 4.4 Create App Service

```powershell
# Create App Service Plan
az appservice plan create `
  --name "${APP_NAME}-plan" `
  --resource-group $RESOURCE_GROUP `
  --location $LOCATION `
  --sku B1 `
  --is-linux

# Create Web App
az webapp create `
  --name $APP_NAME `
  --resource-group $RESOURCE_GROUP `
  --plan "${APP_NAME}-plan" `
  --runtime "NODE:18-lts"

# Enable logging
az webapp log config `
  --name $APP_NAME `
  --resource-group $RESOURCE_GROUP `
  --application-logging filesystem `
  --level verbose
```

#### 4.5 Configure Environment Variables

```powershell
# Configure app settings (environment variables)
az webapp config appsettings set `
  --name $APP_NAME `
  --resource-group $RESOURCE_GROUP `
  --settings `
    NODE_ENV=production `
    PORT=8080 `
    DB_HOST="${DB_NAME}.mysql.database.azure.com" `
    DB_PORT=3306 `
    DB_USER=adminuser `
    DB_PASSWORD="YourSecurePassword123!" `
    DB_NAME=iter_college_db `
    JWT_SECRET="$(New-Guid)" `
    JWT_REFRESH_SECRET="$(New-Guid)" `
    JWT_EXPIRE=1h `
    JWT_REFRESH_EXPIRE=7d `
    STORAGE_MODE=azure `
    AZURE_STORAGE_CONNECTION_STRING="$STORAGE_CONNECTION_STRING" `
    AZURE_STORAGE_CONTAINER=uploads `
    CLIENT_URL="https://${APP_NAME}.azurewebsites.net" `
    CORS_WHITELIST="https://${APP_NAME}.azurewebsites.net" `
    SOCKET_CORS_ORIGIN="https://${APP_NAME}.azurewebsites.net"
```

#### 4.6 Deploy Application

```powershell
# Configure deployment from local git
az webapp deployment source config-local-git `
  --name $APP_NAME `
  --resource-group $RESOURCE_GROUP

# Get deployment credentials
$GIT_URL = az webapp deployment source config-local-git `
  --name $APP_NAME `
  --resource-group $RESOURCE_GROUP `
  --query url `
  --output tsv

# Add Azure as git remote
git remote add azure $GIT_URL

# Deploy to Azure
git add .
git commit -m "Deploy to Azure"
git push azure main
```

**Alternative: ZIP Deployment**

```powershell
# Create deployment package
npm run build:client  # If needed
Compress-Archive -Path * -DestinationPath deploy.zip -Force

# Deploy ZIP
az webapp deployment source config-zip `
  --name $APP_NAME `
  --resource-group $RESOURCE_GROUP `
  --src deploy.zip
```

#### 4.7 Initialize Database

```powershell
# Get MySQL connection details
$DB_HOST = "${DB_NAME}.mysql.database.azure.com"

# Connect and initialize (you'll need MySQL client)
# Option 1: Use Azure Cloud Shell
az mysql flexible-server execute `
  --name $DB_NAME `
  --admin-user adminuser `
  --admin-password "YourSecurePassword123!" `
  --database-name iter_college_db `
  --file-path ".\server\database\init.sql"

# Option 2: Use local MySQL client
mysql -h $DB_HOST -u adminuser -p iter_college_db < server/database/init.sql

# Run seed data (optional)
# SSH into the app service
az webapp ssh --name $APP_NAME --resource-group $RESOURCE_GROUP

# Inside the app service shell
cd /home/site/wwwroot
npm run seed:comprehensive
exit
```

#### 4.8 Configure Custom Domain (Optional)

```powershell
# Add custom domain
az webapp config hostname add `
  --webapp-name $APP_NAME `
  --resource-group $RESOURCE_GROUP `
  --hostname www.yourcollege.edu

# Enable HTTPS
az webapp config ssl bind `
  --name $APP_NAME `
  --resource-group $RESOURCE_GROUP `
  --certificate-thumbprint YOUR_CERT_THUMBPRINT `
  --ssl-type SNI
```

### Step 5: Verify Deployment

```powershell
# Get the app URL
$APP_URL = az webapp show `
  --name $APP_NAME `
  --resource-group $RESOURCE_GROUP `
  --query defaultHostName `
  --output tsv

Write-Host "Your application is deployed at: https://$APP_URL"

# Open in browser
Start-Process "https://$APP_URL"

# Check logs
az webapp log tail `
  --name $APP_NAME `
  --resource-group $RESOURCE_GROUP
```

---

## 🐳 Method 2: Azure Container Instances

### Prerequisites
- Docker installed locally
- Azure Container Registry (ACR)

### Step 1: Create Azure Container Registry

```powershell
$ACR_NAME = "itercollegeacr"  # Must be globally unique

# Create ACR
az acr create `
  --resource-group $RESOURCE_GROUP `
  --name $ACR_NAME `
  --sku Basic `
  --admin-enabled true

# Login to ACR
az acr login --name $ACR_NAME
```

### Step 2: Build and Push Docker Images

```powershell
# Get ACR login server
$ACR_LOGIN_SERVER = az acr show `
  --name $ACR_NAME `
  --query loginServer `
  --output tsv

# Build and tag images
docker build -t ${ACR_LOGIN_SERVER}/iter-app:latest .

# Push to ACR
docker push ${ACR_LOGIN_SERVER}/iter-app:latest
```

### Step 3: Deploy Container Instances

```powershell
# Get ACR credentials
$ACR_USERNAME = az acr credential show `
  --name $ACR_NAME `
  --query username `
  --output tsv

$ACR_PASSWORD = az acr credential show `
  --name $ACR_NAME `
  --query passwords[0].value `
  --output tsv

# Create container instance
az container create `
  --resource-group $RESOURCE_GROUP `
  --name iter-app-container `
  --image ${ACR_LOGIN_SERVER}/iter-app:latest `
  --registry-login-server $ACR_LOGIN_SERVER `
  --registry-username $ACR_USERNAME `
  --registry-password $ACR_PASSWORD `
  --dns-name-label $APP_NAME `
  --ports 5000 `
  --environment-variables `
    NODE_ENV=production `
    DB_HOST="${DB_NAME}.mysql.database.azure.com" `
    DB_USER=adminuser `
    DB_PASSWORD="YourSecurePassword123!" `
    DB_NAME=iter_college_db `
  --cpu 2 `
  --memory 4
```

---

## ✅ Post-Deployment Steps

### 1. Verify Application Health

```powershell
# Check health endpoint
$APP_URL = "https://${APP_NAME}.azurewebsites.net"
Invoke-RestMethod -Uri "${APP_URL}/health"
```

### 2. Test Login

- Navigate to: `https://YOUR_APP.azurewebsites.net`
- Login with admin credentials:
  - Email: `admin@iter.edu`
  - Password: `Admin@123456` (change this!)

### 3. Change Default Passwords

```powershell
# SSH into app service
az webapp ssh --name $APP_NAME --resource-group $RESOURCE_GROUP

# Update admin password through the web interface
```

### 4. Set Up Monitoring

```powershell
# Create Application Insights
az monitor app-insights component create `
  --app iter-app-insights `
  --location $LOCATION `
  --resource-group $RESOURCE_GROUP `
  --application-type web

# Get instrumentation key
$INSTRUMENTATION_KEY = az monitor app-insights component show `
  --app iter-app-insights `
  --resource-group $RESOURCE_GROUP `
  --query instrumentationKey `
  --output tsv

# Add to app settings
az webapp config appsettings set `
  --name $APP_NAME `
  --resource-group $RESOURCE_GROUP `
  --settings APPINSIGHTS_INSTRUMENTATIONKEY=$INSTRUMENTATION_KEY
```

### 5. Configure Backup

```powershell
# Enable automatic MySQL backups (7 days retention)
az mysql flexible-server parameter set `
  --resource-group $RESOURCE_GROUP `
  --server-name $DB_NAME `
  --name backup_retention_days `
  --value 7

# Schedule app service backup
az webapp config backup create `
  --resource-group $RESOURCE_GROUP `
  --webapp-name $APP_NAME `
  --backup-name initial-backup `
  --container-url "STORAGE_URL_WITH_SAS"
```

### 6. Enable CDN (Optional)

```powershell
# Create CDN profile
az cdn profile create `
  --resource-group $RESOURCE_GROUP `
  --name iter-cdn-profile `
  --sku Standard_Microsoft

# Create CDN endpoint
az cdn endpoint create `
  --resource-group $RESOURCE_GROUP `
  --profile-name iter-cdn-profile `
  --name iter-cdn-endpoint `
  --origin ${APP_NAME}.azurewebsites.net
```

---

## 💰 Cost Estimation

### Development/Testing Environment
| Service | Tier | Monthly Cost |
|---------|------|--------------|
| App Service | F1 Free | $0 |
| MySQL Database | Basic B1ms | $15 |
| Storage Account | Standard LRS (10GB) | $0.50 |
| **TOTAL** | | **~$15-20/month** |

### Production Environment (Small)
| Service | Tier | Monthly Cost |
|---------|------|--------------|
| App Service | B1 Basic | $13 |
| MySQL Database | General Purpose D2s | $85 |
| Storage Account | Standard LRS (50GB) | $2.50 |
| Application Insights | Basic | $0-5 |
| **TOTAL** | | **~$100-110/month** |

### Production Environment (Medium)
| Service | Tier | Monthly Cost |
|---------|------|--------------|
| App Service | S1 Standard | $70 |
| MySQL Database | General Purpose D4s | $170 |
| Storage Account | Standard LRS (100GB) | $5 |
| Application Insights | Basic | $5-10 |
| CDN | Standard Microsoft | $10-20 |
| **TOTAL** | | **~$260-275/month** |

**Note:** Costs can vary by region and usage patterns.

---

## 🔧 Troubleshooting

### Issue: Application Won't Start

**Solution:**
```powershell
# Check application logs
az webapp log tail --name $APP_NAME --resource-group $RESOURCE_GROUP

# Check deployment logs
az webapp log deployment show --name $APP_NAME --resource-group $RESOURCE_GROUP
```

### Issue: Database Connection Failed

**Check:**
1. Firewall rules allow Azure services
2. Connection string is correct
3. Database credentials are valid

```powershell
# Update firewall rule
az mysql flexible-server firewall-rule update `
  --resource-group $RESOURCE_GROUP `
  --name $DB_NAME `
  --rule-name AllowAzureServices `
  --start-ip-address 0.0.0.0 `
  --end-ip-address 255.255.255.255
```

### Issue: File Uploads Not Working

**Solution:**
```powershell
# Verify storage account connection
az storage account show `
  --name $STORAGE_NAME `
  --resource-group $RESOURCE_GROUP

# Set correct CORS policy
az storage cors add `
  --services b `
  --methods GET POST PUT `
  --origins "*" `
  --allowed-headers "*" `
  --account-name $STORAGE_NAME
```

### Issue: High Memory Usage

**Solution:**
```powershell
# Scale up the app service
az appservice plan update `
  --name "${APP_NAME}-plan" `
  --resource-group $RESOURCE_GROUP `
  --sku S1
```

### Issue: SSL Certificate Errors

**Solution:**
```powershell
# Create free managed certificate
az webapp config ssl create `
  --name $APP_NAME `
  --resource-group $RESOURCE_GROUP `
  --hostname www.yourcollege.edu

# Bind certificate
az webapp config ssl bind `
  --name $APP_NAME `
  --resource-group $RESOURCE_GROUP `
  --certificate-thumbprint YOUR_THUMBPRINT `
  --ssl-type SNI
```

---

## 📞 Support & Resources

### Azure Documentation
- [App Service Documentation](https://docs.microsoft.com/azure/app-service/)
- [Azure Database for MySQL](https://docs.microsoft.com/azure/mysql/)
- [Azure Storage Documentation](https://docs.microsoft.com/azure/storage/)

### Cost Management
- [Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/)
- [Cost Management + Billing](https://portal.azure.com/#blade/Microsoft_Azure_CostManagement/Menu/overview)

### Monitoring
- View logs: Azure Portal → Your App Service → Monitoring → Log stream
- Metrics: Azure Portal → Your App Service → Monitoring → Metrics
- Alerts: Azure Portal → Your App Service → Monitoring → Alerts

---

## 🎉 Success Checklist

After deployment, verify:
- [ ] Application loads at Azure URL
- [ ] Can login with admin credentials
- [ ] Database connection working
- [ ] File uploads working
- [ ] All pages load correctly
- [ ] SSL/HTTPS enabled
- [ ] Monitoring configured
- [ ] Backups enabled
- [ ] Custom domain configured (if applicable)
- [ ] Changed default passwords
- [ ] Configured email settings
- [ ] Tested student/teacher/admin workflows

---

## 📧 Need Help?

If you encounter issues:
1. Check the troubleshooting section above
2. Review Azure logs: `az webapp log tail`
3. Check Azure Portal for resource health
4. Review Application Insights for errors

---

**Created:** October 2025
**Last Updated:** October 2025
**Version:** 1.0
