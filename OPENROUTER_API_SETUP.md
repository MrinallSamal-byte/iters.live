# OpenRouter API Setup Guide

This guide explains how to configure and use the OpenRouter API for AI chatbot features in ITER EduHub.

## Overview

ITER EduHub now uses **OpenRouter API** as the primary AI service provider, with Google Gemini as a fallback option. OpenRouter provides access to multiple free AI models through a single API, offering better reliability through automatic model fallback.

## Note on Scraper Architecture

**Important**: This project now uses a unified Playwright-based scraper. The Python scraper has been removed. CAPTCHA solving is now handled via user-provided input, not automatic AI solving. See `UNIFIED_SCRAPER_ARCHITECTURE.md` for details.

## Features

### Chatbot Features
The system uses powerful language models for educational assistance:
- `mistralai/mistral-small-3.1-24b-instruct:free` - Fast instruction-following model
- `google/gemma-3-4b-it:free` - Compact instruction-tuned model
- `google/gemma-3-12b-it:free` - Larger instruction-tuned model
- `allenai/olmo-3-32b-think:free` - Large reasoning model
- `openai/gpt-oss-120b:free` - Very large open-source model
- `openai/gpt-oss-20b:free` - Medium open-source model

## Setup Instructions

### 1. Get Your OpenRouter API Key

1. Visit [OpenRouter](https://openrouter.ai/)
2. Sign up or log in to your account
3. Navigate to [API Keys](https://openrouter.ai/keys)
4. Create a new API key
5. Copy your API key (starts with `sk-or-v1-`)

### 2. Configure Environment Variables

Edit your `.env` file in the project root:

```bash
# OpenRouter API Configuration (PRIMARY)
OPENROUTER_API_KEY=sk-or-v1-your-api-key-here

# Google Gemini API (FALLBACK - Optional)
GEMINI_API_KEY=your-gemini-api-key-here
```

### 3. Verify Configuration

```bash
npm run verify:ai
```

## How It Works

### Automatic Fallback System

The system implements a robust fallback mechanism:

1. **Primary**: Tries OpenRouter models in sequence
2. **Fallback**: Uses Google Gemini API if OpenRouter fails
3. **Error Handling**: Returns helpful error message if all methods fail

### Model Selection

Models are tried in the order listed above. If one model fails (due to rate limits, errors, or unavailability), the system automatically tries the next model in the list.

## API Usage and Limits

### Free Tier Features
- All models used are from OpenRouter's free tier
- No credit card required
- Rate limits apply per model
- Automatic fallback to other models when limits are reached

### Best Practices
1. **Monitor Usage**: Keep track of your API usage in the OpenRouter dashboard
2. **Set Rate Limits**: Configure appropriate rate limits in your application
3. **Use Fallbacks**: Keep Google APIs configured as fallbacks for reliability
4. **Error Handling**: The system handles errors gracefully and provides informative messages

## Troubleshooting

### Issue: "OpenRouter API key not configured"

**Solution**: Ensure `OPENROUTER_API_KEY` is set in your `.env` file

### Issue: "All OpenRouter models failed"

**Possible Causes**:
1. API key is invalid or expired
2. All models hit rate limits
3. Network connectivity issues

**Solutions**:
1. Verify your API key is correct
2. Wait a few minutes and try again
3. Check your internet connection
4. Verify fallback API (Gemini) is configured

### Issue: Chatbot not responding

**Solution**:
1. Check if OpenRouter API key is valid
2. Ensure Gemini API is configured as fallback
3. Check server logs for detailed error messages
4. Verify the user has proper authentication

## Security Considerations

1. **API Key Protection**
   - Never commit API keys to version control
   - Use environment variables for all API keys
   - Rotate keys regularly
   - Keep `.env` files in `.gitignore`

2. **Rate Limiting**
   - Implement proper rate limiting in your application
   - Monitor API usage to avoid abuse
   - Set appropriate timeouts for API calls

3. **Error Messages**
   - Don't expose API keys in error messages
   - Log errors securely on the server side
   - Provide user-friendly error messages

## Architecture

### Node.js Components

```
server/services/
├── openrouter.service.js    # OpenRouter API integration
├── ai.service.js             # Main AI service with fallback logic
└── soa-scraper.service.js   # Unified Playwright-based scraper
```

## Support

For issues related to:
- **OpenRouter API**: Visit [OpenRouter Support](https://openrouter.ai/docs)
- **This Implementation**: Check the server logs and error messages
- **Feature Requests**: Submit an issue in the project repository

## References

- [OpenRouter Documentation](https://openrouter.ai/docs)
- [OpenRouter Models](https://openrouter.ai/models)
- [OpenRouter API Keys](https://openrouter.ai/keys)
- [Google Gemini API](https://ai.google.dev/)

## Version History

- **v3.3.0**: Unified scraper architecture, removed Python scraper components
- **v3.2.0**: Added OpenRouter API integration with automatic fallback
- Previous versions used Google APIs exclusively
