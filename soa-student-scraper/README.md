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

### Backend Setup

```bash
cd soa-student-scraper/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Install Playwright browsers
playwright install chromium

# Run the server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend Setup

```bash
cd soa-student-scraper/frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will be available at `http://localhost:3000` and will proxy API requests to the backend.

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

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a PR.

---

Built with ❤️ for SOA University Students
