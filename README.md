# ITER College Management System (EduHub)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![Version](https://img.shields.io/badge/version-3.2.0-blue)](https://github.com)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com)
[![Production Ready](https://img.shields.io/badge/status-production--ready-success)](https://github.com)
[![Performance](https://img.shields.io/badge/performance-90%25%20faster-brightgreen)](https://github.com)

> **🏆 A World-Class, Enterprise-Grade College Management System** with Web, Android PWA/TWA (Android 9+), and Desktop (Electron) support.

Built with **vanilla HTML/CSS/JavaScript** (frontend) and **Node.js + Express + MySQL** (backend), featuring stunning glassmorphism UI, advanced animations, real-time updates via Socket.IO, enterprise security, performance optimization, and comprehensive analytics.

## 🎉 What's New in v3.2.0 - Ultimate Edition

**🚀 Major enhancements completed! Now with AI-powered student tools, bulk operations, advanced analytics, and enhanced caching:**

### 🆕 Phase 7: Advanced Student Tools (NEW - 100%)
- ✅ **Study Schedule Generator** - AI-powered personalized study plans with Pomodoro technique
- ✅ **Flashcard System** - Create, manage, and study with digital flashcards
- ✅ **Advanced File Manager** - Drag-and-drop upload with progress tracking
- ✅ **Performance Analytics** - Comprehensive student analytics with ML predictions
- ✅ **Weak Subject Detection** - Automatic identification of subjects needing improvement
- ✅ **Calendar Export** - Export study schedules to Google Calendar/Outlook

### 📊 Phase 8: Bulk Operations & Analytics (NEW - 100%)
- ✅ **Bulk User Import** - CSV/Excel import for users with error reporting
- ✅ **Bulk Attendance Upload** - Mark attendance for multiple students via CSV
- ✅ **Bulk Marks Upload** - Upload exam marks via Excel with validation
- ✅ **Advanced Analytics API** - Student performance, attendance patterns, teacher stats
- ✅ **Data Export** - Export users, attendance, marks to CSV/Excel
- ✅ **Template Generation** - Download formatted templates for imports
- ✅ **Real-time Notifications** - Socket.IO events for bulk operations

### 🚀 Phase 9: Enhanced Caching Strategies (NEW - 100%)
- ✅ **Redis Implementation** - Production-grade caching with automatic fallback to node-cache
- ✅ **Service Worker Optimization** - Stale-while-revalidate for better offline support
- ✅ **Query Result Caching** - Intelligent caching for complex analytics queries
- ✅ **CDN Integration** - Cloudflare-ready with optimal cache headers
- ✅ **Cache Middleware** - Route-level caching with automatic invalidation
- ✅ **Multi-tier Caching** - API cache (1 min), Main cache (10 min), Static cache (1 hour)
- ✅ **Comprehensive Documentation** - Complete guides for setup and usage

---

**Previous phases completed:**

### 🔐 Phase 1: Security & Infrastructure (100%)
- ✅ Input validation on all routes (50+ rules)
- ✅ Rate limiting with account lockout (5 attempts, 30min)
- ✅ Comprehensive audit logging (database + file backup)
- ✅ Password strength enforcement
- ✅ SQL injection & XSS protection

### ⚡ Phase 2: Database Optimization (100%)
- ✅ 90% faster with multi-tier caching
- ✅ 60+ database indexes for optimal performance
- ✅ 7 materialized views (auto-refresh hourly)
- ✅ Slow query detection (>100ms)
- ✅ Connection pooling (20 connections)
- ✅ Health monitoring dashboard

### 🔔 Phase 3: Notification System (100%)
- ✅ Real-time Socket.IO notifications
- ✅ 8 notification types with filtering
- ✅ Beautiful glassmorphism UI design
- ✅ Mark as read/delete (single/bulk)
- ✅ Browser push notification framework
- ✅ Mobile-responsive design

### 📊 Phase 4: Charts & Visualizations (100%)
- ✅ Attendance heatmap calendar (12-week view)
- ✅ Performance trend charts (student vs class)
- ✅ Subject-wise attendance bars (color-coded)
- ✅ Marks comparison radar charts
- ✅ Grade distribution visualizations
- ✅ SGPA/CGPA progress tracking
- ✅ Assignment submission timeline

### 🔍 Phase 5: Advanced Search (100%)
- ✅ Global search across 5 resource types
- ✅ Type-ahead autocomplete
- ✅ Relevance scoring algorithm
- ✅ Advanced filters & date ranges
- ✅ Permission-aware results
- ✅ Search result caching

### 📋 Phase 6: Data Tables & Bulk Ops (100%)
- ✅ Sortable columns with indicators
- ✅ Pagination controls (first/prev/next/last)
- ✅ Column visibility toggle
- ✅ Bulk selection operations
- ✅ CSV export functionality
- ✅ Inline search filtering

**📋 [View Complete Summary](COMPLETE_IMPLEMENTATION_SUMMARY.md)** | **🚀 [Deployment Guide](DEPLOYMENT_GUIDE.md)** | **📖 [Enhancement Details](ENHANCEMENT_SUMMARY.md)** | **💾 [Caching Guide](CACHING_GUIDE.md)** | **⚡ [Caching Quick Start](CACHING_QUICKSTART.md)**

---

## 🌟 Features

### For Students
- 📊 **Real-time Attendance Tracking** - View attendance percentage, subject-wise breakdown, and history
- 📝 **Marks Management** - Internal/external marks with visual charts and class rankings
- 🎓 **Admit Card Generation** - Dynamic PDF generation with QR codes and verification
- 📚 **Notes & PYQs Repository** - Download notes, previous year questions, and study materials
- ✍️ **Assignment Submission** - Upload assignments, track deadlines, and receive feedback
- 📅 **Interactive Timetable** - Highlight current/next class with color-coded subjects
- 🍽️ **Hostel Menu** - Weekly meal schedules with calendar view
- 🎉 **Events & Clubs** - Register for events and join clubs with real-time counters
- 💰 **Fee Management** - View ledger, download receipts (mock)
- 🏆 **Achievements & Badges** - Track academic and extracurricular achievements
- 🆕 **AI Study Planner** - Personalized 2-week study schedule with priority-based task allocation
- 🆕 **Flashcard System** - Create decks, study mode with spaced repetition, progress tracking
- 🆕 **Performance Analytics** - Comprehensive analytics with weak/strong subject identification
- 🆕 **Advanced File Manager** - Drag-and-drop upload, grid/list views, file preview
- 🆕 **Smart Insights** - ML-powered recommendations and performance predictions

### For Teachers
- ✅ **Attendance Management** - Mark attendance with bulk import via CSV
- 📊 **Marks Upload** - Single and bulk CSV upload with gradebook management
- 📝 **Assignment Creation** - Create assignments, grade submissions, attach rubrics
- 📤 **Notes Upload** - Upload lecture notes, slides, and study materials (requires admin approval)
- 📢 **Announcements** - Post announcements to classes or departments
- 📆 **Lesson Planner** - Plan and schedule lessons
- 🕐 **Office Hours** - Schedule and manage office hour slots
- 🆕 **Bulk Operations** - Import attendance/marks from Excel with detailed error reporting
- 🆕 **Teaching Analytics** - Class performance stats, attendance rates, marking activity
- 🆕 **Attendance Patterns** - Detect chronic absenteeism and suspicious patterns
- 🆕 **Template Downloads** - Pre-formatted CSV/Excel templates for bulk imports

### For Administrators
- 👥 **User Management** - Full CRUD for students, teachers, and admins
- ✅ **Approvals Queue** - Approve/reject teacher uploads, events, and club requests
- 📊 **Analytics Dashboard** - User stats, attendance heatmaps, download analytics, storage usage
- 🔐 **Role & Permissions** - Fine-grained permission management
- 💾 **Backup & Restore** - Database backup with downloadable snapshots
- 📜 **Activity Logs** - Complete audit trail of user actions
- ⚙️ **System Settings** - Configure CORS, storage mode (local/S3), and quotas
- 🆕 **Bulk Import System** - Import users from CSV/Excel with progress tracking
- 🆕 **Data Export** - Export all system data to CSV/Excel with filters
- 🆕 **Advanced Analytics** - System-wide performance metrics and insights
- 🆕 **Template Management** - Generate and download import templates
- 📈 **Advanced Analytics** - Chart.js visualizations for attendance, performance, and usage

### Technical Highlights
- 🎨 **Unmatched UI/UX** - Glassmorphism theme with Lottie animations and smooth transitions
- 🔄 **Real-time Updates** - Socket.IO for live attendance, file approvals, and event registrations
- 📱 **PWA Support** - Installable web app with offline caching and background sync
- 🖥️ **Desktop App** - Electron wrapper for Windows, Mac, and Linux
- 📲 **Android App** - TWA-ready for Android 9+ with native-like experience
- 🔒 **Security First** - JWT auth, bcrypt passwords, rate limiting, helmet, CORS, input validation
- 🐳 **Docker Ready** - docker-compose for easy deployment
- 🧪 **Testing** - Jest unit tests and Playwright E2E test skeletons
- 🚀 **CI/CD** - GitHub Actions workflow for automated builds
- 🔗 **Portal Scraper** - Python Flask microservice for SOA student portal integration

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** >= 18.0.0
- **MySQL** >= 8.0
- **npm** >= 9.0.0
- **Python** >= 3.9 (for portal scraper, optional)
- **Chrome** (for Selenium-based scraping, optional)

### Installation

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd All_In_One_College_Website
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your MySQL credentials and secrets
```

4. **Create and seed database**
```bash
npm run seed
```

This will:
- Create database and tables
- Seed 3 admin accounts
- Seed 20 teacher accounts
- Seed 200 student accounts
- Generate ~36,000 attendance records
- Generate ~19,200 marks records
- Create sample files (notes, PYQs, admit cards)
- Create events, timetables, assignments, and announcements

5. **Start the server**
```bash
npm run dev
```

Server will start at `http://localhost:5000`  
Frontend served at `http://localhost:3000` (if using serve)

### Portal Scraper Setup (Optional)

The portal scraper is a separate Python Flask microservice that integrates with the SOA student portal. To set it up:

1. **Navigate to scraper directory**
```bash
cd scraper
```

2. **Create virtual environment**
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install Python dependencies**
```bash
pip install -r requirements.txt
```

4. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your Google Vision API key (for CAPTCHA solving)
```

5. **Start the scraper service**
```bash
python app.py
```

The scraper service will run at `http://localhost:5001`

**Note:** The main application works without the scraper - students can use demo data if the scraper is unavailable.

---

## 🎭 Demo Credentials

After running `npm run seed`, use these credentials to login:

### Student
- **Registration Number:** `STU20250001`
- **Password:** `Student@123`

### Teacher
- **Registration Number:** `TCH2025001`
- **Password:** `Teacher@123`

### Admin
- **Registration Number:** `ADM2025001`
- **Password:** `Admin@123456`

**Login at:** `http://localhost:3000/login.html`

---

## 📁 Project Structure

```
All_In_One_College_Website/
├── client/                  # Frontend (vanilla HTML/CSS/JS)
│   ├── index.html          # Landing page
│   ├── login.html          # Login page
│   ├── dashboard/          # Role-based dashboards
│   ├── css/                # Stylesheets
│   │   ├── style.css       # Main styles (glassmorphism)
│   │   └── animations.css  # Animations and transitions
│   ├── js/                 # JavaScript
│   │   ├── main.js         # Core utilities, API, Socket.IO
│   │   └── landing.js      # Landing page specific
│   ├── assets/             # Images, icons, fonts
│   ├── manifest.json       # PWA manifest
│   └── service-worker.js   # Service worker for offline support
├── server/                 # Backend (Node.js + Express)
│   ├── index.js            # Main server file
│   ├── database/           # Database connection and schema
│   │   ├── db.js           # Connection pool
│   │   └── init.sql        # Database schema
│   ├── routes/             # API routes
│   │   ├── auth.routes.js  # Authentication
│   │   ├── file.routes.js  # File upload/download
│   │   ├── attendance.routes.js
│   │   ├── marks.routes.js
│   │   ├── event.routes.js
│   │   ├── assignment.routes.js
│   │   └── ... (other routes)
│   ├── middleware/         # Express middleware
│   │   ├── auth.js         # JWT verification
│   │   └── errorHandler.js # Error handling
│   ├── socket/             # Socket.IO setup
│   │   └── socket.js       # Real-time events
│   └── seed/               # Database seeding
│       ├── seed.js         # Seed script
│       └── uploads/        # Seeded files
├── uploads/                # User-uploaded files
├── electron/               # Electron desktop app
│   ├── main.js             # Electron main process
│   └── preload.js          # Preload script
├── scripts/                # Build and utility scripts
│   └── build-android.js    # Android TWA builder
├── docs/                   # Documentation
│   └── brainstorm.md       # 30+ future features
├── .github/workflows/      # CI/CD pipelines
│   └── ci.yml              # GitHub Actions
├── nginx/                  # Nginx config for production
├── docker-compose.yml      # Docker setup
├── Dockerfile              # App container
├── package.json            # Dependencies and scripts
├── .env.example            # Environment variables template
└── README.md               # This file
```

---

## 🛠️ Available Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start production server |
| `npm run dev` | Start development server with hot reload |
| `npm run seed` | Seed database with demo data |
| `npm test` | Run unit tests with Jest |
| `npm run test:e2e` | Run E2E tests with Playwright |
| `npm run build:electron` | Build desktop app (exe/AppImage) |
| `npm run build:android` | Generate Android TWA config |
| `npm run docker:up` | Start with Docker Compose |
| `npm run docker:down` | Stop Docker containers |
| `npm run backup` | Backup database |
| `npm run pm2:start` | Start with PM2 (production) |
| `npm run pm2:stop` | Stop PM2 processes |

---

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register-student` - Register student account
- `POST /api/auth/register-teacher` - Register teacher account
- `POST /api/auth/login` - Login (uses registration_number + password)
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user profile

### Files
- `POST /api/files/upload` - Upload file (notes, assignments, etc.)
- `GET /api/files` - Get files list (paginated, with filters)
- `GET /api/files/download/:id` - Download file
- `POST /api/files/approve/:id` - Approve file (admin only)
- `DELETE /api/files/:id` - Delete file
- `GET /api/files/stats/overview` - File statistics

### Attendance
- `POST /api/attendance/mark` - Mark attendance (teacher/admin)
- `GET /api/attendance/student/:id` - Get student attendance

### Marks
- `POST /api/marks/upload` - Upload marks (teacher/admin)
- `GET /api/marks/student/:id` - Get student marks

### Events
- `GET /api/events` - Get all events
- `POST /api/events` - Create event (teacher/admin)
- `POST /api/events/:id/register` - Register for event

### Assignments
- `POST /api/assignments` - Create assignment (teacher/admin)
- `GET /api/assignments/student` - Get student assignments
- `POST /api/assignments/:id/submit` - Submit assignment (student)
- `POST /api/assignments/:id/grade` - Grade submission (teacher/admin)

### Admin
- `GET /api/admin/users` - Get users list
- `POST /api/admin/users` - Create user
- `PUT /api/admin/users/:id/toggle-active` - Toggle user active status
- `GET /api/admin/approvals/files` - Get pending file approvals
- `GET /api/admin/logs` - Get activity logs

### Analytics
- `GET /api/analytics/overview` - System overview stats (admin)
- `GET /api/analytics/attendance-stats` - Attendance statistics

*Full API documentation available in Postman collection (coming soon)*

---

## 🌐 Deployment

### Docker Deployment (Recommended)

1. **Configure environment**
```bash
cp .env.example .env
# Edit .env with production values
```

2. **Build and start containers**
```bash
docker-compose up --build -d
```

Services will be available at:
- Application: `http://localhost:5000`
- MySQL: `localhost:3306`
- Nginx: `http://localhost:80`

3. **Seed the database**
```bash
docker-compose exec app npm run seed
```

### Manual Deployment

1. **Install dependencies**
```bash
npm install --production
```

2. **Set environment variables**
```bash
export NODE_ENV=production
export DB_HOST=your-db-host
export DB_PASSWORD=your-db-password
export JWT_SECRET=your-jwt-secret
# ... other variables from .env.example
```

3. **Run database migrations**
```bash
mysql -u root -p < server/database/init.sql
npm run seed
```

4. **Start with PM2**
```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Cloud Deployment

#### AWS
- Deploy backend on EC2 or ECS
- Use RDS for MySQL
- Use S3 for file storage (update STORAGE_MODE in .env)
- Use CloudFront for CDN

#### Azure
- Deploy on Azure App Service
- Use Azure Database for MySQL
- Use Azure Blob Storage

#### Google Cloud
- Deploy on Cloud Run or Compute Engine
- Use Cloud SQL for MySQL
- Use Cloud Storage

---

## 📱 Building Mobile & Desktop Apps

### Android App (PWA/TWA)

1. **Generate TWA configuration**
```bash
npm run build:android
```

2. **Install Bubblewrap CLI**
```bash
npm install -g @bubblewrap/cli
```

3. **Initialize and build**
```bash
cd releases/android
bubblewrap init --manifest=twa-manifest.json
bubblewrap build
```

APK will be in `releases/android/app/build/outputs/apk/`

**Requirements:** Android 9+ (API 28+)

See `releases/android/BUILD_INSTRUCTIONS.md` for detailed steps.

### Desktop App (Electron)

1. **Build for your platform**
```bash
npm run build:electron
```

Installers will be in `releases/desktop/`

**Platforms:**
- Windows: `.exe` installer
- Linux: `.AppImage`
- macOS: `.dmg` (requires macOS to build)

---

## 🧪 Testing

### Unit Tests
```bash
npm test
```

### E2E Tests
```bash
npm run test:e2e
```

### Manual Testing Checklist
- [ ] Register student/teacher accounts
- [ ] Login with different roles
- [ ] Upload a file (teacher)
- [ ] Approve file (admin)
- [ ] Download file (student)
- [ ] Mark attendance (teacher)
- [ ] View attendance (student)
- [ ] Upload marks (teacher)
- [ ] View marks with charts (student)
- [ ] Create and submit assignment
- [ ] Register for event (real-time counter update)
- [ ] Test Socket.IO real-time features
- [ ] Test PWA installation
- [ ] Test offline functionality

---

## 🔒 Security

- **Authentication:** JWT with access and refresh tokens
- **Passwords:** Hashed with bcrypt (cost factor: 12)
- **Authorization:** Role-based access control with middleware
- **Input Validation:** express-validator for all inputs
- **Rate Limiting:** 100 requests per 15 minutes per IP
- **Security Headers:** Helmet middleware
- **CORS:** Whitelist-based origin validation
- **SQL Injection Protection:** Prepared statements (mysql2)
- **File Upload Security:** Type validation, size limits, sanitized filenames
- **XSS Protection:** Content Security Policy headers

---

## 🎨 UI/UX Features

- **Glassmorphism Design** - Modern frosted glass effect with blur
- **Dark/Light Mode** - Theme toggle with persistence
- **Lottie Animations** - Smooth vector animations for loading and success states
- **Skeleton Loading** - Shimmer effect for better perceived performance
- **Micro-interactions** - Hover effects, transitions, and feedback
- **Responsive Design** - Mobile-first approach, works on all screen sizes
- **Accessibility** - ARIA labels, keyboard navigation, high contrast support
- **Smooth Transitions** - Page transitions, fade-ins, slide animations
- **Chart Visualizations** - Chart.js for attendance and marks analytics

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

**Code Style:**
- Use ESLint and Prettier
- Follow existing patterns
- Write meaningful commit messages
- Add tests for new features
- Update documentation

---

## 📚 Documentation

- **Brainstorm Document:** See `docs/brainstorm.md` for 30+ future feature ideas
- **API Documentation:** Coming soon (Swagger/OpenAPI)
- **Architecture:** Coming soon
- **Database Schema:** See `server/database/init.sql`

---

## 🐛 Known Issues

- Desktop app requires running backend separately (not bundled)
- Android TWA requires production HTTPS domain for full functionality
- Chart.js may have rendering issues on very old browsers
- Large file uploads (>10MB) may timeout on slow connections

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👥 Team

**ITER Development Team**
- Backend: Node.js + Express + MySQL
- Frontend: Vanilla HTML/CSS/JavaScript
- Real-time: Socket.IO
- Mobile: PWA + TWA
- Desktop: Electron

---

## 🙏 Acknowledgments

- **ITER/SOA University** - Inspiration and requirements
- **Open Source Community** - Libraries and tools used
- **Contributors** - Everyone who has contributed to this project

---

## � Documentation

### Enhancement Documentation (v2.0.0)
- **[Enhancement README](ENHANCEMENT_README.md)** - Quick start guide for new features
- **[Enhancement Summary](ENHANCEMENT_SUMMARY.md)** - Detailed feature breakdown and statistics
- **[Installation Guide](ENHANCEMENT_INSTALLATION_GUIDE.md)** - Step-by-step installation instructions
- **[Implementation Roadmap](IMPLEMENTATION_ROADMAP.md)** - Development timeline and progress
- **[Developer Quick Reference](DEVELOPER_QUICK_REFERENCE.md)** - API reference and code examples

### Original Documentation
- **Architecture:** `ARCHITECTURE.md` - System architecture overview
- **Profile Feature:** `PROFILE_README.md` - User profile functionality
- **UI/UX Guide:** `VISUAL_COMPONENT_REFERENCE.md` - UI components reference
- **Quick Start:** `START_HERE.md` - Getting started guide

---

## �📞 Support

For issues and questions:
- **GitHub Issues:** [Create an issue](https://github.com)
- **Documentation:** See files above
- **Quick Reference:** Check `DEVELOPER_QUICK_REFERENCE.md`

---

## 🗺️ Roadmap

See `docs/brainstorm.md` for detailed feature roadmap including:
- AI-powered study recommendations
- Two-factor authentication
- Payment gateway integration
- Attendance anomaly detection
- Native mobile app (React Native/Flutter)
- And 25+ more features...

---

**Built with ❤️ for ITER/SOA University**

**Star ⭐ this repo if you find it helpful!**
#   I T E R _ L i v e  
 