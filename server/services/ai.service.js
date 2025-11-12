const axios = require('axios');

/**
 * AI Service for Educational Assistance
 * Provides personalized study plans, recommendations, and Q&A
 * Part of ITER EduHub Enhancement Suite
 */
class AIService {
    constructor() {
        this.openaiKey = process.env.OPENAI_API_KEY;
        this.baseURL = 'https://api.openai.com/v1/chat/completions';
        this.model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
    }

    /**
     * Generate personalized study plan based on student performance
     */
    async generateStudyPlan(studentData) {
        const { subjects, attendance, marks, preferences } = studentData;
        
        const prompt = `As an educational AI assistant, create a personalized 2-week study plan for a college student with the following profile:

Subjects: ${subjects.join(', ')}
Attendance: ${JSON.stringify(attendance)}
Recent Marks: ${JSON.stringify(marks)}
Study Preferences: ${preferences.studyHours}h/day, preferred time: ${preferences.preferredTime}

Generate a detailed study plan with:
1. Daily study schedule
2. Priority subjects based on weak areas
3. Recommended study techniques
4. Break times and activities
5. Weekly revision schedule

Format as JSON with structure:
{
    "weeks": [
        {
            "weekNumber": 1,
            "days": [
                {
                    "day": "Monday",
                    "sessions": [
                        {
                            "time": "9:00-11:00",
                            "subject": "",
                            "topics": [],
                            "technique": ""
                        }
                    ],
                    "goals": []
                }
            ]
        }
    ],
    "overallStrategy": "",
    "weeklyGoals": []
}`;

        try {
            if (!this.openaiKey) {
                console.log('OpenAI API key not configured, using fallback study plan');
                return this.getFallbackStudyPlan(studentData);
            }

            const response = await axios.post(
                this.baseURL,
                {
                    model: this.model,
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.7,
                    max_tokens: 2000
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.openaiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            const content = response.data.choices[0].message.content;
            // Try to extract JSON from response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            
            return this.getFallbackStudyPlan(studentData);
        } catch (error) {
            console.error('AI Service Error:', error.message);
            return this.getFallbackStudyPlan(studentData);
        }
    }

    /**
     * Get subject recommendations based on performance
     */
    async getSubjectRecommendations(marks, attendance) {
        // Analyze weak areas
        const weakSubjects = marks
            .filter(m => m.percentage < 60)
            .map(m => m.subject);
        
        const lowAttendance = attendance
            .filter(a => a.percentage < 75)
            .map(a => a.subject);

        return {
            focusAreas: [...new Set([...weakSubjects, ...lowAttendance])],
            recommendations: this.generateRecommendations(weakSubjects, lowAttendance),
            studyTips: this.getStudyTips([...new Set([...weakSubjects, ...lowAttendance])]),
            priorityLevel: this.calculatePriorityLevel(marks, attendance)
        };
    }

    /**
     * Answer student questions using AI
     */
    async answerQuestion(question, context) {
        const prompt = `You are a helpful college professor. Answer this student question clearly and concisely:

Question: ${question}
${context ? `Context: ${context}` : ''}

Provide a detailed but easy-to-understand answer. Include examples if relevant.`;

        try {
            if (!this.openaiKey) {
                return "I'm currently unable to process questions. Please try again later or contact your instructor.";
            }

            const response = await axios.post(
                this.baseURL,
                {
                    model: this.model,
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.7,
                    max_tokens: 500
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.openaiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 20000
                }
            );

            return response.data.choices[0].message.content;
        } catch (error) {
            console.error('AI chat error:', error.message);
            return "I'm sorry, I'm having trouble processing your question right now. Please try again later.";
        }
    }

    /**
     * Generate assignment feedback and suggestions
     */
    async generateAssignmentFeedback(assignmentText, rubric) {
        const prompt = `Analyze this student assignment and provide constructive feedback:

Assignment: ${assignmentText.substring(0, 1000)}
Rubric: ${rubric || 'Standard academic rubric'}

Provide:
1. Strengths (2-3 points)
2. Areas for improvement (2-3 points)
3. Specific suggestions
4. Estimated grade range

Format as JSON.`;

        try {
            if (!this.openaiKey) {
                return this.getBasicFeedback();
            }

            const response = await axios.post(
                this.baseURL,
                {
                    model: this.model,
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.6,
                    max_tokens: 600
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.openaiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            const content = response.data.choices[0].message.content;
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            
            return this.getBasicFeedback();
        } catch (error) {
            console.error('Assignment feedback error:', error.message);
            return this.getBasicFeedback();
        }
    }

    // Helper methods
    getFallbackStudyPlan(studentData) {
        const { subjects, preferences } = studentData;
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const studyHours = preferences.studyHours || 4;
        
        const weeks = [1, 2].map(weekNum => ({
            weekNumber: weekNum,
            days: days.map((day, index) => ({
                day,
                sessions: this.generateDailySessions(subjects, studyHours, index),
                goals: [`Complete ${subjects[index % subjects.length]} assignments`, "Review lecture notes"]
            }))
        }));

        return {
            weeks,
            overallStrategy: "Focus on weak subjects and maintain consistent study hours. Use active recall and spaced repetition techniques.",
            weeklyGoals: [
                "Complete all pending assignments",
                "Review and summarize lecture notes",
                "Practice previous year questions",
                "Attend all classes and maintain >85% attendance"
            ]
        };
    }

    generateDailySessions(subjects, hours, dayIndex) {
        const sessions = [];
        const subjectsToday = subjects.slice(0, Math.min(2, subjects.length));
        const hoursPerSubject = hours / subjectsToday.length;
        
        let startHour = 9;
        subjectsToday.forEach(subject => {
            const endHour = startHour + hoursPerSubject;
            sessions.push({
                time: `${startHour}:00-${Math.floor(endHour)}:00`,
                subject,
                topics: ["Review notes", "Practice problems", "Solve exercises"],
                technique: "Pomodoro Technique (25 min focus + 5 min break)"
            });
            startHour = Math.floor(endHour) + 1;
        });

        return sessions;
    }

    generateRecommendations(weakSubjects, lowAttendance) {
        const recommendations = [];
        
        if (weakSubjects.length > 0) {
            recommendations.push({
                type: 'academic',
                priority: 'high',
                icon: '📚',
                message: `Focus on improving performance in: ${weakSubjects.join(', ')}`,
                actions: [
                    'Schedule 2 extra hours per week for these subjects',
                    'Attend doubt-clearing sessions or office hours',
                    'Form study groups with peers',
                    'Use online resources and video tutorials',
                    'Practice previous year questions'
                ]
            });
        }
        
        if (lowAttendance.length > 0) {
            recommendations.push({
                type: 'attendance',
                priority: 'critical',
                icon: '⚠️',
                message: `Urgent: Improve attendance in: ${lowAttendance.join(', ')}`,
                actions: [
                    'Attend all remaining classes without fail',
                    'Contact professors to discuss catch-up plan',
                    'Review attendance policy and requirements',
                    'Set calendar reminders for classes',
                    'Aim for 100% attendance moving forward'
                ]
            });
        }

        if (recommendations.length === 0) {
            recommendations.push({
                type: 'general',
                priority: 'low',
                icon: '✅',
                message: 'Great job! Keep up the good work!',
                actions: [
                    'Maintain current study routine',
                    'Help peers who need assistance',
                    'Explore advanced topics',
                    'Participate in projects and competitions'
                ]
            });
        }
        
        return recommendations;
    }

    getStudyTips(subjects) {
        const tipDatabase = {
            'Mathematics': [
                'Practice daily - consistency is key',
                'Understand concepts before memorizing formulas',
                'Work through problems step by step',
                'Review mistakes and understand where you went wrong',
                'Use visual aids and diagrams'
            ],
            'Physics': [
                'Connect theory with real-world examples',
                'Solve numerical problems regularly',
                'Understand derivations, don\'t just memorize',
                'Draw diagrams for every problem',
                'Use dimensional analysis to check answers'
            ],
            'Chemistry': [
                'Memorize periodic trends and patterns',
                'Balance chemical equations regularly',
                'Understand reaction mechanisms',
                'Make flashcards for formulas and reactions',
                'Practice nomenclature daily'
            ],
            'Programming': [
                'Code every day, even if just for 30 minutes',
                'Debug systematically using print/console statements',
                'Read and understand others\' code',
                'Break down problems into smaller functions',
                'Comment your code clearly'
            ],
            'Biology': [
                'Use mnemonics for complex terms',
                'Draw and label diagrams',
                'Make concept maps to connect ideas',
                'Review regularly to maintain retention',
                'Use flashcards for terminology'
            ],
            'default': [
                'Take regular breaks (Pomodoro Technique)',
                'Use active recall instead of passive reading',
                'Teach concepts to others to reinforce learning',
                'Create summary sheets after each topic',
                'Stay hydrated and get adequate sleep'
            ]
        };
        
        return subjects.map(subject => ({
            subject,
            tips: tipDatabase[subject] || tipDatabase['default']
        }));
    }

    calculatePriorityLevel(marks, attendance) {
        const avgMarks = marks.reduce((sum, m) => sum + m.percentage, 0) / marks.length;
        const avgAttendance = attendance.reduce((sum, a) => sum + a.percentage, 0) / attendance.length;
        
        if (avgMarks < 50 || avgAttendance < 70) return 'critical';
        if (avgMarks < 65 || avgAttendance < 80) return 'high';
        if (avgMarks < 75 || avgAttendance < 90) return 'medium';
        return 'low';
    }

    getBasicFeedback() {
        return {
            strengths: [
                "Good effort shown",
                "Basic requirements met"
            ],
            improvements: [
                "Expand on key concepts with more detail",
                "Include more examples and references"
            ],
            suggestions: [
                "Review the rubric carefully",
                "Seek feedback from peers",
                "Proofread for clarity and grammar"
            ],
            gradeRange: "60-75%"
        };
    }
}

module.exports = new AIService();
