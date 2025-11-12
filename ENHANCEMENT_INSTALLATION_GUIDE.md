# 🚀 ITER EduHub - Enhancement Installation Guide

## ✅ Phase 1-3 Complete - Security, Performance & Notifications

This guide will help you install and configure the new enhancements added to ITER EduHub.

---

## 📦 New Dependencies Installation

Run the following command to install all new dependencies:

```powershell
npm install
```

### New Packages Added:
- `node-cache@^5.1.2` - In-memory caching for performance
- `nodemailer@^6.9.7` - Email notifications
- `chart.js@^4.4.0` - Interactive data visualizations
- `exceljs@^4.4.0` - Excel file handling for bulk operations
- `winston@^3.11.0` - Advanced logging

---

## 🗄️ Database Migrations

### Run Security Enhancements Migration

Execute the SQL migration file to add new tables for enhanced security and features:

```powershell
# View the migration SQL
npm run migrate:security

# Or manually run in MySQL:
mysql -u your_user -p iter_college_db < server/database/migrations/security-enhancements.sql
```

### New Tables Created:
1. **audit_logs** - Track all sensitive operations
2. **account_lockouts** - Failed login attempt tracking
3. **password_reset_tokens** - Secure password recovery
4. **notifications** - In-app notification system
5. **user_preferences** - User customization settings
6. **user_sessions** - Enhanced session management
7. **api_keys** - External API integrations
8. **system_settings** - Configurable system parameters
9. **file_shares** - Temporary file sharing with expiry
10. **tags** & **file_tags** - File organization system
11. **user_favorites** - Bookmark important resources
12. **study_groups** & **study_group_members** - Collaborative learning
13. **chat_messages** - Real-time messaging

---

## ⚙️ Configuration

### 1. Update Environment Variables

Add these new variables to your `.env` file:

```env
# Caching Configuration
CACHE_TTL=600
CACHE_CHECK_PERIOD=120

# Rate Limiting
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION_MINUTES=30
API_RATE_LIMIT=60

# Notifications
ENABLE_EMAIL_NOTIFICATIONS=true
ENABLE_SMS_NOTIFICATIONS=false
ENABLE_PUSH_NOTIFICATIONS=true

# Email Configuration (for nodemailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=ITER EduHub <noreply@iteredu.com>

# SMS Configuration (Twilio - optional)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Search Configuration
SEARCH_MIN_LENGTH=2
SEARCH_MAX_RESULTS=100

# File Upload Limits
MAX_FILE_SIZE=10485760
MAX_FILES_PER_USER=1000

# Session Configuration
SESSION_TIMEOUT=86400
```

### 2. Create Logs Directory

```powershell
mkdir logs
```

### 3. Update Nginx Configuration (if using)

Add rate limiting configuration to your nginx.conf:

```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=60r/m;
limit_req_zone $binary_remote_addr zone=login_limit:10m rate=10r/m;

location /api/ {
    limit_req zone=api_limit burst=20 nodelay;
    # ... other configurations
}

location /api/auth/login {
    limit_req zone=login_limit burst=5 nodelay;
    # ... other configurations
}
```

---

## 🎨 Frontend Integration

### 1. Add New CSS Files

Include the notification center CSS in your HTML files:

```html
<!-- In all dashboard HTML files -->
<link rel="stylesheet" href="/static/css/base/notification-center.css">
```

### 2. Add New JavaScript Components

Include the notification center component:

```html
<!-- Add before closing </body> tag -->
<script src="/static/js/components/notification-center.js"></script>
```

### 3. Initialize Notification Center

The notification center auto-initializes, but you can customize it:

```javascript
// Optional: Request browser notification permission
if (window.notificationCenter) {
  window.notificationCenter.requestNotificationPermission();
}

// Optional: Manually trigger notification
window.notificationCenter.handleNewNotification({
  title: 'Test Notification',
  message: 'This is a test message',
  type: 'info',
  link: null
});
```

---

## 🔧 Server Updates

### New Routes Available:

