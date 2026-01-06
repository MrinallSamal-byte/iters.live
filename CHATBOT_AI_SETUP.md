# Chatbot AI Features - Setup and Testing Guide

## Overview

The ITER EduHub chatbot now has AI-powered features using OpenRouter API for answering user questions intelligently. The chatbot can:

- Answer educational questions (math, science, etc.)
- Provide step-by-step solutions to problems
- Give personalized assistance based on user role (student/teacher/admin/guest)
- Fallback to FAQ-based responses when AI is unavailable

## Current Status

✅ **Implemented:**
- Session timeout (20 minutes) clears all user data
- Logout redirects to landing page (index.html) instead of login page
- Chatbot with OpenRouter API integration
- Smart fallback to FAQ when AI is unavailable
- Enhanced error logging for debugging

## OpenRouter API Configuration

The `.env` file has been created with the OpenRouter API key from the example:

```
OPENROUTER_API_KEY=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
```

### Verify API Key is Working

To test if the OpenRouter API key is working on your production server:

1. Start the server:
   ```bash
   npm start
   ```

2. Open the browser console (F12) on any page with the chatbot

3. Try asking a question in the chatbot like:
   - "What is 5 + 3?"
   - "Help me solve this math problem"
   - "Explain integration"

4. Check the browser console for logs:
   - If you see "AI API not available" - The API call failed (check server logs)
   - If you see "AI service unavailable (503)" - API key might be invalid
   - If you get an AI response - Everything is working! ✅

### Check Server Logs

When the server starts, you should see:
```
✅ OpenRouter Service initialized with API key (sk-or-v1-5a9d662a...)
```

If you see warnings about the API key format or missing key, update the `.env` file.

### Get a New API Key (if needed)

If the provided key doesn't work:

1. Go to https://openrouter.ai/keys
2. Sign up or log in
3. Create a new API key
4. Copy the key and update `.env` file:
   ```
   OPENROUTER_API_KEY=your-new-key-here
   ```
5. Restart the server

## Testing the Complete Solution

### Test 1: Session Timeout (20 minutes)

1. Log in as any user (student/teacher/admin)
2. Wait 20 minutes without any activity
3. You should see a warning modal at 18 minutes
4. At 20 minutes, you'll be automatically logged out
5. You should land on the landing page (index.html) with a logout notification

**Quick Test (for development):**
- Change `SESSION_TIMEOUT_MS` in `client/js/session-timeout.js` to `2 * 60 * 1000` (2 minutes)
- This will trigger logout after 2 minutes of inactivity

### Test 2: Logout Redirect

1. Log in as any user
2. Click the logout button in the sidebar
3. Confirm the logout
4. You should be redirected to the landing page (index.html)
5. A notification should appear showing you've been logged out

### Test 3: Chatbot AI Features

**For Guests (on landing page):**
1. Open index.html
2. Click the chatbot icon (bottom right)
3. Try asking:
   - "What is 10 * 5?"
   - "Tell me about ITER"
   - "How do I register?"

**For Authenticated Users:**
1. Log in as student/teacher/admin
2. Open the chatbot
3. Try role-specific questions:
   - Students: "Check my attendance", "Help me solve this problem"
   - Teachers: "How to mark attendance?", "Upload marks"
   - Admins: "Manage users", "View analytics"

**Expected Behavior:**
- Simple questions should get FAQ-based responses (fast)
- Complex/educational questions should attempt AI call first
- If AI is available, you get detailed AI-generated responses
- If AI is unavailable, you get smart FAQ fallbacks
- Math questions have special handling with step-by-step solutions

### Test 4: Cross-Tab Logout

1. Open the site in two browser tabs
2. Log in on both tabs
3. Log out from one tab
4. The other tab should also detect the logout and redirect to landing page

## Troubleshooting

### Chatbot Always Uses Fallback (No AI Responses)

**Check:**
1. Server is running: `npm start`
2. `.env` file exists with `OPENROUTER_API_KEY`
3. Server logs show: "✅ OpenRouter Service initialized"
4. Browser console doesn't show CORS errors
5. Network tab shows `/api/ai/chat` calls (status should be 200, not 503)

**Solution:**
- If 503 error: API key is invalid or missing
- If 500 error: Server error (check server logs)
- If no call is made: Frontend isn't making the request (check browser console)

### Session Timeout Not Working

**Check:**
1. `session-timeout.js` is loaded on dashboard pages
2. Browser console doesn't show errors
3. localStorage/sessionStorage is not disabled in browser

**Solution:**
- Clear browser cache and reload
- Check browser console for errors
- Verify `lastActivityTimestamp` is being updated in localStorage

### Logout Goes to Login Instead of Landing Page

**Check:**
1. Recent changes to `main.js`, `universal-sidebar.js`, `session-timeout.js`
2. Look for hardcoded `/login.html` references

**Solution:**
- All logout functions should redirect to `/index.html`
- Clear browser cache after updates

## Files Modified

### Session Timeout & Logout
- `client/js/session-timeout.js` - Enhanced to clear ALL user data
- `client/js/main.js` - Updated logout function
- `client/js/universal-sidebar.js` - Updated logout redirect
- `client/index.html` - Added logout notification display

### Chatbot AI
- `client/js/chatbot.js` - Enhanced error logging
- `.env` - Created from .env.example with API key
- `server/routes/ai.routes.js` - AI endpoint (already existed)
- `server/services/openrouter.service.js` - OpenRouter integration (already existed)

## Next Steps

1. **Deploy to production** - Ensure `.env` file is on the server
2. **Test API key** - Run `node test-openrouter-api.js` on production server
3. **Monitor logs** - Watch server logs for AI API calls
4. **Get user feedback** - Ask users to test chatbot features
5. **Update API key if needed** - If free tier runs out, get a paid key or new free key

## Support

If you need help:
1. Check server logs: `npm start` and watch console
2. Check browser console: F12 → Console tab
3. Look for error messages in both places
4. Test the OpenRouter API: `node test-openrouter-api.js`
