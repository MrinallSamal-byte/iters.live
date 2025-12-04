const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const aiService = require('../services/ai.service');
const { db } = require('../database/firebase');

/**
 * AI Routes for Educational Assistance
 * Part of ITER EduHub Enhancement Suite
 * 
 * Note: Migrated from SQL to Firestore
 */

/**
 * Helper function to calculate percentage from marks data
 * @param {Object} marksItem - Marks data object
 * @returns {number} Calculated percentage
 */
function calculatePercentage(marksItem) {
    if (!marksItem.marks || !marksItem.total_marks) return 0;
    return (parseFloat(marksItem.marks) / parseFloat(marksItem.total_marks)) * 100;
}

/**
 * @route   POST /api/ai/study-plan
 * @desc    Generate personalized study plan
 * @access  Private
 */
router.post('/study-plan', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id || req.user.uid;
        
        // Fetch student data from Firestore
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        
        // Extract data from user document
        const marksData = userData.marks_data || [];
        const attendanceData = userData.attendance_data || [];
        const coursesData = userData.courses_data || [];
        
        const studentData = {
            subjects: coursesData.map(c => c.name || c.subject).filter(Boolean),
            attendance: attendanceData.map(a => ({
                subject: a.subject,
                percentage: parseFloat(a.percentage) || 0
            })),
            marks: marksData.map(m => ({
                subject: m.subject,
                percentage: m.marks ? (parseFloat(m.marks) / (parseFloat(m.total_marks) || 100)) * 100 : 0
            })),
            preferences: req.body.preferences || {
                studyHours: 4,
                preferredTime: 'morning'
            }
        };
        
        const studyPlan = await aiService.generateStudyPlan(studentData);
        
        // Save study plan to Firestore
        await db.collection('study_plans').add({
            user_id: userId,
            plan_data: studyPlan,
            created_at: new Date()
        });
        
        res.json({
            success: true,
            studyPlan,
            message: 'Study plan generated successfully'
        });
    } catch (error) {
        console.error('Study plan generation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate study plan',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route   GET /api/ai/recommendations
 * @desc    Get personalized subject recommendations
 * @access  Private
 */
router.get('/recommendations', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id || req.user.uid;
        
        // Fetch student data from Firestore
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        
        const marksData = userData.marks_data || [];
        const attendanceData = userData.attendance_data || [];
        
        const recommendations = await aiService.getSubjectRecommendations(
            marksData.map(m => ({ 
                subject: m.subject, 
                percentage: m.marks ? (parseFloat(m.marks) / (parseFloat(m.total_marks) || 100)) * 100 : 0 
            })),
            attendanceData.map(a => ({
                subject: a.subject,
                percentage: parseFloat(a.percentage) || 0
            }))
        );
        
        res.json({
            success: true,
            recommendations
        });
    } catch (error) {
        console.error('Recommendations error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get recommendations'
        });
    }
});

/**
 * @route   POST /api/ai/chat
 * @desc    AI chatbot for student questions
 * @access  Private
 */
router.post('/chat', verifyToken, async (req, res) => {
    try {
        const { question, context } = req.body;
        
        if (!question) {
            return res.status(400).json({
                success: false,
                message: 'Question is required'
            });
        }
        
        const answer = await aiService.answerQuestion(question, context || '');
        
        // Log chat interaction to Firestore
        await db.collection('ai_chat_logs').add({
            user_id: req.user.id || req.user.uid,
            question,
            answer,
            created_at: new Date()
        }).catch(err => console.error('Failed to log chat:', err));
        
        res.json({
            success: true,
            answer
        });
    } catch (error) {
        console.error('AI chat error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process question'
        });
    }
});

/**
 * @route   POST /api/ai/assignment-feedback
 * @desc    Get AI feedback on assignment
 * @access  Private
 */
router.post('/assignment-feedback', verifyToken, async (req, res) => {
    try {
        const { assignmentText, rubric } = req.body;
        
        if (!assignmentText) {
            return res.status(400).json({
                success: false,
                message: 'Assignment text is required'
            });
        }
        
        const feedback = await aiService.generateAssignmentFeedback(assignmentText, rubric);
        
        res.json({
            success: true,
            feedback
        });
    } catch (error) {
        console.error('Assignment feedback error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate feedback'
        });
    }
});

/**
 * @route   GET /api/ai/study-plans/history
 * @desc    Get user's study plan history
 * @access  Private
 */
