const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { query } = require('../database/db');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const { emitToClass, emitToDepartment, emitToRole } = require('../socket/socket');

// Configure multer storage
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    const ext = path.extname(file.originalname);
    const safeName = file.originalname.replace(ext, '').replace(/[^a-z0-9]/gi, '_');
    cb(null, `${safeName}-${uniqueSuffix}${ext}`);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'image/jpg',
    'text/plain',
    'application/zip'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOC, DOCX, PPT, PPTX, images, TXT, and ZIP are allowed.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB default
  }
});

/**
 * Calculate file checksum
 */
const calculateChecksum = async (filePath) => {
  const fileBuffer = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
};

/**
 * Log activity
 */
const logActivity = async (userId, action, entityType, entityId, metadata = null) => {
  await query('INSERT INTO activity_log (user_id, action, entity_type, entity_id, metadata) VALUES ($1, $2, $3, $4, $5) RETURNING id', [userId, action, entityType, entityId, JSON.stringify(metadata)]
  );
};

/**
 * POST /api/files/upload
 * Upload a file (students and teachers)
 */
router.post('/upload', authMiddleware, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const { category, subject, description } = req.body;

    if (!category) {
      await fs.unlink(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Category is required'
      });
    }

    // Calculate checksum
    const checksum = await calculateChecksum(req.file.path);

    // Public URL
    const publicUrl = `/static/uploads/${req.file.filename}`;

    // Determine approval status (teacher uploads need approval)
    const approved = req.user.role === 'student' ? true : false;

    // Insert file metadata
    const result = await query(`INSERT INTO files (original_name, stored_name, mime_type, file_size, checksum, 
       file_path, public_url, category, subject, uploaded_by, approved, description) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`, [
        req.file.originalname,
        req.file.filename,
        req.file.mimetype,
        req.file.size,
        checksum,
        req.file.path,
        publicUrl,
        category,
        subject || null,
        req.user.id,
        approved,
        description || null
      ]
    );

    // Log activity
    await logActivity(req.user.id, 'file_upload', 'file', result[0].id, {
      filename: req.file.originalname,
      category
    });

    // Emit socket event for approved files
    if (approved || req.user.role === 'teacher') {
      if (req.user.department) {
        emitToDepartment(req.user.department, 'file:uploaded', {
          fileId: result[0].id,
          category,
          subject,
          uploadedBy: req.user.name,
          approved
        });
      }
    }

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully' + (approved ? '' : ' (pending approval)'),
      data: {
        id: result[0].id,
        originalName: req.file.originalname,
        publicUrl,
        category,
        subject,
        size: req.file.size,
        approved
      }
    });
  } catch (error) {
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    next(error);
  }
});

