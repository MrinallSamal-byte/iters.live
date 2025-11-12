# 🚀 ITER EduHub v2.0 - Developer Quick Reference

> **Fast reference for common tasks and APIs**

---

## 🔑 Quick Commands

```powershell
# Install & Setup
npm install                      # Install all dependencies
npm run migrate:security         # Run database migrations
setup-enhancements.bat          # Automated setup (Windows)

# Development
npm run dev                      # Start dev server with hot reload
npm start                        # Start production server
npm test                         # Run tests with coverage

# Database
npm run seed                     # Seed test data
npm run migrate:security         # Run security migrations
npm run backup                   # Backup database
```

---

## 📡 New API Endpoints Reference

### Notifications
```javascript
GET    /api/notifications                      // Get notifications (paginated)
GET    /api/notifications/unread-count         // Get unread count
GET    /api/notifications/stats                // Get statistics
PUT    /api/notifications/:id/read             // Mark as read
PUT    /api/notifications/read-all             // Mark all as read
DELETE /api/notifications/:id                  // Delete notification
DELETE /api/notifications/read/all             // Clear read

// Example
const response = await fetch('/api/notifications?page=1&pageSize=20', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

### Search
```javascript
GET /api/search?q=query                        // Global search
GET /api/search/users?q=john                   // Search users
GET /api/search/files?q=notes&category=note    // Search files
GET /api/search/suggestions?q=da               // Autocomplete
GET /api/search/trending                       // Trending searches

// Example
const results = await fetch('/api/search?q=test&types=files,events', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

---

## 🛠️ Service Layer Usage

### Cache Service
```javascript
const cacheService = require('./services/cache.service');

// Basic operations
cacheService.set('key', value, ttl);           // Set cache
const value = cacheService.get('key');         // Get cache
cacheService.del('key');                       // Delete cache
cacheService.flush();                          // Clear all cache

// Get-or-set pattern
const data = await cacheService.getOrSet('key', async () => {
  return await fetchDataFromDatabase();
}, 600);

// Specialized caches
cacheService.getUserData(userId);              // Get user data
cacheService.getAttendance(studentId);         // Get attendance
cacheService.getMarks(studentId);              // Get marks

// Cache statistics
const stats = cacheService.getStats();
console.log(stats);
```

### Notification Service
```javascript
const notificationService = require('./services/notification.service');

// Create notification
await notificationService.create({
  userId: 1,
  title: 'New Assignment',
  message: 'Assignment submitted successfully',
  type: 'assignment',
  link: '/assignments/123',
  metadata: { assignmentId: 123 }
});

// Bulk notifications
await notificationService.createBulk([1, 2, 3], {
  title: 'Announcement',
  message: 'Classes cancelled tomorrow',
  type: 'announcement'
});

// Multi-channel notification
await notificationService.sendMultiChannel(userId, {
  title: 'Important',
  message: 'Your message',
  type: 'warning'
});
```

### Audit Logger
```javascript
const auditLogger = require('./services/audit.service');

// Log an action
await auditLogger.log({
  userId: req.user.id,
  action: 'CREATE',
  resource: 'user',
  resourceId: newUser.id,
  ipAddress: req.ip,
  userAgent: req.get('user-agent'),
  metadata: { role: 'student' },
  status: 'success'
});

// Get audit logs
const logs = await auditLogger.getLogs({
  userId: 1,
  action: 'UPDATE',
  startDate: '2025-01-01',
  page: 1,
  pageSize: 50
});

// Get user activity
const activity = await auditLogger.getUserActivitySummary(userId, 30);

// Detect suspicious activity
const suspicious = await auditLogger.detectSuspiciousActivity(userId, 5);
```

### Search Service
```javascript
const searchService = require('./services/search.service');

// Global search
const results = await searchService.globalSearch('query', {
  userId: req.user.id,
  userRole: req.user.role,
  types: ['files', 'events'],
  page: 1,
  pageSize: 20
});

// Search with filters
const files = await searchService.searchFiles('notes', {
  category: 'note',
  subject: 'DSA',
  startDate: '2025-01-01',
  page: 1
});

// Autocomplete
const suggestions = await searchService.getSuggestions('da', 'all');
```

### Rate Limiting
```javascript
const { 
  trackFailedLogin, 
  isAccountLocked, 
  clearFailedAttempts 
} = require('./services/rateLimit.service');

// Track failed login
const result = await trackFailedLogin(identifier, ipAddress);
if (result.locked) {
  return res.status(423).json({
    success: false,
    message: `Account locked for ${result.lockoutMinutes} minutes`
  });
}

// Check if locked
const lockStatus = isAccountLocked(identifier);
if (lockStatus.locked) {
  return res.status(423).json({
    success: false,
    message: `Account locked. Try again in ${lockStatus.remainingMinutes} minutes`
  });
}

// Clear on success
clearFailedAttempts(identifier, ipAddress);
```

---

## ✅ Validation Patterns

### Using Validators
```javascript
const { 
  registerValidation, 
  validate 
} = require('./validators/auth.validator');

// In route
router.post('/register', registerValidation, validate, async (req, res) => {
  // Data is already validated
  const { name, email, password } = req.body;
  // ... proceed with logic
});

// Custom validation
const customValidation = [
  body('field').custom((value) => {
    if (value !== 'expected') {
      throw new Error('Validation failed');
    }
    return true;
  })
];
```

### Validation Response Format
```javascript
// On validation error:
{
  success: false,
  message: 'Validation failed',
  errors: [
    {
      field: 'email',
      message: 'Invalid email format',
      value: 'invalid-email'
    }
  ]
}
```

---

## 🎨 Frontend Integration

### Notification Center
```javascript
// Auto-initialized on page load
// Access via: window.notificationCenter

// Request permissions
window.notificationCenter.requestNotificationPermission();

// Send custom notification
window.notificationCenter.handleNewNotification({
  title: 'Test',
  message: 'This is a test',
  type: 'info',
  link: '/dashboard'
});

// Open/close panel
window.notificationCenter.togglePanel();

// Load more notifications
window.notificationCenter.loadMoreNotifications();
```

### Search Integration
```javascript
// Basic search
async function search(query) {
  const response = await fetch(
    `/api/search?q=${encodeURIComponent(query)}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  const data = await response.json();
  return data.results;
}

