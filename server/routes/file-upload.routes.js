/**
 * File Upload Routes with Chunked Upload Support
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const crypto = require('crypto');
const { authMiddleware: authenticateToken } = require('../middleware/auth');

// Storage configuration
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    
    // Create uploads directory if it doesn't exist
    if (!fsSync.existsSync(uploadDir)) {
      await fs.mkdir(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|zip|rar/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('File type not allowed'));
  }
};

// Multer configuration
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB max
  },
  fileFilter: fileFilter
});

// Store for tracking chunked uploads
const chunkUploads = new Map();

/**
 * Direct file upload (for small files)
 */
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileData = {
      id: crypto.randomBytes(16).toString('hex'),
      filename: req.file.filename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      uploadedBy: req.user.userId,
      uploadedAt: new Date()
    };

    // Save file metadata to database
    const db = require('../database/db');
    await db.query(`INSERT INTO files (id, filename, original_name, mime_type, size, file_path, uploaded_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [fileData.id, fileData.filename, fileData.originalname, fileData.mimetype, 
       fileData.size, fileData.path, fileData.uploadedBy, fileData.uploadedAt]
    );

    res.json({
      success: true,
      file: {
        id: fileData.id,
        filename: fileData.filename,
        originalname: fileData.originalname,
        size: fileData.size,
        url: `/uploads/${fileData.filename}`
      }
    });

  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ error: 'File upload failed' });
  }
});

/**
 * Chunked file upload (for large files)
 */
router.post('/upload-chunk', authenticateToken, upload.single('chunk'), async (req, res) => {
  try {
    const { uploadId, chunkIndex, totalChunks, filename } = req.body;

    if (!uploadId || chunkIndex === undefined || !totalChunks || !filename) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Initialize upload tracking if not exists
    if (!chunkUploads.has(uploadId)) {
      chunkUploads.set(uploadId, {
        filename,
        chunks: new Array(parseInt(totalChunks)).fill(null),
        uploadedBy: req.user.userId,
        createdAt: Date.now()
      });
    }

    const uploadData = chunkUploads.get(uploadId);

    // Save chunk file path
    uploadData.chunks[parseInt(chunkIndex)] = req.file.path;

    // Check if all chunks received
    const allChunksReceived = uploadData.chunks.every(chunk => chunk !== null);

    if (allChunksReceived) {
      // Merge chunks
      const finalPath = await mergeChunks(uploadId, uploadData);
      
      // Save to database
      const fileId = crypto.randomBytes(16).toString('hex');
      const stats = await fs.stat(finalPath);
      
      const db = require('../database/db');
      await db.query(`INSERT INTO files (id, filename, original_name, mime_type, size, file_path, uploaded_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [fileId, path.basename(finalPath), uploadData.filename, 
         'application/octet-stream', stats.size, finalPath, 
         uploadData.uploadedBy, new Date()]
      );

      // Clean up chunk files
      await Promise.all(uploadData.chunks.map(chunkPath => 
        fs.unlink(chunkPath).catch(console.error)
      ));

      // Remove from tracking
      chunkUploads.delete(uploadId);

      res.json({
        success: true,
        completed: true,
        file: {
          id: fileId,
          filename: path.basename(finalPath),
          originalname: uploadData.filename,
          size: stats.size,
          url: `/uploads/${path.basename(finalPath)}`
        }
      });
    } else {
      res.json({
        success: true,
        completed: false,
        received: uploadData.chunks.filter(c => c !== null).length,
        total: totalChunks
      });
    }

  } catch (error) {
    console.error('Chunk upload error:', error);
    res.status(500).json({ error: 'Chunk upload failed' });
  }
});

/**
 * Merge uploaded chunks into single file
 */
async function mergeChunks(uploadId, uploadData) {
  const uploadDir = path.join(__dirname, '../../uploads');
  const ext = path.extname(uploadData.filename);
  const finalFilename = `${uploadId}${ext}`;
  const finalPath = path.join(uploadDir, finalFilename);

  // Create write stream for final file
  const writeStream = fsSync.createWriteStream(finalPath);

  // Write each chunk in order
  for (const chunkPath of uploadData.chunks) {
    const chunkData = await fs.readFile(chunkPath);
    writeStream.write(chunkData);
  }

  writeStream.end();

  // Wait for write to complete
  await new Promise((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });

  return finalPath;
}

/**
 * Get file metadata
 */
