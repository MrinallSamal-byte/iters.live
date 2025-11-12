# Railway MySQL + Vercel Deployment - Setup & Testing Guide

## 🎯 Overview

This guide will help you verify that your **Railway MySQL** database is properly connected to your **Vercel deployment** with all required dummy data and demo accounts.

**Live URL:** https://iter-college-management-7sct95bwk-mrinallsamal-bytes-projects.vercel.app/index.html

---

## 📋 Prerequisites

- Railway MySQL database set up and running
- Vercel project deployed
- Environment variables configured in Vercel

---

## 🔧 Step 1: Configure Environment Variables

### In Vercel Dashboard

Go to your Vercel project → Settings → Environment Variables

Add the following variables with your **Railway MySQL credentials**:

```env
DB_HOST=<your-railway-mysql-host>
DB_PORT=<your-railway-mysql-port>
DB_USER=<your-railway-mysql-user>
DB_PASSWORD=<your-railway-mysql-password>
DB_NAME=<your-railway-mysql-database>
JWT_SECRET=your-secret-key-change-in-production-2024
JWT_REFRESH_SECRET=your-refresh-secret-key-change-in-production-2024
NODE_ENV=production
```

### Finding Railway Credentials

1. Go to Railway Dashboard: https://railway.app/dashboard
2. Select your MySQL service
3. Click on "Variables" tab
4. Copy the following values:
   - `MYSQLHOST` → DB_HOST
   - `MYSQLPORT` → DB_PORT
   - `MYSQLUSER` → DB_USER
   - `MYSQLPASSWORD` → DB_PASSWORD
   - `MYSQLDATABASE` → DB_NAME

---

## 🧪 Step 2: Test Railway Connection (Local)

### Update Your Local .env File

Create/update `.env` file with Railway credentials:

```env
DB_HOST=<railway-mysql-host>
DB_PORT=<railway-mysql-port>
DB_USER=<railway-mysql-user>
DB_PASSWORD=<railway-mysql-password>
DB_NAME=<railway-mysql-database>
```

### Run Connection Check

```powershell
node check-railway-db.js
```

This script will:
- ✓ Test connection to Railway MySQL
- ✓ Verify all tables exist
- ✓ Check user accounts (admin, teacher, student)
- ✓ Verify dummy data in key tables
- ✓ Display demo account credentials

---

## 🌱 Step 3: Seed Railway Database (If Needed)

If the check script shows missing data, run:

```powershell
node seed-railway-db.js
```

This will:
- Create all necessary tables
- Add 3 admin accounts
- Add 20 teacher accounts
- Add 100+ student accounts
- Generate dummy data for:
  - Attendance records
  - Marks/grades
  - Assignments
  - Events
  - Timetables
  - Admit cards
  - Hostel rooms
  - Notifications

---

## 🚀 Step 4: Test Vercel Deployment

```powershell
node test-vercel-deployment.js
```

This script will:
- ✓ Check if website is accessible
- ✓ Test API health endpoint
- ✓ Test login with demo accounts
- ✓ Test authenticated requests
- ✓ Test registration endpoint
- ✓ Verify analytics data loading

---

## 👥 Demo Accounts

### Admin Accounts
```
Email:    admin1@iter.edu
Password: Admin@123456

Email:    admin2@iter.edu
Password: Admin@123456

Email:    admin3@iter.edu
Password: Admin@123456
```

### Teacher Accounts
```
Email:    teacher1@iter.edu
Password: Teacher@123

Email:    teacher2@iter.edu
Password: Teacher@123

... up to teacher20@iter.edu
```

### Student Accounts
```
Email:    student1@iter.edu
Password: Student@123

Email:    student2@iter.edu
Password: Student@123

... up to 100+ students
```

---

## 📊 Pages to Test

### 1. Landing Page
**URL:** https://iter-college-management-7sct95bwk-mrinallsamal-bytes-projects.vercel.app/index.html
- Should load without errors
- Navigation should work
- Login button should redirect to login page

### 2. Login Page
**URL:** https://iter-college-management-7sct95bwk-mrinallsamal-bytes-projects.vercel.app/client/html/login.html
- Test login with demo accounts
- Should redirect to appropriate dashboard based on role

### 3. Registration Page
**URL:** https://iter-college-management-7sct95bwk-mrinallsamal-bytes-projects.vercel.app/client/html/register.html
- Test creating new accounts
- Validation should work
- Should save to Railway database

### 4. Admin Dashboard
**URL:** https://iter-college-management-7sct95bwk-mrinallsamal-bytes-projects.vercel.app/client/html/admin-dashboard.html
- Login as admin
- Check analytics widgets:
  - Total students count
  - Total teachers count
  - Attendance statistics
  - Performance metrics
- Verify charts load with data

