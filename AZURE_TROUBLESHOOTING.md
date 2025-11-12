# Azure Deployment - Common Issues & Solutions

## Quick Troubleshooting Guide

---

## 🔧 Installation Issues

### Issue: Azure CLI Not Found
**Error:** `'az' is not recognized as an internal or external command`

**Solution:**
```powershell
# 1. Install Azure CLI
Invoke-WebRequest -Uri https://aka.ms/installazurecliwindows -OutFile .\AzureCLI.msi
Start-Process msiexec.exe -Wait -ArgumentList '/I AzureCLI.msi /quiet'

# 2. Restart PowerShell
exit
# Open new PowerShell window

# 3. Verify installation
az --version
```

### Issue: Not Logged into Azure
**Error:** `Please run 'az login' to setup account.`

**Solution:**
```powershell
az login
# Browser will open - login with Microsoft account
# If browser doesn't open, copy device code and go to: https://microsoft.com/devicelogin
```

### Issue: Multiple Subscriptions
**Error:** `More than one subscription found`

**Solution:**
```powershell
# List subscriptions
az account list --output table

# Set default subscription
az account set --subscription "YOUR_SUBSCRIPTION_NAME"
```

---

## 🗄️ Database Issues

### Issue: Database Connection Failed
**Error:** `ER_ACCESS_DENIED_ERROR` or `Can't connect to MySQL server`

**Solutions:**

**1. Check Firewall Rules**
```powershell
# Add firewall rule allowing all Azure services
az mysql flexible-server firewall-rule create `
    --resource-group YOUR_RG `
    --name YOUR_DB `
    --rule-name AllowAzure `
    --start-ip-address 0.0.0.0 `
    --end-ip-address 0.0.0.0
```

**2. Verify Credentials**
```powershell
# Test connection using MySQL client
mysql -h YOUR_DB.mysql.database.azure.com -u adminuser -p
```

**3. Check Connection String**
- Verify `DB_HOST` ends with `.mysql.database.azure.com`
- Verify `DB_USER` doesn't include `@servername`
- Verify `DB_PASSWORD` is correct (check azure-deployment-info.json)

### Issue: Database Tables Not Created
**Error:** Tables don't exist when app starts

**Solutions:**

**1. Initialize Database Manually**
```powershell
# SSH into app service
az webapp ssh --name YOUR_APP --resource-group YOUR_RG

# Inside SSH
cd /home/site/wwwroot
npm run init:db
npm run seed:comprehensive
```

**2. Run SQL Files Directly**
```powershell
# Using Azure Cloud Shell
mysql -h YOUR_DB.mysql.database.azure.com -u adminuser -p YOUR_DB_NAME < server/database/init.sql
```

### Issue: Too Many Connections
**Error:** `ER_TOO_MANY_CONNECTIONS`

**Solution:**
```powershell
# Increase max connections
az mysql flexible-server parameter set `
    --resource-group YOUR_RG `
    --server-name YOUR_DB `
    --name max_connections `
    --value 100
```

---

## 🚀 Deployment Issues

### Issue: Deployment Fails
**Error:** `Deployment failed` or timeout

**Solutions:**

**1. Check Deployment Logs**
```powershell
az webapp log tail --name YOUR_APP --resource-group YOUR_RG
```

**2. Verify Package.json**
Make sure `start` script exists:
```json
"scripts": {
  "start": "node server/index.js"
}
```

**3. Increase Timeout**
```powershell
az webapp deployment source config-zip `
    --name YOUR_APP `
    --resource-group YOUR_RG `
    --src deploy.zip `
    --timeout 600
```

### Issue: Application Won't Start
**Error:** 502 Bad Gateway or Application Error

**Solutions:**

**1. Check App Logs**
```powershell
az webapp log tail --name YOUR_APP --resource-group YOUR_RG
```

**2. Verify Node Version**
```powershell
az webapp config show --name YOUR_APP --resource-group YOUR_RG
# Should show Node 18 LTS
```

**3. Check Environment Variables**
```powershell
# List all settings
az webapp config appsettings list `
    --name YOUR_APP `
    --resource-group YOUR_RG `
    --output table

# Verify these exist:
# - DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
# - JWT_SECRET, JWT_REFRESH_SECRET
# - NODE_ENV=production
```

**4. Restart App**
```powershell
az webapp restart --name YOUR_APP --resource-group YOUR_RG
```

### Issue: Git Push Fails
**Error:** `Authentication failed` or `Permission denied`

**Solutions:**

**1. Get Deployment Credentials**
```powershell
# Get username and password
az webapp deployment list-publishing-credentials `
    --name YOUR_APP `
    --resource-group YOUR_RG
```

**2. Reset Git URL**
```powershell
git remote remove azure
git remote add azure https://USERNAME:PASSWORD@YOUR_APP.scm.azurewebsites.net/YOUR_APP.git
git push azure main
```

