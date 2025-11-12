# 🎓 Profile Feature - README

## Quick Links

- 📖 **[Full Documentation](PROFILE_FEATURE.md)** - Complete feature guide
- 🚀 **[Quick Start Guide](QUICKSTART_PROFILE.md)** - Get started in 5 minutes
- 📋 **[Implementation Summary](PROFILE_IMPLEMENTATION_SUMMARY.md)** - What's been built

## What Is This?

A **production-ready** top-right profile control with ID/Admit Card modal for the ITER/SOA College Management System. Features:

- ✨ Animated glassmorphism dropdown
- 📸 Photo upload with progress tracking
- 📝 Profile editing (name, phone, department, etc.)
- 🎫 ID/Admit card viewer with PDF download
- 🔔 Real-time updates via Socket.IO
- ♿ Fully accessible (ARIA, keyboard navigation)
- 📱 Responsive and mobile-friendly
- 🌙 Dark mode support

## Installation

### 1. Setup Environment
```bash
# Create .env file (or update existing)
echo "DB_HOST=localhost" >> .env
echo "DB_USER=root" >> .env
echo "DB_PASSWORD=your_password" >> .env
echo "DB_NAME=college_db" >> .env
echo "JWT_SECRET=your_32_character_secret_key" >> .env
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Database
```bash
# Create upload directories
npm run setup:uploads

# View migration SQL
npm run migrate:profile

# Copy the SQL output and run in MySQL, OR:
mysql -u root -p college_db < server/database/migrations/create-profile-tables.sql
```

### 4. Seed Demo Data
```bash
npm run seed:profile
```

Creates demo user: `SOA2025001` / `Password123!`

### 5. Start Server
```bash
npm run dev
```

Visit: `http://localhost:3000/simple-integration-example.html`

## Usage in Your Pages

### Method 1: Auto-Loader (Easiest) ⭐

```html
<!-- In your HTML -->
<div id="profileControlContainer"></div>

<!-- At end of body -->
<script src="/js/profile-loader.js"></script>
```

**That's it!** Everything loads automatically.

### Method 2: Manual Loading

```html
<head>
    <link rel="stylesheet" href="/css/profile.css">
</head>
<body>
    <!-- Your page content -->
    
    <div id="profileControlContainer"></div>
    
    <script src="/socket.io/socket.io.js"></script>
    <script>
        // Load HTML partials
        Promise.all([
            fetch('/partials/top-right-profile.html').then(r => r.text()),
            fetch('/partials/idcard-modal.html').then(r => r.text())
        ]).then(([profileHTML, modalHTML]) => {
            document.getElementById('profileControlContainer').innerHTML = profileHTML;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
        });
    </script>
    <script src="/js/profile.js"></script>
</body>
```

## Examples

| File | Description |
|------|-------------|
| `simple-integration-example.html` | Easiest method (auto-loader) |
| `example-with-profile.html` | Manual integration with styling |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/me` | Get current user |
| PUT | `/api/users/me` | Update profile |
| POST | `/api/profile/photo` | Upload photo |
| GET | `/api/admitcard/:id` | Get admit card |
| GET | `/api/admitcard/:id/download` | Download PDF |

All require `Authorization: Bearer <token>` header.

## Testing

### Login
1. Go to `/login.html`
2. Enter: `SOA2025001` / `Password123!`

### Test Profile Control
1. Click avatar in top-right
2. Try all menu options:
   - View Profile → Edit and save
   - Show ID Card → View and download
   - Change Photo → Upload image
   - Logout

### API Testing
```bash
# Get token first
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"registration_number":"SOA2025001","password":"Password123!"}'

# Then test endpoints
curl http://localhost:5000/api/users/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## File Structure

```
├── server/
│   ├── controllers/
│   │   ├── profile.controller.js       # Profile logic
│   │   └── admitcard.controller.js     # Admit card logic
│   ├── routes/
│   │   ├── profile.routes.js           # Profile endpoints
│   │   └── admitcard.routes.js         # Admit card endpoints
│   ├── config/
│   │   └── multer.js                   # File upload config
│   ├── utils/
│   │   └── file.util.js                # File helpers
│   ├── database/migrations/
│   │   └── create-profile-tables.sql   # DB schema
│   └── seed/
│       └── seed-profile.js             # Demo data
├── client/
│   ├── partials/
│   │   ├── top-right-profile.html      # Profile UI
│   │   └── idcard-modal.html           # Modal UI
│   ├── css/
│   │   └── profile.css                 # Styles
│   ├── js/
│   │   ├── profile.js                  # Main logic
│   │   └── profile-loader.js           # Auto-loader
│   ├── simple-integration-example.html # Simple demo
│   └── example-with-profile.html       # Full demo
└── uploads/
    ├── avatars/                        # Profile photos
    └── admitcards/                     # PDF files
```

## Features

### Security ✅
- JWT authentication
- File validation (type, size)
- Rate limiting (5 uploads/15min)
- SQL injection prevention
- Path traversal protection
- Activity logging

### Accessibility ♿
- ARIA labels and roles
- Keyboard navigation (Tab, Enter, Esc)
- Focus management
- Screen reader friendly
- 44px+ touch targets
- Reduced motion support

### UX ✨
- Smooth animations (120ms)
- Glassmorphism design
- Upload progress tracking
- Success animations
- Error handling
- Real-time updates
- Dark mode support

## Troubleshooting

### Profile avatar not showing
- Check uploads folder exists: `npm run setup:uploads`
- Verify `/uploads` route in `server/index.js`

### "No auth token"
- User must be logged in
- Token stored in `localStorage.token`

### Upload fails
- Check file size < 2MB
- Verify file type (JPG/PNG/WEBP/GIF)

### Socket.IO not connecting
- Check server is running
- Verify CORS settings in `.env`

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run seed:profile` | Create demo data |
| `npm run migrate:profile` | Show migration SQL |
| `npm run setup:uploads` | Create upload folders |

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- iOS Safari 14+
- Chrome Mobile 90+

## Tech Stack

- **Backend**: Node.js, Express, MySQL
- **Auth**: JWT (jsonwebtoken)
- **Upload**: Multer
- **Real-time**: Socket.IO
- **Frontend**: Vanilla JS, CSS3
- **Design**: Glassmorphism, CSS animations

## License

MIT - Part of ITER College Management System

## Support

1. Check documentation: `PROFILE_FEATURE.md`
2. Review examples in `client/` folder
3. Check console for errors
4. Verify database migration ran
5. Ensure seed data loaded

---

**Made with ❤️ for ITER/SOA**

Ready to use? Run `npm run dev` and visit:
- `http://localhost:3000/simple-integration-example.html`
