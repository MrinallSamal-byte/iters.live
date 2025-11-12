// ============================================
// NOTES ROUTES WITH BRANCH & SEMESTER FILTERS
// server/routes/notes.routes.js
// ============================================

const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authMiddleware } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/notes');
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /pdf|doc|docx|ppt|pptx|txt/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Only PDF, DOC, DOCX, PPT, PPTX, and TXT files are allowed!'));
        }
    }
});

// ============================================
// GET ALL NOTES WITH FILTERS
// ============================================
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { branch, semester, type, search, subject } = req.query;
        const userId = req.user.id;
        const userRole = req.user.role;

        let sql = `
            SELECT 
                n.*,
                u.name as uploaded_by_name,
                u.role as uploader_role,
                (SELECT COUNT(*) FROM note_downloads WHERE note_id = n.id) as downloads,
                (SELECT COUNT(*) FROM note_favorites WHERE note_id = n.id AND user_id = ?) as is_favorited
            FROM notes n
            LEFT JOIN users u ON n.uploaded_by = u.id
            WHERE n.status = 'approved'
        `;
        
        const params = [userId];

        // Apply branch filter
        if (branch) {
            sql += ` AND n.branch = ?`;
            params.push(branch);
        }

        // Apply semester filter
        if (semester) {
            sql += ` AND n.semester = ?`;
            params.push(parseInt(semester));
        }

        // Apply type filter
        if (type) {
            sql += ` AND n.type = ?`;
            params.push(type);
        }

        // Apply subject filter
        if (subject) {
            sql += ` AND n.subject LIKE ?`;
            params.push(`%${subject}%`);
        }

        // Apply search filter
        if (search) {
            sql += ` AND (n.title LIKE ? OR n.subject LIKE ? OR n.description LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        // If student, show only their branch notes (optional)
        if (userRole === 'student') {
            const userBranch = req.user.department || req.user.branch;
            if (userBranch && !branch) {
                sql += ` AND n.branch = ?`;
                params.push(userBranch);
            }
        }

        sql += ` ORDER BY n.created_at DESC`;

        // Convert '?' placeholders to Postgres $1..$n
        let idx = 0;
        const pgSql = sql.replace(/\?/g, () => `$${++idx}`);

        const notes = await db.query(pgSql, params);

        res.json({
            success: true,
            notes: notes.map(note => ({
                ...note,
                is_favorited: note.is_favorited > 0,
                file_size: note.file_size || 'Unknown',
                file_type: path.extname(note.file_path).toUpperCase().replace('.', '')
            }))
        });
    } catch (error) {
        console.error('Error fetching notes:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch notes'
        });
    }
});

// ============================================
// GET NOTES STATISTICS
// ============================================
router.get('/stats', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

    const totalNotes = await db.query("SELECT COUNT(*) as count FROM notes WHERE status = 'approved'"
        );

        const downloadedNotes = await db.query(
            'SELECT COUNT(DISTINCT note_id) as count FROM note_downloads WHERE user_id = $1', [userId]
        );

        const savedNotes = await db.query('SELECT COUNT(*) as count FROM note_favorites WHERE user_id = $1', [userId]
        );

    const subjects = await db.query("SELECT COUNT(DISTINCT subject) as count FROM notes WHERE status = 'approved'"
        );

        res.json({
            success: true,
            totalNotes: totalNotes[0].count,
            downloadedNotes: downloadedNotes[0].count,
            savedNotes: savedNotes[0].count,
            totalSubjects: subjects[0].count
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics'
        });
    }
});

// ============================================
// GET SINGLE NOTE DETAILS
// ============================================
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const notes = await db.query(
            `SELECT 
                n.*,
                u.name as uploaded_by_name,
                (SELECT COUNT(*) FROM note_downloads WHERE note_id = n.id) as downloads,
                (SELECT COUNT(*) FROM note_favorites WHERE note_id = n.id AND user_id = $1) as is_favorited
            FROM notes n
            LEFT JOIN users u ON n.uploaded_by = u.id
            WHERE n.id = $2 AND n.status = 'approved'`,
            [userId, id]
        );

        if (notes.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Note not found'
            });
        }

        res.json({
            success: true,
            note: {
                ...notes[0],
                is_favorited: notes[0].is_favorited > 0
            }
        });
    } catch (error) {
        console.error('Error fetching note:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch note details'
        });
    }
});

// ============================================
// DOWNLOAD NOTE
// ============================================
router.get('/:id/download', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Get note details
        const notes = await db.query(
            "SELECT * FROM notes WHERE id = $1 AND status = 'approved'", [id]
        );

        if (notes.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Note not found'
            });
        }

        const note = notes[0];
        const filePath = path.join(__dirname, '../uploads/notes', path.basename(note.file_path));

        // Check if file exists
        try {
            await fs.access(filePath);
        } catch (error) {
            return res.status(404).json({
                success: false,
                message: 'File not found on server'
            });
        }

        // Record download
        await db.query('INSERT INTO note_downloads (note_id, user_id, downloaded_at) VALUES ($1, $2, NOW())', [id, userId]
        );

        // Send file
        res.download(filePath, note.title + path.extname(note.file_path));
    } catch (error) {
        console.error('Error downloading note:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to download note'
        });
    }
});

// ============================================
// VIEW/PREVIEW NOTE
// ============================================
router.get('/:id/view', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

    const notes = await db.query("SELECT * FROM notes WHERE id = $1 AND status = 'approved'", [id]
    );

        if (notes.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Note not found'
            });
        }

        const note = notes[0];
        const viewUrl = `/uploads/notes/${path.basename(note.file_path)}`;

        res.json({
            success: true,
            viewUrl
        });
    } catch (error) {
        console.error('Error viewing note:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to view note'
        });
    }
});

// ============================================
// UPLOAD NOTE (Teacher/Admin)
// ============================================
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
    try {
        const { title, subject, branch, semester, type, description } = req.body;
        const userId = req.user.id;
        const userRole = req.user.role;

        // Only teachers and admins can upload
        if (userRole !== 'teacher' && userRole !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only teachers and admins can upload notes'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        // Get file size
        const stats = await fs.stat(req.file.path);
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

        // Insert note
        const result = await db.query(`INSERT INTO notes 
            (title, subject, branch, semester, type, description, file_path, file_size, uploaded_by, status, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', NOW()) RETURNING id`, [
                title,
                subject,
                branch,
                parseInt(semester),
                type,
                description || '',
                req.file.filename,
                `${fileSizeMB} MB`,
                userId
            ]
        );

        res.json({
            success: true,
            message: 'Note uploaded successfully and sent for approval',
            noteId: (result && result[0] && result[0].id) || null
        });
    } catch (error) {
        console.error('Error uploading note:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload note'
        });
    }
});