**3. Use Deployment Token**
```powershell
# In Azure Portal:
# App Service → Deployment Center → FTPS Credentials
# Copy username and password, use in git URL
```

---

## 💾 Storage Issues

### Issue: File Uploads Not Working
**Error:** `Cannot upload file` or 404 errors on uploaded files

**Solutions:**

**1. Verify Storage Connection String**
```powershell
# Get connection string
az storage account show-connection-string `
    --name YOUR_STORAGE `
    --resource-group YOUR_RG

# Update app setting
az webapp config appsettings set `
    --name YOUR_APP `
    --resource-group YOUR_RG `
    --settings AZURE_STORAGE_CONNECTION_STRING="YOUR_CONNECTION_STRING"
```

**2. Check Blob Container**
```powershell
# Verify container exists
az storage container list --account-name YOUR_STORAGE --output table

# Create if missing
az storage container create `
    --name uploads `
    --account-name YOUR_STORAGE `
    --public-access blob
```

**3. Configure CORS**
```powershell
az storage cors add `
    --services b `
    --methods GET POST PUT DELETE `
    --origins "*" `
    --allowed-headers "*" `
    --exposed-headers "*" `
    --max-age 3600 `
    --account-name YOUR_STORAGE
```

### Issue: Storage Access Denied
**Error:** `Blob not found` or `403 Forbidden`

**Solutions:**

**1. Check Container Public Access**
```powershell
# Set public access
az storage container set-permission `
    --name uploads `
    --account-name YOUR_STORAGE `
    --public-access blob
```

**2. Verify SAS Token (if using)**
- Ensure SAS token hasn't expired
- Check permissions include read/write/list

---

## 🔐 SSL/HTTPS Issues

### Issue: SSL Certificate Error
**Error:** `Your connection is not private`

**Solutions:**

**1. Enable HTTPS Only**
```powershell
az webapp update `
    --name YOUR_APP `
    --resource-group YOUR_RG `
    --https-only true
```

**2. Bind SSL Certificate**
```powershell
# For custom domain
az webapp config ssl bind `
    --name YOUR_APP `
    --resource-group YOUR_RG `
    --certificate-thumbprint YOUR_THUMBPRINT `
    --ssl-type SNI
```

### Issue: Mixed Content Warnings
**Error:** Some resources loading over HTTP

**Solution:**
- Update all URLs in code to use HTTPS
- Update `CLIENT_URL` and CORS settings to use https://
- Check database URLs for http:// references

---

## 🌐 Domain & DNS Issues

### Issue: Custom Domain Not Working
**Error:** Domain shows 404 or doesn't resolve

**Solutions:**

**1. Verify DNS Records**
```powershell
# Check CNAME record
nslookup www.yourcollege.edu
# Should point to YOUR_APP.azurewebsites.net
```

**2. Wait for DNS Propagation**
- Can take 5-30 minutes
- Use https://dnschecker.org to verify

**3. Validate Domain in Azure**
```powershell
az webapp config hostname add `
    --webapp-name YOUR_APP `
    --resource-group YOUR_RG `
    --hostname www.yourcollege.edu
```

---

## 💰 Billing Issues

### Issue: Unexpected Charges
**Concern:** Bill is higher than expected

**Solutions:**

**1. Check Cost Analysis**
```powershell
# View costs in portal:
# Azure Portal → Cost Management + Billing → Cost analysis
```

**2. Set Spending Limit**
- Azure Portal → Subscriptions → Your subscription → Budgets
- Create alert at 80% of budget

**3. Optimize Resources**
```powershell
# Downgrade App Service Plan
az appservice plan update `
    --name YOUR_PLAN `
    --resource-group YOUR_RG `
    --sku F1  # Free tier

# Reduce database tier
az mysql flexible-server update `
    --resource-group YOUR_RG `
    --name YOUR_DB `
    --sku-name Standard_B1ms
```

### Issue: Free Trial Expired
**Problem:** $200 credit used up

**Solutions:**
- Upgrade to Pay-As-You-Go
- Delete unused resources
- Use smaller tiers (F1, B1)

---

## 📊 Performance Issues

### Issue: Slow Application Response
**Problem:** Pages load slowly

**Solutions:**

**1. Scale Up App Service**
```powershell
az appservice plan update `
    --name YOUR_PLAN `
    --resource-group YOUR_RG `
    --sku S1
```

**2. Enable Compression**
- Already enabled in your app by default
- Verify in server/index.js

**3. Check Database Performance**
```powershell
# View slow query log
az mysql flexible-server parameter set `
    --resource-group YOUR_RG `
    --server-name YOUR_DB `
    --name slow_query_log `
    --value ON
```

**4. Add CDN (Optional)**
```powershell
az cdn profile create `
    --resource-group YOUR_RG `
    --name iter-cdn-profile `
    --sku Standard_Microsoft
```

### Issue: High Memory Usage
**Error:** Out of memory errors

**Solutions:**

