# 🔧 Quick Fix: AI Chatbot "Service Unavailable" on Render

## Problem
Your chatbot shows this message:
> 🤔 Interesting question! For detailed answers to general questions, I need the AI service which is currently unavailable.

## Root Cause
The OpenRouter API key (and optionally Gemini API key) are not configured in your Render deployment environment variables.

## Quick Fix (5 minutes)

### Step 1: Add Environment Variables on Render

1. **Go to Render Dashboard**: https://dashboard.render.com
2. **Click on your service** (e.g., `iter-aio`)
3. **Click "Environment"** in the left menu
4. **Add these three variables:**

```
Variable Name: OPENROUTER_API_KEY
Value: sk-or-v1-REPLACE_WITH_YOUR_ACTUAL_OPENROUTER_KEY
```

```
Variable Name: GEMINI_API_KEY  
Value: AIza_REPLACE_WITH_YOUR_ACTUAL_GEMINI_KEY
```

```
Variable Name: GEMINI_MODEL
Value: gemini-1.5-flash
```

> **Important:** Replace the placeholder values with your actual API keys:
> - Get FREE OpenRouter key: https://openrouter.ai/keys (Sign up → Create Key)
> - Get FREE Gemini key: https://makersuite.google.com/app/apikey (Sign in → Get Key)
> - **Never commit API keys to Git** - use environment variables only

5. **Click "Save Changes"**
6. **Wait 2-3 minutes** for automatic redeployment

### Step 2: Test It

1. Visit your deployed site (e.g., `https://iter-aio.onrender.com`)
2. Login with: `STU20250001` / `Student@123`
3. Click the chatbot icon (bottom-right)
4. Ask: "What is photosynthesis?"
5. You should get a detailed AI response! ✅

## What Was Fixed

### Files Modified:
1. **RENDER_ENV_VARS.md** - Updated to include OpenRouter configuration
2. **render.yaml** - Added AI service environment variables
3. **server/services/ai.service.js** - Enhanced logging for debugging
4. **client/js/chatbot.js** - Better error messages
5. **verify-ai-service.js** - Enhanced to test both OpenRouter and Gemini

### New Documentation:
- **RENDER_AI_SERVICE_SETUP.md** - Complete setup guide with troubleshooting

## How It Works

The system now uses a **two-tier AI service**:

1. **Primary**: OpenRouter API
   - Multiple free AI models
   - Automatic fallback between models
   - Very reliable

2. **Fallback**: Google Gemini
   - Backup if OpenRouter fails
   - Single powerful model
   - Good reliability

The chatbot automatically tries OpenRouter first, then falls back to Gemini if needed.

## Verify It's Working

After deploying, check your Render logs for these messages:

✅ **Success:**
```
✅ OpenRouter Service initialized with API key
✅ AI Service using OpenRouter API (primary)
```

❌ **Still failing?**
```
⚠️ OpenRouter Service initialized without API key - features will use fallback
```

If you see the warning, double-check that you:
1. Added the environment variable correctly (no spaces)
2. Saved changes on Render
3. Waited for the redeployment to complete

## Need Help?

See the comprehensive guide: [RENDER_AI_SERVICE_SETUP.md](./RENDER_AI_SERVICE_SETUP.md)

## Summary

✅ Added `OPENROUTER_API_KEY` to Render environment variables  
✅ Added `GEMINI_API_KEY` as fallback  
✅ Added `GEMINI_MODEL` configuration  
✅ Improved logging and error handling  
✅ Created comprehensive documentation  

**Time to fix: 5 minutes**  
**Cost: FREE (both APIs have generous free tiers)**