1. **Notifications API**
   - `GET /api/notifications` - Get user notifications
   - `GET /api/notifications/unread-count` - Get unread count
   - `PUT /api/notifications/:id/read` - Mark as read
   - `PUT /api/notifications/read-all` - Mark all as read
   - `DELETE /api/notifications/:id` - Delete notification
   - `DELETE /api/notifications/read/all` - Clear read notifications

2. **Search API**
   - `GET /api/search?q=query` - Global search
   - `GET /api/search/users?q=query` - Search users
   - `GET /api/search/files?q=query` - Search files
   - `GET /api/search/suggestions?q=query` - Autocomplete
   - `GET /api/search/trending` - Trending searches

3. **Enhanced Security**
   - All routes now have input validation
   - Rate limiting per user
   - Audit logging for sensitive operations
   - Account lockout protection

---

## 🚦 Testing the Installation

### 1. Start the Server

```powershell
npm run dev
```

### 2. Verify New Features

**Test Notifications:**
```powershell
# Using PowerShell (replace TOKEN with your JWT)
$token = "your-jwt-token"
$headers = @{
    "Authorization" = "Bearer $token"
}

# Get notifications
Invoke-RestMethod -Uri "http://localhost:5000/api/notifications" -Headers $headers

# Get unread count
Invoke-RestMethod -Uri "http://localhost:5000/api/notifications/unread-count" -Headers $headers
```

**Test Search:**
```powershell
# Global search
Invoke-RestMethod -Uri "http://localhost:5000/api/search?q=test" -Headers $headers

# Get suggestions
Invoke-RestMethod -Uri "http://localhost:5000/api/search/suggestions?q=da" -Headers $headers
```

**Test Cache:**
```javascript
// In server console or route handler
const cacheService = require('./server/services/cache.service');

// Set cache
cacheService.set('test-key', { data: 'test value' }, 300);

// Get cache
const value = cacheService.get('test-key');
console.log(value); // { data: 'test value' }

// Get cache stats
console.log(cacheService.getStats());
```

**Test Audit Logging:**
```javascript
const auditLogger = require('./server/services/audit.service');

// Log an action
await auditLogger.log({
  userId: 1,
  action: 'CREATE',
  resource: 'user',
  resourceId: 123,
  ipAddress: req.ip,
  userAgent: req.get('user-agent'),
  metadata: { additional: 'data' },
  status: 'success'
});

// Get audit logs
const logs = await auditLogger.getLogs({
  userId: 1,
  page: 1,
  pageSize: 50
});
```

### 3. Monitor System Health

**View Logs:**
```powershell
# View audit logs
Get-Content logs/audit-*.log -Tail 50

# Monitor real-time logs
Get-Content logs/audit-*.log -Wait
```

**Check Cache Stats:**
Visit the admin dashboard and look for cache statistics (to be implemented in admin panel).

---

## 🔐 Security Checklist

After installation, verify these security features:

- [ ] Password validation enforces strong passwords
- [ ] Rate limiting prevents brute force attacks
- [ ] Account lockout after 5 failed login attempts
- [ ] Audit logs capture sensitive operations
- [ ] Input validation on all forms
- [ ] SQL injection protection via parameterized queries
- [ ] XSS protection via input sanitization
- [ ] CORS configured properly
- [ ] JWT tokens secure and expire properly
- [ ] File uploads validated and restricted

---

## 📊 Performance Optimization

### Caching Strategy

The system now uses a multi-tier caching approach:

1. **API Cache** - 60 seconds for API responses
2. **Static Cache** - 1 hour for static data (timetables, menus)
3. **User Cache** - 10 minutes for user data
4. **Session Cache** - 30 minutes for session data

### Cache Invalidation

Caches are automatically invalidated when data changes:

```javascript
// Example: Invalidate attendance cache when marking attendance
const cacheService = require('./services/cache.service');

// After marking attendance
cacheService.invalidateAttendance(studentId, subject);

// After updating user
cacheService.invalidateUserData(userId);
```

---

## 🎯 Next Steps

### Recommended Implementation Order:

1. ✅ **Phase 1: Security** - COMPLETED
   - ✅ Input validation
   - ✅ Rate limiting
   - ✅ Audit logging
   - ✅ Password strength

