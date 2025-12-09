# 🚀 ITER-AIO Deployment - Environment Variables

## Copy these into your Render Dashboard

When creating the web service on Render, add these environment variables:

### Required Variables

```
NODE_ENV=production
PORT=10000
DATABASE_URL=postgresql://iter_college_db_user:93UqDvuxyr57TKtxgvBWIVSj3CcAJe6B@dpg-d3o80g3e5dus73agr8q0-a/iter_college_db
JWT_SECRET=LXfbTAoqz0WlSa7QeIn6Khrdyp3JvsZ4k2tuxjHMiVwOEmR5BGgDUC18cPFNY9
JWT_REFRESH_SECRET=uqwGFrHbNfMo1YdpjOSg7K8Wi9VkUhs4xDeI5LARvan2lEBzy0QPC3mTZX6tcJ
MAX_FILE_SIZE=10485760
JWT_EXPIRE=24h
JWT_REFRESH_EXPIRE=7d
```

### AI Service Configuration (for Smart Chatbot)

```
# OpenRouter API Key (PRIMARY) - For AI Chatbot and Educational Features
OPENROUTER_API_KEY=sk-or-v1-YOUR_ACTUAL_OPENROUTER_KEY_HERE

# Google Gemini AI API Key (FALLBACK) - Backup AI Service
GEMINI_API_KEY=AIzaYOUR_ACTUAL_GEMINI_KEY_HERE
GEMINI_MODEL=gemini-1.5-flash
```

**Features enabled by AI Services:**
- `/api/ai/chat` - AI-powered chatbot responses (uses OpenRouter primary, Gemini fallback)
- `/api/ai/study-plan` - Personalized study plan generation
- `/api/ai/recommendations` - AI-driven learning recommendations
- `/api/ai/predict-performance` - ML-based exam performance prediction
- `/api/ai/tutor-recommendations` - Personalized AI tutor recommendations
- Smart answers for student questions
- Context-aware educational responses

**Get your OpenRouter API key:** https://openrouter.ai/keys
**Get your Gemini API key:** https://makersuite.google.com/app/apikey

> **Note:** OpenRouter is the PRIMARY AI service. The system automatically falls back to Gemini if OpenRouter is unavailable. For best results, configure both keys.

> **For Repository Maintainers:** The actual working API keys are stored in `.env.example` for reference. For production deployment, you should use these keys or obtain your own from the providers above.

### Update After First Deploy

Once you get your Render URL (e.g., `https://iter-aio-abc123.onrender.com`), add:

```
CORS_WHITELIST=https://iter-aio-abc123.onrender.com
```

---

## Quick Deploy Steps

1. **Go to Render**: https://dashboard.render.com
2. **New → Web Service**
3. **Connect GitHub repo** (or use manual deploy)
4. **Configure**:
   - Name: `iter-aio`
   - Runtime: Node
   - Build: `npm install`
   - Start: `node server/index.js`
   - **Add all variables above** ☝️
5. **Add Disk** (Advanced):
   - Name: `uploads`
   - Path: `/opt/render/project/src/uploads`
   - Size: 1 GB
6. **Create Service**

---

## ✅ What's Already Done

- ✅ PostgreSQL database provisioned
- ✅ Schema created (18 tables)
- ✅ Demo accounts seeded:
  - **STU20250001** / Student@123 (Student)
  - **TCH2025001** / Teacher@123 (Teacher)
  - **ADM2025001** / Admin@123456 (Admin)
- ✅ Code converted to PostgreSQL
- ✅ Demo data cloning system implemented
- ✅ JWT authentication configured
- ✅ File upload/download ready

---

## 🎯 After Deployment

Your app will be live at: `https://[your-service-name].onrender.com`

**Test it**:
- Health check: `/health`
- Login: `/api/auth/login`
- Dashboard: `/student/dashboard.html` (after login)

**Features working**:
- ✅ Login with demo accounts
- ✅ Dynamic data variation per session
- ✅ Attendance tracking
- ✅ Marks/grades display
- ✅ File upload/download
- ✅ Event registration
- ✅ Hostel menu
- ✅ Timetable
- ✅ Announcements

All data is pre-loaded and ready! 🎉
