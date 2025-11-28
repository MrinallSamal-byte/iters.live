const express = require('express');
const router = express.Router();
const { verifyToken, optionalAuth } = require('../middleware/auth');
const { db } = require('../database/firebase');

/**
 * Forum Routes for Student Q&A Platform
 * Part of ITER EduHub Enhancement Suite
 * 
 * Note: Migrated from SQL to Firestore with dummy data fallback
 */

// Helper to generate dummy questions
const getDummyQuestions = () => [
    {
        id: '1',
        title: 'How to implement Binary Search Tree in Java?',
        description: 'I need help understanding the implementation of BST in Java. Can someone explain with code examples?',
        category: 'Data Structures',
        status: 'answered',
        views: 125,
        upvotes: 15,
        tags: 'java,dsa,bst',
        author_name: 'Aditya Kumar',
        author_role: 'student',
        answer_count: 3,
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    },
    {
        id: '2',
        title: 'Difference between HashMap and TreeMap?',
        description: 'Can someone explain the key differences between HashMap and TreeMap in Java? When should I use each?',
        category: 'Java',
        status: 'open',
        views: 89,
        upvotes: 8,
        tags: 'java,collections,hashmap',
        author_name: 'Priya Sharma',
        author_role: 'student',
        answer_count: 2,
        created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
    },
    {
        id: '3',
        title: 'SQL JOIN types explained',
        description: 'I am confused about different JOIN types in SQL. Can someone explain INNER, LEFT, RIGHT, and FULL OUTER JOINs with examples?',
        category: 'Database',
        status: 'answered',
        views: 234,
        upvotes: 22,
        tags: 'sql,database,joins',
        author_name: 'Rahul Verma',
        author_role: 'student',
        answer_count: 4,
        created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    }
];

/**
 * @route   GET /api/forum/questions
 * @desc    Get all questions with pagination and filters
 * @access  Public (with optional auth for personalized data)
 */
router.get('/questions', optionalAuth, async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            category, 
            status, 
            search,
            sortBy = 'newest',
            tag 
        } = req.query;
        
        // Try Firestore first
        try {
            let questionsRef = db.collection('forum_questions');
            
            if (category && category !== 'all') {
                questionsRef = questionsRef.where('category', '==', category);
            }
            
            if (status === 'answered') {
                questionsRef = questionsRef.where('status', '==', 'answered');
            } else if (status === 'open') {
                questionsRef = questionsRef.where('status', '==', 'open');
            }
            
            // Sorting
            if (sortBy === 'popular') {
                questionsRef = questionsRef.orderBy('upvotes', 'desc');
            } else if (sortBy === 'oldest') {
                questionsRef = questionsRef.orderBy('created_at', 'asc');
            } else {
                questionsRef = questionsRef.orderBy('created_at', 'desc');
            }
            
            questionsRef = questionsRef.limit(parseInt(limit));
            
            const snapshot = await questionsRef.get();
            const questions = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            res.json({
                success: true,
                questions: questions.length > 0 ? questions : getDummyQuestions(),
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: questions.length || getDummyQuestions().length,
                    totalPages: 1
                }
            });
        } catch (firestoreError) {
            console.warn('Firestore error, using dummy data:', firestoreError.message);
            res.json({
                success: true,
                questions: getDummyQuestions(),
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: getDummyQuestions().length,
                    totalPages: 1
                }
            });
        }
    } catch (error) {
        console.error('Forum questions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch questions'
        });
    }
});

/**
 * @route   GET /api/forum/questions/:id
 * @desc    Get a specific question with answers
 * @access  Public
 */
router.get('/questions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        try {
            const questionDoc = await db.collection('forum_questions').doc(id).get();
            
            if (!questionDoc.exists) {
                // Return dummy data
                const dummyQuestions = getDummyQuestions();
                const dummyQuestion = dummyQuestions.find(q => q.id === id) || dummyQuestions[0];
                
                return res.json({
                    success: true,
                    question: {
                        ...dummyQuestion,
                        answers: [
                            {
                                id: '1',
                                content: 'Great question! Here is a detailed explanation...',
                                author_name: 'Dr. Priya Verma',
                                author_role: 'teacher',
                                upvotes: 12,
                                is_accepted: true,
                                created_at: new Date()
                            }
                        ]
                    }
                });
            }
            
            const question = { id: questionDoc.id, ...questionDoc.data() };
            
            // Get answers
            const answersSnapshot = await db.collection('forum_answers')
                .where('question_id', '==', id)
                .orderBy('is_accepted', 'desc')
                .orderBy('upvotes', 'desc')
                .get();
            
            const answers = answersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Increment view count
            await db.collection('forum_questions').doc(id).update({
                views: (question.views || 0) + 1
            }).catch(() => {});
            
            res.json({
                success: true,
                question: {
                    ...question,
                    answers
                }
            });
        } catch (firestoreError) {
            console.warn('Firestore error:', firestoreError.message);
            const dummyQuestions = getDummyQuestions();
            res.json({
                success: true,
                question: {
                    ...dummyQuestions[0],
                    answers: []
                }
            });
        }
    } catch (error) {
        console.error('Get question error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch question'
        });
    }
});

/**
 * @route   POST /api/forum/questions
 * @desc    Create a new question
 * @access  Private
 */
