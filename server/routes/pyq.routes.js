const express = require('express');
const router = express.Router();
const { verifyToken, optionalAuth } = require('../middleware/auth');
const db = require('../database/db');

/**
 * PYQ (Previous Year Questions) Routes
 * Provides access to question papers from previous exams
 * Part of ITER EduHub Enhancement Suite
 */

/**
 * @route   GET /api/pyq/papers
 * @desc    Get all question papers with pagination and filters
 * @access  Public
 */
router.get('/papers', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            subject,
            year,
            semester,
            examType,
            search,
            sortBy = 'newest'
        } = req.query;

        const offset = (page - 1) * limit;

        let query = `
            SELECT 
                pyq.id,
                pyq.subject,
                pyq.subject_code,
                pyq.year,
                pyq.semester,
                pyq.exam_type,
                pyq.duration,
                pyq.max_marks,
                pyq.downloads,
                pyq.file_url,
                pyq.has_solution,
                pyq.uploaded_at,
                u.name as uploaded_by
            FROM pyq_papers pyq
            LEFT JOIN users u ON pyq.uploaded_by = u.id
            WHERE 1=1
        `;

        const params = [];
        let paramIndex = 1;

        if (subject) {
            query += ` AND LOWER(pyq.subject) LIKE LOWER($${paramIndex++})`;
            params.push(`%${subject.replace(/-/g, ' ')}%`);
        }

        if (year) {
            query += ` AND pyq.year = $${paramIndex++}`;
            params.push(parseInt(year));
        }

        if (semester) {
            query += ` AND pyq.semester = $${paramIndex++}`;
            params.push(parseInt(semester));
        }

        if (examType) {
            query += ` AND pyq.exam_type = $${paramIndex++}`;
            params.push(examType);
        }

        if (search) {
            query += ` AND (LOWER(pyq.subject) LIKE LOWER($${paramIndex}) OR LOWER(pyq.subject_code) LIKE LOWER($${paramIndex++}))`;
            params.push(`%${search}%`);
        }

        // Sorting
        switch (sortBy) {
            case 'oldest':
                query += ' ORDER BY pyq.year ASC, pyq.uploaded_at ASC';
                break;
            case 'popular':
                query += ' ORDER BY pyq.downloads DESC';
                break;
            case 'subject':
                query += ' ORDER BY pyq.subject ASC';
                break;
            default: // newest
                query += ' ORDER BY pyq.year DESC, pyq.uploaded_at DESC';
        }

        query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(parseInt(limit), offset);

        const papers = await db.query(query, params);

        // Get total count
        let countQuery = 'SELECT COUNT(*) FROM pyq_papers WHERE 1=1';
        const countParams = [];
        let countParamIndex = 1;

        if (subject) {
            countQuery += ` AND LOWER(subject) LIKE LOWER($${countParamIndex++})`;
            countParams.push(`%${subject.replace(/-/g, ' ')}%`);
        }

        if (year) {
            countQuery += ` AND year = $${countParamIndex++}`;
            countParams.push(parseInt(year));
        }

        const totalCount = await db.query(countQuery, countParams);

        res.json({
            success: true,
            papers: papers.rows || papers,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(totalCount.rows?.[0]?.count || totalCount[0]?.count || 0),
                totalPages: Math.ceil((totalCount.rows?.[0]?.count || totalCount[0]?.count || 0) / limit)
            }
        });
    } catch (error) {
        console.error('PYQ papers error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch papers'
        });
    }
});

/**
 * @route   GET /api/pyq/papers/:id
 * @desc    Get a specific question paper
 * @access  Public
 */
