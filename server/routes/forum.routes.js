const express = require('express');
const router = express.Router();
const { verifyToken, optionalAuth } = require('../middleware/auth');
const db = require('../database/db');

/**
 * Forum Routes for Student Q&A Platform
 * Part of ITER EduHub Enhancement Suite
 */

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
        
        const offset = (page - 1) * limit;
        
        let query = `
            SELECT 
                fq.id,
                fq.title,
                fq.description,
                fq.category,
                fq.status,
                fq.views,
                fq.upvotes,
                fq.tags,
                fq.created_at,
                fq.updated_at,
                u.name as author_name,
                u.role as author_role,
                (SELECT COUNT(*) FROM forum_answers fa WHERE fa.question_id = fq.id) as answer_count
            FROM forum_questions fq
            LEFT JOIN users u ON fq.user_id = u.id
            WHERE 1=1
        `;
        
        const params = [];
        let paramIndex = 1;
        
        if (category && category !== 'all') {
            query += ` AND fq.category = $${paramIndex++}`;
            params.push(category);
        }
        
        if (status) {
            if (status === 'answered') {
                query += ` AND fq.status = 'answered'`;
            } else if (status === 'unanswered') {
                query += ` AND (SELECT COUNT(*) FROM forum_answers fa WHERE fa.question_id = fq.id) = 0`;
            } else if (status === 'open') {
                query += ` AND fq.status = 'open'`;
            }
        }
        
        if (search) {
            query += ` AND (fq.title ILIKE $${paramIndex} OR fq.description ILIKE $${paramIndex++})`;
            params.push(`%${search}%`);
        }
        
        if (tag) {
            query += ` AND fq.tags ILIKE $${paramIndex++}`;
            params.push(`%${tag}%`);
        }
        
        // Sorting
        switch (sortBy) {
            case 'popular':
                query += ' ORDER BY fq.upvotes DESC, fq.views DESC';
                break;
            case 'oldest':
                query += ' ORDER BY fq.created_at ASC';
                break;
            case 'recent-activity':
                query += ' ORDER BY fq.updated_at DESC';
                break;
            default: // newest
                query += ' ORDER BY fq.created_at DESC';
        }
        
        query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(parseInt(limit), offset);
        
        const questions = await db.query(query, params);
        
        // Get total count
        let countQuery = 'SELECT COUNT(*) FROM forum_questions fq WHERE 1=1';
        const countParams = [];
        let countParamIndex = 1;
        
        if (category && category !== 'all') {
            countQuery += ` AND fq.category = $${countParamIndex++}`;
            countParams.push(category);
        }
        
        const totalCount = await db.query(countQuery, countParams);
        
        res.json({
            success: true,
            questions: questions.rows || questions,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(totalCount.rows?.[0]?.count || totalCount[0]?.count || 0),
                totalPages: Math.ceil((totalCount.rows?.[0]?.count || totalCount[0]?.count || 0) / limit)
            }
        });
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
        
        // Get question
        const questionResult = await db.query(`
            SELECT 
                fq.*,
                u.name as author_name,
                u.role as author_role
            FROM forum_questions fq
            LEFT JOIN users u ON fq.user_id = u.id
            WHERE fq.id = $1
        `, [id]);
        
        if (!questionResult.rows?.length && !questionResult.length) {
            return res.status(404).json({
                success: false,
                message: 'Question not found'
            });
        }
        
        const question = questionResult.rows?.[0] || questionResult[0];
        
        // Increment view count
        await db.query('UPDATE forum_questions SET views = views + 1 WHERE id = $1', [id]);
        
        // Get answers
        const answersResult = await db.query(`
            SELECT 
                fa.*,
                u.name as author_name,
                u.role as author_role
            FROM forum_answers fa
            LEFT JOIN users u ON fa.user_id = u.id
            WHERE fa.question_id = $1
            ORDER BY fa.is_accepted DESC, fa.upvotes DESC, fa.created_at ASC
        `, [id]);
        
        res.json({
            success: true,
            question: {
                ...question,
                answers: answersResult.rows || answersResult
            }
        });
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
        const userId = req.user.id;
        
        if (!title || !description || !category) {
            return res.status(400).json({
                success: false,
                message: 'Title, description, and category are required'
            });
        }
        
        const tagsString = Array.isArray(tags) ? tags.join(',') : tags || '';
        
        const result = await db.query(`
            INSERT INTO forum_questions (user_id, title, description, category, tags, status, views, upvotes, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, 'open', 0, 0, NOW(), NOW())
            RETURNING *
        `, [userId, title, description, category, tagsString]);
        
        res.status(201).json({
            success: true,
            question: result.rows?.[0] || result[0],
            message: 'Question posted successfully'
        });
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
        const userId = req.user.id;
        
        if (!content) {
            return res.status(400).json({
                success: false,
                message: 'Answer content is required'
            });
        }
        
        // Check if question exists
        const questionCheck = await db.query('SELECT id FROM forum_questions WHERE id = $1', [id]);
        if (!questionCheck.rows?.length && !questionCheck.length) {
            return res.status(404).json({
                success: false,
                message: 'Question not found'
            });
        }
        
        const result = await db.query(`
            INSERT INTO forum_answers (question_id, user_id, content, upvotes, is_accepted, created_at)
            VALUES ($1, $2, $3, 0, false, NOW())
            RETURNING *
        `, [id, userId, content]);
        
        // Update question's updated_at timestamp
        await db.query('UPDATE forum_questions SET updated_at = NOW() WHERE id = $1', [id]);
        
        res.status(201).json({
            success: true,
            answer: result.rows?.[0] || result[0],
            message: 'Answer posted successfully'
        });
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
        
        await db.query('UPDATE forum_questions SET upvotes = upvotes + 1 WHERE id = $1', [id]);
        
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
        
        await db.query('UPDATE forum_answers SET upvotes = upvotes + 1 WHERE id = $1', [id]);
        
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
        const userId = req.user.id;
        
        // Verify user is the question author
        const answerCheck = await db.query(`
            SELECT fa.question_id, fq.user_id as question_author_id
            FROM forum_answers fa
            JOIN forum_questions fq ON fa.question_id = fq.id
            WHERE fa.id = $1
        `, [id]);
        
        if (!answerCheck.rows?.length && !answerCheck.length) {
            return res.status(404).json({
                success: false,
                message: 'Answer not found'
            });
        }
        
        const answer = answerCheck.rows?.[0] || answerCheck[0];
        
        if (answer.question_author_id !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Only question author can accept an answer'
            });
        }
        
        // Unaccept previous accepted answer
        await db.query('UPDATE forum_answers SET is_accepted = false WHERE question_id = $1', [answer.question_id]);
        
        // Accept this answer
        await db.query('UPDATE forum_answers SET is_accepted = true WHERE id = $1', [id]);
        
        // Update question status
        await db.query('UPDATE forum_questions SET status = $1 WHERE id = $2', ['answered', answer.question_id]);
        
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
        const stats = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM forum_questions) as total_questions,
                (SELECT COUNT(*) FROM forum_questions WHERE status = 'answered') as answered_questions,
                (SELECT COUNT(DISTINCT user_id) FROM forum_questions) as active_users,
                (SELECT COUNT(*) FROM forum_answers) as total_answers
        `);
        
        res.json({
            success: true,
            stats: stats.rows?.[0] || stats[0] || {
                total_questions: 0,
                answered_questions: 0,
                active_users: 0,
                total_answers: 0
            }
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
        const contributors = await db.query(`
            SELECT 
                u.id,
                u.name,
                u.role,
                COUNT(fa.id) as answer_count,
                SUM(fa.upvotes) as total_upvotes
            FROM users u
            JOIN forum_answers fa ON u.id = fa.user_id
            GROUP BY u.id, u.name, u.role
            ORDER BY answer_count DESC, total_upvotes DESC
            LIMIT 10
        `);
        
        res.json({
            success: true,
            contributors: contributors.rows || contributors
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