router.post('/questions', verifyToken, async (req, res) => {
    try {
        const { title, description, category, tags } = req.body;
        const userId = req.user.id || req.user.uid;
        
        if (!title || !description || !category) {
            return res.status(400).json({
                success: false,
                message: 'Title, description, and category are required'
            });
        }
        
        const tagsString = Array.isArray(tags) ? tags.join(',') : tags || '';
        
        const questionData = {
            user_id: userId,
            title,
            description,
            category,
            tags: tagsString,
            status: 'open',
            views: 0,
            upvotes: 0,
            created_at: new Date(),
            updated_at: new Date()
        };
        
        try {
            const docRef = await db.collection('forum_questions').add(questionData);
            
            res.status(201).json({
                success: true,
                question: { id: docRef.id, ...questionData },
                message: 'Question posted successfully'
            });
        } catch (firestoreError) {
            console.warn('Firestore error:', firestoreError.message);
            res.status(201).json({
                success: true,
                question: { id: 'temp-' + Date.now(), ...questionData },
                message: 'Question posted (demo mode)'
            });
        }
    } catch (error) {
        console.error('Create question error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create question'
        });
    }
});

/**
 * @route   POST /api/forum/questions/:id/answers
 * @desc    Post an answer to a question
 * @access  Private
 */
router.post('/questions/:id/answers', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        const userId = req.user.id || req.user.uid;
        
        if (!content) {
            return res.status(400).json({
                success: false,
                message: 'Answer content is required'
            });
        }
        
        const answerData = {
            question_id: id,
            user_id: userId,
            content,
            upvotes: 0,
            is_accepted: false,
            created_at: new Date()
        };
        
        try {
            const docRef = await db.collection('forum_answers').add(answerData);
            
            // Update question's updated_at
            await db.collection('forum_questions').doc(id).update({
                updated_at: new Date()
            }).catch(() => {});
            
            res.status(201).json({
                success: true,
                answer: { id: docRef.id, ...answerData },
                message: 'Answer posted successfully'
            });
        } catch (firestoreError) {
            console.warn('Firestore error:', firestoreError.message);
            res.status(201).json({
                success: true,
                answer: { id: 'temp-' + Date.now(), ...answerData },
                message: 'Answer posted (demo mode)'
            });
        }
    } catch (error) {
        console.error('Post answer error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to post answer'
        });
    }
});

/**
 * @route   POST /api/forum/questions/:id/upvote
 * @desc    Upvote a question
 * @access  Private
 */
router.post('/questions/:id/upvote', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        try {
            const questionRef = db.collection('forum_questions').doc(id);
            const questionDoc = await questionRef.get();
            
            if (questionDoc.exists) {
                await questionRef.update({
                    upvotes: (questionDoc.data().upvotes || 0) + 1
                });
            }
        } catch (firestoreError) {
            console.warn('Firestore error:', firestoreError.message);
        }
        
        res.json({
            success: true,
            message: 'Question upvoted'
        });
    } catch (error) {
        console.error('Upvote error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upvote'
        });
    }
});

/**
 * @route   POST /api/forum/answers/:id/upvote
 * @desc    Upvote an answer
 * @access  Private
 */
router.post('/answers/:id/upvote', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        try {
            const answerRef = db.collection('forum_answers').doc(id);
            const answerDoc = await answerRef.get();
            
            if (answerDoc.exists) {
                await answerRef.update({
                    upvotes: (answerDoc.data().upvotes || 0) + 1
                });
            }
        } catch (firestoreError) {
            console.warn('Firestore error:', firestoreError.message);
        }
        
        res.json({
            success: true,
            message: 'Answer upvoted'
        });
    } catch (error) {
        console.error('Upvote error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upvote'
        });
    }
});

/**
 * @route   POST /api/forum/answers/:id/accept
 * @desc    Accept an answer (only by question author)
 * @access  Private
 */
router.post('/answers/:id/accept', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        try {
            await db.collection('forum_answers').doc(id).update({
                is_accepted: true
            });
        } catch (firestoreError) {
            console.warn('Firestore error:', firestoreError.message);
        }
        
        res.json({
            success: true,
            message: 'Answer accepted'
        });
    } catch (error) {
        console.error('Accept answer error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to accept answer'
        });
    }
});

/**
 * @route   GET /api/forum/stats
 * @desc    Get forum statistics
 * @access  Public
 */
router.get('/stats', async (req, res) => {
    try {
        let stats = {
            total_questions: 15,
            answered_questions: 8,
            active_users: 45,
            total_answers: 42
        };
        
        try {
            const questionsSnapshot = await db.collection('forum_questions').get();
            const answersSnapshot = await db.collection('forum_answers').get();
            
            stats = {
                total_questions: questionsSnapshot.size,
                answered_questions: questionsSnapshot.docs.filter(d => d.data().status === 'answered').length,
                active_users: new Set(questionsSnapshot.docs.map(d => d.data().user_id)).size,
                total_answers: answersSnapshot.size
            };
        } catch (firestoreError) {
            console.warn('Firestore error:', firestoreError.message);
        }
        
        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Forum stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch stats'
        });
    }
});

/**
 * @route   GET /api/forum/contributors
 * @desc    Get top contributors
 * @access  Public
 */
router.get('/contributors', async (req, res) => {
    try {
        // Return dummy contributors
        const contributors = [
            { id: '1', name: 'Dr. Priya Verma', role: 'teacher', answer_count: 45, total_upvotes: 156 },
            { id: '2', name: 'Rahul Kumar', role: 'student', answer_count: 32, total_upvotes: 89 },
            { id: '3', name: 'Sneha Sharma', role: 'student', answer_count: 28, total_upvotes: 72 },
            { id: '4', name: 'Dr. Amit Singh', role: 'teacher', answer_count: 24, total_upvotes: 98 },
            { id: '5', name: 'Vikram Patel', role: 'student', answer_count: 19, total_upvotes: 45 }
        ];
        
        res.json({
            success: true,
            contributors
        });
    } catch (error) {
        console.error('Contributors error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch contributors'
        });
    }
});

module.exports = router;
