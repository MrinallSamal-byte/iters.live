# 🤖 AI Service Setup Guide for Render Deployment

## Overview
This guide helps you enable AI-powered chatbot features on your Render deployment. The chatbot provides intelligent responses to student questions, generates study plans, and offers educational assistance.

## Problem
If your chatbot shows messages like:
- "AI service is currently unavailable"
- "I need the AI service which is currently unavailable"
- Questions receive fallback responses instead of AI-generated answers

This means the AI service environment variables are not configured on Render.

## Solution: Configure Environment Variables on Render

### Step 1: Get Free API Keys

You need at least ONE of these API keys (both is recommended for redundancy):

#### Option A: OpenRouter API (Recommended - Primary Service)
1. Visit https://openrouter.ai
2. Click "Sign Up" or "Sign In"
3. Go to "Keys" section (https://openrouter.ai/keys)
4. Click "Create Key"
5. Copy the key (starts with `sk-or-v1-`)

**Benefits:**
- Multiple free AI models available
- Automatic fallback between models
- High reliability
- No credit card required

#### Option B: Google Gemini API (Fallback Service)
1. Visit https://makersuite.google.com/app/apikey
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key (starts with `AIza`)

**Benefits:**
- Powerful Gemini 1.5 Flash model
- Good for educational content
- Free tier available

### Step 2: Add Environment Variables to Render

1. **Log in to Render Dashboard**
   - Go to https://dashboard.render.com
   - Find your service (e.g., `iter-aio`)

2. **Navigate to Environment Settings**
   - Click on your web service
   - Click "Environment" in the left sidebar

3. **Add the Following Variables**

   Click "Add Environment Variable" for each:

   **For OpenRouter (Primary - Recommended):**
   ```
   Key: OPENROUTER_API_KEY
   Value: [paste your OpenRouter API key here]
   ```

   **For Gemini (Fallback - Optional but recommended):**
   ```
   Key: GEMINI_API_KEY
   Value: [paste your Gemini API key here]
   ```

   ```
   Key: GEMINI_MODEL
   Value: gemini-1.5-flash
   ```

4. **Save Changes**
   - Click "Save Changes" button
   - Render will automatically redeploy your service (takes 2-3 minutes)

### Step 3: Verify the Configuration

After the redeployment completes:

1. **Check Service Logs**
   - In Render dashboard, click "Logs"
   - Look for these success messages:
     ```
     ✅ OpenRouter Service initialized with API key (sk-or-v1-...6f8a)
     ✅ AI Service using OpenRouter API (primary)
     ```

2. **Test the AI Service Health Endpoint**
   - Visit: `https://[your-service-name].onrender.com/api/health/ai-service`
   - You should see:
     ```json
     {
       "status": "available",
       "services": {
         "openRouter": {
           "configured": true,
           "available": true
         }
       }
     }
     ```

3. **Test the Chatbot**
   - Visit your deployed website
   - Log in (e.g., `STU20250001` / `Student@123`)
   - Click the chatbot icon (bottom-right corner)
   - Ask a question: "What is photosynthesis?"
   - You should get a detailed AI-generated response!

## Troubleshooting

### Issue: "API key not configured" in logs
**Solution:**
- Double-check that you added the environment variable correctly
- Ensure there are no extra spaces before/after the key
- Verify the key starts with `sk-or-v1-` (OpenRouter) or `AIza` (Gemini)
- Click "Save Changes" in Render
- Wait for redeployment to complete

### Issue: "fetch failed" or "API error"
**Solution:**
- Verify your API key is valid:
  - OpenRouter: Visit https://openrouter.ai/keys and check if key is active
  - Gemini: Visit https://aistudio.google.com/app/apikey
- Check if you've exceeded free tier limits
- Try the fallback service (add both OpenRouter and Gemini)

### Issue: Chatbot still shows fallback responses
**Solution:**
- Clear browser cache and refresh
- Check `/api/health/ai-service` endpoint
- Verify environment variables are saved in Render
- Check Render logs for error messages
- Try asking a different question

### Issue: "Service Unavailable" after adding keys
**Solution:**
- Wait 5 minutes for Render to fully redeploy
- Check Render deployment logs for errors
- Verify both services are running (web service + database)
- Restart the web service manually if needed

## How It Works

The system uses a **two-tier AI service architecture**:

```
User Question
    ↓
1. Try OpenRouter API (Primary)
    ↓ (if fails)
2. Try Gemini API (Fallback)
    ↓ (if both fail)
3. Use Smart Fallback Responses
```

### AI Features Enabled

Once configured, these features become available:

1. **AI Chatbot** (`/api/ai/chat`)
   - Answers general questions
   - Explains academic concepts
   - Solves math problems
   - Provides study tips

2. **Study Plan Generator** (`/api/ai/study-plan`)
   - Creates personalized 2-week study schedules
   - Identifies weak subjects
   - Recommends study techniques

3. **Performance Predictor** (`/api/ai/predict-performance`)
   - Predicts exam scores based on past performance
   - Provides improvement recommendations

4. **AI Tutor Recommendations** (`/api/ai/tutor-recommendations`)
   - Personalized learning strategies
   - Subject-specific study resources

## Security Best Practices

✅ **DO:**
- Store API keys only in environment variables
- Use Render's environment variable feature
- Rotate keys periodically
- Monitor API usage

❌ **DON'T:**
- Commit API keys to Git
- Share keys publicly
- Hardcode keys in source code
- Use the same key across multiple environments

## Cost

Both services offer generous **FREE tiers**:

- **OpenRouter**: Free models available with reasonable rate limits
- **Gemini**: 60 requests per minute free tier

For educational use, the free tiers are typically sufficient.

## Support

If you still have issues:

1. Check service status:
   - OpenRouter: https://status.openrouter.ai
   - Gemini: https://status.cloud.google.com

2. Review documentation:
   - [RENDER_ENV_VARS.md](./RENDER_ENV_VARS.md)
   - [AI_CHATBOT_RENDER_QUICKFIX.md](./AI_CHATBOT_RENDER_QUICKFIX.md)

3. Test locally:
   ```bash
   # Copy environment template
   cp .env.example .env
   
   # Add your API keys to .env
   # Then run verification
   node verify-ai-service.js
   ```

## Summary Checklist

- [ ] Get OpenRouter API key from https://openrouter.ai/keys
- [ ] Get Gemini API key from https://makersuite.google.com/app/apikey (optional)
- [ ] Add `OPENROUTER_API_KEY` to Render environment variables
- [ ] Add `GEMINI_API_KEY` to Render environment variables (optional)
- [ ] Add `GEMINI_MODEL=gemini-1.5-flash` to Render environment variables
- [ ] Save changes and wait for redeployment
- [ ] Check logs for success messages
- [ ] Test `/api/health/ai-service` endpoint
- [ ] Test chatbot with a sample question
- [ ] Verify AI responses are detailed and helpful

**Estimated Setup Time:** 5-10 minutes
**Cost:** FREE (using free tier APIs)

---

**Need Help?** Open an issue on GitHub or check the Render logs for specific error messages.