**1. Increase App Service Memory**
```powershell
# Upgrade to higher tier
az appservice plan update `
    --name YOUR_PLAN `
    --resource-group YOUR_RG `
    --sku B2  # 3.5GB RAM
```

**2. Optimize Node.js**
```powershell
# Set Node memory limit
az webapp config appsettings set `
    --name YOUR_APP `
    --resource-group YOUR_RG `
    --settings NODE_OPTIONS="--max-old-space-size=2048"
```

---

## 🔍 Debugging Tools

### View Live Logs
```powershell
az webapp log tail --name YOUR_APP --resource-group YOUR_RG
```

### SSH into App
```powershell
az webapp ssh --name YOUR_APP --resource-group YOUR_RG
```

### Download Logs
```powershell
az webapp log download `
    --name YOUR_APP `
    --resource-group YOUR_RG `
    --log-file logs.zip
```

### Check Health Endpoint
```powershell
curl https://YOUR_APP.azurewebsites.net/health
```

### View Environment Variables
```powershell
az webapp config appsettings list `
    --name YOUR_APP `
    --resource-group YOUR_RG `
    --output table
```

### Check Resource Status
```powershell
# App Service
az webapp show `
    --name YOUR_APP `
    --resource-group YOUR_RG `
    --query state

# MySQL
az mysql flexible-server show `
    --resource-group YOUR_RG `
    --name YOUR_DB `
    --query state
```

---

## 🆘 Emergency Recovery

### Issue: App is Down - Need to Recover ASAP

**Quick Recovery Steps:**

**1. Restart Everything**
```powershell
# Restart app
az webapp restart --name YOUR_APP --resource-group YOUR_RG

# Restart MySQL (if needed)
az mysql flexible-server restart `
    --resource-group YOUR_RG `
    --name YOUR_DB
```

**2. Check Status**
```powershell
az webapp show --name YOUR_APP --resource-group YOUR_RG --query state
az mysql flexible-server show --resource-group YOUR_RG --name YOUR_DB --query state
```

**3. View Recent Logs**
```powershell
az webapp log tail --name YOUR_APP --resource-group YOUR_RG
```

**4. Rollback Deployment (if recent change)**
```powershell
# List deployment history
az webapp deployment list-publishing-profiles `
    --name YOUR_APP `
    --resource-group YOUR_RG

# Rollback (in portal: Deployment Center → Deployment History → Redeploy)
```

### Issue: Need to Start Fresh

**Complete Reset:**

```powershell
# ⚠️ WARNING: This deletes everything!

# Delete resource group (all resources)
az group delete --name YOUR_RG --yes

# Redeploy
.\deploy-to-azure.ps1
```

---

## 📞 Getting Help

### Azure Support Channels
1. **Azure Portal:** Help + support in top menu
2. **Documentation:** https://docs.microsoft.com/azure/
3. **Forums:** https://learn.microsoft.com/answers/
4. **Stack Overflow:** Tag with `azure`

### Collect This Info for Support
```powershell
# Azure CLI version
az --version

# Resource details
az group show --name YOUR_RG
az webapp show --name YOUR_APP --resource-group YOUR_RG

# Recent logs
az webapp log tail --name YOUR_APP --resource-group YOUR_RG > logs.txt
```

### Local Testing
Before asking for help, test locally:
```powershell
# Run locally with production settings
$env:NODE_ENV="production"
$env:DB_HOST="YOUR_AZURE_DB.mysql.database.azure.com"
# ... other env vars ...
npm start
```

---

## ✅ Prevention Checklist

### Before Each Deployment
- [ ] Test locally first
- [ ] Check all environment variables
- [ ] Backup database
- [ ] Review recent changes
- [ ] Check Azure service health

### Regular Maintenance
- [ ] Monitor costs weekly
- [ ] Review logs daily (first week)
- [ ] Update packages monthly
- [ ] Rotate secrets quarterly
- [ ] Test backups monthly
- [ ] Review performance metrics

---

## 🔗 Quick Reference

### Essential Commands
```powershell
# Login
az login

# View logs
az webapp log tail --name YOUR_APP --resource-group YOUR_RG

# Restart app
az webapp restart --name YOUR_APP --resource-group YOUR_RG

# SSH
az webapp ssh --name YOUR_APP --resource-group YOUR_RG

# Update env var
az webapp config appsettings set --name YOUR_APP --resource-group YOUR_RG --settings KEY=VALUE

# View costs
az consumption usage list --output table
```

### Useful URLs
- Azure Portal: https://portal.azure.com
- Cost Management: https://portal.azure.com/#blade/Microsoft_Azure_CostManagement
- Service Health: https://status.azure.com
- Pricing: https://azure.microsoft.com/pricing/

---

**Remember:** Most issues are solved by:
1. Checking logs
2. Verifying environment variables
3. Restarting the app
4. Reviewing recent changes

**Still stuck? Let me know the error message and I'll help debug! 🔧**