router.get('/study-plans/history', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id || req.user.uid;
        
        // Fetch from Firestore
        const plansSnapshot = await db.collection('study_plans')
            .where('user_id', '==', userId)
            .orderBy('created_at', 'desc')
            .limit(10)
            .get();
        
        const plans = plansSnapshot.docs.map(doc => ({
            id: doc.id,
            plan: doc.data().plan_data,
            createdAt: doc.data().created_at
        }));
        
        res.json({
            success: true,
            plans
        });
    } catch (error) {
        console.error('Study plan history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch study plan history'
        });
    }
});

/**
 * @route   POST /api/ai/predict-performance
 * @desc    ML-based exam performance prediction
 * @access  Private
 */
router.post('/predict-performance', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id || req.user.uid;
        const { studyHours, customData } = req.body;
        
        // Fetch student data from Firestore
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        
        const marksData = userData.marks_data || [];
        const attendanceData = userData.attendance_data || [];
        const assignmentsData = userData.assignments_data || {};
        
        // Calculate weak subjects
        const weakSubjects = marksData
            .filter(m => calculatePercentage(m) < 60)
            .map(m => m.subject);
        
        const studentData = {
            marks: marksData.map(m => ({
                subject: m.subject,
                percentage: calculatePercentage(m)
            })),
            attendance: attendanceData.map(a => ({
                subject: a.subject,
                percentage: parseFloat(a.percentage) || 0
            })),
            assignments: assignmentsData,
            studyHours: studyHours || 4,
            weakSubjects,
            ...customData
        };
        
        const prediction = await aiService.predictExamPerformance(studentData);
        
        // Log prediction to Firestore
        await db.collection('performance_predictions').add({
            user_id: userId,
            prediction,
            input_data: studentData,
            created_at: new Date()
        }).catch(err => console.error('Failed to log prediction:', err));
        
        res.json({
            success: true,
            prediction,
            message: 'Performance prediction generated successfully'
        });
    } catch (error) {
        console.error('Performance prediction error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to predict performance',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route   POST /api/ai/tutor-recommendations
 * @desc    Get personalized AI tutor recommendations
 * @access  Private
 */
router.post('/tutor-recommendations', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id || req.user.uid;
        const { learningStyle, goals } = req.body;
        
        // Fetch student data from Firestore
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        
        const marksData = userData.marks_data || [];
        const attendanceData = userData.attendance_data || [];
        
        // Calculate averages and identify weak/strong subjects
        const avgMarks = marksData.length > 0 
            ? marksData.reduce((sum, m) => sum + calculatePercentage(m), 0) / marksData.length 
            : 0;
            
        const avgAttendance = attendanceData.length > 0
            ? attendanceData.reduce((sum, a) => sum + parseFloat(a.percentage || 0), 0) / attendanceData.length
            : 0;
        
        const weakSubjects = marksData
            .filter(m => calculatePercentage(m) < 60)
            .map(m => m.subject);
            
        const strongSubjects = marksData
            .filter(m => calculatePercentage(m) >= 80)
            .map(m => m.subject);
        
        const studentProfile = {
            marks: { average: avgMarks },
            attendance: { average: avgAttendance },
            weakSubjects,
            strongSubjects,
            learningStyle: learningStyle || 'visual',
            goals: goals || 'Improve overall academic performance'
        };
        
        const recommendations = await aiService.getPersonalizedTutorRecommendations(studentProfile);
        
        // Save recommendations to Firestore
        await db.collection('tutor_recommendations').add({
            user_id: userId,
            recommendations,
            profile: studentProfile,
            created_at: new Date()
        }).catch(err => console.error('Failed to save recommendations:', err));
        
        res.json({
            success: true,
            recommendations,
            message: 'Personalized recommendations generated successfully'
        });
    } catch (error) {
        console.error('Tutor recommendations error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate recommendations',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route   GET /api/ai/predictions/history
 * @desc    Get user's prediction history
 * @access  Private
 */
router.get('/predictions/history', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id || req.user.uid;
        
        const predictionsSnapshot = await db.collection('performance_predictions')
            .where('user_id', '==', userId)
            .orderBy('created_at', 'desc')
            .limit(10)
            .get();
        
        const predictions = predictionsSnapshot.docs.map(doc => ({
            id: doc.id,
            prediction: doc.data().prediction,
            createdAt: doc.data().created_at
        }));
        
        res.json({
            success: true,
            predictions
        });
    } catch (error) {
        console.error('Prediction history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch prediction history'
        });
    }
});

module.exports = router;