// ============================================
// TOGGLE FAVORITE
// ============================================
router.post('/:id/favorite', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Check if already favorited
        const existing = await db.query('SELECT * FROM note_favorites WHERE note_id = $1 AND user_id = $2', [id, userId]
        );

        if (existing.length > 0) {
            // Remove favorite
            await db.query('DELETE FROM note_favorites WHERE note_id = $1 AND user_id = $2', [id, userId]
            );
            res.json({
                success: true,
                message: 'Removed from favorites',
                is_favorited: false
            });
        } else {
            // Add favorite
            await db.query('INSERT INTO note_favorites (note_id, user_id, created_at) VALUES ($1, $2, NOW())', [id, userId]
            );
            res.json({
                success: true,
                message: 'Added to favorites',
                is_favorited: true
            });
        }
    } catch (error) {
        console.error('Error toggling favorite:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update favorite'
        });
    }
});

// ============================================
// GET FAVORITES
// ============================================
router.get('/favorites/list', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        const favorites = await db.query(`SELECT 
                n.*,
                u.name as uploaded_by_name,
                (SELECT COUNT(*) FROM note_downloads WHERE note_id = n.id) as downloads
            FROM note_favorites nf
            JOIN notes n ON nf.note_id = n.id
            LEFT JOIN users u ON n.uploaded_by = u.id
            WHERE nf.user_id = $1 AND n.status = 'approved'
            ORDER BY nf.created_at DESC`, [userId]
        );

        res.json({
            success: true,
            favorites
        });
    } catch (error) {
        console.error('Error fetching favorites:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch favorites'
        });
    }
});

module.exports = router;
