# 🚀 Quick Start Guide - Profile Feature

## Prerequisites
- Node.js v16+ installed
- MySQL 8+ installed and running
- Git (optional)

## Step-by-Step Setup

### 1️⃣ Install Dependencies
```bash
npm install
```

### 2️⃣ Configure Environment
Create/update `.env` file in the project root:

```env
# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=college_db

# JWT
JWT_SECRET=your_super_secret_jwt_key_min_32_characters_long
JWT_EXPIRES_IN=1h

# Server
PORT=5000
NODE_ENV=development
```

### 3️⃣ Create Database
```bash
mysql -u root -p
```

In MySQL shell:
```sql
CREATE DATABASE IF NOT EXISTS college_db;
USE college_db;
```

### 4️⃣ Run Migrations
**Option A: Copy and paste SQL**
```bash
npm run migrate:profile
```
Copy the displayed SQL and run it in MySQL.

**Option B: Run SQL file directly**
```bash
mysql -u root -p college_db < server/database/migrations/create-profile-tables.sql
```

### 5️⃣ Seed Demo Data
```bash
npm run seed:profile
```

This creates:
- Demo user: `SOA2025001` / `Password123!`
- Sample avatar
- Sample admit card

### 6️⃣ Start Server
```bash
npm run dev
```

Server runs on: `http://localhost:5000`  
Client dev server: `http://localhost:3000`

### 7️⃣ Test the Feature

#### Open Example Page
Navigate to: `http://localhost:3000/example-with-profile.html`

#### Or Test API Directly

**Get Auth Token (Login)**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "registration_number": "SOA2025001",
    "password": "Password123!"
  }'
```

Save the `token` from response.

**Get Profile**
```bash
curl -X GET http://localhost:5000/api/users/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Upload Photo**
```bash
curl -X POST http://localhost:5000/api/profile/photo \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -F "avatar=@/path/to/your/photo.jpg"
```

## ✅ Verify Installation

### Check Database Tables
```sql
USE college_db;
SHOW TABLES;
-- Should show: users, files, admit_cards, activity_log, sessions
```

### Check Demo User
```sql
SELECT * FROM users WHERE registration_number = 'SOA2025001';
```

### Check Upload Directories
```bash
ls uploads/avatars/
ls uploads/admitcards/
```

Should see `demo-avatar.png` and `admitcard-SOA2025001.pdf`

## 🎨 Integration in Your Pages

### Add to Existing HTML
```html
<!-- In <head> -->
<link rel="stylesheet" href="/css/profile.css">

<!-- In header, where you want the profile button -->
<div id="profileControlContainer"></div>

<!-- Before </body> -->
<script src="/socket.io/socket.io.js"></script>
<script>
  // Load profile control
  fetch('/partials/top-right-profile.html')
    .then(res => res.text())
    .then(html => {
      document.getElementById('profileControlContainer').innerHTML = html;
      return fetch('/partials/idcard-modal.html');
    })
    .then(res => res.text())
    .then(html => {
      document.body.insertAdjacentHTML('beforeend', html);
    });
</script>
<script src="/js/profile.js"></script>
```

## 🐛 Common Issues

### Port Already in Use
```bash
# Change PORT in .env
PORT=5001
```

### MySQL Connection Error
- Check MySQL is running: `sudo systemctl status mysql`
- Verify credentials in `.env`
- Check user has database privileges

### Uploads Directory Not Found
```bash
mkdir -p uploads/avatars uploads/admitcards
```

### JWT Token Invalid
- Make sure `JWT_SECRET` is at least 32 characters
- Re-login to get fresh token

## 📚 Next Steps

1. **Customize Styles**: Edit `client/css/profile.css`
2. **Add More Fields**: Update form in `client/partials/top-right-profile.html`
3. **Modify API**: Edit controllers in `server/controllers/`
4. **Add Validation**: Update in `server/routes/*.routes.js`

## 🔗 Resources

- Full Documentation: `PROFILE_FEATURE.md`
- API Endpoints: See section in docs
- Database Schema: `server/database/migrations/create-profile-tables.sql`

## 💡 Tips

- Use Chrome DevTools → Network tab to debug API calls
- Check browser console for JavaScript errors
- Use `console.log` in `profile.js` for debugging
- Monitor server logs for backend errors

---

**Need Help?** Check the full documentation in `PROFILE_FEATURE.md`

**Happy Coding! 🎉**
