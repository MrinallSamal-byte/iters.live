# AI-Powered Features Documentation

## Overview
ITER EduHub now includes comprehensive AI-powered features to enhance student learning experience. These features leverage Google's Gemini AI to provide personalized recommendations, performance predictions, and 24/7 assistance.

## Features Implemented

### 1. 📚 AI Tutor
**Description:** Personalized study recommendations based on student's academic performance, attendance, and learning patterns.

**Key Features:**
- Two-week action plans tailored to individual needs
- Time allocation recommendations per subject
- Subject-specific study techniques
- Motivation tips and mental health advice
- Curated learning resources

**API Endpoint:** `POST /api/ai/tutor-recommendations`

**Request Body:**
```json
{
  "learningStyle": "visual",  // Optional: visual, auditory, kinesthetic
  "goals": "Improve overall academic performance"  // Optional
}
```

**Response:**
```json
{
  "success": true,
  "recommendations": {
    "actionPlan": {
      "week1": [...],
      "week2": [...]
    },
    "timeAllocation": [...],
    "studyTechniques": {...},
    "motivation": [...],
    "resources": [...]
  }
}
```

---

### 2. 🤖 24/7 Chatbot
**Description:** AI-powered chatbot with Gemini integration for instant doubt clearing and general questions.

**Key Features:**
- Context-aware responses
- Role-specific knowledge (Student/Teacher/Admin)
- Page-context detection
- Built-in FAQ database
- Quick action buttons
- Chat history

**API Endpoint:** `POST /api/ai/chat`

**Request Body:**
```json
{
  "question": "How do I improve my marks in Mathematics?",
  "context": "student-marks"  // Optional
}
```

**Response:**
```json
{
  "success": true,
  "answer": "Here are some tips to improve your Mathematics marks: ..."
}
```

**Access:** 
- Available on all pages via floating chatbot widget
- Click the 🤖 icon in the bottom-right corner

---

### 3. 📊 Performance Predictor
**Description:** ML-based prediction of exam results using multi-factor analysis.

**Key Features:**
- Weighted prediction model (40% marks, 25% attendance, 20% assignments, 15% study hours)
- Confidence scoring based on data completeness
- Risk level assessment (low/medium/high)
- Factor-wise contribution analysis
- Improvement potential calculation
- Personalized recommendations

**API Endpoint:** `POST /api/ai/predict-performance`

**Request Body:**
```json
{
  "studyHours": 4,  // Average study hours per day
  "customData": {}  // Optional additional data
}
```

**Response:**
```json
{
  "success": true,
  "prediction": {
    "predictedScore": 78.5,
    "predictedGrade": "B+",
    "category": "Good",
    "confidence": 85.0,
    "factors": {
      "previousMarks": {
        "score": "75.50",
        "impact": "40%",
        "status": "positive"
      },
      // ... other factors
    },
    "recommendations": [...],
    "improvementPotential": 11.5,
    "riskLevel": "low"
  }
}
```

---

### 4. 🎯 Smart Study Plans
**Description:** Auto-generated personalized study schedules focused on weak subjects.

**Key Features:**
- 2-week detailed study schedule
- Day-by-day session breakdown
- Priority-based subject allocation
- Technique recommendations (Pomodoro, active recall, etc.)
- Weekly goals and overall strategy
- Break times and activities

**API Endpoint:** `POST /api/ai/study-plan`

**Request Body:**
```json
{
  "preferences": {
    "studyHours": 4,  // Hours per day
    "preferredTime": "morning"  // morning, afternoon, evening
  }
}
```

**Response:**
```json
{
  "success": true,
  "studyPlan": {
    "weeks": [
      {
        "weekNumber": 1,
        "days": [
          {
            "day": "Monday",
            "sessions": [
              {
                "time": "9:00-11:00",
                "subject": "Mathematics",
                "topics": [...],
                "technique": "Pomodoro Technique"
              }
            ],
            "goals": [...]
          }
        ]
      }
    ],
    "overallStrategy": "...",
    "weeklyGoals": [...]
  }
}
```

---

## User Interface

### AI Assistant Dashboard
**Location:** `/dashboard/student-ai-assistant.html`

**Sections:**
1. **Feature Cards:** Quick access to all 4 AI features
2. **Performance Prediction Display:** Visual representation with charts
3. **Tutor Recommendations:** Structured action plans
4. **Study Plan Viewer:** Week-by-week schedule display

**Navigation:** Added to student sidebar navigation with 🤖 icon

---

## Technical Implementation

### Backend Components

**1. AI Service** (`server/services/ai.service.js`)
- `generateStudyPlan()` - Creates personalized study plans
- `getSubjectRecommendations()` - Analyzes weak areas
- `answerQuestion()` - Handles chatbot queries
- `generateAssignmentFeedback()` - Provides assignment feedback
- `predictExamPerformance()` - ML-based performance prediction
- `getPersonalizedTutorRecommendations()` - AI tutor recommendations

