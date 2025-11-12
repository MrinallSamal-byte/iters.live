# Profile Feature Documentation

## Overview
Complete implementation of a polished top-right profile control with ID/Admit Card modal and Change Photo functionality for the ITER/SOA College Management System.

## Features Implemented

### 1. **Top-Right Profile Control**
- ✅ Avatar button with online status indicator
- ✅ Animated glassmorphism dropdown menu
- ✅ Profile summary (avatar, name, registration number)
- ✅ Quick actions: View Profile, Show ID Card, Change Photo, Settings, Logout
- ✅ Fully keyboard accessible (Tab, Enter, Escape)
- ✅ Responsive and mobile-friendly

### 2. **Change Photo Flow**
- ✅ Drag & drop + click-to-select file input
- ✅ Client-side image preview
- ✅ Real upload with progress tracking
- ✅ File validation (type: JPG/PNG/WEBP/GIF, size: 2MB max)
- ✅ Multer backend processing
- ✅ SHA256 checksum calculation
- ✅ Database record in `files` table
- ✅ `users.profile_pic` field updated
- ✅ Activity logging
- ✅ Animated success feedback with Lottie-style checkmark
- ✅ Socket.IO real-time broadcast

### 3. **View Profile Panel**
- ✅ Slide-out side panel with editable fields
- ✅ Fields: Name, Phone, Department, Year, Section
- ✅ PUT `/api/users/me` endpoint
- ✅ Form validation
- ✅ Socket.IO broadcast on update
- ✅ Smooth animations

### 4. **ID/Admit Card Modal**
- ✅ Full-screen modal with preview
- ✅ Student information display
- ✅ Document preview (PDF embed, image, or text)
- ✅ Download PDF functionality
- ✅ Print option
- ✅ Download counter tracking
- ✅ Authorization checks (student can view own, admin/teacher can view all)

### 5. **Backend API**
All endpoints with JWT authentication:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/me` | Get current user profile |
| PUT | `/api/users/me` | Update profile fields |
| POST | `/api/profile/photo` | Upload profile photo (2MB limit, field: `avatar`, rate-limited) |
| DELETE | `/api/profile/photo` | Remove profile photo |
| GET | `/api/admitcard/:student_id` | Get admit card details |
| GET | `/api/admitcard/:student_id/download` | Download admit card PDF |
| POST | `/api/admitcard/upload` | Upload admit card (admin/teacher only) |

### 6. **Database Schema**
Tables created:
- **`users`**: Extended with `profile_pic`, `phone`, `department`, `year`, `section`
- **`files`**: Stores all uploaded files with checksums and metadata
- **`admit_cards`**: Links users to their admit card files
- **`activity_log`**: Audit trail for all profile actions
- **`sessions`**: Manages refresh tokens

### 7. **Socket.IO Events**
Real-time updates:
- `user:photo:changed` — Broadcast when profile photo changes
- `user:updated` — Broadcast when profile info changes
- `admitcard:uploaded` — Notify student when admit card is uploaded

### 8. **Security & Best Practices**
- ✅ JWT authentication on all endpoints
- ✅ File validation (MIME type, size)
- ✅ SQL injection prevention (prepared statements)
- ✅ Path traversal protection
- ✅ Rate limiting on upload endpoints (5 uploads per 15 minutes)
- ✅ Activity logging for audit trail
- ✅ Checksum verification for files

---

## Setup Instructions

### 1. Install Dependencies
All required dependencies are already in `package.json`. If you need to install them:

```bash
npm install
```

**Key dependencies:**
- `multer` — File upload handling
- `bcrypt` — Password hashing
- `jsonwebtoken` — JWT authentication
- `mysql2` — MySQL database driver
- `socket.io` — Real-time communication
- `express-rate-limit` — API rate limiting

### 2. Environment Variables
Ensure your `.env` file includes:

```env
# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=college_db

# JWT
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Server
PORT=5000
NODE_ENV=development

# Socket.IO
SOCKET_CORS_ORIGIN=http://localhost:3000

# CORS
CORS_WHITELIST=http://localhost:3000,http://localhost:5000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 3. Run Database Migration
Run the SQL migration to create required tables:

**Option A: View SQL to run manually**
```bash
npm run migrate:profile
```
Copy the output SQL and run it in your MySQL client (phpMyAdmin, MySQL Workbench, or CLI).