router.get('/papers/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(`
            SELECT 
                pyq.*,
                u.name as uploaded_by_name
            FROM pyq_papers pyq
            LEFT JOIN users u ON pyq.uploaded_by = u.id
            WHERE pyq.id = $1
        `, [id]);

        if (!result.rows?.length && !result.length) {
            return res.status(404).json({
                success: false,
                message: 'Paper not found'
            });
        }

        res.json({
            success: true,
            paper: result.rows?.[0] || result[0]
        });
    } catch (error) {
        console.error('Get paper error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch paper'
        });
    }
});

/**
 * @route   POST /api/pyq/papers/:id/download
 * @desc    Track paper download
 * @access  Public
 */
router.post('/papers/:id/download', async (req, res) => {
    try {
        const { id } = req.params;

        // Increment download count
        await db.query('UPDATE pyq_papers SET downloads = downloads + 1 WHERE id = $1', [id]);

        // Get updated paper with file URL
        const result = await db.query('SELECT file_url, downloads FROM pyq_papers WHERE id = $1', [id]);

        if (!result.rows?.length && !result.length) {
            return res.status(404).json({
                success: false,
                message: 'Paper not found'
            });
        }

        const paper = result.rows?.[0] || result[0];

        res.json({
            success: true,
            fileUrl: paper.file_url,
            downloads: paper.downloads
        });
    } catch (error) {
        console.error('Download track error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process download'
        });
    }
});

/**
 * @route   POST /api/pyq/papers
 * @desc    Upload a new question paper (admin/teacher only)
 * @access  Private
 */
router.post('/papers', verifyToken, async (req, res) => {
    try {
        const {
            subject,
            subjectCode,
            year,
            semester,
            examType,
            duration,
            maxMarks,
            fileUrl,
            hasSolution
        } = req.body;

        // Verify user is admin or teacher
        if (!['admin', 'teacher'].includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Only admins and teachers can upload papers'
            });
        }

        if (!subject || !year || !semester || !examType) {
            return res.status(400).json({
                success: false,
                message: 'Subject, year, semester, and exam type are required'
            });
        }

        const result = await db.query(`
            INSERT INTO pyq_papers 
            (subject, subject_code, year, semester, exam_type, duration, max_marks, file_url, has_solution, downloads, uploaded_by, uploaded_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $10, NOW())
            RETURNING *
        `, [subject, subjectCode, year, semester, examType, duration, maxMarks, fileUrl, hasSolution || false, req.user.id]);

        res.status(201).json({
            success: true,
            paper: result.rows?.[0] || result[0],
            message: 'Paper uploaded successfully'
        });
    } catch (error) {
        console.error('Upload paper error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload paper'
        });
    }
});

/**
 * @route   POST /api/pyq/requests
 * @desc    Request a question paper
 * @access  Private
 */
router.post('/requests', verifyToken, async (req, res) => {
    try {
        const { subject, year, examType } = req.body;
        const userId = req.user.id;

        if (!subject || !year) {
            return res.status(400).json({
                success: false,
                message: 'Subject and year are required'
            });
        }

        const result = await db.query(`
            INSERT INTO pyq_requests (user_id, subject, year, exam_type, status, created_at)
            VALUES ($1, $2, $3, $4, 'pending', NOW())
            RETURNING *
        `, [userId, subject, year, examType || null]);

        res.status(201).json({
            success: true,
            request: result.rows?.[0] || result[0],
            message: 'Request submitted successfully'
        });
    } catch (error) {
        console.error('Paper request error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit request'
        });
    }
});

/**
 * @route   GET /api/pyq/stats
 * @desc    Get PYQ statistics
 * @access  Public
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM pyq_papers) as total_papers,
                (SELECT COUNT(DISTINCT subject) FROM pyq_papers) as total_subjects,
                (SELECT MIN(year) FROM pyq_papers) as min_year,
                (SELECT MAX(year) FROM pyq_papers) as max_year,
                (SELECT SUM(downloads) FROM pyq_papers) as total_downloads
        `);

        const result = stats.rows?.[0] || stats[0] || {};

        res.json({
            success: true,
            stats: {
                totalPapers: parseInt(result.total_papers) || 0,
                totalSubjects: parseInt(result.total_subjects) || 0,
                yearRange: result.min_year && result.max_year ? 
                    `${result.min_year}-${result.max_year}` : 'N/A',
                totalDownloads: parseInt(result.total_downloads) || 0
            }
        });
    } catch (error) {
        console.error('PYQ stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch stats'
        });
    }
});

/**
 * @route   GET /api/pyq/subjects
 * @desc    Get list of available subjects
 * @access  Public
 */
router.get('/subjects', async (req, res) => {
    try {
        const subjects = await db.query(`
            SELECT DISTINCT subject, subject_code, COUNT(*) as paper_count
            FROM pyq_papers
            GROUP BY subject, subject_code
            ORDER BY subject ASC
        `);

        res.json({
            success: true,
            subjects: subjects.rows || subjects
        });
    } catch (error) {
        console.error('PYQ subjects error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch subjects'
        });
    }
});

module.exports = router;
