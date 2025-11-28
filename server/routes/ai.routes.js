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

module.exports = router;