**Option B: Run directly (if using Node.js MySQL client)**
```bash
mysql -u root -p college_db < server/database/migrations/create-profile-tables.sql
```

### 4. Seed Demo Data
Run the seed script to create demo user and sample files:

```bash
npm run seed:profile
```

This will create:
- **Demo User**
  - Name: Demo Student
  - Registration No: `SOA2025001`
  - Password: `Password123!`
  - Email: demo.student@college.edu
  - Department: CSE, Year 2, Section A
- **Avatar**: `/uploads/avatars/demo-avatar.png`
- **Admit Card**: `/uploads/admitcards/admitcard-SOA2025001.pdf`

### 5. Start the Server
```bash
npm run dev
```

The server will start on `http://localhost:5000` and the client dev server on `http://localhost:3000`.

### 6. Integrate Frontend HTML
To use the profile control in your pages, add these includes in your HTML files:

#### In the `<head>` section:
```html
<link rel="stylesheet" href="/css/profile.css">
```

#### In the header (top-right corner):
```html
<!-- Include the profile control partial -->
<div id="profileControlContainer"></div>

<script>
  // Load profile control HTML
  fetch('/partials/top-right-profile.html')
    .then(res => res.text())
    .then(html => {
      document.getElementById('profileControlContainer').innerHTML = html;
    });
</script>
```

#### Before closing `</body>`:
```html
<!-- Socket.IO client -->
<script src="/socket.io/socket.io.js"></script>

<!-- Profile control JS -->
<script src="/js/profile.js"></script>

<!-- Load ID Card modal HTML -->
<script>
  fetch('/partials/idcard-modal.html')
    .then(res => res.text())
    .then(html => {
      document.body.insertAdjacentHTML('beforeend', html);
    });
</script>
```

**Or** use a simple include script at the top of your page:

```javascript
// client/js/include-profile.js
(async function() {
  const profileHTML = await fetch('/partials/top-right-profile.html').then(r => r.text());
  const modalHTML = await fetch('/partials/idcard-modal.html').then(r => r.text());
  
  const container = document.getElementById('profileControlContainer');
  if (container) {
    container.innerHTML = profileHTML;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }
})();
```

---

## Usage

### For Students

#### Login
1. Navigate to `/login.html`
2. Enter credentials:
   - Registration No: `SOA2025001`
   - Password: `Password123!`
3. Click **Login**

#### View Profile
1. Click avatar button in top-right
2. Click **View Profile**
3. Edit fields and click **Save Changes**

#### Change Photo
1. Click avatar button
2. Click **Change Photo** or drag-and-drop an image
3. Select image (JPG/PNG/WEBP, max 2MB)
4. Watch upload progress
5. See success animation

#### View/Download Admit Card
1. Click avatar button
2. Click **Show ID Card**
3. View admit card details and preview
4. Click **Download PDF** to save locally
5. Click **Print** to print

#### Logout
1. Click avatar button
2. Click **Logout**
3. Confirm logout

### For Admin/Teachers

#### Upload Admit Card for Student
```bash
curl -X POST http://localhost:5000/api/admitcard/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "admitCard=@path/to/admit_card.pdf" \
  -F "user_id=1" \
  -F "exam_code=ESE-2025-01" \
  -F "exam_name=End Semester Examination 2025" \
  -F "exam_date=2025-01-15"
```

Or use Postman:
- Method: POST
- URL: `http://localhost:5000/api/admitcard/upload`
- Headers: `Authorization: Bearer <token>`
- Body: form-data
  - `admitCard`: file
  - `user_id`: 1
  - `exam_code`: ESE-2025-01
  - `exam_name`: End Semester Examination 2025
  - `exam_date`: 2025-01-15

---

## API Testing

### Get Current User Profile
```bash
curl -X GET http://localhost:5000/api/users/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Update Profile
```bash
curl -X PUT http://localhost:5000/api/users/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Name",
    "phone": "+91-9876543210",
    "department": "CSE",
    "year": 2,
    "section": "A"
  }'
```

### Upload Profile Photo
```bash
curl -X POST http://localhost:5000/api/profile/photo \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "avatar=@path/to/photo.jpg"
```

### Get Admit Card
```bash
curl -X GET http://localhost:5000/api/admitcard/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Download Admit Card
```bash
curl -X GET http://localhost:5000/api/admitcard/1/download \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  --output admitcard.pdf
```