2. ✅ **Phase 3: Notifications** - COMPLETED
   - ✅ In-app notifications
   - ✅ Real-time updates
   - ✅ Notification center UI
   - ⏳ Email integration (setup required)
   - ⏳ SMS integration (optional)

3. ✅ **Phase 5: Search** - COMPLETED
   - ✅ Global search
   - ✅ Advanced filters
   - ✅ Autocomplete
   - ✅ Multi-resource search

4. 🔜 **Phase 2: Database Optimization** - NEXT
   - Connection pooling
   - Query optimization
   - Indexed views
   - Redis integration (optional)

5. 🔜 **Phase 4: Charts & Visualizations** - UPCOMING
   - Attendance heatmaps
   - Performance trends
   - Interactive dashboards
   - Drill-down analytics

---

## 🐛 Troubleshooting

### Common Issues:

**1. Notifications not appearing**
- Check if Socket.IO is connected
- Verify JWT token is valid
- Check browser console for errors
- Ensure notification routes are registered

**2. Search returning no results**
- Verify database has approved content
- Check search query length (min 2 chars)
- Ensure user has proper permissions
- Check network tab for API errors

**3. Cache not working**
- Verify node-cache is installed
- Check memory limits
- Review cache TTL settings
- Clear cache: `cacheService.flush()`

**4. Rate limiting too strict**
- Adjust limits in .env file
- Check user vs IP-based limiting
- Review rate limit windows
- Check audit logs for patterns

**5. Audit logs not recording**
- Verify audit_logs table exists
- Check database permissions
- Ensure logs directory is writable
- Review error logs for SQL errors

---

## 📚 Additional Resources

### API Documentation

All new endpoints are documented with:
- Request parameters
- Response format
- Error codes
- Example requests

### Code Examples

Check these files for implementation examples:
- `server/services/*.service.js` - Service layer patterns
- `server/validators/*.validator.js` - Validation patterns
- `client/js/components/*.js` - Frontend components
- `server/routes/*.routes.js` - API route patterns

### Support

For issues or questions:
1. Check the logs directory
2. Review error messages in console
3. Check database for migrations
4. Verify all dependencies installed
5. Ensure .env is properly configured

---

## 🎉 Success Criteria

Your installation is successful when:

✅ Server starts without errors
✅ All new routes respond correctly
✅ Database migrations applied
✅ Notification bell appears in UI
✅ Search functionality works
✅ Audit logs being created
✅ Cache improves response times
✅ Rate limiting prevents abuse
✅ Input validation catches errors
✅ No console errors in browser

---

## 🔄 Continuous Improvement

Monitor these metrics after deployment:

- **Performance**: Response times, cache hit rates
- **Security**: Failed login attempts, audit logs
- **User Experience**: Notification engagement, search usage
- **System Health**: Memory usage, database queries
- **Error Rates**: API errors, validation failures

---

## 📝 Changelog

### Version 2.0.0 - Security & Performance Update

**Added:**
- ✅ Comprehensive input validation
- ✅ Advanced rate limiting with user tracking
- ✅ Audit logging system
- ✅ In-memory caching (node-cache)
- ✅ Notification center with real-time updates
- ✅ Global search with autocomplete
- ✅ Enhanced security middleware
- ✅ Account lockout protection
- ✅ Password strength validation
- ✅ 13 new database tables
- ✅ 2 new API route groups
- ✅ 5 new service modules

**Improved:**
- ✅ API response times with caching
- ✅ Security posture with multiple layers
- ✅ User experience with notifications
- ✅ Search functionality across resources
- ✅ Error handling and logging
- ✅ Database schema with indexes

**Next Release (2.1.0):**
- 🔜 Chart.js visualizations
- 🔜 Bulk operations (CSV import)
- 🔜 Enhanced file management
- 🔜 Email/SMS integrations
- 🔜 Mobile UI improvements

---

## 🙏 Credits

Enhancements developed for ITER EduHub by the development team.
Built with ❤️ for education.

---

**Need Help?** Check the troubleshooting section or review the code comments in the service files.
