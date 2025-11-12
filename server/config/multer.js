/**
 * Multer Configuration for File Uploads
 * Handles avatar and document uploads with validation
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { generateUniqueFilename, sanitizeFilename, ensureDir } = require('../utils/file.util');

// Storage configuration
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        let uploadPath = 'uploads/';
        
        // Determine upload path based on field name
        if (file.fieldname === 'avatar' || file.fieldname === 'photo') {
            uploadPath = 'uploads/avatars/';
        } else if (file.fieldname === 'admitCard') {
            uploadPath = 'uploads/admitcards/';
        } else if (file.fieldname === 'assignment') {
            uploadPath = 'uploads/assignments/';
        } else if (file.fieldname === 'notes') {
            uploadPath = 'uploads/notes/';
        } else {
            uploadPath = 'uploads/misc/';
        }
        try {
            // Ensure directory exists (sync fallback for multer callback)
            await ensureDir(uploadPath);
        } catch (e) {
            try {
                fs.mkdirSync(uploadPath, { recursive: true });
            } catch (err) {
                return cb(err);
            }
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueName = generateUniqueFilename(file.originalname);
        cb(null, uniqueName);
    }
});

// File filter for images
const imageFilter = (req, file, cb) => {
    const allowedMimes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPG, PNG, GIF, and WEBP images are allowed.'), false);
    }
};

// File filter for documents
const documentFilter = (req, file, cb) => {
    const allowedMimes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/jpeg',
        'image/png'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only PDF, DOC, DOCX, XLS, XLSX, JPG, and PNG files are allowed.'), false);
    }
};

// Avatar upload configuration (2MB limit, images only)
const avatarUpload = multer({
    storage: storage,
    fileFilter: imageFilter,
    limits: {
        fileSize: 2 * 1024 * 1024, // 2MB
        files: 1
    }
});

// Document upload configuration (10MB limit)
const documentUpload = multer({
    storage: storage,
    fileFilter: documentFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 1
    }
});

// Multiple files upload (max 5 files, 5MB each)
const multipleUpload = multer({
    storage: storage,
    fileFilter: documentFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB per file
        files: 5
    }
});

// Generic upload with configurable limits
const createUpload = (options = {}) => {
    const {
        maxSize = 5 * 1024 * 1024,
        maxFiles = 1,
        allowedMimes = null,
        fieldName = 'file'
    } = options;
    
    return multer({
        storage: storage,
        fileFilter: allowedMimes ? (req, file, cb) => {
            if (allowedMimes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new Error(`Invalid file type. Allowed types: ${allowedMimes.join(', ')}`), false);
            }
        } : undefined,
        limits: {
            fileSize: maxSize,
            files: maxFiles
        }
    });
};

// Error handler middleware
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'File too large. Maximum size exceeded.'
            });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                error: 'Too many files. Maximum count exceeded.'
            });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({
                success: false,
                error: 'Unexpected field name in form data.'
            });
        }
        return res.status(400).json({
            success: false,
            error: `Upload error: ${err.message}`
        });
    }
    
    if (err) {
        return res.status(400).json({
            success: false,
            error: err.message || 'File upload failed.'
        });
    }
    
    next();
};

module.exports = {
    avatarUpload,
    documentUpload,
    multipleUpload,
    createUpload,
    handleMulterError
};
