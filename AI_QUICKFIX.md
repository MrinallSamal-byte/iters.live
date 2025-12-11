# 🚀 Quick Fix: Enable AI Chatbot Features

## Problem
Your chatbot is not working or shows "AI service unavailable" messages.

## Solution (3 Steps - 5 Minutes)

### Step 1: Check Configuration
```bash
npm run check:ai
```

This will tell you exactly what's missing.

### Step 2: Get API Keys (FREE)

Choose **at least ONE** (both recommended):

**Option A: OpenRouter (Recommended)**
1. Go to https://openrouter.ai/keys
2. Sign up (free, no credit card)
3. Create API key
4. Copy the key (starts with `sk-or-v1-`)

**Option B: Google Gemini (Fallback)**
1. Go to https://makersuite.google.com/app/apikey
2. Sign in with Google
3. Create API key
4. Copy the key (starts with `AIza`)

### Step 3: Configure

**For Local Development:**
```bash
# If .env doesn't exist, create it
cp .env.example .env

# Edit .env and add your keys:
OPENROUTER_API_KEY=sk-or-v1-your-actual-key-here
GEMINI_API_KEY=AIza-your-actual-key-here
GEMINI_MODEL=gemini-1.5-flash
```

**For Render Deployment:**
1. Go to https://dashboard.render.com
2. Click your service → Environment
3. Add environment variables:
   - `OPENROUTER_API_KEY` = your key
   - `GEMINI_API_KEY` = your key (optional)
   - `GEMINI_MODEL` = gemini-1.5-flash
4. Save (auto-redeploys in 2-3 minutes)

### Step 4: Verify
```bash
# Check configuration
npm run check:ai

# Test API connection
npm run verify:ai

# Start server
npm start
```

Visit your website, click the chatbot, and ask: "What is photosynthesis?"

You should get a detailed AI response! ✅

## Troubleshooting

### "API key not configured"
- Make sure you saved .env file (local) or Render environment variables
- Check for typos in key names
- Restart your server

### "fetch failed" or network errors
- Verify API key is valid at provider's website
- Check internet connection
- Try the fallback service (add both keys)

### Still not working?
```bash
# Check health endpoint
curl http://localhost:5000/api/health/ai-service
```

Or visit: `https://your-app.onrender.com/api/health/ai-service`

## What Gets Enabled

✅ Intelligent chatbot responses  
✅ Study plan generation  
✅ Performance predictions  
✅ Academic question answering  
✅ Subject recommendations  

## Cost

**FREE** - Both APIs have generous free tiers suitable for educational use.

## More Info

- Complete guide: [AI_SERVICE_RENDER_SETUP_GUIDE.md](./AI_SERVICE_RENDER_SETUP_GUIDE.md)
- Render setup: [RENDER_ENV_VARS.md](./RENDER_ENV_VARS.md)
- Original setup: [AI_CHATBOT_RENDER_QUICKFIX.md](./AI_CHATBOT_RENDER_QUICKFIX.md)

---

**Time to fix:** 5 minutes  
**Difficulty:** Easy  
**Cost:** FREE
