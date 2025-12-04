/**
 * Payment Controller
 * Handles student payment operations: create, view, history, receipt generation
 */

const { db, admin } = require('../database/firebase');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * POST /api/payments
 * Create a new payment record
 */
const createPayment = async (req, res) => {
    try {
        const userId = req.user.id;
        const { amount, semester, category, paymentMethod, description } = req.body;

        // Validation
        if (!amount || !semester || !category || !paymentMethod) {
            return res.status(400).json({
                success: false,
                error: 'Amount, semester, category, and payment method are required'
            });
        }

        // Validate amount
        if (isNaN(amount) || parseFloat(amount) <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid amount'
            });
        }

        // Generate payment ID
        const paymentId = `PAY${Date.now()}${Math.floor(Math.random() * 1000)}`;

        // Create payment record
        const payment = {
            paymentId,
            userId,
            studentName: req.user.name,
            studentEmail: req.user.email,
            studentRegNo: req.user.reg_no || req.user.student_id || 'N/A',
            amount: parseFloat(amount),
            semester,
            category,
            paymentMethod,
            description: description || '',
            status: 'completed', // For now, all payments are completed immediately
            transactionId: `TXN${Date.now()}`,
            paymentDate: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            // Admin reconciliation fields
            reconciled: false,
            reconciledBy: null,
            reconciledAt: null,
            notes: ''
        };

        // Save to Firestore
        await db.collection('payments').doc(paymentId).set(payment);

        res.json({
            success: true,
            message: 'Payment recorded successfully',
            data: {
                paymentId,
                transactionId: payment.transactionId,
                amount: payment.amount,
                status: payment.status
            }
        });

    } catch (error) {
        console.error('Create payment error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process payment'
        });
    }
};

/**
 * GET /api/payments
 * Get payment history for current student
 */
const getPaymentHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 20, status, category } = req.query;

        // Build query
        let query = db.collection('payments')
            .where('userId', '==', userId)
            .orderBy('paymentDate', 'desc');

        // Apply filters
        if (status) {
            query = query.where('status', '==', status);
        }
        if (category) {
            query = query.where('category', '==', category);
        }

        // Get data
        const snapshot = await query.get();
        
        const payments = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            payments.push({
                id: doc.id,
                ...data,
                paymentDate: data.paymentDate?.toDate?.() || new Date()
            });
        });

        res.json({
            success: true,
            data: payments,
            pagination: {
                total: payments.length,
                page: parseInt(page),
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        console.error('Get payment history error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch payment history'
        });
    }
};

/**
 * GET /api/payments/:paymentId
 * Get details of a specific payment
 */
const getPaymentDetails = async (req, res) => {
    try {
        const userId = req.user.id;
        const { paymentId } = req.params;

        // Get payment
        const doc = await db.collection('payments').doc(paymentId).get();

        if (!doc.exists) {
            return res.status(404).json({
                success: false,
                error: 'Payment not found'
            });
        }

        const payment = doc.data();

        // Check if payment belongs to user
        if (payment.userId !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Unauthorized access to payment'
            });
        }

        res.json({
            success: true,
            data: {
                id: doc.id,
                ...payment,
                paymentDate: payment.paymentDate?.toDate?.() || new Date()
            }
        });

    } catch (error) {
        console.error('Get payment details error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch payment details'
        });
    }
};

/**
 * GET /api/payments/:paymentId/receipt
 * Generate and download payment receipt as PDF
 */
const downloadReceipt = async (req, res) => {
    try {
        const userId = req.user.id;
        const { paymentId } = req.params;

        // Get payment
        const doc = await db.collection('payments').doc(paymentId).get();

        if (!doc.exists) {
            return res.status(404).json({
                success: false,
                error: 'Payment not found'
            });
        }

        const payment = doc.data();

        // Check if payment belongs to user
        if (payment.userId !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Unauthorized access to payment'
            });
        }

        // Create PDF
        const pdfDoc = new PDFDocument({ margin: 50 });
        const filename = `receipt-${paymentId}.pdf`;

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Pipe PDF to response
        pdfDoc.pipe(res);

        // Header
        pdfDoc
            .fontSize(20)
            .font('Helvetica-Bold')
            .text('ITER COLLEGE', { align: 'center' })
            .fontSize(16)
            .text('Payment Receipt', { align: 'center' })
            .moveDown(2);

        // Payment details
        const paymentDate = payment.paymentDate?.toDate?.() || new Date();
        
        pdfDoc
            .fontSize(12)
            .font('Helvetica-Bold')
            .text('Receipt Details', { underline: true })
            .moveDown(0.5)
            .font('Helvetica');

        const details = [
            { label: 'Payment ID:', value: payment.paymentId },
            { label: 'Transaction ID:', value: payment.transactionId },
            { label: 'Date:', value: paymentDate.toLocaleDateString('en-IN') },
            { label: 'Time:', value: paymentDate.toLocaleTimeString('en-IN') },
            { label: '', value: '' },
            { label: 'Student Name:', value: payment.studentName },
            { label: 'Registration No:', value: payment.studentRegNo },
            { label: 'Email:', value: payment.studentEmail },
            { label: '', value: '' },
            { label: 'Semester:', value: payment.semester },
            { label: 'Category:', value: payment.category },
            { label: 'Payment Method:', value: payment.paymentMethod },
            { label: 'Description:', value: payment.description || 'N/A' },
            { label: '', value: '' },
            { label: 'Amount:', value: `₹ ${payment.amount.toFixed(2)}` },
            { label: 'Status:', value: payment.status.toUpperCase() }
        ];

        details.forEach(item => {
            if (item.label === '' && item.value === '') {
                pdfDoc.moveDown(0.5);
            } else {
                pdfDoc
                    .font('Helvetica-Bold')
                    .text(item.label, { continued: true, width: 200 })
                    .font('Helvetica')
                    .text(item.value);
            }
        });

        // Footer
        pdfDoc
            .moveDown(3)
            .fontSize(10)
            .text('This is a computer-generated receipt and does not require a signature.', { align: 'center' })
            .text(`Generated on: ${new Date().toLocaleString('en-IN')}`, { align: 'center' });

        // Finalize PDF
        pdfDoc.end();

    } catch (error) {
        console.error('Download receipt error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate receipt'
        });
    }
};

/**
 * GET /api/payments/stats
 * Get payment statistics for current student
 */
const getPaymentStats = async (req, res) => {
    try {
        const userId = req.user.id;

        // Get all payments for user
        const snapshot = await db.collection('payments')
            .where('userId', '==', userId)
            .get();

        let totalPaid = 0;
        let totalPayments = 0;
        let pendingPayments = 0;
        const categoryBreakdown = {};

        snapshot.forEach(doc => {
            const payment = doc.data();
            totalPayments++;
            
            if (payment.status === 'completed') {
                totalPaid += payment.amount;
            } else if (payment.status === 'pending') {
                pendingPayments++;
            }

            // Category breakdown
            if (!categoryBreakdown[payment.category]) {
                categoryBreakdown[payment.category] = 0;
            }
            categoryBreakdown[payment.category] += payment.amount;
        });

        res.json({
            success: true,
            data: {
                totalPaid,
                totalPayments,
                pendingPayments,
                categoryBreakdown
            }
        });

    } catch (error) {
        console.error('Get payment stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch payment statistics'
        });
    }
};

module.exports = {
    createPayment,
    getPaymentHistory,
    getPaymentDetails,
    downloadReceipt,
    getPaymentStats
};
