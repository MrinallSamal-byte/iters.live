# AI Chat Endpoint Fix - Complete Documentation

## Overview

This document describes the fix for the `/api/ai/chat` endpoint that was returning `{"success": false, "message": "No token provided"}` error even when the `OPENROUTER_API_KEY` was correctly configured.

## Problem Statement

The chatbot was failing with the following issues:
1. **"No token provided" error**: The endpoint was requiring authentication for all users, including guests
2. **Incorrect field names**: The endpoint expected `question` but the specification required `message`
3. **Wrong response format**: The endpoint returned `answer` instead of `response`
4. **No service availability check**: The endpoint didn't check if OpenRouter API key was configured before attempting to use it

## Root Cause

The `/api/ai/chat` endpoint in `server/routes/ai.routes.js` had several issues:
- It required authentication via `verifyToken` middleware
- It used `aiService.answerQuestion()` which had additional layers of abstraction
- It didn't properly check if the OpenRouter service was available
- The response format didn't match the expected specification

## Solution

### 1. Server-Side Changes (`server/routes/ai.routes.js`)

#### Updated Endpoint Signature
```javascript
// Before
router.post('/chat', verifyToken, async (req, res) => { ... });

// After
router.post('/chat', optionalAuth, async (req, res) => { ... });
```

**Key Changes:**
- Changed from `verifyToken` (required auth) to `optionalAuth` (optional auth)
- This allows both authenticated users and guests to use the chatbot

#### Updated Request Handling
```javascript
// Accept both 'message' (primary) and 'question' (fallback)
const { message, question, context, systemPrompt } = req.body;
const userMessage = message || question;

// Improved validation
if (!userMessage || typeof userMessage !== 'string' || userMessage.trim() === '') {
    return res.status(400).json({
        success: false,
        message: 'Message is required'
    });
}
```

**Key Changes:**
- Accepts both `message` (primary) and `question` (backward compatibility)
- Validates for empty/whitespace-only strings
- Supports optional `context` and `systemPrompt` parameters

#### Added Service Availability Check
```javascript
// Check if OpenRouter service is available
const openRouterService = require('../services/openrouter.service');
if (!openRouterService.isAvailable()) {
    return res.status(503).json({
        success: false,
        message: 'AI service is currently unavailable. Please check if OPENROUTER_API_KEY is configured.'
    });
}
```

**Key Changes:**
- Checks if `OPENROUTER_API_KEY` is configured before attempting to use the service
- Returns clear 503 error with helpful message when service is unavailable

#### Direct OpenRouter Integration
```javascript
// Call OpenRouter service directly
const response = await openRouterService.answerQuestion(
    userMessage,
    context || '',
    systemPrompt || null
);
```

**Key Changes:**
- Calls `openRouterService` directly instead of going through `aiService`
- This ensures we use the configured OpenRouter API key

#### Updated Response Format
```javascript
// Return response in expected format
res.json({
    success: true,
    response: response,  // Changed from 'answer' to 'response'
    timestamp: new Date().toISOString()
});
```

**Key Changes:**
- Response field is now `response` instead of `answer`
- Added `timestamp` field
- Follows the specification exactly

### 2. Client-Side Changes (`client/js/chatbot.js`)

#### Updated Request Format
```javascript
// Before
body: JSON.stringify({ question: message, role: this.userRole })

// After
const userRole = this.userRole || 'guest';
const pageContext = this.pageContext || 'general';
const contextStr = `User role: ${userRole}, Page context: ${pageContext}`;

body: JSON.stringify({ 
    message: message,
    context: contextStr
})
```

**Key Changes:**
- Sends `message` instead of `question`
- Includes user role and page context for better AI responses
- Safely handles undefined values

#### Removed Authentication Requirement
```javascript
// Before
const token = localStorage.getItem('accessToken');
if (token) {
    const response = await fetch('/api/ai/chat', { ... });
}

// After
const token = localStorage.getItem('accessToken');
const headers = { 'Content-Type': 'application/json' };

// Add authorization header if token exists
if (token) {
    headers['Authorization'] = `Bearer ${token}`;
}

const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({ ... })
});
```

**Key Changes:**
- Makes API call regardless of authentication status
- Includes token if available, but doesn't require it
- Works for both authenticated users and guests

#### Updated Response Handling
```javascript
// Before
if (data.success && data.answer) {
    return data.answer;
}

// After
if (data.success && data.response) {
    return data.response;
}
```

**Key Changes:**
- Handles `response` field instead of `answer`
- Matches the new server response format

#### Added 503 Error Handling
```javascript
if (response.status === 503) {
    // AI service unavailable - fall back to FAQ
    console.log('AI service unavailable (503), using FAQ fallback');
}
```

**Key Changes:**
- Gracefully handles service unavailable errors
- Falls back to FAQ-based responses when AI service is not configured

### 3. Middleware Changes (`server/middleware/auth.js`)

No changes were needed to the middleware - we utilized the existing `optionalAuth` middleware which was already available.

## API Specification

### Request Format

