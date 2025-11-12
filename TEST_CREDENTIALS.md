# 🔐 Test Credentials for ITER EduHub

## ✅ Database Seeded Successfully!

The database now has **223 users** ready for testing:
- **3 Admin accounts**
- **20 Teacher accounts**  
- **200 Student accounts**

---

## 📝 Test Credentials

### Student Accounts
Use any of these student accounts:

| Registration Number | Password | Department | Year | Section |
|---------------------|----------|------------|------|---------|
| STU20250001 | Student@123 | CSE | 2 | A |
| STU20250002 | Student@123 | CSE | 2 | A |
| STU20250003 | Student@123 | CSE | 2 | B |
| ... | ... | ... | ... | ... |
| STU20250200 | Student@123 | Various | Various | Various |

**Quick Login:**
- **Registration**: `STU20250001`
- **Password**: `Student@123`

### Teacher Accounts

| Registration Number | Password | Department | Subjects |
|---------------------|----------|------------|----------|
| TEA20250001 | Teacher@123 | CSE | Programming |
| TEA20250002 | Teacher@123 | MECH | Mechanics |
| TEA20250003 | Teacher@123 | EEE | Circuits |
| ... | ... | ... | ... |
| TEA20250020 | Teacher@123 | Various | Various |

**Quick Login:**
- **Registration**: `TEA20250001`
- **Password**: `Teacher@123`

### Admin Accounts

| Registration Number | Password | Role |
|---------------------|----------|------|
| ADM20250001 | Admin@123 | Super Admin |
| ADM20250002 | Admin@123 | Admin |
| ADM20250003 | Admin@123 | Admin |

**Quick Login:**
- **Registration**: `ADM20250001`
- **Password**: `Admin@123`

---

## 🚀 How to Test Login

1. **Open the login page**: http://localhost:3000/login.html

2. **Enter credentials**:
   - Registration Number: `STU20250001`
   - Password: `Student@123`

3. **Click Login**

4. **Check browser console** (Press F12):
   - Should see "Login form initialized"
   - Should see "Login form submitted"
   - Should see "Login response"
   
5. **Expected behavior**:
   - Button changes to "Logging in..."
   - Success message appears
   - Redirects to dashboard after 0.5 seconds

---

## 🔍 Troubleshooting

### If login still doesn't work:

1. **Check Browser Console** (F12):
   - Look for any red error messages
   - Check if "APP object loaded: true" appears
   
2. **Check Network Tab** (F12 → Network):
   - Should see POST request to `http://localhost:5000/api/auth/login`
   - Check response status (should be 200 OK)

3. **Common Issues**:
   - **APP not loaded**: Refresh page
   - **CORS error**: Already configured, shouldn't occur
   - **404 Not Found**: Check server is running on port 5000
   - **401 Unauthorized**: Wrong credentials (use exact case)

---

## 📊 What's in the Database

The seed script created:
- ✅ 223 users (3 admins, 20 teachers, 200 students)
- ✅ Attendance records (3 months of data)
- ✅ Grade/marks records for all students
- ✅ Department assignments
- ✅ Section assignments
- ✅ Active status enabled

---

## 🎯 Testing Different Roles

### Test as Student:
```
Registration: STU20250001
Password: Student@123
→ Redirects to: /dashboard/student.html
```

### Test as Teacher:
```
Registration: TEA20250001
Password: Teacher@123
→ Redirects to: /dashboard/teacher.html
```

### Test as Admin:
```
Registration: ADM20250001
Password: Admin@123
→ Redirects to: /dashboard/admin.html
```

---

## ✨ New Features Added

1. **Console logging** - See exactly what's happening during login
2. **Better error handling** - More descriptive error messages
3. **DOM ready check** - Ensures form loads properly
4. **APP availability check** - Verifies API helper is loaded

---

## 🔧 If You See Errors

**"APP object not loaded!"**
- Refresh the page
- Check if `js/main.js` loaded successfully

**"Login failed. Please check your credentials."**
- Double-check registration number and password
- Make sure to use exact case (capital letters)

**No error message appears**
- Open browser console (F12)
- Look for red error messages
- Share the error with me

---

**Server Status**: ✅ Running on http://localhost:3000 and http://localhost:5000  
**Database**: ✅ Seeded with 223 test users  
**Login Page**: ✅ Updated with debugging features

**Try logging in now with: STU20250001 / Student@123**
