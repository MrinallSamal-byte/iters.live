# SOA Student Portal Scraper

A secure, real-time web application that allows SOA University students to fetch their own live academic data from the official portal using their own credentials.

## 🌟 Features

- **Real-Time Data Fetching**: Live scraping using user-provided credentials
- **Demo Mode**: Sample data display without any login attempt
- **Automatic CAPTCHA Solving**: pytesseract + PIL OCR for CAPTCHA handling
- **3-Attempt Retry Logic**: Clear status updates with remaining attempts
- **Secure by Design**: Credentials never logged, stored, or cached
- **Responsive UI**: Clean React frontend that works on all devices

## 📁 Project Structure

```
soa-student-scraper/
├── backend/
│   ├── main.py                    # FastAPI application
│   ├── requirements.txt           # Python dependencies
│   └── scraper/
│       ├── __init__.py
│       ├── live_scraper.py        # Playwright-based portal scraper
│       ├── captcha_solver.py      # pytesseract OCR CAPTCHA solver
│       └── dummy_data.json        # Generic sample student data
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css
│       └── components/
│           ├── CredentialForm.jsx
│           ├── Dashboard.jsx
│           └── StatusBanner.jsx
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- Tesseract OCR (`tesseract-ocr` package)

### Installation

**1. Install Tesseract OCR**
```bash
# Ubuntu/Debian
sudo apt-get update && sudo apt-get install -y tesseract-ocr

# macOS
brew install tesseract

# Windows
# Download from: https://github.com/UB-Mannheim/tesseract/wiki
```

**2. Backend Setup**

```bash
cd soa-student-scraper/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Install Playwright browsers
playwright install chromium

# Configure environment (optional)
cp .env.example .env
# Edit .env if needed

# Run the server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**3. Frontend Setup**

```bash
cd soa-student-scraper/frontend

# Install dependencies
npm install

# Configure environment (optional)
cp .env.example .env
# Edit .env if backend is on different URL

# Start development server
npm run dev
```

The frontend will be available at `http://localhost:3000` and will proxy API requests to the backend.

### Quick Test

1. Open `http://localhost:3000` in your browser
2. Click "Load Dummy Data" to see a sample profile
3. OR enter your SOA credentials to fetch live data

**Note:** For live data, make sure the SOA portal is accessible.

## 📡 API Endpoints

### POST /api/scrape-portal

Scrape live student data from the SOA portal.

**Request:**
```json
{
  "registration_number": "2461XXXXXXX",
  "password": "your_password"
}
```

**Response (Success):**
```json
{
  "success": true,
  "status": "SUCCESS",
  "message": "Live data fetched successfully using your credentials",
  "attempt": 1,
  "attemptsRemaining": 2,
  "data": {
    "personalInfo": { ... },
    "attendance": [ ... ],
    "results": { ... }
  },
  "isDemo": false
}
```

**Response (Auth Failed):**
```json
{
  "success": false,
  "status": "AUTH_FAILED",
  "message": "Attempt 1/3: Invalid credentials...",
  "attempt": 1,
  "attemptsRemaining": 2,
  "data": null,
  "isDemo": false
}
```

### GET /api/dummy-data

Get generic sample student profile (demo mode).

**Response:**
```json
{
  "success": true,
  "status": "DEMO_LOADED",
  "message": "Demo Mode Active — Sample Data",
  "data": {
    "personalInfo": {
      "name": "Sample Student",
      "enrollmentNo": "22XXXXXXX",
      "branch": "Computer Science & Engineering",
      ...
    },
    "attendance": [ ... ],
    "results": { ... }
  },
  "isDemo": true
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "soa-student-scraper",
  "version": "1.0.0",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 🔒 Security

This application is designed with security as a top priority:

1. **No Credential Storage**: User credentials are never logged, stored, or cached
2. **Memory-Only Processing**: Passwords exist only in memory during the scraping operation
3. **Clean Browser Sessions**: A fresh browser context is created and destroyed for each request
4. **No Credentials in Logs**: The application explicitly avoids logging any credential information
5. **HTTPS Recommended**: Always deploy behind HTTPS in production

## 🌐 Deployment

### Backend (Render)

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Set build command: `pip install -r soa-student-scraper/backend/requirements.txt && playwright install chromium --with-deps`
4. Set start command: `cd soa-student-scraper/backend && uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add environment variable: `PLAYWRIGHT_BROWSERS_PATH=/opt/render/.cache/ms-playwright`