**Endpoint:** `POST /api/ai/chat`

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <token>" // Optional
}
```

**Body:**
```json
{
  "message": "User's question here",          // Required (or use 'question' for backward compatibility)
  "context": "Optional context",              // Optional
  "systemPrompt": "Optional custom system prompt" // Optional
}
```

### Response Formats

#### Success Response (200 OK)
```json
{
  "success": true,
  "response": "AI generated response here",
  "timestamp": "2025-12-11T00:00:00.000Z"
}
```

#### Bad Request (400)
```json
{
  "success": false,
  "message": "Message is required"
}
```

#### Service Unavailable (503)
```json
{
  "success": false,
  "message": "AI service is currently unavailable. Please check if OPENROUTER_API_KEY is configured."
}
```

#### Internal Server Error (500)
```json
{
  "success": false,
  "message": "Failed to process your request. Please try again.",
  "error": "Error details (only in development mode)"
}
```

## Testing

### Unit Tests

Created comprehensive unit tests in `__tests__/ai-chat.test.js` covering:
- Input validation
- Response format
- Error handling
- Backward compatibility

### Integration Test

Created integration test script in `test-ai-chat-endpoint.js` that tests:
- Missing message field validation
- Guest user access (no authentication)
- Backward compatibility with `question` field
- Custom `systemPrompt` support
- Service unavailability handling

### Manual Testing

To manually test the endpoint:

1. **Test without authentication (guest user):**
```bash
curl -X POST http://localhost:5000/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is 2 + 2?"}'
```

2. **Test with authentication:**
```bash
curl -X POST http://localhost:5000/api/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-token>" \
  -d '{"message": "Explain photosynthesis", "context": "Biology topic"}'
```

3. **Test service unavailability:**
   - Remove or unset `OPENROUTER_API_KEY` environment variable
   - Make a request - should return 503 error

## Configuration

### Required Environment Variables

```bash
# OpenRouter API Key (required for AI functionality)
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

### Getting an OpenRouter API Key

1. Visit https://openrouter.ai/keys
2. Sign up or log in
3. Create a new API key
4. Copy the key (format: `sk-or-v1-...`)
5. Add to your `.env` file

## Security Considerations

### 1. Optional Authentication
- The endpoint uses `optionalAuth` middleware which attempts to authenticate if a token is provided
- If no token is provided, the request proceeds as a guest user
- This is safe because:
  - Guest users can still use the chatbot for general questions
  - Authenticated users get their chats logged for analytics
  - No sensitive data is exposed through the endpoint

### 2. Input Validation
- Validates that `message` is a non-empty string
- Checks for whitespace-only strings
- Type checking ensures string input

### 3. Error Handling
- Errors are caught and logged server-side
- Error details are only exposed in development mode
- Proper HTTP status codes are used

### 4. Rate Limiting
- The endpoint is under the `/api/` route which has rate limiting applied
- Default: 100 requests per 15 minutes per IP

## Backward Compatibility

The implementation maintains backward compatibility by:

1. **Supporting both `message` and `question` fields:**
   - New clients should use `message`
   - Old clients using `question` will continue to work
   - `message` takes priority if both are provided

2. **Logging format:**
   - Still logs to Firestore when user is authenticated
   - Gracefully handles logging failures
   - Compatible with existing analytics

## Troubleshooting

### Issue: "AI service is currently unavailable"

**Symptoms:** Chatbot returns 503 error

**Solutions:**
1. Check if `OPENROUTER_API_KEY` is set in your environment variables
2. Verify the API key format is correct (starts with `sk-or-v1-`)
3. Check if the API key is valid by testing it directly with OpenRouter
4. Ensure the environment variables are loaded (check `process.env.OPENROUTER_API_KEY`)

### Issue: "No token provided" (for authenticated endpoints)

**Symptoms:** User is logged in but gets authentication error

**Solutions:**
1. Check if the token is being sent in the Authorization header
2. Verify the token format is `Bearer <token>`
3. Check if the token is expired
4. Ensure the user exists in Firestore

### Issue: Chatbot shows fallback responses instead of AI responses

**Symptoms:** Chatbot works but always uses FAQ responses

**Solutions:**
1. Open browser console and check for error messages
2. Verify the API endpoint is reachable
3. Check if the 503 error is being returned
4. Ensure OPENROUTER_API_KEY is configured

## Performance Considerations

1. **Caching:** Consider implementing response caching for common questions
2. **Rate Limiting:** Monitor API usage to avoid exceeding OpenRouter rate limits
3. **Timeout:** Consider adding request timeout to prevent long-running requests
4. **Logging:** Firestore logging is async and won't block the response

## Future Improvements

1. **Response Caching:** Cache common questions and responses
2. **Analytics:** Track usage patterns and popular questions
3. **Model Selection:** Allow dynamic model selection based on question type
4. **Streaming Responses:** Implement streaming for longer AI responses
5. **Conversation History:** Maintain conversation context for multi-turn dialogues

## Related Files

- `server/routes/ai.routes.js` - Main endpoint implementation
- `client/js/chatbot.js` - Client-side chatbot implementation
- `server/services/openrouter.service.js` - OpenRouter API integration
- `server/middleware/auth.js` - Authentication middleware
- `__tests__/ai-chat.test.js` - Unit tests
- `test-ai-chat-endpoint.js` - Integration test script

## Success Criteria

✅ All success criteria met:
- [x] `/api/ai/chat` endpoint accepts POST requests
- [x] Endpoint validates input and returns 400 for invalid requests
- [x] Endpoint returns 503 when API key is not configured
- [x] Endpoint successfully calls OpenRouter API and returns responses (when configured)
- [x] Endpoint handles errors gracefully with appropriate status codes
- [x] Chatbot UI receives proper responses from the API
- [x] "No token provided" error is resolved
- [x] Works for both authenticated and guest users
- [x] Maintains backward compatibility

## Conclusion

The fix successfully resolves the "No token provided" error by:
1. Making authentication optional (using `optionalAuth` middleware)
2. Properly checking if the OpenRouter service is available
3. Returning clear error messages when the service is unavailable
4. Supporting both authenticated and guest users
5. Following the API specification exactly

The implementation is secure, well-tested, and maintains backward compatibility while providing a better user experience.
