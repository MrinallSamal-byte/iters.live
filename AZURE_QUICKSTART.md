# Quick Start: Deploy to Microsoft Azure

## Prerequisites Checklist
- [ ] Azure account with active subscription
- [ ] Azure CLI installed
- [ ] Logged into Azure CLI (`az login`)

## One-Command Deployment 🚀

```powershell
# Run the automated deployment script
.\deploy-to-azure.ps1
```

That's it! The script will:
1. ✅ Create all Azure resources
2. ✅ Configure environment variables
3. ✅ Deploy your application
4. ✅ Set up database
5. ✅ Configure SSL/HTTPS
6. ✅ Open the app in your browser

## Custom Deployment Options

### Specify Resource Names
```powershell
.\deploy-to-azure.ps1 `
    -ResourceGroup "my-college-rg" `
    -Location "westus2" `
    -AppName "my-college-app" `
    -DBName "my-college-db"
```

### Dry Run (See what will be created without actually creating it)
```powershell
.\deploy-to-azure.ps1 -DryRun
```

### Skip Database Initialization
```powershell
.\deploy-to-azure.ps1 -SkipDatabaseInit
```

## After Deployment

### 1. Access Your Application
Your app will be at: `https://YOUR_APP_NAME.azurewebsites.net`

### 2. Default Login Credentials
- **Email:** admin@iter.edu
- **Password:** Admin@123456
- ⚠️ **CHANGE THIS IMMEDIATELY!**

### 3. View Deployment Info
Check `azure-deployment-info.json` for:
- Database credentials
- Storage account details
- JWT secrets
- Application URL

### 4. Monitor Your Application
```powershell
# View live logs
az webapp log tail --name YOUR_APP_NAME --resource-group YOUR_RESOURCE_GROUP

# SSH into the app
az webapp ssh --name YOUR_APP_NAME --resource-group YOUR_RESOURCE_GROUP
```

### 5. Set Up Database
```powershell
# SSH into your app
az webapp ssh --name YOUR_APP_NAME --resource-group YOUR_RESOURCE_GROUP

# Inside the app, run:
cd /home/site/wwwroot
npm run seed:comprehensive
exit
```

## Common Tasks

### Update Application
```powershell
# Pull latest changes
git pull

# Redeploy
.\deploy-to-azure.ps1
```

### View Logs
```powershell
az webapp log tail --name YOUR_APP_NAME --resource-group YOUR_RESOURCE_GROUP
```

### Scale Up (Upgrade Plan)
```powershell
az appservice plan update `
    --name YOUR_APP_NAME-plan `
    --resource-group YOUR_RESOURCE_GROUP `
    --sku S1
```

### Backup Database
```powershell
# Azure automatically backs up MySQL
# View backups in Azure Portal → Your Database → Backup and Restore
```

### Add Custom Domain
```powershell
az webapp config hostname add `
    --webapp-name YOUR_APP_NAME `
    --resource-group YOUR_RESOURCE_GROUP `
    --hostname www.yourcollege.edu
```

## Cost Estimation
- **Development:** ~$15-20/month (Free App Service + Basic MySQL)
- **Production (Small):** ~$100-110/month (B1 App + MySQL)
- **Production (Medium):** ~$260-275/month (S1 App + Better MySQL)

## Troubleshooting

### App Won't Start?
```powershell
# Check logs
az webapp log tail --name YOUR_APP_NAME --resource-group YOUR_RESOURCE_GROUP

# Restart app
az webapp restart --name YOUR_APP_NAME --resource-group YOUR_RESOURCE_GROUP
```

### Database Connection Issues?
1. Check firewall rules in Azure Portal
2. Verify connection string in App Settings
3. Ensure database is running

### File Upload Issues?
1. Check storage account connection string
2. Verify blob container exists and is public
3. Check CORS settings on storage account

## Need Help?

📖 **Full Documentation:** See `AZURE_DEPLOYMENT_GUIDE.md`

🔧 **Azure Portal:** https://portal.azure.com

📊 **Cost Calculator:** https://azure.microsoft.com/pricing/calculator/

## Security Reminders
- ⚠️ Change default admin password immediately
- 🔐 Use Azure Key Vault for secrets
- 🔒 Enable SSL/HTTPS (auto-configured)
- 🛡️ Configure firewall rules
- 📝 Enable monitoring and alerts
- 💾 Set up regular backups

---

**That's it! Your college management system is now running on Azure! 🎉**