**2. AI Routes** (`server/routes/ai.routes.js`)
- `POST /api/ai/study-plan` - Generate study plan
- `GET /api/ai/recommendations` - Get subject recommendations
- `POST /api/ai/chat` - Chatbot endpoint
- `POST /api/ai/assignment-feedback` - Assignment feedback
- `POST /api/ai/predict-performance` - Performance prediction
- `POST /api/ai/tutor-recommendations` - Tutor recommendations
- `GET /api/ai/study-plans/history` - Study plan history
- `GET /api/ai/predictions/history` - Prediction history

**3. Chatbot Widget** (`client/js/chatbot.js`)
- Role-aware functionality
- Context detection
- FAQ database integration
- Quick actions
- Real-time API communication

### Frontend Components

**1. AI Assistant Page** (`client/dashboard/student-ai-assistant.html`)
- Interactive feature cards
- Dynamic data loading
- Visual charts and graphs
- Responsive design

**2. Chatbot Widget** (All pages)
- Floating button
- Modal interface
- Message history
- Quick actions
- File upload support

---

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Google Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here

# Gemini Model (optional, defaults to gemini-1.5-flash)
GEMINI_MODEL=gemini-1.5-flash
```

**Get API Key:** https://makersuite.google.com/app/apikey or https://aistudio.google.com/app/apikey

### Firebase/Firestore Collections

The following collections are used:
- `study_plans` - Stores generated study plans
- `ai_chat_logs` - Chat history for analytics
- `performance_predictions` - Prediction history
- `tutor_recommendations` - Recommendation history

---

## Usage Examples

### For Students

**1. Get Performance Prediction:**
```javascript
const response = await fetch('/api/ai/predict-performance', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({ studyHours: 4 })
});
const data = await response.json();
console.log('Predicted Score:', data.prediction.predictedScore);
```

**2. Ask Chatbot a Question:**
```javascript
const response = await fetch('/api/ai/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    question: 'How can I improve my performance in Physics?',
    context: 'student-marks'
  })
});
const data = await response.json();
console.log('AI Answer:', data.answer);
```

**3. Generate Study Plan:**
```javascript
const response = await fetch('/api/ai/study-plan', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    preferences: {
      studyHours: 5,
      preferredTime: 'evening'
    }
  })
});
const data = await response.json();
console.log('Study Plan:', data.studyPlan);
```

---

## Fallback Behavior

All AI features have fallback mechanisms when:
- Gemini API key is not configured
- API rate limits are exceeded
- Network issues occur

**Fallback Features:**
- Pre-defined study plan templates
- Rule-based recommendations
- Static FAQ responses
- Basic prediction models

---

## Performance Considerations

**Caching:**
- AI responses are not cached (to ensure freshness)
- Student data is cached for 30 minutes
- Prediction results stored in Firestore for history

**Rate Limiting:**
- API calls are subject to Gemini API limits
- Consider implementing request queuing for high traffic

**Cost Optimization:**
- Use `gemini-1.5-flash` for cost-effective responses
- Implement token limits in prompts
- Cache frequently asked questions

---

## Future Enhancements

**Planned Features:**
1. **Advanced ML Models:** 
   - Neural network-based prediction
   - Time-series analysis for trend prediction
   - Collaborative filtering for peer comparison

2. **Enhanced Chatbot:**
   - Voice input/output
   - Image recognition for problem solving
   - Multi-language support

3. **Smart Insights:**
   - Automated anomaly detection
   - Predictive alerts for at-risk students
   - Personalized learning paths

4. **Integration:**
   - Calendar integration for study plans
   - Email notifications for recommendations
   - Mobile app with push notifications

---

## Troubleshooting

### Issue: Chatbot not responding
**Solution:** 
1. Check if GEMINI_API_KEY is set in .env
2. Verify Firebase/Firestore connection
3. Check browser console for errors
4. Ensure user is authenticated

### Issue: Predictions show "Insufficient Data"
**Solution:**
1. Ensure student has marks and attendance data
2. Verify data is properly stored in Firestore
3. Check if user document exists with required fields

### Issue: Study plan generation fails
**Solution:**
1. Verify API key has sufficient quota
2. Check network connectivity
3. Fallback plan should still be generated

---

## Support

For issues or questions:
- Check console logs for error messages
- Verify environment variables are set correctly
- Ensure Firebase/Firestore is properly configured
- Contact system administrator for API key issues

---

## License

Part of ITER EduHub - College Management System
MIT License

---

**Last Updated:** December 2024
**Version:** 3.2.0
