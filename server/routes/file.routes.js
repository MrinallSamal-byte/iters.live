const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { db, admin } = require('../database/firebase');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const { emitToDepartment } = require('../socket/socket');
const { getUploadsBaseDir } = require('../utils/uploads-dir.util');
const { getExtensionFromMime } = require('../utils/file.util');
const {
  createRecord,
  getRecord,
  listRecords,
  updateRecord,
  deleteRecord,
  isValidDocId
} = require('../services/firebase-data.service');
const notificationService = require('../services/notification.service');
const { recordAudit } = require('../services/audit.service');

// Configure multer storage
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = getUploadsBaseDir();
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    // Stored-XSS fix: derive extension from validated MIME, never the client filename
    const ext = getExtensionFromMime(file.mimetype) || '.bin';
    const safeName = path.basename(file.originalname, path.extname(file.originalname)).replace(/[^a-z0-9]/gi, '_');
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
    // 400, not 500: this is the uploader's mistake, and 5xx messages are hidden in production.
    const error = new Error('Invalid file type. Only PDF, DOC, DOCX, PPT, PPTX, images, TXT, and ZIP are allowed.');
    error.statusCode = 400;
    cb(error);
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
 * Fields safe to show to any signed-in user. Server-side paths, stored names and
 * checksums stay internal.
 */
function toPublicFile(file) {
  return {
    id: file.id,
    original_name: file.original_name,
    category: file.category,
    subject: file.subject || null,
    description: file.description || null,
    mime_type: file.mime_type || null,
    file_size: file.file_size || 0,
    download_count: file.download_count || 0,
    approved: file.approved === true,
    status: file.status || (file.approved === true ? 'approved' : 'pending'),
    uploaded_by: file.uploaded_by,
    uploaded_by_name: file.uploaded_by_name || null,
    created_at: file.created_at || null,
    download_url: `/api/files/download/${encodeURIComponent(file.id)}`
  };
}

function actorId(req) {
  return req.user.id || req.user.uid;
}

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

    // Determine approval status (teacher uploads need approval)
    const approved = req.user.role === 'student' ? true : false;

    const record = await createRecord('files', {
      original_name: req.file.originalname,
      stored_name: req.file.filename,
      mime_type: req.file.mimetype,
      file_size: req.file.size,
      checksum,
      file_path: req.file.path,
      category,
      subject: subject || null,
      uploaded_by: actorId(req),
      uploaded_by_name: req.user.name || null,
      approved,
      status: approved ? 'approved' : 'pending',
      description: description || null,
      download_count: 0
    });
    const fileId = record.id;

    await recordAudit(req, {
      action: 'file_upload',
      entityType: 'file',
      entityId: fileId,
      summary: req.file.originalname,
      metadata: { category }
    });

    // Emit socket event for approved files
    if (approved || req.user.role === 'teacher') {
      if (req.user.department) {
        emitToDepartment(req.user.department, 'file:uploaded', {
          fileId,
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
        id: fileId,
        originalName: req.file.originalname,
        downloadUrl: `/api/files/download/${encodeURIComponent(fileId)}`,
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
 * Files list with real pagination, filters, search and totals
 */
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const { category, subject, approved, search } = req.query;

    const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const filters = [];
    if (category) filters.push({ field: 'category', value: String(category) });
    if (subject) filters.push({ field: 'subject', value: String(subject) });

    // Role-based filtering: students only ever see approved files
    if (req.user.role === 'student') {
      filters.push({ field: 'approved', value: true });
    } else if (approved !== undefined) {
      filters.push({ field: 'approved', value: approved === 'true' });
    }

    let files = await listRecords('files', {
      filters,
      orderBy: [{ field: 'created_at', direction: 'desc' }]
    });

    if (search) {
      const needle = String(search).toLowerCase();
      files = files.filter((file) => [file.original_name, file.description, file.subject]
        .some((field) => String(field || '').toLowerCase().includes(needle)));
    }

    const total = files.length;
    const offset = (pageNum - 1) * limitNum;

    res.json({
      success: true,
      data: {
        files: files.slice(offset, offset + limitNum).map(toPublicFile),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.max(1, Math.ceil(total / limitNum))
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/files/stats/overview
 * Real file statistics (zeros when there are no files; never invented numbers)
 */
router.get('/stats/overview', authMiddleware, async (req, res, next) => {
  try {
    const files = await listRecords('files');

    const categoryMap = new Map();
    let totalSize = 0;
    let totalDownloads = 0;
    let approvedFiles = 0;

    for (const file of files) {
      totalSize += file.file_size || 0;
      totalDownloads += file.download_count || 0;
      if (file.approved === true) approvedFiles += 1;

      if (file.category) {
        const entry = categoryMap.get(file.category) || { count: 0, size: 0 };
        entry.count += 1;
        entry.size += file.file_size || 0;
        categoryMap.set(file.category, entry);
      }
    }

    res.json({
      success: true,
      data: {
        overview: {
          total_files: files.length,
          total_size: totalSize,
          total_downloads: totalDownloads,
          approved_files: approvedFiles,
          pending_files: files.length - approvedFiles
        },
        byCategory: Array.from(categoryMap.entries()).map(([category, entry]) => ({
          category,
          count: entry.count,
          size: entry.size
        }))
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
    const file = isValidDocId(fileId) ? await getRecord('files', fileId) : null;

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Permission check
    if (req.user.role === 'student') {
      if (!file.approved && file.uploaded_by !== actorId(req)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied - file not approved'
        });
      }
    }

    try {
      await fs.access(file.file_path);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
    }

    // Atomic increment: concurrent downloads must not overwrite each other's count.
    try {
      const increment = admin?.firestore?.FieldValue?.increment;
      await db.collection('files').doc(fileId).update({
        download_count: typeof increment === 'function' ? increment(1) : (file.download_count || 0) + 1
      });
    } catch (countError) {
      console.warn('Failed to update download count:', countError.message);
    }

    await recordAudit(req, {
      action: 'file_download',
      entityType: 'file',
      entityId: fileId,
      summary: file.original_name
    });

    res.download(file.file_path, file.original_name, (downloadError) => {
      if (downloadError && !res.headersSent) {
        next(downloadError);
      }
    });
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
    const file = isValidDocId(fileId) ? await getRecord('files', fileId) : null;

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    await updateRecord('files', fileId, {
      approved: true,
      status: 'approved',
      approved_by: actorId(req),
      approved_at: new Date().toISOString(),
      rejection_reason: null
    });

    await recordAudit(req, {
      action: 'file_approve',
      entityType: 'file',
      entityId: fileId,
      summary: file.original_name
    });

    if (file.uploaded_by) {
      await notificationService.create({
        userId: file.uploaded_by,
        title: 'File approved',
        message: `Your file "${file.original_name}" was approved and is now visible to students.`,
        type: 'file',
        link: '/dashboard/student-notes.html',
        metadata: { fileId }
      });
    }

    // Emit socket event
    if (req.user.department) {
      emitToDepartment(req.user.department, 'file:approved', {
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
    const file = isValidDocId(fileId) ? await getRecord('files', fileId) : null;

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Permission check
    if (req.user.role !== 'admin' && file.uploaded_by !== actorId(req)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Delete file from filesystem
    if (file.file_path) {
      try {
        await fs.unlink(file.file_path);
      } catch (error) {
        console.error('Error deleting file:', error);
      }
    }

    await deleteRecord('files', fileId);

    await recordAudit(req, {
      action: 'file_delete',
      entityType: 'file',
      entityId: fileId,
      summary: file.original_name
    });

    res.json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
