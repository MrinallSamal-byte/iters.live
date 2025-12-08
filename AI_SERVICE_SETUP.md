# AI Service Setup Guide

## Overview
The ITER EduHub platform includes an AI-powered chatbot that uses Google's Gemini API to answer student questions, provide study recommendations, and generate personalized study plans.

## Configuration

### API Key Setup
The AI service requires a Google Gemini API key to function. This has been configured in the `.env` file:

```
GEMINI_API_KEY=AIzaSyB5aszVVX1UQuv0MEJOt0QumbnSa4x5z5A
GEMINI_MODEL=gemini-1.5-flash
```

### How It Works

1. **AI Service**: Located in `server/services/ai.service.js`
   - Initializes Google Gemini AI with the API key from environment variables
   - Provides methods for answering questions, generating study plans, and making predictions

2. **Chatbot**: Located in `client/js/chatbot.js`
   - Smart role-aware assistant that adapts to user role (student, teacher, admin, guest)
   - Falls back to local FAQ database when AI service is unavailable
   - Can solve math problems and provide detailed explanations

3. **API Routes**: Located in `server/routes/ai.routes.js`
   - `/api/ai/chat` - Answer student questions
   - `/api/ai/study-plan` - Generate personalized study plans
   - `/api/ai/recommendations` - Get subject recommendations
   - `/api/ai/predict-performance` - ML-based exam performance prediction
   - `/api/ai/tutor-recommendations` - Personalized AI tutor recommendations

## Features

### For Students
- **Question Answering**: Ask any academic or general question
- **Math Solving**: Solve mathematical problems with step-by-step explanations
- **Study Plans**: Get personalized 2-week study plans
- **Performance Prediction**: Predict exam scores based on attendance and marks
- **Subject Recommendations**: Get AI recommendations for weak subjects

### For Teachers
- **Assignment Feedback**: Get AI-generated feedback on student assignments
- **Question Bank**: AI assistance in creating educational content

### Fallback Behavior
If the AI service is unavailable (no API key or network issues), the chatbot will:
- Use an extensive local FAQ database
- Provide helpful navigation links
- Guide users to appropriate resources
- Still handle basic math calculations

## Verification

To verify the AI service is configured correctly:

```bash
# Check if .env file exists and has the API key
grep GEMINI_API_KEY .env

# Expected output:
# GEMINI_API_KEY=AIzaSyB5aszVVX1UQuv0MEJOt0QumbnSa4x5z5A
```

## Troubleshooting

### "AI service which is currently unavailable" Message
This message appears when:
1. The `.env` file doesn't exist or doesn't have `GEMINI_API_KEY`
2. The API key is invalid
3. There are network connectivity issues
4. API quota has been exceeded

**Solution**: Ensure `.env` file exists with the correct API key (see Configuration section above)

### API Quota Issues
If you exceed the free tier quota:
1. Get a new API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Update `GEMINI_API_KEY` in `.env`
3. Consider upgrading to a paid plan for higher quotas

## Security Note

⚠️ **Important**: The `.env` file containing API keys should NEVER be committed to version control. It's already listed in `.gitignore` to prevent accidental commits.

## Setup from Scratch

If setting up a new environment:

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. The `.env` file will already have the correct API key configured

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start the server:
   ```bash
   npm run dev
   ```

The AI chatbot will now be fully functional!

## Additional Resources

- [Google Gemini API Documentation](https://ai.google.dev/docs)
- [API Key Management](https://aistudio.google.com/app/apikey)
- [Rate Limits and Quotas](https://ai.google.dev/pricing)
