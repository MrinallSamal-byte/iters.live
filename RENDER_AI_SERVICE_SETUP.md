# 🤖 Setting Up AI Services on Render

This guide explains how to configure AI services (OpenRouter and Google Gemini) for your ITER EduHub deployment on Render.

## Problem

If you see this message in the chatbot:
> 🤔 Interesting question! For detailed answers to general questions, I need the AI service which is currently unavailable.

It means the AI service environment variables are not configured on Render.

## Solution: Configure AI Service Environment Variables

### Step 1: Get Your API Keys

#### OpenRouter API Key (PRIMARY - Recommended)

1. Visit [OpenRouter](https://openrouter.ai/)
2. Sign up or log in to your account
3. Navigate to [API Keys](https://openrouter.ai/keys)
4. Click "Create Key"
5. Copy your API key (starts with `sk-or-v1-`)

**Why OpenRouter?**
- Access to multiple free AI models
- Automatic fallback between models
- No credit card required
- Better reliability

#### Google Gemini API Key (FALLBACK - Optional)

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Get API Key" or "Create API Key"
4. Copy your API key (starts with `AIza`)

**Note:** Gemini is optional but recommended as a fallback if OpenRouter fails.

### Step 2: Add Environment Variables to Render

1. **Go to your Render Dashboard**: https://dashboard.render.com
2. **Select your service** (e.g., `iter-aio`)
3. **Click "Environment"** in the left sidebar
4. **Add the following variables:**

#### Required Variables:

```
OPENROUTER_API_KEY
Value: sk-or-v1-your-actual-key-here
```

#### Optional Variables (for fallback):

```
GEMINI_API_KEY
Value: AIzaYourActualKeyHere

GEMINI_MODEL
Value: gemini-1.5-flash
```

### Step 3: Save and Redeploy

1. Click "Save Changes" at the bottom
2. Render will automatically redeploy your service
3. Wait 2-3 minutes for the deployment to complete

### Step 4: Verify It's Working

1. **Visit your deployed app** (e.g., `https://iter-aio.onrender.com`)
2. **Login** with a demo account:
   - Student: `STU20250001` / `Student@123`
3. **Open the chatbot** (click the chat icon in bottom-right)
4. **Ask a general question** like:
   - "What is photosynthesis?"
   - "Explain Newton's laws of motion"
   - "How does recursion work in programming?"

5. **Expected Result**: You should get a detailed AI-generated response instead of the "unavailable" message.

### Step 5: Check Server Logs (Optional)

To verify the AI service is initialized correctly:

1. Go to your Render Dashboard
2. Click on your service
3. Click "Logs" tab
4. Look for these messages on startup:

**✅ Success (OpenRouter configured):**
```
✅ OpenRouter Service initialized with API key
✅ AI Service using OpenRouter API (primary)
```

**⚠️ Fallback (Only Gemini configured):**
```
⚠️ OpenRouter Service initialized without API key - features will use fallback
✅ AI Service initialized with Gemini API (fallback)
```

**❌ Problem (No AI service configured):**
```
⚠️ OpenRouter Service initialized without API key - features will use fallback
⚠️ AI Service initialized without Gemini API key
⚠️ AI Service initialized without any AI provider - using fallback responses
```

## What AI Features Are Enabled

Once configured, these features will work:

### 1. AI Chatbot (`/api/ai/chat`)
- Answer study-related questions
- Help with homework and assignments
- Explain academic concepts
- Solve math and programming problems
- Answer general knowledge questions

### 2. Personalized Study Plans (`/api/ai/study-plan`)
- Generate 2-week study plans
- Prioritize weak subjects
- Recommend study techniques
- Schedule break times

### 3. Performance Predictions (`/api/ai/predict-performance`)
- Predict exam performance based on historical data
- ML-based analysis of marks, attendance, and study hours
- Identify risk levels and improvement potential

### 4. AI Tutor Recommendations (`/api/ai/tutor-recommendations`)
- Personalized learning recommendations
- Study technique suggestions
- Resource recommendations
- Time allocation guidance

### 5. Subject Recommendations (`/api/ai/recommendations`)
- Identify weak subjects
- Priority-based action plans
- Study tips per subject

## Cost Information

### OpenRouter (PRIMARY)
- **Cost**: FREE
- **Models**: Multiple free models available
  - `mistralai/mistral-small-3.1-24b-instruct:free`
  - `google/gemma-3-4b-it:free`
  - `google/gemma-3-12b-it:free`
  - And more...
- **Limits**: Generous free tier, no credit card required
- **Reliability**: Automatic fallback between models

### Google Gemini (FALLBACK)
- **Cost**: FREE
- **Model**: `gemini-1.5-flash` (recommended)
- **Limits**: 60 requests per minute (free tier)
- **Reliability**: Very reliable, but single model

## Troubleshooting

### Issue: Still showing "AI service unavailable" after adding keys

**Solutions:**
1. Verify the API keys are correct (no spaces, complete key)
2. Make sure you clicked "Save Changes" in Render
3. Wait for the redeployment to complete (2-3 minutes)
4. Check server logs for initialization messages
5. Try clearing browser cache and reloading

### Issue: OpenRouter returns errors

**Solutions:**
1. Verify your OpenRouter API key is valid
2. Check OpenRouter dashboard for API status
3. The system will automatically fall back to Gemini if configured
4. Check server logs for specific error messages

### Issue: Gemini returns errors

**Solutions:**
1. Verify your Gemini API key is valid
2. Check if you exceeded the free tier limits (60 req/min)
3. Make sure the API key has the correct permissions
4. Try regenerating the API key in Google AI Studio

### Issue: Want to test locally

**Steps:**
1. Copy `.env.example` to `.env`
2. Add your API keys to `.env`:
   ```
   OPENROUTER_API_KEY=sk-or-v1-your-key-here
   GEMINI_API_KEY=AIzaYourKeyHere
   GEMINI_MODEL=gemini-1.5-flash
   ```
3. Run `npm start`
4. Test the chatbot at `http://localhost:5000`

## Security Best Practices

1. **Never commit API keys** to git repositories
2. **Use environment variables** for all sensitive data
3. **Rotate keys periodically** for security
4. **Monitor usage** in OpenRouter/Gemini dashboards
5. **Set up rate limiting** if you see abuse

## Additional Resources

- [OpenRouter Documentation](https://openrouter.ai/docs)
- [Google Gemini API Documentation](https://ai.google.dev/docs)
- [ITER EduHub AI Features Guide](./AI_FEATURES_DOCUMENTATION.md)
- [OpenRouter API Setup Guide](./OPENROUTER_API_SETUP.md)

## Summary

1. ✅ Get OpenRouter API key from https://openrouter.ai/keys
2. ✅ (Optional) Get Gemini API key from https://makersuite.google.com/app/apikey
3. ✅ Add `OPENROUTER_API_KEY` to Render environment variables
4. ✅ (Optional) Add `GEMINI_API_KEY` and `GEMINI_MODEL` 
5. ✅ Save changes and wait for redeployment
6. ✅ Test the chatbot with a general question
7. ✅ Check server logs to verify initialization

**Need help?** Check the troubleshooting section above or open an issue on GitHub.