### Frontend (Vercel)

1. Import your GitHub repository on Vercel
2. Set root directory to `soa-student-scraper/frontend`
3. Add environment variable: `VITE_API_URL=https://your-backend-url.onrender.com`
4. Deploy!

### Docker (Optional)

```dockerfile
# Backend Dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/requirements.txt .
RUN pip install -r requirements.txt && playwright install chromium --with-deps

COPY backend/ .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## 🧪 Testing

### Backend Tests

```bash
cd soa-student-scraper/backend

# Run with pytest
pytest

# Or test manually with curl
curl http://localhost:8000/health
curl http://localhost:8000/api/dummy-data
```

### Frontend Tests

```bash
cd soa-student-scraper/frontend
npm run build  # Verify build works
```

## 📊 Data Extracted

The scraper extracts the following data (when available):

### Personal Information
- Name
- Enrollment/Registration Number
- Branch/Department
- Semester
- Date of Birth
- Gender
- Blood Group
- Profile Photo

### Attendance
- Subject Code
- Subject Name
- Classes Attended
- Total Classes
- Attendance Percentage

### Results
- Semester-wise SGPA
- Cumulative CGPA
- Credits Earned
- Credits Required

## ⚠️ Disclaimer

This tool is designed for SOA University students to access their **own** academic data using their **own** credentials. Please:

- Only use this with your own credentials
- Do not share your password with anyone
- Use responsibly and in accordance with SOA University policies

## 📚 Documentation

- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Complete deployment guide for Render, Vercel, Railway, and Docker
- **[TESTING.md](./TESTING.md)** - Comprehensive testing guide with examples
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Guidelines for contributors
- **[FIREBASE_INTEGRATION.md](./FIREBASE_INTEGRATION.md)** - Integration with existing Firebase/Render deployment
- **[PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)** - Complete project overview and statistics

## 🔧 Configuration

### Backend Environment Variables

Create `backend/.env` from `backend/.env.example`:
```bash
HOST=0.0.0.0
PORT=8000
ALLOWED_ORIGINS=*  # Update for production
```

### Frontend Environment Variables

Create `frontend/.env` from `frontend/.env.example`:
```bash
VITE_API_URL=  # Leave empty for local dev, set for production
```

## 🐳 Docker Support

Run the entire stack with Docker:
```bash
docker-compose up -d --build
```

Services will be available at:
- Frontend: http://localhost:3000
- Backend: http://localhost:8000

## 🧪 Testing

Run backend tests:
```bash
cd backend
source venv/bin/activate
pytest
```

Run frontend build test:
```bash
cd frontend
npm run build
```

See [TESTING.md](./TESTING.md) for comprehensive testing guide.

## 🚨 Important Notes

### For Students
- **Use ONLY your own credentials** - Never share or use someone else's login
- Data is fetched in real-time and not stored anywhere
- This tool is for personal use only

### For Developers
- Never commit credentials or sensitive data
- Always use `.env` files for configuration
- Test thoroughly before deploying
- Keep dependencies updated

### Security
- Passwords are NEVER logged or stored
- Browser sessions are isolated per request
- All data is transferred over HTTPS in production
- CORS is enforced to prevent unauthorized access

## 📊 Tech Stack

**Backend:**
- FastAPI (Python web framework)
- Playwright (Browser automation)
- pytesseract + Pillow (CAPTCHA solving)
- uvicorn (ASGI server)

**Frontend:**
- React 18 (UI library)
- Vite (Build tool)
- Modern CSS with responsive design

**Deployment:**
- Docker & Docker Compose
- Render (Backend hosting)
- Vercel (Frontend hosting)
- Railway (Full-stack option)

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- SOA University for the inspiration
- Open-source community for amazing tools
- All contributors and testers

---

Built with ❤️ for SOA University Students

**Star ⭐ this project if you find it helpful!**
