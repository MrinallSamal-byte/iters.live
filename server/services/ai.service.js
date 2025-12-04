const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * AI Service for Educational Assistance
 * Provides personalized study plans, recommendations, and Q&A
 * Uses Google Gemini AI for intelligent responses
 * Part of ITER EduHub Enhancement Suite
 */
class AIService {
    constructor() {
        this.geminiKey = process.env.GEMINI_API_KEY;
        this.model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
        this.genAI = null;
        
        if (this.geminiKey) {
            this.genAI = new GoogleGenerativeAI(this.geminiKey);
        }
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
            if (!this.genAI) {
                console.log('Gemini API key not configured, using fallback study plan');
                return this.getFallbackStudyPlan(studentData);
            }

            const model = this.genAI.getGenerativeModel({ model: this.model });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const content = response.text();
            
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
     * Handles both study-related and general questions
     */
    async answerQuestion(question, context) {
        const prompt = `You are a helpful and knowledgeable educational assistant for college students. Your primary focus is helping with study-related questions, but you can also help with general questions.

Question: ${question}
${context ? `Context: ${context}` : ''}

Instructions:
- If this is a study-related question (academics, homework, concepts, problems, etc.), provide a detailed, clear, and educational answer with examples where helpful.
- If this is a general question, still provide a helpful and accurate answer.
- Always aim to be educational and help the student learn.
- Include step-by-step explanations for complex problems.
- Provide examples when they would help understanding.

Please provide a thorough and helpful response:`;

        try {
            if (!this.genAI) {
                return "I'm currently unable to process questions. Please make sure the AI service is configured correctly or contact your instructor.";
            }

            const model = this.genAI.getGenerativeModel({ model: this.model });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
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
            if (!this.genAI) {
                return this.getBasicFeedback();
            }

            const model = this.genAI.getGenerativeModel({ model: this.model });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const content = response.text();
            
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
        const avgMarks = marks.reduce((sum, m) => sum + m.percentage, 0) / (marks.length || 1);
        const avgAttendance = attendance.reduce((sum, a) => sum + a.percentage, 0) / (attendance.length || 1);
        
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

    /**
     * Enhanced ML-based Performance Predictor
     * Predicts exam results using multiple factors
     * @param {Object} studentData - Historical performance data
     * @returns {Object} Prediction with confidence and recommendations
     */
    async predictExamPerformance(studentData) {
        const { marks, attendance, assignments, studyHours, weakSubjects } = studentData;
        
        try {
            // Calculate feature scores
            const avgMarks = marks.reduce((sum, m) => sum + parseFloat(m.percentage), 0) / (marks.length || 1);
            const avgAttendance = attendance.reduce((sum, a) => sum + parseFloat(a.percentage), 0) / (attendance.length || 1);
            const assignmentScore = (assignments?.completed || 0) / (assignments?.total || 1) * 100;
            const studyScore = Math.min((studyHours || 0) / 4 * 100, 100); // Normalize to 4 hours/day
            
            // Weighted prediction model
            const weights = {
                previousMarks: 0.40,    // 40% weight on past performance
                attendance: 0.25,        // 25% weight on attendance
                assignments: 0.20,       // 20% weight on assignment completion
                studyHours: 0.15        // 15% weight on study hours
            };
            
            const predictedScore = (
                avgMarks * weights.previousMarks +
                avgAttendance * weights.attendance +
                assignmentScore * weights.assignments +
                studyScore * weights.studyHours
            );
            
            // Calculate confidence based on data availability
            const dataCompleteness = [
                marks.length > 0,
                attendance.length > 0,
                assignments && assignments.total > 0,
                studyHours > 0
            ].filter(Boolean).length / 4;
            
            const confidence = dataCompleteness * 100;
            
            // Determine performance category
            let category, grade, recommendations;
            if (predictedScore >= 90) {
                category = 'Excellent';
                grade = 'A+';
                recommendations = [
                    'Maintain your excellent study routine',
                    'Help peers who need assistance',
                    'Explore advanced topics for deeper understanding',
                    'Consider participating in academic competitions'
                ];
            } else if (predictedScore >= 80) {
                category = 'Very Good';
                grade = 'A';
                recommendations = [
                    'Keep up the good work',
                    'Focus on consistency across all subjects',
                    'Aim for excellence in weak areas',
                    'Participate in group study sessions'
                ];
            } else if (predictedScore >= 70) {
                category = 'Good';
                grade = 'B+';
                recommendations = [
                    'Increase study hours by 1-2 hours per day',
                    'Focus extra time on weak subjects: ' + (weakSubjects?.join(', ') || 'identified subjects'),
                    'Attend doubt-clearing sessions regularly',
                    'Practice more previous year questions'
                ];
            } else if (predictedScore >= 60) {
                category = 'Satisfactory';
                grade = 'B';
                recommendations = [
                    'Significant improvement needed',
                    'Increase daily study time to at least 4 hours',
                    'Seek one-on-one help from teachers',
                    'Form study groups with high-performing peers',
                    'Focus intensively on: ' + (weakSubjects?.join(', ') || 'weak areas')
                ];
            } else if (predictedScore >= 50) {
                category = 'Needs Improvement';
                grade = 'C';
                recommendations = [
                    'Urgent action required to improve performance',
                    'Attend all classes without exception',
                    'Schedule daily study sessions of 5+ hours',
                    'Get tutoring support for weak subjects',
                    'Create and follow a strict study timetable',
                    'Eliminate distractions during study time'
                ];
            } else {
                category = 'At Risk';
                grade = 'D/F';
                recommendations = [
                    'Critical: Immediate intervention needed',
                    'Meet with academic advisor urgently',
                    'Attend all remedial classes',
                    'Dedicate 6+ hours daily to focused study',
                    'Consider peer tutoring or coaching',
                    'Prioritize attendance and participation',
                    'Start with basic concepts before advanced topics'
                ];
            }
            
            // Factor analysis
            const factors = {
                previousMarks: {
                    score: avgMarks.toFixed(2),
                    impact: weights.previousMarks * 100 + '%',
                    status: avgMarks >= 70 ? 'positive' : avgMarks >= 50 ? 'neutral' : 'negative'
                },
                attendance: {
                    score: avgAttendance.toFixed(2),
                    impact: weights.attendance * 100 + '%',
                    status: avgAttendance >= 85 ? 'positive' : avgAttendance >= 75 ? 'neutral' : 'negative'
                },
                assignments: {
                    score: assignmentScore.toFixed(2),
                    impact: weights.assignments * 100 + '%',
                    status: assignmentScore >= 80 ? 'positive' : assignmentScore >= 60 ? 'neutral' : 'negative'
                },
                studyHours: {
                    score: studyScore.toFixed(2),
                    impact: weights.studyHours * 100 + '%',
                    status: studyScore >= 75 ? 'positive' : studyScore >= 50 ? 'neutral' : 'negative'
                }
            };
            
            return {
                predictedScore: parseFloat(predictedScore.toFixed(2)),
                predictedGrade: grade,
                category,
                confidence: parseFloat(confidence.toFixed(2)),
                factors,
                recommendations,
                improvementPotential: Math.max(0, 90 - predictedScore).toFixed(2),
                riskLevel: predictedScore < 50 ? 'high' : predictedScore < 70 ? 'medium' : 'low'
            };
        } catch (error) {
            console.error('Prediction error:', error.message);
            return {
                predictedScore: 0,
                predictedGrade: 'N/A',
                category: 'Insufficient Data',
                confidence: 0,
                factors: {},
                recommendations: ['Not enough data available for prediction. Continue studying and tracking your progress.'],
                improvementPotential: 0,
                riskLevel: 'unknown'
            };
        }
    }

    /**
     * Generate personalized AI tutor recommendations
     * Based on comprehensive analysis of student performance
     * @param {Object} studentProfile - Complete student profile
     * @returns {Object} Personalized recommendations
     */
    async getPersonalizedTutorRecommendations(studentProfile) {
        const { marks, attendance, weakSubjects, strongSubjects, learningStyle, goals } = studentProfile;
        
        const prompt = `As an AI tutor for a college student, provide personalized study recommendations based on:

Academic Performance:
- Average Marks: ${marks?.average || 'N/A'}%
- Weak Subjects: ${weakSubjects?.join(', ') || 'None identified'}
- Strong Subjects: ${strongSubjects?.join(', ') || 'None identified'}
- Attendance: ${attendance?.average || 'N/A'}%

Student Goals: ${goals || 'Improve overall performance'}
Learning Style: ${learningStyle || 'Not specified'}

Provide:
1. Specific action plan for the next 2 weeks
2. Time allocation per subject (in hours per week)
3. Recommended study techniques for each weak subject
4. Motivation tips and mental health advice
5. Resources (books, videos, websites) for weak subjects

Format as JSON with clear structure.`;

        try {
            if (!this.genAI) {
                return this.getFallbackTutorRecommendations(studentProfile);
            }

            const model = this.genAI.getGenerativeModel({ model: this.model });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const content = response.text();
            
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            
            return this.getFallbackTutorRecommendations(studentProfile);
        } catch (error) {
            console.error('AI Tutor error:', error.message);
            return this.getFallbackTutorRecommendations(studentProfile);
        }
    }

    /**
     * Fallback tutor recommendations when AI is unavailable
     * @private
     */
    getFallbackTutorRecommendations(studentProfile) {
        const { marks, weakSubjects } = studentProfile;
        const avgMarks = marks?.average || 0;
        
        return {
            actionPlan: {
                week1: [
                    'Review fundamentals in weak subjects',
                    'Complete all pending assignments',
                    'Create summary notes for each subject',
                    'Practice 10 problems per weak subject daily'
                ],
                week2: [
                    'Take practice tests for weak subjects',
                    'Review and analyze mistakes',
                    'Attend doubt-clearing sessions',
                    'Revise all topics systematically'
                ]
            },
            timeAllocation: weakSubjects?.map(subject => ({
                subject,
                hoursPerWeek: avgMarks < 50 ? 8 : avgMarks < 70 ? 6 : 4,
                priority: 'high'
            })) || [],
            studyTechniques: {
                Mathematics: ['Practice problem-solving daily', 'Create formula sheets', 'Solve previous papers'],
                Programming: ['Code daily', 'Debug step by step', 'Build mini projects'],
                default: ['Active recall', 'Spaced repetition', 'Pomodoro technique']
            },
            motivation: [
                'Set small, achievable daily goals',
                'Reward yourself after completing study sessions',
                'Track your progress visually',
                'Remember your long-term goals',
                'Take regular breaks to avoid burnout'
            ],
            resources: weakSubjects?.map(subject => ({
                subject,
                resources: [
                    'Khan Academy (free video tutorials)',
                    'Course textbook chapters',
                    'YouTube subject-specific channels',
                    'Stack Overflow / subject forums',
                    'Previous year question papers'
                ]
            })) || []
        };
    }
}

module.exports = new AIService();
