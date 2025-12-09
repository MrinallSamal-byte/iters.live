# OpenRouter API - Quick Start Guide

Get up and running with OpenRouter API in 5 minutes!

## Step 1: Get Your API Key (2 minutes)

1. Visit [OpenRouter.ai](https://openrouter.ai/)
2. Sign up or log in
3. Go to [API Keys](https://openrouter.ai/keys)
4. Click "Create Key"
5. Copy your API key (starts with `sk-or-v1-`)

## Step 2: Configure Environment (1 minute)

### For the Main Server

Edit `.env` file in the project root:

```bash
# Add this line
OPENROUTER_API_KEY=sk-or-v1-your-api-key-here
```

### For the Python Scraper

Edit `scraper/.env` file:

```bash
# Add this line
OPENROUTER_API_KEY=sk-or-v1-your-api-key-here
```

## Step 3: Install Dependencies (1 minute)

```bash
# Install Node.js dependencies (skip puppeteer)
PUPPETEER_SKIP_DOWNLOAD=true npm install

# Install Python dependencies
cd scraper
pip3 install python-dotenv requests
cd ..
```

## Step 4: Test Your Setup (1 minute)

```bash
# Test the integration
node test-openrouter-integration.js
```

Expected output:
```
╔════════════════════════════════════════════════════════════════╗
║          OpenRouter API Integration Test Suite                ║
╚════════════════════════════════════════════════════════════════╝

=== Testing Chatbot Feature ===
Testing with a simple question...
✅ Chatbot Response: ...

=== Testing Study Plan Generation ===
Generating a sample study plan...
✅ Study Plan Generated Successfully

=== Testing CAPTCHA Solving Feature ===
✅ OpenRouter service is configured for CAPTCHA solving

╔════════════════════════════════════════════════════════════════╗
║                         Test Results                           ║
╚════════════════════════════════════════════════════════════════╝
Chatbot:    ✅ PASSED
Study Plan: ✅ PASSED
CAPTCHA:    ✅ CONFIGURED

🎉 All tests passed! OpenRouter integration is working correctly.
```

## You're Done! 🎉

Your ITER EduHub is now powered by OpenRouter API!

### What's Working Now:

✅ **CAPTCHA Solving**
- Automatic CAPTCHA text extraction in portal scraper
- 2 vision models with automatic fallback
- Falls back to Google Vision if needed

✅ **AI Chatbot**
- Smart educational assistant
- Answers student questions
- 6 powerful models with automatic fallback
- Falls back to Google Gemini if needed

✅ **Study Plans**
- Personalized study plan generation
- Based on student performance data
- AI-powered recommendations

## Quick Troubleshooting

### Issue: API Key Not Working

**Solution:**
1. Verify your API key at https://openrouter.ai/keys
2. Make sure it starts with `sk-or-v1-`
3. Check for any extra spaces in `.env` file
4. Restart your server after adding the key

### Issue: Tests Failing

**Solution:**
1. Ensure you have internet connection
2. Check if dependencies are installed
3. Verify `.env` file has the correct key
4. Wait a minute and try again (rate limits)

### Issue: "Module not found" errors

**Solution:**
```bash
# Reinstall dependencies
PUPPETEER_SKIP_DOWNLOAD=true npm install
cd scraper && pip3 install -r requirements.txt
```

## Next Steps

### Optional: Configure Fallback APIs

For even more reliability, configure fallback services:

```bash
# Add to .env
GEMINI_API_KEY=your-gemini-key-here
GOOGLE_VISION_API_KEY=your-vision-key-here
```

**Note:** These are optional! The system works great with just OpenRouter.

### Learn More

- 📖 [Full Setup Guide](OPENROUTER_API_SETUP.md)
- 📊 [Implementation Summary](OPENROUTER_INTEGRATION_SUMMARY.md)
- 🔧 [OpenRouter Documentation](https://openrouter.ai/docs)

## Support

Need help? Check out:
- [Troubleshooting Guide](OPENROUTER_API_SETUP.md#troubleshooting)
- [OpenRouter Support](https://openrouter.ai/docs)
- Project issue tracker

---

**Time to complete:** ~5 minutes
**Difficulty:** Easy
**Cost:** Free (using free tier models)

Enjoy your enhanced AI-powered ITER EduHub! 🚀