// Autocomplete
async function getSuggestions(query) {
  const response = await fetch(
    `/api/search/suggestions?q=${encodeURIComponent(query)}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  const data = await response.json();
  return data.suggestions;
}
```

---

## 🗄️ Database Queries

### Common Patterns
```sql
-- Get user with cache check first
const cached = cacheService.getUserData(userId);
if (cached) return cached;

const [users] = await db.query(
  'SELECT * FROM users WHERE id = ?',
  [userId]
);

cacheService.setUserData(userId, users[0]);

-- Paginated queries
SELECT * FROM table 
WHERE condition 
ORDER BY created_at DESC 
LIMIT ? OFFSET ?

-- With filters
SELECT * FROM files 
WHERE category = ? 
  AND subject = ? 
  AND approved = TRUE 
ORDER BY created_at DESC 
LIMIT ? OFFSET ?
```

### New Tables Reference
```sql
-- Notifications
SELECT * FROM notifications 
WHERE user_id = ? AND is_read = FALSE 
ORDER BY created_at DESC;

-- Audit Logs
SELECT * FROM audit_logs 
WHERE user_id = ? AND action = 'UPDATE' 
ORDER BY created_at DESC 
LIMIT 100;

-- User Preferences
SELECT * FROM user_preferences WHERE user_id = ?;

-- File Shares
SELECT * FROM file_shares 
WHERE share_token = ? AND is_active = TRUE;

-- Study Groups
SELECT * FROM study_groups 
WHERE is_active = TRUE 
ORDER BY created_at DESC;
```

---

## 🔐 Security Checklist

```javascript
// ✅ Always validate input
router.post('/endpoint', validation, validate, handler);

// ✅ Always use parameterized queries
await db.query('SELECT * FROM users WHERE id = ?', [userId]);

// ✅ Always check authentication
router.get('/protected', auth, handler);

// ✅ Always check authorization
if (req.user.role !== 'admin') {
  return res.status(403).json({ success: false, message: 'Forbidden' });
}

// ✅ Always log sensitive operations
await auditLogger.log({ userId, action, resource, status });

// ✅ Always handle errors
try {
  // ... operation
} catch (error) {
  console.error('Error:', error);
  res.status(500).json({ success: false, error: error.message });
}
```

---

## 📊 Response Formats

### Success Response
```javascript
{
  success: true,
  data: { ... },
  message: 'Operation successful',
  meta: {
    page: 1,
    pageSize: 20,
    total: 100,
    totalPages: 5
  }
}
```

### Error Response
```javascript
{
  success: false,
  message: 'Error description',
  error: 'Detailed error message',
  errors: [ ... ]  // For validation errors
}
```

---

## 🧪 Testing Examples

### Unit Test (Jest)
```javascript
const cacheService = require('../services/cache.service');

describe('Cache Service', () => {
  test('should set and get cache', () => {
    cacheService.set('test-key', 'test-value');
    const value = cacheService.get('test-key');
    expect(value).toBe('test-value');
  });

  test('should return undefined for missing key', () => {
    const value = cacheService.get('non-existent');
    expect(value).toBeUndefined();
  });
});
```

### API Test (Postman/PowerShell)
```powershell
# Get notifications
$token = "your-jwt-token"
$headers = @{ "Authorization" = "Bearer $token" }
Invoke-RestMethod -Uri "http://localhost:5000/api/notifications" -Headers $headers

# Create notification (admin)
$body = @{
  userId = 1
  title = "Test"
  message = "Test message"
  type = "info"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/notifications" `
  -Method POST -Headers $headers -Body $body -ContentType "application/json"
```

---

## 🐛 Debugging Tips

### Check Logs
```powershell
# Audit logs
Get-Content logs/audit-*.log -Tail 50

# Application logs
Get-Content logs/app.log -Tail 50

# Real-time monitoring
Get-Content logs/audit-*.log -Wait
```

### Database Queries
```sql
-- Check new tables
SHOW TABLES LIKE '%notification%';
SHOW TABLES LIKE '%audit%';

-- Check data
SELECT * FROM notifications ORDER BY created_at DESC LIMIT 10;
SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10;

-- Check indexes
SHOW INDEX FROM users;
SHOW INDEX FROM notifications;
```

### Cache Debugging
```javascript
// In server console or route
const stats = cacheService.getStats();
console.log('Cache Statistics:', stats);

// Clear cache
cacheService.flush();

// Check specific cache
const value = cacheService.get('user:123');
console.log('Cached value:', value);
```

---

## 🚀 Performance Tips

1. **Always cache frequent queries**
   ```javascript
   const data = await cacheService.getOrSet('key', fetchFunction, 600);
   ```

2. **Use pagination**
   ```javascript
   const limit = parseInt(req.query.pageSize) || 20;
   const offset = (page - 1) * limit;
   ```

3. **Invalidate cache on updates**
   ```javascript
   await updateUser(userId, data);
   cacheService.invalidateUserData(userId);
   ```

4. **Use database indexes**
   ```sql
   CREATE INDEX idx_user_id ON table_name(user_id);
   ```

5. **Batch operations**
   ```javascript
   // Instead of loop, use bulk insert
   await db.query('INSERT INTO table VALUES ?', [values]);
   ```

---

## 📚 Additional Resources

- **Main README**: `README.md`
- **Installation Guide**: `ENHANCEMENT_INSTALLATION_GUIDE.md`
- **Feature Summary**: `ENHANCEMENT_SUMMARY.md`
- **Implementation Roadmap**: `IMPLEMENTATION_ROADMAP.md`
- **This Quick Reference**: `DEVELOPER_QUICK_REFERENCE.md`

---

## 🆘 Common Issues

### Issue: Notifications not appearing
```javascript
// Check Socket.IO connection
console.log(window.notificationCenter.socket.connected);

// Check if notifications exist
fetch('/api/notifications/unread-count', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json()).then(console.log);
```

### Issue: Search not working
```javascript
// Check minimum query length
if (query.length < 2) {
  console.log('Query too short');
}

// Check permissions
// Ensure user is authenticated and has proper role
```

### Issue: Cache not working
```javascript
// Clear and retry
cacheService.flush();
const stats = cacheService.getStats();
console.log('Cache cleared, stats:', stats);
```

---

**Keep this reference handy during development!**

*Quick Reference v2.0.0*
*Last Updated: October 9, 2025*
