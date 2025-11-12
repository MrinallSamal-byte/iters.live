# 🔍 Login Troubleshooting Guide

## Issue Summary
The login page loads successfully but form submission doesn't send API requests.

## Diagnostic Results

### ✅ What's Working:
1. **Frontend Server** - Running on port 3000
2. **Backend Server** - Running on port 5000  
3. **Database Connection** - Successfully connected
4. **Socket.IO** - Initialized and ready
5. **Login Route** - `/api/auth/login` is properly defined
6. **API Helper** - `APP.API.post()` function exists in `main.js`

### ❓ What We Need to Check:

1. **Are there any test users in the database?**
2. **Is the form submission working in the browser console?**
3. **Are there any JavaScript errors preventing the form from submitting?**

## Quick Testing Steps

### Step 1: Check Browser Console
1. Open http://localhost:3000/login.html
2. Press **F12** to open Developer Tools
3. Go to the **Console** tab
4. Look for any JavaScript errors (red text)
5. Try to login and watch for errors or API requests in the **Network** tab

### Step 2: Test Database Connection
Run this command to check if there are users:
```powershell
node -e "const db = require('./server/database/db'); db.query('SELECT COUNT(*) as count FROM users').then(result => { console.log('Total users:', result[0].count); process.exit(0); }).catch(err => { console.error('Error:', err); process.exit(1); });"
```

### Step 3: Create a Test User
If no users exist, create one:
```powershell
npm run seed
```

## Common Issues & Solutions

### Issue 1: No API Request Sent
**Symptom**: Login button works but no network request in DevTools  
**Causes**:
- JavaScript error in console
- Form validation failing
- `APP` object not loaded

**Solution**: Check browser console for errors

### Issue 2: CORS Error
**Symptom**: Request blocked by CORS policy  
**Solution**: Already configured in `server/index.js` - shouldn't occur

### Issue 3: Database Not Seeded
**Symptom**: "Invalid credentials" error  
**Solution**: Run `npm run seed` to create test users

### Issue 4: Wrong API URL
**Symptom**: 404 Not Found or connection refused  
**Check**: API_URL in `main.js` should be `http://localhost:5000/api`

## Test Credentials (After Seeding)

After running `npm run seed`, you should have:

**Student Account**:
- Registration: `STU20250001`  
- Password: `Student@123`

**Teacher Account**:
- Registration: `TEA20250001`
- Password: `Teacher@123`

**Admin Account**:
- Registration: `ADM20250001`
- Password: `Admin@123`

## Manual API Test

Test the API directly:
```powershell
curl -X POST http://localhost:5000/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{"registration_number":"STU20250001","password":"Student@123"}'
```

## Next Steps

1. **Start the server** (if not running):
   ```powershell
   npm run dev
   ```

2. **Open the login page**: http://localhost:3000/login.html

3. **Open Browser DevTools**: Press F12

4. **Try to login** and observe:
   - Any errors in Console tab
   - Network requests in Network tab
   - What error message appears

5. **Share the following with me**:
   - Screenshot of browser console errors (if any)
   - What happens when you click "Login"
   - Any error messages displayed on screen

## Files Involved

- **Frontend Login**: `client/login.html` (lines 299-350)
- **API Helper**: `client/js/main.js` (lines 33-85)
- **Backend Route**: `server/routes/auth.routes.js` (lines 226-296)
- **Server Config**: `server/index.js` (route registration)

## Quick Fix Checklist

- [ ] Server is running on port 5000
- [ ] Frontend is served on port 3000
- [ ] Database connection is successful
- [ ] At least one user exists in database
- [ ] No JavaScript errors in browser console
- [ ] Network tab shows API request when submitting
- [ ] Correct test credentials being used

---

**Status**: Awaiting browser console output and user feedback to diagnose further.
