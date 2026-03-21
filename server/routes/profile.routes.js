/**
 * Profile Routes
 * API endpoints for user profile management
 */

const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profile.controller');
const { verifyToken } = require('../middleware/auth');
const { avatarUpload, handleMulterError } = require('../config/multer');
const rateLimit = require('express-rate-limit');

// Rate limiter for photo uploads (5 uploads per 15 minutes)
const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: {
        success: false,
        error: 'Too many upload attempts. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// GET /api/users/me - Get current user profile
router.get('/users/me', verifyToken, profileController.getCurrentUser);

// PUT /api/users/me - Update profile
router.put('/users/me', verifyToken, profileController.updateProfile);

// POST /api/profile/photo - Upload profile photo
router.post(
    '/profile/photo',
    verifyToken,
    uploadLimiter,
    avatarUpload.single('avatar'),
    handleMulterError,
    profileController.uploadPhoto
);

// DELETE /api/profile/photo - Remove profile photo
router.delete('/profile/photo', verifyToken, profileController.deletePhoto);

module.exports = router;
