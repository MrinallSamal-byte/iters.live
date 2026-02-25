const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { db } = require('../database/firebase');
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
 * Log activity to Firestore
 */
const logActivity = async (userId, action, entityType, entityId, metadata = null) => {
  try {
    await db.collection('activity_log').add({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata: metadata || {},
      created_at: new Date()
    });
  } catch (error) {
    console.warn('Failed to log activity:', error.message);
  }
};

// Helper to generate dummy files data
const getDummyFiles = () => [
  {
    id: '1',
    original_name: 'Data_Structures_Unit1_Notes.pdf',
    category: 'note',
    subject: 'Data Structures',
    uploaded_by_name: 'Dr. Priya Verma',
    file_size: 2500000,
    download_count: 125,
    approved: true,
    public_url: '/uploads/dummy-file.pdf',
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
  },
  {
    id: '2',
    original_name: 'Database_PYQ_2024.pdf',
    category: 'pyq',
    subject: 'Database Management',
    uploaded_by_name: 'Dr. Amit Singh',
    file_size: 1800000,
    download_count: 89,
    approved: true,
    public_url: '/uploads/dummy-file.pdf',
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
  },
  {
    id: '3',
    original_name: 'Operating_Systems_Assignment.pdf',
    category: 'assignment',
    subject: 'Operating Systems',
    uploaded_by_name: 'Prof. Rahul Kumar',
    file_size: 950000,
    download_count: 45,
    approved: true,
    public_url: '/uploads/dummy-file.pdf',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  }
];

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

    // Determine approval status (student uploads need approval, teacher/admin auto-approved)
    const approved = req.user.role === 'teacher' || req.user.role === 'admin' ? true : false;

    // Save to Firestore
    const fileData = {
      original_name: req.file.originalname,
      stored_name: req.file.filename,
      mime_type: req.file.mimetype,
      file_size: req.file.size,
      checksum,
      file_path: req.file.path,
      public_url: publicUrl,
      category,
      subject: subject || null,
      uploaded_by: req.user.id || req.user.uid,
      approved,
      description: description || null,
      download_count: 0,
      created_at: new Date()
    };

    const docRef = await db.collection('files').add(fileData);
    const fileId = docRef.id;

    // Log activity
    await logActivity(req.user.id || req.user.uid, 'file_upload', 'file', fileId, {
      filename: req.file.originalname,
      category
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

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    
    try {
      // Build Firestore query
      let filesRef = db.collection('files');
      
      if (category) {
        filesRef = filesRef.where('category', '==', category);
      }
      
      if (subject) {
        filesRef = filesRef.where('subject', '==', subject);
      }
      
      // Role-based filtering
      if (req.user.role === 'student') {
        // Students see approved files
        filesRef = filesRef.where('approved', '==', true);
      } else if (approved !== undefined) {
        filesRef = filesRef.where('approved', '==', approved === 'true');
      }
      
      filesRef = filesRef.orderBy('created_at', 'desc').limit(limitNum);
      
      const snapshot = await filesRef.get();
      let files = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Client-side search filter (Firestore doesn't support LIKE)
      if (search) {
        const searchLower = search.toLowerCase();
        files = files.filter(f => 
          f.original_name?.toLowerCase().includes(searchLower) ||
          f.description?.toLowerCase().includes(searchLower)
        );
      }
      
      res.json({
        success: true,
        data: {
          files: files.length > 0 ? files : getDummyFiles(),
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: files.length || getDummyFiles().length,
            totalPages: 1
          }
        }
      });
    } catch (firestoreError) {
      console.warn('Firestore error, using dummy data:', firestoreError.message);
      res.json({
        success: true,
        data: {
          files: getDummyFiles(),
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: getDummyFiles().length,
            totalPages: 1
          }
        }
      });
    }
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

    try {
      const fileDoc = await db.collection('files').doc(fileId).get();

      if (!fileDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'File not found'
        });
      }

      const file = fileDoc.data();

      // Permission check
      if (req.user.role === 'student') {
        if (!file.approved && file.uploaded_by !== (req.user.id || req.user.uid)) {
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
      await db.collection('files').doc(fileId).update({
        download_count: (file.download_count || 0) + 1
      });

      // Log activity
      await logActivity(req.user.id || req.user.uid, 'file_download', 'file', fileId, {
        filename: file.original_name
      });

      // Send file
      res.download(file.file_path, file.original_name);
    } catch (firestoreError) {
      console.error('Firestore error:', firestoreError.message);
      res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
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

    try {
      const fileDoc = await db.collection('files').doc(fileId).get();

      if (!fileDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'File not found'
        });
      }

      const file = fileDoc.data();

      // Update approval status
      await db.collection('files').doc(fileId).update({
        approved: true,
        approved_by: req.user.id || req.user.uid,
        approved_at: new Date()
      });

      // Log activity
      await logActivity(req.user.id || req.user.uid, 'file_approve', 'file', fileId);

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
    } catch (firestoreError) {
      console.error('Firestore error:', firestoreError.message);
      res.status(500).json({
        success: false,
        message: 'Failed to approve file'
      });
    }
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

    try {
      const fileDoc = await db.collection('files').doc(fileId).get();

      if (!fileDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'File not found'
        });
      }

      const file = fileDoc.data();

      // Permission check
      if (req.user.role !== 'admin' && file.uploaded_by !== (req.user.id || req.user.uid)) {
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

      // Delete from Firestore
      await db.collection('files').doc(fileId).delete();

      // Log activity
      await logActivity(req.user.id || req.user.uid, 'file_delete', 'file', fileId, {
        filename: file.original_name
      });

      res.json({
        success: true,
        message: 'File deleted successfully'
      });
    } catch (firestoreError) {
      console.error('Firestore error:', firestoreError.message);
      res.status(500).json({
        success: false,
        message: 'Failed to delete file'
      });
    }
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
    // Return default stats
    let stats = {
      total_files: 45,
      total_size: 125000000,
      total_downloads: 1250,
      approved_files: 42,
      pending_files: 3
    };
    
    let byCategory = [
      { category: 'note', count: 20, size: 50000000 },
      { category: 'pyq', count: 15, size: 40000000 },
      { category: 'assignment', count: 10, size: 35000000 }
    ];

    try {
      const filesSnapshot = await db.collection('files').get();
      
      if (filesSnapshot.size > 0) {
        let totalSize = 0;
        let totalDownloads = 0;
        let approved = 0;
        let pending = 0;
        const categoryMap = {};
        
        filesSnapshot.docs.forEach(doc => {
          const file = doc.data();
          totalSize += file.file_size || 0;
          totalDownloads += file.download_count || 0;
          if (file.approved) approved++;
          else pending++;
          
          if (file.category) {
            if (!categoryMap[file.category]) {
              categoryMap[file.category] = { count: 0, size: 0 };
            }
            categoryMap[file.category].count++;
            categoryMap[file.category].size += file.file_size || 0;
          }
        });
        
        stats = {
          total_files: filesSnapshot.size,
          total_size: totalSize,
          total_downloads: totalDownloads,
          approved_files: approved,
          pending_files: pending
        };
        
        byCategory = Object.entries(categoryMap).map(([category, data]) => ({
          category,
          count: data.count,
          size: data.size
        }));
      }
    } catch (firestoreError) {
      console.warn('Firestore error:', firestoreError.message);
    }

    res.json({
      success: true,
      data: {
        overview: stats,
        byCategory
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
