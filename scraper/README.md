# Student Portal Scraper

Flask-based Student Portal Scraper with Google Vision AI Integration for CAPTCHA solving.

## Features

- **Browser Automation**: Selenium-based headless Chrome browser automation
- **Human-Like Interaction**: Simulates human typing and mouse movements
- **AI CAPTCHA Solving**: Google Cloud Vision API for high-precision CAPTCHA OCR
- **Session Management**: Singleton pattern for browser instance management
- **Data Extraction**: Scrapes attendance, timetable, and student information

## Tech Stack

- **Backend**: Python (Flask)
- **Browser Automation**: Selenium (Headless Chrome)
- **AI/OCR Service**: Google Cloud Vision REST API
- **Image Processing**: OpenCV (cv2) for pre-processing
- **Environment Config**: python-dotenv

## Setup

### 1. Install Dependencies

```bash
cd scraper
pip install -r requirements.txt
```

### 2. Configure Environment

Create a `.env` file in the `scraper/` directory:

```env
# Student Portal Credentials
PORTAL_USER_ID=your_student_id
PORTAL_PASSWORD=your_password

# Google Cloud Vision API Key
GOOGLE_VISION_API_KEY=your_google_vision_api_key

# Browser Configuration
HEADLESS_MODE=True
```

### 3. Run the Application

```bash
python app.py
```

The server will start on `http://localhost:5001`

## API Endpoints

### Health Check

```
GET /health
```

Response:
```json
{
  "status": "healthy",
  "service": "Student Portal Scraper",
  "captcha_solver": "Google Cloud Vision"
}
```

### Scrape Student Data

```
POST /api/scrape
```

Request Body (optional - uses env vars if not provided):
```json
{
  "user_id": "your_student_id",
  "password": "your_password"
}
```

Success Response:
```json
{
  "status": "success",
  "student_data": {
    "name": "Student Name",
    "attendance": [...],
    "timetable": [...]
  },
  "metadata": {
    "captcha_solver": "Google Cloud Vision",
    "execution_time": "4.2s"
  }
}
```

Error Responses:
- `400` - Missing required configuration
- `401` - Authentication failed
- `500` - Server/configuration error

### Validate Configuration

```
GET /api/validate-config
```

Response:
```json
{
  "status": "valid",
  "config": {
    "portal_url": "https://soaportals.com/StudentPortalSOA/#/",
    "headless_mode": true,
    "has_api_key": true,
    "has_credentials": true
  }
}
```

## Architecture

```
scraper/
├── app.py              # Flask application with REST API endpoints
├── config.py           # Environment configuration
├── browser_manager.py  # Singleton browser session management
├── human_interaction.py # Human-like typing and mouse utilities
├── captcha_solver.py   # Google Vision API CAPTCHA solver
├── scraper.py          # Main automation workflow
├── requirements.txt    # Python dependencies
├── .env.example        # Environment template
└── README.md           # This file
```

## How It Works

1. **Initialize**: Start WebDriver with bot-detection evasion
2. **Navigate**: Go to https://soaportals.com/StudentPortalSOA/#/
3. **Wait**: Use WebDriverWait for the login form to appear
4. **Fill Form**: Enter credentials with human-like typing
5. **Solve CAPTCHA**: 
   - Capture CAPTCHA image element screenshot
   - Preprocess with OpenCV (grayscale, threshold, denoise)
   - Send to Google Vision API for TEXT_DETECTION
   - Extract and clean alphanumeric text
6. **Login**: Click login with human-like behavior
7. **Verify**: Check for errors or successful dashboard navigation
8. **Scrape**: Navigate to internal routes and extract table data

## Security Notes

- Never hardcode credentials in code
- Use `.env` file for sensitive configuration
- The `.env` file is excluded from git via `.gitignore`
- API key should have appropriate restrictions in Google Cloud Console
