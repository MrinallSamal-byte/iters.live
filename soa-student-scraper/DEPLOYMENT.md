# SOA Student Portal Scraper - Deployment Guide

This guide covers deployment to various cloud platforms.

## Table of Contents
- [Render Deployment](#render-deployment)
- [Vercel Deployment](#vercel-deployment)
- [Railway Deployment](#railway-deployment)
- [Docker Deployment](#docker-deployment)
- [Manual Deployment](#manual-deployment)

---

## Render Deployment

### Backend Deployment on Render

1. **Create New Web Service**
   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository

2. **Configure Service**
   - **Name:** `soa-scraper-backend`
   - **Root Directory:** `soa-student-scraper/backend`
   - **Environment:** Python 3.11
   - **Build Command:**
     ```bash
     pip install -r requirements.txt && playwright install chromium --with-deps
     ```
   - **Start Command:**
     ```bash
     uvicorn main:app --host 0.0.0.0 --port $PORT
     ```

3. **Set Environment Variables**
   - `PLAYWRIGHT_BROWSERS_PATH=/opt/render/.cache/ms-playwright`
   - `ALLOWED_ORIGINS=https://your-frontend.vercel.app` (update after deploying frontend)

4. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment (5-10 minutes)
   - Note your backend URL: `https://your-service.onrender.com`

### Notes for Render
- Free tier may have cold starts (service sleeps after 15 min of inactivity)
- Playwright browsers take ~2GB of disk space
- First deployment takes longer due to browser installation

---

## Vercel Deployment

### Frontend Deployment on Vercel

1. **Import Project**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "Add New..." → "Project"
   - Import your GitHub repository

2. **Configure Project**
   - **Framework Preset:** Vite
   - **Root Directory:** `soa-student-scraper/frontend`
   - **Build Command:** `npm run build` (auto-detected)
   - **Output Directory:** `dist` (auto-detected)

3. **Set Environment Variables**
   - `VITE_API_URL=https://your-backend.onrender.com` (your Render backend URL)

4. **Deploy**
   - Click "Deploy"
   - Wait for deployment (1-2 minutes)
   - Your frontend will be live at `https://your-project.vercel.app`

5. **Update Backend CORS**
   - Go back to Render backend
   - Update `ALLOWED_ORIGINS` environment variable with your Vercel URL
   - Redeploy backend

---

## Railway Deployment

### Full Stack Deployment on Railway

1. **Create New Project**
   - Go to [Railway Dashboard](https://railway.app/)
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository

2. **Deploy Backend**
   - Click "Add Service" → "GitHub Repo"
   - **Root Directory:** `soa-student-scraper/backend`
   - **Start Command:**
     ```bash
     pip install -r requirements.txt && playwright install chromium --with-deps && uvicorn main:app --host 0.0.0.0 --port $PORT
     ```
   - Add environment variables:
     - `PYTHONUNBUFFERED=1`
     - `PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright`

3. **Deploy Frontend**
   - Click "Add Service" → "GitHub Repo"
   - **Root Directory:** `soa-student-scraper/frontend`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run preview`
   - Add environment variable:
     - `VITE_API_URL=https://your-backend.railway.app` (from backend service)

4. **Configure Networking**
   - Both services will get public URLs
   - Update backend CORS with frontend URL

---

## Docker Deployment

### Using Docker Compose (Recommended for VPS/Local)

1. **Prerequisites**
   - Docker and Docker Compose installed
   - `.env` files configured (copy from `.env.example`)

2. **Build and Run**
   ```bash
   cd soa-student-scraper
   docker-compose up -d --build
   ```

3. **Access Services**
   - Frontend: `http://localhost:3000`
   - Backend: `http://localhost:8000`
   - Health check: `http://localhost:8000/health`

4. **View Logs**
   ```bash
   docker-compose logs -f
   ```

5. **Stop Services**
   ```bash
   docker-compose down
   ```

### Individual Docker Builds

**Backend:**
```bash
cd soa-student-scraper/backend
docker build -t soa-scraper-backend .
docker run -p 8000:8000 soa-scraper-backend
```

**Frontend:**
```bash
cd soa-student-scraper/frontend
docker build -t soa-scraper-frontend .
docker run -p 3000:80 soa-scraper-frontend
```

---

## Manual Deployment

### Prerequisites
- Python 3.11+
- Node.js 18+
- Tesseract OCR installed
- Chromium browser (for Playwright)

### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd soa-student-scraper/backend
   ```

2. **Create virtual environment**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   playwright install chromium
   ```

4. **Install Tesseract OCR**
   - **Ubuntu/Debian:** `sudo apt-get install tesseract-ocr`
   - **macOS:** `brew install tesseract`
   - **Windows:** Download from [GitHub](https://github.com/UB-Mannheim/tesseract/wiki)

5. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

6. **Run the server**
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd soa-student-scraper/frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Set VITE_API_URL if deploying separately
   ```

4. **Development mode**
   ```bash
   npm run dev
   ```
   Frontend will be at `http://localhost:3000`

5. **Production build**
   ```bash
   npm run build
   npm run preview
   ```

---

## Production Checklist

Before deploying to production:

- [ ] Update `ALLOWED_ORIGINS` in backend with your frontend domain
- [ ] Set `VITE_API_URL` in frontend with your backend URL
- [ ] Enable HTTPS for both frontend and backend
- [ ] Set up monitoring and logging
- [ ] Configure proper error tracking
- [ ] Test CAPTCHA solving on production environment
- [ ] Verify Playwright browsers are installed correctly
- [ ] Test end-to-end flow with real credentials (in a safe environment)
- [ ] Review and update security headers
- [ ] Set up rate limiting if needed
- [ ] Configure auto-scaling if using cloud platform
- [ ] Set up backup and recovery procedures

---

## Troubleshooting

### Backend Issues

**Playwright browser not found:**
- Run `playwright install chromium --with-deps`
- Set `PLAYWRIGHT_BROWSERS_PATH` correctly for your platform

**Tesseract OCR errors:**
- Ensure tesseract-ocr is installed: `tesseract --version`
- Install language data if needed: `sudo apt-get install tesseract-ocr-eng`

**CORS errors:**
- Check `ALLOWED_ORIGINS` includes your frontend domain
- Ensure URLs match exactly (including https://)

### Frontend Issues

**API connection failed:**
- Verify `VITE_API_URL` is set correctly
- Check backend is running and accessible
- Verify CORS configuration on backend

**Build errors:**
- Clear node_modules: `rm -rf node_modules && npm install`
- Clear cache: `npm cache clean --force`

---

## Support

For issues and questions:
- Check the main [README](./README.md)
- Review [GitHub Issues](https://github.com/your-repo/issues)
- Consult platform-specific documentation

---

**Last Updated:** December 2024
