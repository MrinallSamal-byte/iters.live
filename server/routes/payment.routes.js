/**
 * Payment Routes
 * Handles all payment-related API endpoints
 */

const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/auth');
const paymentController = require('../controllers/payment.controller');

// Middleware to check validation results
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    next();
};

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * POST /api/payments
 * Create a new payment
 */
router.post('/',
    [
        body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
        body('semester').notEmpty().withMessage('Semester is required'),
        body('category').notEmpty().withMessage('Category is required'),
        body('paymentMethod').notEmpty().withMessage('Payment method is required'),
        body('description').optional().isString()
    ],
    validate,
    paymentController.createPayment
);

/**
 * GET /api/payments
 * Get payment history for current student
 */
router.get('/',
    [
        query('page').optional().isInt({ min: 1 }),
        query('limit').optional().isInt({ min: 1, max: 100 }),
        query('status').optional().isIn(['pending', 'completed', 'failed', 'refunded']),
        query('category').optional().isString()
    ],
    paymentController.getPaymentHistory
);

/**
 * GET /api/payments/stats
 * Get payment statistics
 */
router.get('/stats', paymentController.getPaymentStats);

/**
 * GET /api/payments/:paymentId
 * Get details of a specific payment
 */
router.get('/:paymentId',
    [
        param('paymentId').notEmpty().withMessage('Payment ID is required')
    ],
    validate,
    paymentController.getPaymentDetails
);

/**
 * GET /api/payments/:paymentId/receipt
 * Download payment receipt as PDF
 */
router.get('/:paymentId/receipt',
    [
        param('paymentId').notEmpty().withMessage('Payment ID is required')
    ],
    validate,
    paymentController.downloadReceipt
);

module.exports = router;
