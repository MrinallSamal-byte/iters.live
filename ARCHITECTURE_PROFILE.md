# Profile Feature - Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENT BROWSER                             │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    HTML Page (Any Page)                       │  │
│  │                                                               │  │
│  │  ┌─────────────────────────────────────────────────────┐    │  │
│  │  │  <div id="profileControlContainer"></div>           │    │  │
│  │  │                                                      │    │  │
│  │  │  ┌──────────────────────────────────────────────┐  │    │  │
│  │  │  │     Profile Avatar Button                    │  │    │  │
│  │  │  │     [Avatar Image + Status Indicator]        │  │    │  │
│  │  │  └──────────────────────────────────────────────┘  │    │  │
│  │  │         │                                           │    │  │
│  │  │         ↓ (click)                                  │    │  │
│  │  │  ┌──────────────────────────────────────────────┐  │    │  │
│  │  │  │     Glassmorphism Dropdown Menu              │  │    │  │
│  │  │  │  • View Profile                              │  │    │  │
│  │  │  │  • Show ID Card                              │  │    │  │
│  │  │  │  • Change Photo                              │  │    │  │
│  │  │  │  • Settings                                  │  │    │  │
│  │  │  │  • Logout                                    │  │    │  │
│  │  │  └──────────────────────────────────────────────┘  │    │  │
│  │  └─────────────────────────────────────────────────────┘    │  │
│  │                                                               │  │
│  │  MODALS (Loaded Dynamically):                                │  │
│  │  ┌──────────────────────┐  ┌──────────────────────┐         │  │
│  │  │  Profile Edit Panel  │  │  ID Card Modal       │         │  │
│  │  │  (Side Slide-In)     │  │  (Full Screen)       │         │  │
│  │  └──────────────────────┘  └──────────────────────┘         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  JavaScript Components:                                             │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  profile.js - ProfileControl Class                           │  │
│  │  • Event Handlers (click, keyboard, file upload)             │  │
│  │  • API Communication (fetch)                                 │  │
│  │  • Socket.IO Client Connection                               │  │
│  │  • State Management (currentUser, dropdownOpen, etc.)        │  │
│  │  • UI Updates (animations, progress, success)                │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Styles:                                                             │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  profile.css                                                  │  │
│  │  • Glassmorphism effects (backdrop-filter, blur)             │  │
│  │  • Animations (scale, fade, slide, pulse)                    │  │
│  │  • Responsive breakpoints                                    │  │
│  │  • Dark mode (@media prefers-color-scheme)                   │  │
│  │  • Accessibility (focus-visible, reduced-motion)             │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/HTTPS
                              │ (JWT in Authorization header)
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                           NODE.JS SERVER                             │
│                                                                      │
│  Express.js Application (server/index.js)                           │
│                                                                      │
│  Middleware Stack:                                                   │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  1. Helmet (Security Headers)                                │  │
│  │  2. CORS (Cross-Origin)                                      │  │
│  │  3. Rate Limiting (5 uploads/15min)                          │  │
│  │  4. Body Parser (JSON, URL-encoded)                          │  │
│  │  5. Compression (Gzip)                                       │  │
│  │  6. Morgan (HTTP Logging)                                    │  │
│  │  7. Static Files (/uploads, /client)                         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  API Routes:                                                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  /api/auth/*                                                 │  │
│  │  ├── POST /login       → Generate JWT                        │  │
│  │  └── POST /logout      → Invalidate token                    │  │
│  │                                                               │  │
│  │  /api/users/me         (JWT Required)                        │  │
│  │  ├── GET              → profile.controller.getCurrentUser()  │  │
│  │  └── PUT              → profile.controller.updateProfile()   │  │
│  │                                                               │  │
│  │  /api/profile/*        (JWT Required)                        │  │
│  │  ├── POST /photo      → profile.controller.uploadPhoto()     │  │
│  │  │                      + Multer Middleware (2MB limit)      │  │
│  │  │                      + Rate Limiter                        │  │
│  │  └── DELETE /photo    → profile.controller.deletePhoto()     │  │
│  │                                                               │  │
│  │  /api/admitcard/*      (JWT Required)                        │  │
│  │  ├── GET /:id         → admitcard.controller.getAdmitCard()  │  │
│  │  ├── GET /:id/download→ admitcard.controller.download()      │  │
│  │  └── POST /upload     → admitcard.controller.upload()        │  │
│  │                          (Admin/Teacher only)                │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Controllers (Business Logic):                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  profile.controller.js                                        │  │
│  │  • Validate input                                             │  │
│  │  • Calculate checksums (SHA256)                               │  │
│  │  • Database operations                                        │  │
│  │  • File system operations                                     │  │
│  │  • Socket.IO emit events                                      │  │
│  │  • Activity logging                                           │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  File Upload Pipeline:                                               │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Client File → Multer → Validation → Save to Disk →          │  │
│  │  → Checksum → DB Insert → Update User → Socket Emit          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Authentication Flow:                                                │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  JWT Token in Header → middleware/auth.js → verify() →       │  │
│  │  → Decode payload → Load user from DB → Attach to req.user   │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ mysql2 (Connection Pool)
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                           MySQL DATABASE                             │
│                                                                      │
│  Tables:                                                             │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  users                                                        │  │
│  │  ├── id (PK)                                                  │  │
│  │  ├── name                                                     │  │
│  │  ├── registration_number (UNIQUE)                            │  │
│  │  ├── email (UNIQUE)                                          │  │
│  │  ├── password (bcrypt hash)                                  │  │
│  │  ├── role (student/teacher/admin)                            │  │
│  │  ├── phone                                                    │  │
│  │  ├── department                                               │  │
│  │  ├── year, section                                            │  │
│  │  ├── profile_pic (URL)        ← Updated by upload            │  │
│  │  ├── refresh_token                                            │  │
│  │  └── created_at, updated_at                                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  files                                                        │  │
│  │  ├── id (PK)                                                  │  │
│  │  ├── original_name                                            │  │
│  │  ├── stored_name (UUID + extension)                          │  │
│  │  ├── mime                                                     │  │
│  │  ├── size                                                     │  │
│  │  ├── checksum (SHA256)        ← For integrity                │  │
│  │  ├── uploaded_by (FK → users.id)                             │  │
│  │  ├── public_url                                               │  │
│  │  ├── file_type (avatar/admit_card/etc)                       │  │
│  │  ├── approved                                                 │  │
│  │  ├── download_count            ← Incremented on download     │  │
│  │  └── created_at                                               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  admit_cards                                                  │  │
│  │  ├── id (PK)                                                  │  │
│  │  ├── user_id (FK → users.id)                                 │  │
│  │  ├── file_id (FK → files.id)                                 │  │
│  │  ├── exam_code                                                │  │
│  │  ├── exam_name                                                │  │
│  │  ├── exam_date                                                │  │
│  │  ├── is_active                                                │  │
│  │  └── created_at                                               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  activity_log                 ← Audit Trail                  │  │
│  │  ├── id (PK)                                                  │  │
│  │  ├── user_id (FK → users.id)                                 │  │
│  │  ├── action (profile_updated, profile_photo_changed, etc)    │  │
│  │  ├── entity_type, entity_id                                  │  │
│  │  ├── meta (JSON - additional data)                           │  │
│  │  ├── ip_address                                               │  │
│  │  ├── user_agent                                               │  │
│  │  └── created_at                                               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Indexes:                                                            │
│  • users(registration_number), users(email)                         │
│  • files(uploaded_by), files(checksum), files(file_type)            │
│  • admit_cards(user_id), admit_cards(file_id)                       │
│  • activity_log(user_id), activity_log(action)                      │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ File System (uploads/)
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                         FILE STORAGE                                 │
│                                                                      │
│  uploads/                                                            │
│  ├── avatars/                                                        │
│  │   ├── default-avatar.png                                         │
│  │   ├── demo-avatar.png                                            │
│  │   └── <uuid>.jpg/png/webp/gif        ← User uploads             │
│  │                                                                   │
│  ├── admitcards/                                                     │
│  │   ├── admitcard-SOA2025001.pdf       ← Demo                     │
│  │   └── <uuid>.pdf                      ← Uploaded by admin       │
│  │                                                                   │
│  └── (other folders: assignments, notes, misc)                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    SOCKET.IO REAL-TIME LAYER                         │
│                                                                      │
│  Server Rooms:                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  user-<id>              → Individual user notifications       │  │
│  │  role:student           → All students                         │  │
│  │  role:teacher           → All teachers                         │  │
│  │  dept-CSE-year-2        → Department & year group             │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Events Emitted:                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  user:photo:changed     → { userId, profile_pic }             │  │
│  │  user:updated           → { userId, name, department }        │  │
│  │  admitcard:uploaded     → { exam_code, public_url }           │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Client Listeners (in profile.js):                                  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  socket.on('user:photo:changed', ...) → Update avatar         │  │
│  │  socket.on('user:updated', ...) → Update name/info            │  │
│  │  socket.on('admitcard:uploaded', ...) → Show notification     │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════
                        DATA FLOW EXAMPLES
═══════════════════════════════════════════════════════════════════════

EXAMPLE 1: User Uploads Profile Photo
┌─────────┐
│ Client  │  1. User selects image file
└────┬────┘
     │ 2. profile.js validates (type, size)
     │ 3. Creates FormData with 'avatar' field
     │ 4. XHR POST to /api/profile/photo with JWT
     ↓
┌────────────┐
│   Server   │  5. Auth middleware verifies JWT
└─────┬──────┘  6. Multer saves to uploads/avatars/<uuid>.jpg
      │ 7. Calculate SHA256 checksum
      │ 8. Insert record into files table
      │ 9. Update users.profile_pic
      │ 10. Insert activity_log entry
      │ 11. Emit Socket.IO 'user:photo:changed' event
      ↓
┌──────────┐
│ Database │  12. Files record created
└─────┬────┘  13. Users.profile_pic updated
      │
      ↓
┌────────────┐
│ All Clients│  14. Socket listeners receive event
└─────┬──────┘  15. Update avatar image (fade transition)
      │
      ↓
┌──────────┐
│  Success │  16. Show success animation
└──────────┘  17. Hide progress bar

EXAMPLE 2: View Admit Card
┌─────────┐
│ Client  │  1. User clicks "Show ID Card"
└────┬────┘
     │ 2. profile.js opens modal
     │ 3. GET /api/admitcard/:student_id with JWT
     ↓
┌────────────┐
│   Server   │  4. Auth middleware verifies JWT
└─────┬──────┘  5. Check authorization (own card or admin)
      │ 6. Query admit_cards JOIN files JOIN users
      │ 7. Return admit card metadata + public_url
      ↓
┌──────────┐
│ Database │  8. Fetch from admit_cards, files, users tables
└─────┬────┘
      │
      ↓
┌─────────┐
│ Client  │  9. Populate modal with data
└─────────┘  10. Embed PDF or show image preview
             11. Enable Download/Print buttons

EXAMPLE 3: Download Admit Card
┌─────────┐
│ Client  │  1. User clicks "Download PDF"
└────┬────┘
     │ 2. GET /api/admitcard/:student_id/download
     ↓
┌────────────┐
│   Server   │  3. Verify JWT + authorization
└─────┬──────┘  4. Fetch file path from database
      │ 5. Stream file with Content-Disposition header
      │ 6. Increment files.download_count
      │ 7. Insert activity_log entry
      ↓
┌──────────┐
│ Database │  8. Update download_count
└─────┬────┘  9. Insert activity log
      │
      ↓
┌─────────┐
│ Client  │  10. Browser saves file
└─────────┘  11. Show success toast

═══════════════════════════════════════════════════════════════════════
                        SECURITY LAYERS
═══════════════════════════════════════════════════════════════════════

Layer 1: Network
├── HTTPS (TLS encryption)
├── CORS whitelist
└── Helmet security headers

Layer 2: Authentication
├── JWT tokens (signed with secret)
├── Token expiry (1 hour)
└── Refresh token rotation

Layer 3: Authorization
├── Role-based access (student/teacher/admin)
├── Resource ownership check (user can edit own profile)
└── Admit card access control

Layer 4: Input Validation
├── File type whitelist (images, PDFs)
├── File size limits (2MB avatars, 10MB docs)
├── SQL prepared statements (injection prevention)
└── Filename sanitization (path traversal prevention)

Layer 5: Rate Limiting
├── API rate limit (100 req/15min)
├── Upload rate limit (5 uploads/15min)
└── Per-IP limiting

Layer 6: Audit Trail
├── Activity logging (all actions)
├── IP address tracking
├── User agent logging
└── Timestamp recording

═══════════════════════════════════════════════════════════════════════
```

## Integration Points

### Adding Profile Control to New Pages

1. **Include CSS**: `<link rel="stylesheet" href="/css/profile.css">`
2. **Add Container**: `<div id="profileControlContainer"></div>`
3. **Load Script**: `<script src="/js/profile-loader.js"></script>`

### Extending Functionality

- **Add Fields**: Update `top-right-profile.html` form
- **New Endpoints**: Add to `profile.routes.js`
- **Custom Actions**: Extend `ProfileControl` class in `profile.js`
- **Styling**: Override in your own CSS after loading `profile.css`

### Socket.IO Events

Listen for events in your own code:
```javascript
socket.on('user:photo:changed', (data) => {
    console.log('User changed photo:', data);
    // Your custom logic
});
```

---

**This diagram represents the complete architecture of the profile feature implementation.**
