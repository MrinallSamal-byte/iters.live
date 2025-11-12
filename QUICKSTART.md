# 🚀 Quick Start Guide - ITER EduHub

Welcome! Get your ITER College Management System up and running in 5 minutes.

## Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **MySQL** 8.0+ ([Download](https://dev.mysql.com/downloads/mysql/))
- **Git** ([Download](https://git-scm.com/downloads))

## Installation Steps

### 1️⃣ Clone & Install

```bash
# Clone the repository
git clone <your-repo-url>
cd All_In_One_College_Website

# Install dependencies
npm install
```

### 2️⃣ Configure Database

```bash
# Run setup script (creates .env and sample files)
npm run setup
```

Edit `.env` file with your MySQL credentials:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=iter_college_db
DB_PORT=3306
```

### 3️⃣ Initialize Database

```bash
# Create database and tables
mysql -u root -p < server/database/init.sql

# Or use MySQL Workbench to run init.sql
```

### 4️⃣ Seed Sample Data

```bash
# Populate database with 200 students, 20 teachers, 3 admins
npm run seed
```

This creates:
- ✅ 200 Students (STU20250001-200)
- ✅ 20 Teachers (TCH2025001-020)
- ✅ 3 Admins (ADM2025001-003)
- ✅ Sample files, attendance, marks, assignments
- ✅ Events, timetables, hostel menus

### 5️⃣ Start Development Server

```bash
npm run dev
```

**Access the application:**
- 🌐 Web: http://localhost:5000
- 📱 PWA: Install from browser (installable!)

## 🎭 Demo Credentials

### Student Login
```
Registration: STU20250001
Password: Student@123
```

### Teacher Login
```
Registration: TCH2025001
Password: Teacher@123
```

### Admin Login
```
Registration: ADM2025001
Password: Admin@123456
```

## 📂 Project Structure

```
All_In_One_College_Website/
├── client/                   # Frontend (Vanilla JS)
│   ├── dashboard/           # Role-based dashboards
│   │   ├── student.html     # Student dashboard
│   │   ├── teacher.html     # Teacher dashboard
│   │   └── admin.html       # Admin dashboard
│   ├── css/                 # Glassmorphism styles
│   ├── js/                  # Client-side logic
│   ├── index.html           # Landing page
│   ├── login.html           # Login page
│   └── register.html        # Registration page
├── server/                  # Backend (Node.js + Express)
│   ├── routes/              # API routes
│   ├── middleware/          # Auth & validation
│   ├── database/            # MySQL config & schema
│   └── seed/                # Seed scripts & sample files
├── electron/                # Desktop app config
├── docker-compose.yml       # Docker setup
└── README.md               # Full documentation
```

## 🔧 Available Commands

| Command | Description |
|---------|-------------|
| `npm run setup` | Initial setup (creates .env, sample files) |
| `npm run dev` | Start development server with hot reload |
| `npm start` | Start production server |
| `npm run seed` | Populate database with sample data |
| `npm test` | Run unit tests (Jest) |
| `npm run test:e2e` | Run E2E tests (Playwright) |
| `npm run build:electron` | Build desktop app |
| `npm run build:android` | Generate Android TWA config |
| `npm run docker:up` | Start with Docker |

## 🎨 Features Overview

### For Students 🎓
- ✅ View attendance with charts
- ✅ Check marks & GPA
- ✅ Download notes & study material
- ✅ Submit assignments
- ✅ View timetable
- ✅ Check hostel menu
- ✅ Download admit cards

### For Teachers 👨‍🏫
- ✅ Mark attendance (class-wise)
- ✅ Upload marks (CSV/Excel)
- ✅ Create assignments
- ✅ Grade submissions
- ✅ Upload study material
- ✅ View student performance

### For Admins 🔐
- ✅ User management (CRUD)
- ✅ Approve file uploads
- ✅ System analytics & reports
- ✅ Send announcements
- ✅ Database backup/restore
- ✅ Activity logs

## 📱 Mobile & Desktop

### Install as PWA (Mobile/Desktop)
1. Open http://localhost:5000
2. Click browser's "Install" button
3. App works offline!

### Build Desktop App
```bash
npm run build:electron
# Installers created in releases/desktop/
```

### Build Android App
```bash
npm run build:android
cd releases/android
npx @bubblewrap/cli build
```

## 🐳 Docker Deployment

```bash
# Start all services (MySQL, Node, Nginx)
npm run docker:up

# Access: http://localhost:8080
```

## 🆘 Troubleshooting

### Database Connection Error
- Check MySQL is running: `mysql --version`
- Verify credentials in `.env`
- Create database: `CREATE DATABASE iter_college_db;`

### Port Already in Use
- Change PORT in `.env` (default: 5000)
- Or stop conflicting process

### Seed Script Fails
- Ensure database exists
- Check MySQL user permissions
- Run `init.sql` first

## 📚 Documentation

- **Full README**: See `/README.md` for complete API documentation
- **API Endpoints**: 20+ RESTful endpoints documented
- **Future Features**: Check `/docs/brainstorm.md` for 25+ ideas

## 🤝 Need Help?

- Check `/README.md` for detailed documentation
- Review `/docs/brainstorm.md` for feature ideas
- Check the demo credentials above
- All routes support JSON responses

## 🎉 You're Ready!

Visit **http://localhost:5000** and login with demo credentials.

Explore the glassmorphism UI, real-time updates via Socket.IO, and all management features!

---

**Built with:** Node.js • Express • MySQL • Vanilla JS • Chart.js • Socket.IO • PWA • Electron
