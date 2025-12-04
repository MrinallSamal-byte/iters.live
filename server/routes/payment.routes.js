const express = require('express');
const router = express.Router();
const { db } = require('../database/firebase');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const PDFDocument = require('pdfkit');
const crypto = require('crypto');

/**
 * POST /api/payments/create
 * Create a new payment transaction
 */
router.post('/create',
  authMiddleware,
  roleMiddleware('student'),
  [
    body('amount').isFloat({ min: 1 }).withMessage('Amount must be a positive number'),
    body('semester').isString().notEmpty().withMessage('Semester is required'),
    body('category').isIn(['tuition', 'hostel', 'library', 'exam', 'other']).withMessage('Invalid category'),
    body('payment_method').isIn(['card', 'upi', 'netbanking', 'wallet']).withMessage('Invalid payment method')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { amount, semester, category, payment_method, description } = req.body;
      const studentId = req.user.id;

      // Generate unique payment ID and transaction ID
      const paymentId = 'PAY' + Date.now() + crypto.randomBytes(4).toString('hex').toUpperCase();
      const transactionId = 'TXN' + Date.now() + crypto.randomBytes(6).toString('hex').toUpperCase();

      // Create payment document
      const paymentData = {
        payment_id: paymentId,
        transaction_id: transactionId,
        student_id: studentId,
        amount: parseFloat(amount),
        semester,
        category,
        payment_method,
        description: description || '',
        status: 'pending', // pending, processing, success, failed
        created_at: new Date(),
        updated_at: new Date(),
        payment_gateway_response: null
      };

      // Save to Firestore
      await db.collection('payments').doc(paymentId).set(paymentData);

      // Simulate payment processing (in production, integrate with real gateway)
      setTimeout(async () => {
        try {
          // Mock payment success (80% success rate)
          const isSuccess = Math.random() > 0.2;
          const newStatus = isSuccess ? 'success' : 'failed';

          await db.collection('payments').doc(paymentId).update({
            status: newStatus,
            updated_at: new Date(),
            payment_gateway_response: {
              status: newStatus,
              gateway: 'mock_gateway',
              processed_at: new Date()
            }
          });

          // Emit Socket.IO event for real-time update
          const io = req.app.get('io');
          if (io) {
            io.to(studentId).emit('payment_status_update', {
              payment_id: paymentId,
              status: newStatus,
              amount,
              category
            });
          }
        } catch (error) {
          console.error('Error updating payment status:', error);
        }
      }, 3000); // Simulate 3 second processing time

      res.json({
        success: true,
        message: 'Payment initiated successfully',
        data: {
          payment_id: paymentId,
          transaction_id: transactionId,
          status: 'pending'
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/payments/student/:id
 * Get payment history for a student
 */
router.get('/student/:id', authMiddleware, async (req, res, next) => {
  try {
    const studentId = req.params.id;

    // Authorization check - students can only view their own payments
    if (req.user.role === 'student' && req.user.id !== studentId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get payments from Firestore
    const paymentsSnapshot = await db.collection('payments')
      .where('student_id', '==', studentId)
      .orderBy('created_at', 'desc')
      .get();

    const payments = [];
    paymentsSnapshot.forEach(doc => {
      const data = doc.data();
      payments.push({
        id: doc.id,
        ...data,
        created_at: data.created_at?.toDate ? data.created_at.toDate() : data.created_at,
        updated_at: data.updated_at?.toDate ? data.updated_at.toDate() : data.updated_at
      });
    });

    // Calculate summary statistics
    const summary = {
      total_payments: payments.length,
      total_amount: payments.filter(p => p.status === 'success').reduce((sum, p) => sum + p.amount, 0),
      pending_payments: payments.filter(p => p.status === 'pending' || p.status === 'processing').length,
      successful_payments: payments.filter(p => p.status === 'success').length,
      failed_payments: payments.filter(p => p.status === 'failed').length
    };

    res.json({
      success: true,
      data: {
        payments,
        summary
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/payments/:id
 * Get single payment details
 */
router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    const paymentId = req.params.id;

    const paymentDoc = await db.collection('payments').doc(paymentId).get();

    if (!paymentDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    const payment = paymentDoc.data();

    // Authorization check
    if (req.user.role === 'student' && req.user.id !== payment.student_id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get student details
    let studentInfo = null;
    if (payment.student_id) {
      const studentDoc = await db.collection('users').doc(payment.student_id).get();
      if (studentDoc.exists) {
        const studentData = studentDoc.data();
        studentInfo = {
          name: studentData.name,
          email: studentData.email,
          registration_number: studentData.registration_number
        };
      }
    }

    res.json({
      success: true,
      data: {
        ...payment,
        student_info: studentInfo,
        created_at: payment.created_at?.toDate ? payment.created_at.toDate() : payment.created_at,
        updated_at: payment.updated_at?.toDate ? payment.updated_at.toDate() : payment.updated_at
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/payments/:id/receipt
 * Generate and download PDF receipt
 */
router.get('/:id/receipt', authMiddleware, async (req, res, next) => {
  try {
    const paymentId = req.params.id;

    const paymentDoc = await db.collection('payments').doc(paymentId).get();

    if (!paymentDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    const payment = paymentDoc.data();

    // Authorization check
    if (req.user.role === 'student' && req.user.id !== payment.student_id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Only generate receipt for successful payments
    if (payment.status !== 'success') {
      return res.status(400).json({
        success: false,
        message: 'Receipt only available for successful payments'
      });
    }

    // Get student details
    const studentDoc = await db.collection('users').doc(payment.student_id).get();
    const student = studentDoc.exists ? studentDoc.data() : {};

    // Create PDF
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=receipt-${paymentId}.pdf`);

    // Pipe PDF to response
    doc.pipe(res);

    // Header
    doc.fontSize(20)
      .font('Helvetica-Bold')
      .text('ITER College Management System', { align: 'center' })
      .fontSize(16)
      .text('Payment Receipt', { align: 'center' })
      .moveDown();

    // Receipt details box
    doc.fontSize(10)
      .font('Helvetica')
      .text('_'.repeat(80))
      .moveDown(0.5);

    // Receipt info
    doc.fontSize(12)
      .font('Helvetica-Bold')
      .text(`Receipt No: ${paymentId}`, 50, doc.y)
      .font('Helvetica')
      .text(`Date: ${new Date(payment.created_at?.toDate ? payment.created_at.toDate() : payment.created_at).toLocaleDateString()}`, 350, doc.y - 12)
      .moveDown();

    // Student details
    doc.fontSize(10)
      .font('Helvetica-Bold')
      .text('Student Details:')
      .font('Helvetica')
      .text(`Name: ${student.name || 'N/A'}`)
      .text(`Registration No: ${student.registration_number || 'N/A'}`)
      .text(`Email: ${student.email || 'N/A'}`)
      .moveDown();

    // Payment details
    doc.font('Helvetica-Bold')
      .text('Payment Details:')
      .font('Helvetica')
      .text(`Transaction ID: ${payment.transaction_id}`)
      .text(`Category: ${payment.category.toUpperCase()}`)
      .text(`Semester: ${payment.semester}`)
      .text(`Payment Method: ${payment.payment_method.toUpperCase()}`)
      .text(`Status: ${payment.status.toUpperCase()}`)
      .moveDown();

    if (payment.description) {
      doc.text(`Description: ${payment.description}`)
        .moveDown();
    }

    // Amount section
    doc.fontSize(10)
      .text('_'.repeat(80))
      .moveDown(0.5);

    doc.fontSize(14)
      .font('Helvetica-Bold')
      .text(`Amount Paid: ₹${payment.amount.toFixed(2)}`, { align: 'right' })
      .moveDown();

    doc.fontSize(10)
      .text('_'.repeat(80))
      .moveDown();

    // Footer
    doc.fontSize(8)
      .font('Helvetica')
      .text('This is a computer-generated receipt and does not require a signature.', { align: 'center' })
      .moveDown(0.5)
      .text('For queries, contact: finance@iter.edu | +91-XXXXXXXXXX', { align: 'center' });

    // Finalize PDF
    doc.end();

  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/payments/:id/status
 * Update payment status (Admin only)
 */
router.put('/:id/status',
  authMiddleware,
  roleMiddleware('admin'),
  [
    body('status').isIn(['pending', 'processing', 'success', 'failed']).withMessage('Invalid status')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const paymentId = req.params.id;
      const { status, admin_notes } = req.body;

      const paymentDoc = await db.collection('payments').doc(paymentId).get();

      if (!paymentDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
      }

      // Update payment status
      await db.collection('payments').doc(paymentId).update({
        status,
        admin_notes: admin_notes || '',
        updated_at: new Date(),
        updated_by: req.user.id
      });

      const payment = paymentDoc.data();

      // Emit Socket.IO event
      const io = req.app.get('io');
      if (io) {
        io.to(payment.student_id).emit('payment_status_update', {
          payment_id: paymentId,
          status,
          amount: payment.amount,
          category: payment.category
        });
      }

      res.json({
        success: true,
        message: 'Payment status updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/payments/admin/all
 * Get all payments (Admin only) with filters and pagination
 */
router.get('/admin/all',
  authMiddleware,
  roleMiddleware('admin', 'teacher'),
  async (req, res, next) => {
    try {
      const { status, category, limit = 50, startAfter } = req.query;

      let query = db.collection('payments');

      // Apply filters
      if (status) {
        query = query.where('status', '==', status);
      }
      if (category) {
        query = query.where('category', '==', category);
      }

      // Order by created_at
      query = query.orderBy('created_at', 'desc');

      // Pagination
      if (startAfter) {
        const startDoc = await db.collection('payments').doc(startAfter).get();
        if (startDoc.exists) {
          query = query.startAfter(startDoc);
        }
      }

      query = query.limit(parseInt(limit));

      const snapshot = await query.get();

      const payments = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        payments.push({
          id: doc.id,
          ...data,
          created_at: data.created_at?.toDate ? data.created_at.toDate() : data.created_at,
          updated_at: data.updated_at?.toDate ? data.updated_at.toDate() : data.updated_at
        });
      });

      // Get summary stats
      const allPaymentsSnapshot = await db.collection('payments').get();
      const allPayments = [];
      allPaymentsSnapshot.forEach(doc => {
        allPayments.push(doc.data());
      });

      const summary = {
        total_payments: allPayments.length,
        total_amount: allPayments.filter(p => p.status === 'success').reduce((sum, p) => sum + p.amount, 0),
        pending_count: allPayments.filter(p => p.status === 'pending' || p.status === 'processing').length,
        success_count: allPayments.filter(p => p.status === 'success').length,
        failed_count: allPayments.filter(p => p.status === 'failed').length
      };

      res.json({
        success: true,
        data: {
          payments,
          summary,
          hasMore: snapshot.size === parseInt(limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