### 5. Teacher Dashboard
**URL:** https://iter-college-management-7sct95bwk-mrinallsamal-bytes-projects.vercel.app/client/html/teacher-dashboard.html
- Login as teacher
- Check analytics:
  - Class statistics
  - Student attendance
  - Assignment submissions
  - Performance overview
- Verify data displays correctly

### 6. Student Dashboard
**URL:** https://iter-college-management-7sct95bwk-mrinallsamal-bytes-projects.vercel.app/client/html/student-dashboard.html
- Login as student
- Verify personal data:
  - Attendance records
  - Marks/grades
  - Assignments
  - Timetable
  - Admit cards
- Check all data loads from Railway

### 7. Other Pages to Test
- Attendance Management
- Marks Entry
- Assignment Management
- Event Management
- Timetable View
- Hostel Management
- Profile Page
- Notifications

---

## 🔍 Troubleshooting

### Issue: Cannot connect to Railway database

**Solutions:**
1. Verify Railway MySQL service is running
2. Check environment variables are correct
3. Ensure IP whitelisting (if enabled in Railway)
4. Check Railway service logs for errors

### Issue: Login fails on Vercel

**Solutions:**
1. Check Vercel logs: `vercel logs <your-deployment-url>`
2. Verify environment variables in Vercel dashboard
3. Ensure JWT_SECRET is set
4. Test if database connection works from Vercel

### Issue: No data showing in dashboards

**Solutions:**
1. Run `node check-railway-db.js` to verify data exists
2. Check browser console for API errors
3. Verify API endpoints are accessible
4. Check Vercel function logs

### Issue: Registration not working

**Solutions:**
1. Check if users table exists in Railway
2. Verify unique constraints (email, registration_number)
3. Check password hashing is working
4. Review Vercel function logs for errors

### Issue: Analytics showing empty/zero

**Solutions:**
1. Verify dummy data was seeded correctly
2. Check if analytics API endpoint returns data
3. Ensure user has proper role/permissions
4. Check date ranges in analytics queries

---

## 🔐 Security Checklist

- [ ] JWT_SECRET is set to a strong, unique value
- [ ] JWT_REFRESH_SECRET is different from JWT_SECRET
- [ ] Database password is strong and secure
- [ ] Railway database has proper access controls
- [ ] CORS is configured correctly
- [ ] Rate limiting is enabled
- [ ] Sensitive data is not logged

---

## 📈 Performance Testing

### Load Testing

Test with multiple concurrent users:

```powershell
# Install Artillery (if not installed)
npm install -g artillery

# Run load test
artillery quick --count 10 --num 20 https://iter-college-management-7sct95bwk-mrinallsamal-bytes-projects.vercel.app/api/health
```

### Database Performance

Check query performance in Railway:
1. Go to Railway Dashboard
2. Select MySQL service
3. Check "Metrics" tab
4. Monitor connection count and query performance

---

## 🔄 Continuous Monitoring

### Daily Checks
- [ ] Website is accessible
- [ ] Login works for all roles
- [ ] Data is being saved correctly
- [ ] Analytics are updating

### Weekly Checks
- [ ] Database size and growth
- [ ] Backup verification
- [ ] Performance metrics
- [ ] Error logs review

### Monthly Checks
- [ ] Security audit
- [ ] Dependency updates
- [ ] Database optimization
- [ ] Cost analysis (Railway + Vercel)

---

## 📞 Support

### Railway Support
- Dashboard: https://railway.app/dashboard
- Docs: https://docs.railway.app
- Discord: https://discord.gg/railway

### Vercel Support
- Dashboard: https://vercel.com/dashboard
- Docs: https://vercel.com/docs
- Support: https://vercel.com/support

---

## 🎉 Success Criteria

Your deployment is successful when:

✅ All three test scripts pass without errors
✅ Demo accounts can login successfully
✅ Dashboards show analytics and data
✅ New registrations work smoothly
✅ Data persists in Railway database
✅ All pages load without console errors
✅ API responses are fast (<500ms)

---

## 📝 Next Steps

After successful deployment:

1. **Production Accounts**: Create real admin accounts and disable/remove demo accounts
2. **Data Migration**: Import real student/teacher data
3. **Customization**: Update branding, logos, and content
4. **Monitoring**: Set up monitoring and alerting
5. **Backup**: Configure automated backups in Railway
6. **Documentation**: Document any custom configurations

---

## 🚨 Emergency Procedures

### If Database Connection Fails

1. Check Railway service status
2. Verify environment variables
3. Check Vercel function logs
4. Restart Railway service if needed
5. Contact Railway support if persists

### If Vercel Deployment Fails

1. Check build logs in Vercel
2. Verify all dependencies are installed
3. Check for syntax errors
4. Rollback to previous deployment if needed
5. Contact Vercel support if persists

---

**Last Updated:** October 2025
**Version:** 1.0
**Maintained By:** Development Team
