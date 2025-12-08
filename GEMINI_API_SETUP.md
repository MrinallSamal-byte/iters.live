# Gemini API Setup Guide

This guide will help you set up the Google Gemini API for the AI chatbot and other AI-powered features in ITER EduHub.

## Prerequisites

- A Google account
- Access to the Google AI Studio

## Steps to Get Your Gemini API Key

### 1. Visit Google AI Studio

Go to: [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

Or alternatively: [https://makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)

### 2. Sign In

Sign in with your Google account if you haven't already.

### 3. Create API Key

1. Click on "Create API key" button
2. Choose your Google Cloud project or create a new one
3. Your API key will be generated

### 4. Copy Your API Key

Copy the generated API key that starts with `AIza...`

⚠️ **Important**: Keep this key secure and never share it publicly!

## Configuration

### Option 1: Environment Variables (Recommended)

1. Create a `.env` file in the root directory (if it doesn't exist):
   ```bash
   cp .env.example .env
   ```

2. Add your Gemini API key to the `.env` file:
   ```env
   GEMINI_API_KEY=your-actual-api-key-here
   GEMINI_MODEL=gemini-1.5-flash
   ```

3. Restart your server for changes to take effect.

### Option 2: Deployment Platform Environment Variables

If you're deploying to Vercel, Railway, Azure, etc., set the environment variables in your deployment platform:

**Vercel:**
```bash
vercel env add GEMINI_API_KEY
```

**Railway:**
- Go to your project settings → Variables
- Add: `GEMINI_API_KEY` = `your-api-key`

**Azure:**
```bash
az webapp config appsettings set --name <app-name> --resource-group <resource-group> --settings GEMINI_API_KEY=your-api-key
```

## Verification

### Test the AI Service

Run the test script to verify your API key is working:

```bash
node test-ai-service.js
```

Expected output:
```
✅ AI Service initialized with Gemini API
✅ Gemini AI client initialized
✅ AI service is working and generating responses!
```

### Test in the Application

1. Log in to the application
2. Click the chatbot icon (🤖) in the bottom-right corner
3. Ask a general question like "What is machine learning?"
4. The AI should provide a detailed response

## AI Features Using Gemini API

Once configured, the following features will use the Gemini API:

### 1. 🤖 AI Chatbot
- 24/7 assistance for students
- Answers academic questions
- Helps with math problems
- Provides study tips

### 2. 📚 AI Tutor
- Personalized study recommendations
- Two-week action plans
- Subject-specific study techniques

### 3. 📊 Performance Predictor
- Exam performance predictions
- Personalized improvement recommendations

### 4. 📝 Assignment Feedback
- AI-powered feedback on assignments
- Suggestions for improvement

### 5. 📈 Study Plan Generator
- Customized study schedules
- Priority subject identification

## Troubleshooting

### "AI service is currently unavailable"

**Cause**: The Gemini API key is not set or invalid.

**Solutions**:
1. Verify your `.env` file has the correct `GEMINI_API_KEY`
2. Check that the API key is valid (starts with "AIza")
3. Restart your server after setting the environment variable
4. Make sure you're logged in when using the chatbot

### "I'm currently unable to process questions"

**Cause**: The chatbot can't authenticate your request.

**Solutions**:
1. Make sure you're logged in to the application
2. Check that the `accessToken` is stored in localStorage
3. Clear your browser cache and log in again

### API Rate Limits

Google Gemini has rate limits on the free tier:
- 60 requests per minute
- 1,500 requests per day

If you hit these limits, you may need to:
1. Wait for the rate limit to reset
2. Upgrade to a paid plan
3. Optimize your usage to reduce requests

## Security Best Practices

1. ✅ **Never commit** your `.env` file to version control
2. ✅ **Add `.env` to `.gitignore`** (already done in this project)
3. ✅ **Use environment variables** for API keys in production
4. ✅ **Rotate your API keys** periodically
5. ✅ **Monitor your API usage** in Google AI Studio

## API Key Restrictions (Optional but Recommended)

For production deployments, restrict your API key:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to "Credentials"
3. Click on your API key
4. Add restrictions:
   - **Application restrictions**: HTTP referrers (website)
   - **API restrictions**: Restrict to Generative Language API
   - **Referrer**: Add your domain (e.g., `yourdomain.com/*`)

## Free Tier Limits

Google Gemini Free Tier includes:
- ✅ 60 requests per minute
- ✅ 1,500 requests per day
- ✅ 32,000 tokens per minute
- ✅ 50,000 tokens per day

This is usually sufficient for small to medium deployments.

## Support

If you continue to experience issues:

1. Check the server logs for detailed error messages
2. Verify your API key in Google AI Studio
3. Test the API key using the test script
4. Contact support or open an issue on GitHub

## Additional Resources

- [Google AI Studio](https://aistudio.google.com/)
- [Gemini API Documentation](https://ai.google.dev/docs)
- [Google Generative AI SDK for Node.js](https://www.npmjs.com/package/@google/generative-ai)
