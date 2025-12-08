# AI Features Quick Start Guide

## 🚀 Get AI Features Working in 3 Steps

### Step 1: Get API Key (2 minutes)
1. Visit: https://aistudio.google.com/app/apikey
2. Sign in with Google account
3. Click "Create API key"
4. Copy the key (starts with `AIza...`)

### Step 2: Configure Environment (1 minute)
```bash
# Copy the template
cp .env.example .env

# Edit .env and add your key:
# GEMINI_API_KEY=your-actual-key-here
```

### Step 3: Restart Server (30 seconds)
```bash
# Stop current server (Ctrl+C)
# Start again
npm start
```

## ✅ Verify It Works

### Quick Test
```bash
node test-ai-service.js
```

Expected output:
```
✅ AI Service initialized with Gemini API
✅ Gemini AI client initialized
```

### Browser Test
1. Log in to the app
2. Click chatbot icon (🤖)
3. Ask: "What is AI?"
4. Get detailed response ✨

## 🔧 Troubleshooting

### "AI service is currently unavailable"
→ API key not set. Check your `.env` file.

### "I'm currently unable to process questions"
→ Not logged in. Sign in first.

### Still not working?
```bash
# Check if key is loaded
node -e "require('dotenv').config(); console.log('Key:', process.env.GEMINI_API_KEY ? 'Set ✅' : 'Missing ❌')"
```

## 📖 More Help

- **Full Guide**: See `GEMINI_API_SETUP.md`
- **Complete Fix Details**: See `AI_CHATBOT_FIX_COMPLETE.md`
- **Test Script**: Run `test-ai-service.js`

## 🎯 What Works Now

- ✅ AI Chatbot (answers questions)
- ✅ Study Plan Generator
- ✅ Performance Predictor
- ✅ Assignment Feedback
- ✅ Personalized Recommendations

## 🔒 Security Note

- ⚠️ Never commit `.env` to git (already in `.gitignore`)
- ⚠️ Keep your API key secret
- ✅ Use different keys for dev/production

## 💡 Pro Tips

1. **Free Tier Limits**: 60 requests/min, 1500/day
2. **Response Time**: 1-3 seconds per AI query
3. **Fallback Mode**: Works without API key (FAQ responses)
4. **Best Model**: `gemini-1.5-flash` (fast, free)

---

That's it! Your AI features should now be working. 🎉