/**
 * GET /api/files
 * Get files list with pagination and filters
 */
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const {
      category,
      subject,
      approved,
      page = 1,
      limit = 20,
      search
    } = req.query;

    // Parse and validate pagination parameters
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const offset = (pageNum - 1) * limitNum;
    
    let conditions = [];
    let params = [];

    // Role-based filtering
    if (req.user.role === 'student') {
      // Students see only approved files or their own
      // Ignore the 'approved' query param for students - they always see approved + their own
      conditions.push('(files.approved = 1 OR files.uploaded_by = ?)');
      params.push(req.user.id);
    } else if (req.user.role === 'teacher') {
      // Teachers see all files from their department or their own
      conditions.push('(users.department = ? OR files.uploaded_by = ?)');
      params.push(req.user.department, req.user.id);
    } else {
      // Admins can filter by approval status
      if (approved !== undefined) {
        conditions.push('files.approved = ?');
        params.push(approved === 'true' ? 1 : 0);
      }
    }

    if (category) {
      conditions.push('files.category = ?');
      params.push(category);
    }

    if (subject) {
      conditions.push('files.subject = ?');
      params.push(subject);
    }

    if (search) {
      conditions.push('(files.original_name LIKE ? OR files.description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

  const baseWhere = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  // Convert MySQL '?' placeholders to Postgres-style $1..$n in order
  let paramIndex = 0;
  const pgWhereClause = baseWhere.replace(/\?/g, () => `$${++paramIndex}`);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total FROM files 
      LEFT JOIN users ON files.uploaded_by = users.id 
      ${pgWhereClause}
    `;
    const countResult = await query(countQuery, params);
    const total = countResult && countResult[0] ? countResult[0].total : 0;

    // Get files (clone params array to avoid mutation)
    // IMPORTANT: LIMIT and OFFSET must be integers, not placeholders in some MySQL configurations
    const filesQuery = `
      SELECT files.*, users.name as uploaded_by_name, users.role as uploader_role
      FROM files
      LEFT JOIN users ON files.uploaded_by = users.id
      ${pgWhereClause}
      ORDER BY files.created_at DESC
      LIMIT ${limitNum} OFFSET ${offset}
    `;
    
    console.log('Files query:', filesQuery); // Debug log
    console.log('Files query params:', params); // Debug log

    const files = await query(filesQuery, params);

    res.json({
      success: true,
      data: {
        files,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/files/download/:id
 * Download a file
 */
router.get('/download/:id', authMiddleware, async (req, res, next) => {
  try {
    const fileId = req.params.id;

    // Get file metadata
    const files = await query(`SELECT files.*, users.department, users.role as uploader_role 
       FROM files 
       LEFT JOIN users ON files.uploaded_by = users.id 
       WHERE files.id = $1`, [fileId]
    );

    if (files.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const file = files[0];

    // Permission check
    if (req.user.role === 'student') {
      if (!file.approved && file.uploaded_by !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied - file not approved'
        });
      }
    }

    // Check if file exists
    try {
      await fs.access(file.file_path);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
    }

    // Increment download count
    await query('UPDATE files SET download_count = download_count + 1 WHERE id = $1', [fileId]);

    // Log activity
    await logActivity(req.user.id, 'file_download', 'file', fileId, {
      filename: file.original_name
    });

    // Send file
    res.download(file.file_path, file.original_name);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/files/approve/:id
 * Approve a file (admin only)
 */
router.post('/approve/:id', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const fileId = req.params.id;

    // Get file details
    const files = await query('SELECT * FROM files WHERE id = $1', [fileId]
    );

    if (files.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const file = files[0];

    // Update approval status
    await query('UPDATE files SET approved = TRUE, approved_by = $1, approved_at = NOW() WHERE id = $2', [req.user.id, fileId]
    );

    // Log activity
    await logActivity(req.user.id, 'file_approve', 'file', fileId);

    // Get uploader details
    const uploaders = await query('SELECT department FROM users WHERE id = $1', [file.uploaded_by]
    );

    // Emit socket event
    if (uploaders.length > 0 && uploaders[0].department) {
      emitToDepartment(uploaders[0].department, 'file:approved', {
        fileId,
        category: file.category,
        subject: file.subject,
        originalName: file.original_name
      });
    }

    res.json({
      success: true,
      message: 'File approved successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/files/:id
 * Delete a file (owner or admin)
 */
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    const fileId = req.params.id;

    // Get file details
    const files = await query('SELECT * FROM files WHERE id = $1', [fileId]);

    if (files.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const file = files[0];

    // Permission check
    if (req.user.role !== 'admin' && file.uploaded_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Delete file from filesystem
    try {
      await fs.unlink(file.file_path);
    } catch (error) {
      console.error('Error deleting file:', error);
    }

    // Delete from database
    await query('DELETE FROM files WHERE id = $1', [fileId]);

    // Log activity
    await logActivity(req.user.id, 'file_delete', 'file', fileId, {
      filename: file.original_name
    });

    res.json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/files/stats
 * Get file statistics
 */
router.get('/stats/overview', authMiddleware, async (req, res, next) => {
  try {
    let whereClause = '';
    let params = [];

    if (req.user.role === 'student') {
      whereClause = 'WHERE approved = TRUE OR uploaded_by = ?';
      params.push(req.user.id);
    } else if (req.user.role === 'teacher') {
      whereClause = 'WHERE uploaded_by = ?';
      params.push(req.user.id);
    }

    let idx = 0;
    const pgWhere = whereClause.replace(/\?/g, () => `$${++idx}`);

    const stats = await query(`
      SELECT 
        COUNT(*) as total_files,
        SUM(file_size) as total_size,
        SUM(download_count) as total_downloads,
        COUNT(CASE WHEN approved = TRUE THEN 1 END) as approved_files,
        COUNT(CASE WHEN approved = FALSE THEN 1 END) as pending_files
      FROM files
      ${pgWhere}
    `, params);

    const byCategory = await query(`
      SELECT category, COUNT(*) as count, SUM(file_size) as size
      FROM files
      ${pgWhere}
      GROUP BY category
    `, params);

    res.json({
      success: true,
      data: {
        overview: stats[0],
        byCategory
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
