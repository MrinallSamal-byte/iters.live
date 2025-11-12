/**
 * Admit Card Routes
 * API endpoints for admit card / ID card management
 */

const express = require('express');
const router = express.Router();
const admitCardController = require('../controllers/admitcard.controller');
const { verifyToken } = require('../middleware/auth');
const { documentUpload, handleMulterError } = require('../config/multer');

// All routes require authentication
router.use(verifyToken);

// GET /api/admitcard/:student_id - Get admit card details
router.get('/:student_id', admitCardController.getAdmitCard);

// GET /api/admitcard/:student_id/download - Download admit card PDF
router.get('/:student_id/download', admitCardController.downloadAdmitCard);

// POST /api/admitcard/upload - Upload admit card (admin/teacher only)
router.post(
    '/upload',
    documentUpload.single('admitCard'),
    handleMulterError,
    admitCardController.uploadAdmitCard
);

module.exports = router;