router.get('/files/:fileId', authenticateToken, async (req, res) => {
  try {
    const db = require('../database/db');
    const files = await db.query('SELECT * FROM files WHERE id = $1', [req.params.fileId]
    );

    if (files.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({ file: files[0] });

  } catch (error) {
    console.error('Get file error:', error);
    res.status(500).json({ error: 'Failed to get file' });
  }
});

/**
 * Download file
 */
router.get('/files/:fileId/download', authenticateToken, async (req, res) => {
  try {
    const db = require('../database/db');
    const files = await db.query('SELECT * FROM files WHERE id = $1', [req.params.fileId]
    );

    if (files.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = files[0];
    
    res.download(file.file_path, file.original_name, (err) => {
      if (err) {
        console.error('Download error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Download failed' });
        }
      }
    });

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Download failed' });
  }
});

/**
 * Delete file
 */
router.delete('/files/:fileId', authenticateToken, async (req, res) => {
  try {
    const db = require('../database/db');
    const files = await db.query('SELECT * FROM files WHERE id = $1 AND uploaded_by = $2', [req.params.fileId, req.user.userId]
    );

    if (files.length === 0) {
      return res.status(404).json({ error: 'File not found or unauthorized' });
    }

    const file = files[0];

    // Delete file from disk
    await fs.unlink(file.file_path).catch(console.error);

    // Delete from database
    await db.query('DELETE FROM files WHERE id = $1', [req.params.fileId]);

    res.json({ success: true, message: 'File deleted' });

  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

/**
 * Get user's files
 */
router.get('/files', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const offset = (page - 1) * limit;

    const db = require('../database/db');
    
    let query = 'SELECT * FROM files WHERE uploaded_by = ?';
    const params = [req.user.userId];

    if (type) {
      query += ' AND mime_type LIKE ?';
      params.push(`${type}%`);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const files = await db.query(query, params);
    const totalRows = await db.query('SELECT COUNT(*) as total FROM files WHERE uploaded_by = $1', [req.user.userId]
    );
    const total = totalRows[0]?.total || 0;

    res.json({
      files,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({ error: 'Failed to get files' });
  }
});

/**
 * Folder Management Routes
 */

// Get all folders for user
router.get('/folders', authenticateToken, async (req, res) => {
  try {
    const db = require('../database/db');
    const folders = await db.query('SELECT * FROM file_folders WHERE created_by = $1 ORDER BY name', [req.user.userId]
    );

    res.json({ folders });

  } catch (error) {
    console.error('Get folders error:', error);
    res.status(500).json({ error: 'Failed to get folders' });
  }
});

// Create folder
router.post('/folders', authenticateToken, async (req, res) => {
  try {
    const { name, parent_id } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Folder name required' });
    }

    const folderId = crypto.randomBytes(16).toString('hex');
    const db = require('../database/db');

    await db.query('INSERT INTO file_folders (id, name, parent_id, created_by) VALUES ($1, $2, $3, $4)', [folderId, name, parent_id || null, req.user.userId]
    );

    const folderRows = await db.query('SELECT * FROM file_folders WHERE id = $1', [folderId]
    );

    res.json({ success: true, folder: folderRows[0] });

  } catch (error) {
    console.error('Create folder error:', error);
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

// Rename folder
router.patch('/folders/:folderId', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Folder name required' });
    }

    const db = require('../database/db');
    await db.query('UPDATE file_folders SET name = $1 WHERE id = $2 AND created_by = $3', [name, req.params.folderId, req.user.userId]
    );

    res.json({ success: true });

  } catch (error) {
    console.error('Rename folder error:', error);
    res.status(500).json({ error: 'Failed to rename folder' });
  }
});

// Delete folder
router.delete('/folders/:folderId', authenticateToken, async (req, res) => {
  try {
    const db = require('../database/db');
    
    // Check if folder is empty
    const countRows = await db.query('SELECT COUNT(*) as file_count FROM files WHERE folder_id = $1', [req.params.folderId]
    );
    const file_count = countRows[0]?.file_count || 0;

    if (file_count > 0) {
      return res.status(400).json({ error: 'Cannot delete non-empty folder' });
    }

    await db.query('DELETE FROM file_folders WHERE id = $1 AND created_by = $2', [req.params.folderId, req.user.userId]
    );

    res.json({ success: true });

  } catch (error) {
    console.error('Delete folder error:', error);
    res.status(500).json({ error: 'Failed to delete folder' });
  }
});

// Move folder
router.patch('/folders/:folderId/move', authenticateToken, async (req, res) => {
  try {
    const { folder_id } = req.body;

    const db = require('../database/db');
    await db.query('UPDATE file_folders SET parent_id = $1 WHERE id = $2 AND created_by = $3', [folder_id || null, req.params.folderId, req.user.userId]
    );

    res.json({ success: true });

  } catch (error) {
    console.error('Move folder error:', error);
    res.status(500).json({ error: 'Failed to move folder' });
  }
});

/**
 * Share Link Routes
 */

// Create share link
router.post('/files/:fileId/share', authenticateToken, async (req, res) => {
  try {
    const { expires_at, password, max_downloads } = req.body;

    const shareId = crypto.randomBytes(16).toString('hex');
    const shareToken = crypto.randomBytes(32).toString('hex');
    
    let passwordHash = null;
    if (password) {
      const bcrypt = require('bcrypt');
      passwordHash = await bcrypt.hash(password, 10);
    }

    const db = require('../database/db');
    await db.query(`INSERT INTO file_shares (id, file_id, share_token, password_hash, max_downloads, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`, [shareId, req.params.fileId, shareToken, passwordHash, 
       max_downloads || null, expires_at || null, req.user.userId]
    );

    const shareRows = await db.query('SELECT * FROM file_shares WHERE id = $1', [shareId]
    );

    res.json({ success: true, share: shareRows[0] });

  } catch (error) {
    console.error('Create share link error:', error);
    res.status(500).json({ error: 'Failed to create share link' });
  }
});

// Access shared file
router.get('/share/:token', async (req, res) => {
  try {
    const db = require('../database/db');
    const shareRows = await db.query('SELECT * FROM file_shares WHERE share_token = $1', [req.params.token]
    );
    const share = shareRows[0];
    if (!share) {
      return res.status(404).json({ error: 'Share link not found' });
    }

    // Check expiry
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Share link expired' });
    }

    // Check download limit
    if (share.max_downloads && share.download_count >= share.max_downloads) {
      return res.status(403).json({ error: 'Download limit reached' });
    }

    // Get file info
    const fileRows = await db.query('SELECT * FROM files WHERE id = $1', [share.file_id]
    );
    const file = fileRows[0];
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({ 
      success: true, 
      file: {
        id: file.id,
        name: file.original_name,
        size: file.size,
        mime_type: file.mime_type
      },
      requiresPassword: !!share.password_hash
    });

  } catch (error) {
    console.error('Access share link error:', error);
    res.status(500).json({ error: 'Failed to access share link' });
  }
});

// Download shared file
router.post('/share/:token/download', async (req, res) => {
  try {
    const { password } = req.body;
    
    const db = require('../database/db');
    const shareRows2 = await db.query('SELECT * FROM file_shares WHERE share_token = $1', [req.params.token]
    );
    const share2 = shareRows2[0];
    if (!share2) {
      return res.status(404).json({ error: 'Share link not found' });
    }

    // Check password
    if (share2.password_hash) {
      if (!password) {
        return res.status(401).json({ error: 'Password required' });
      }
      
      const bcrypt = require('bcrypt');
      const valid = await bcrypt.compare(password, share2.password_hash);
      
      if (!valid) {
        return res.status(401).json({ error: 'Invalid password' });
      }
    }

    // Get file
    const fileRows2 = await db.query('SELECT * FROM files WHERE id = $1', [share2.file_id]
    );
    const file2 = fileRows2[0];

    // Increment download count
    await db.query('UPDATE file_shares SET download_count = download_count + 1, last_accessed_at = NOW() WHERE id = $1', [share2.id]
    );

    // Download file
  res.download(file2.file_path, file2.original_name);

  } catch (error) {
    console.error('Download shared file error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Revoke share link
router.delete('/files/:fileId/share/:shareId', authenticateToken, async (req, res) => {
  try {
    const db = require('../database/db');
    await db.query('DELETE FROM file_shares WHERE id = $1 AND file_id = $2 AND created_by = $3', [req.params.shareId, req.params.fileId, req.user.userId]
    );

    res.json({ success: true });

  } catch (error) {
    console.error('Revoke share link error:', error);
    res.status(500).json({ error: 'Failed to revoke share link' });
  }
});

// Clean up old incomplete uploads (run periodically)
setInterval(() => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  for (const [uploadId, data] of chunkUploads.entries()) {
    if (now - data.createdAt > maxAge) {
      // Clean up chunk files
      data.chunks.forEach(chunkPath => {
        if (chunkPath) {
          fs.unlink(chunkPath).catch(console.error);
        }
      });
      chunkUploads.delete(uploadId);
    }
  }
}, 60 * 60 * 1000); // Run every hour

module.exports = router;