---

## File Structure

```
server/
├── config/
│   └── multer.js                 # Multer upload configuration
├── controllers/
│   ├── profile.controller.js     # Profile management logic
│   └── admitcard.controller.js   # Admit card logic
├── routes/
│   ├── profile.routes.js         # Profile API routes
│   └── admitcard.routes.js       # Admit card API routes
├── database/
│   └── migrations/
│       └── create-profile-tables.sql  # DB schema
├── seed/
│   └── seed-profile.js           # Demo data seeder
├── utils/
│   └── file.util.js              # File helpers (checksum, etc.)
└── middleware/
    └── auth.js                   # JWT auth middleware (updated)

client/
├── partials/
│   ├── top-right-profile.html    # Profile control HTML
│   └── idcard-modal.html         # Admit card modal HTML
├── css/
│   └── profile.css               # Profile styles (glassmorphism)
└── js/
    └── profile.js                # Profile control logic

uploads/
├── avatars/                      # Profile photos
└── admitcards/                   # Admit card PDFs
```

---

## Styling & Animations

### Glassmorphism
The profile dropdown uses a glassmorphism effect with:
- `backdrop-filter: blur(20px)`
- Semi-transparent background
- Subtle border and drop-shadow
- Smooth animations

### Animations
- **Dropdown open**: `transform: scale(0.95) → scale(1)` + fade-in (120ms ease-out)
- **Dropdown close**: fade-out (80ms ease-in)
- **Panel slide-in**: `translateX(100%) → translateX(0)` (300ms cubic-bezier)
- **Upload progress**: smooth width transition + pulse effect
- **Success checkmark**: SVG stroke animation (Lottie-style)
- **Avatar swap**: crossfade transition

### Dark Mode Support
All components support dark mode via `prefers-color-scheme: dark` media query.

---

## Troubleshooting

### Issue: Profile avatar not showing
**Solution:** Ensure `/uploads` route is configured in server and files exist:
```javascript
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
```

### Issue: "No auth token found"
**Solution:** User must be logged in. JWT token stored in `localStorage.token` or `sessionStorage.token`.

### Issue: Upload fails with "File too large"
**Solution:** Image must be < 2MB. Compress image or use a smaller file.

### Issue: Socket.IO not connecting
**Solution:** Check CORS settings and ensure Socket.IO client script is loaded:
```html
<script src="/socket.io/socket.io.js"></script>
```

### Issue: Admit card not found
**Solution:** Run seed script to create demo admit card:
```bash
npm run seed:profile
```

---

## Production Deployment

### 1. Set Environment Variables
```env
NODE_ENV=production
JWT_SECRET=<strong-random-secret>
DB_HOST=<production-db-host>
SOCKET_CORS_ORIGIN=https://yourdomain.com
```

### 2. Use HTTPS
Ensure all uploads and API calls use HTTPS in production.

### 3. Configure File Storage
For production, consider using cloud storage (AWS S3, Cloudinary) instead of local disk.

### 4. Enable Compression
Already enabled in `server/index.js`:
```javascript
app.use(compression());
```

### 5. Setup PM2
```bash
npm run pm2:start
```

---

## Browser Support

### Desktop
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

### Mobile
- ✅ iOS Safari 14+
- ✅ Chrome Mobile 90+
- ✅ Samsung Internet 14+

### Accessibility
- ✅ ARIA attributes (`aria-haspopup`, `aria-expanded`, `role="menu"`)
- ✅ Keyboard navigation (Tab, Enter, Escape)
- ✅ Focus trap in modals
- ✅ Large touch targets (44x44px minimum)
- ✅ Screen reader friendly
- ✅ Reduced motion support (`prefers-reduced-motion`)

---

## Future Enhancements

- [ ] Image cropping UI before upload
- [ ] Multiple profile photo history
- [ ] QR code on admit card
- [ ] Digital signature verification
- [ ] Bulk admit card upload (CSV)
- [ ] Student ID card generator
- [ ] Email notifications on admit card upload
- [ ] Profile completeness indicator

---

## License

MIT License - Part of ITER College Management System

---

## Support

For issues or questions:
1. Check this documentation
2. Review code comments in source files
3. Check browser console for errors
4. Verify database tables are created
5. Ensure seed data is loaded

**Happy Coding! 🚀**
