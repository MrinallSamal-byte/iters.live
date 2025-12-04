/**
 * Payment Analytics Service
 * Provides analytics and insights for payment data
 */

const { db } = require('../database/firebase');

/**
 * Get payment analytics for a specific user
 * @param {string} userId - User ID
 * @param {string} timeRange - Time range (week, month, year, all)
 * @returns {Object} Analytics data
 */
const getUserPaymentAnalytics = async (userId, timeRange = 'all') => {
    try {
        let query = db.collection('payments').where('userId', '==', userId);

        // Apply time range filter
        if (timeRange !== 'all') {
            const now = new Date();
            let startDate;

            switch (timeRange) {
                case 'week':
                    startDate = new Date(now.getTime());
                    startDate.setDate(startDate.getDate() - 7);
                    break;
                case 'month':
                    startDate = new Date(now.getTime());
                    startDate.setMonth(startDate.getMonth() - 1);
                    break;
                case 'year':
                    startDate = new Date(now.getTime());
                    startDate.setFullYear(startDate.getFullYear() - 1);
                    break;
                default:
                    startDate = new Date(0); // Beginning of time
            }

            query = query.where('paymentDate', '>=', startDate);
        }

        const snapshot = await query.get();

        // Initialize analytics data
        const analytics = {
            totalAmount: 0,
            averagePayment: 0,
            paymentCount: 0,
            categoryBreakdown: {},
            methodBreakdown: {},
            statusBreakdown: {
                completed: 0,
                pending: 0,
                failed: 0,
                refunded: 0
            },
            monthlyTrend: {},
            semesterBreakdown: {}
        };

        const payments = [];
        snapshot.forEach(doc => {
            payments.push({ id: doc.id, ...doc.data() });
        });

        // Calculate analytics
        payments.forEach(payment => {
            // Total amount and count
            analytics.totalAmount += payment.amount;
            analytics.paymentCount++;

            // Category breakdown
            if (!analytics.categoryBreakdown[payment.category]) {
                analytics.categoryBreakdown[payment.category] = {
                    count: 0,
                    amount: 0
                };
            }
            analytics.categoryBreakdown[payment.category].count++;
            analytics.categoryBreakdown[payment.category].amount += payment.amount;

            // Method breakdown
            if (!analytics.methodBreakdown[payment.paymentMethod]) {
                analytics.methodBreakdown[payment.paymentMethod] = {
                    count: 0,
                    amount: 0
                };
            }
            analytics.methodBreakdown[payment.paymentMethod].count++;
            analytics.methodBreakdown[payment.paymentMethod].amount += payment.amount;

            // Status breakdown
            if (analytics.statusBreakdown[payment.status] !== undefined) {
                analytics.statusBreakdown[payment.status]++;
            }

            // Semester breakdown
            if (!analytics.semesterBreakdown[payment.semester]) {
                analytics.semesterBreakdown[payment.semester] = {
                    count: 0,
                    amount: 0
                };
            }
            analytics.semesterBreakdown[payment.semester].count++;
            analytics.semesterBreakdown[payment.semester].amount += payment.amount;

            // Monthly trend
            const date = payment.paymentDate?.toDate?.() || new Date();
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!analytics.monthlyTrend[monthKey]) {
                analytics.monthlyTrend[monthKey] = {
                    count: 0,
                    amount: 0
                };
            }
            analytics.monthlyTrend[monthKey].count++;
            analytics.monthlyTrend[monthKey].amount += payment.amount;
        });

        // Calculate average
        analytics.averagePayment = analytics.paymentCount > 0
            ? analytics.totalAmount / analytics.paymentCount
            : 0;

        return analytics;

    } catch (error) {
        console.error('Get user payment analytics error:', error);
        throw error;
    }
};

/**
 * Get system-wide payment analytics (for admin)
 * @param {string} timeRange - Time range
 * @returns {Object} System analytics
 */
const getSystemPaymentAnalytics = async (timeRange = 'all') => {
    try {
        let query = db.collection('payments');

        // Apply time range filter
        if (timeRange !== 'all') {
            const now = new Date();
            let startDate;

            switch (timeRange) {
                case 'week':
                    startDate = new Date(now.getTime());
                    startDate.setDate(startDate.getDate() - 7);
                    break;
                case 'month':
                    startDate = new Date(now.getTime());
                    startDate.setMonth(startDate.getMonth() - 1);
                    break;
                case 'year':
                    startDate = new Date(now.getTime());
                    startDate.setFullYear(startDate.getFullYear() - 1);
                    break;
                default:
                    startDate = new Date(0);
            }

            query = query.where('paymentDate', '>=', startDate);
        }

        const snapshot = await query.get();

        const analytics = {
            totalRevenue: 0,
            totalPayments: 0,
            averagePayment: 0,
            uniqueStudents: new Set(),
            categoryBreakdown: {},
            statusBreakdown: {
                completed: 0,
                pending: 0,
                failed: 0,
                refunded: 0
            },
            dailyRevenue: {}
        };

        snapshot.forEach(doc => {
            const payment = doc.data();

            analytics.totalRevenue += payment.amount;
            analytics.totalPayments++;
            analytics.uniqueStudents.add(payment.userId);

            // Category breakdown
            if (!analytics.categoryBreakdown[payment.category]) {
                analytics.categoryBreakdown[payment.category] = {
                    count: 0,
                    amount: 0
                };
            }
            analytics.categoryBreakdown[payment.category].count++;
            analytics.categoryBreakdown[payment.category].amount += payment.amount;

            // Status breakdown
            if (analytics.statusBreakdown[payment.status] !== undefined) {
                analytics.statusBreakdown[payment.status]++;
            }

            // Daily revenue
            const date = payment.paymentDate?.toDate?.() || new Date();
            const dayKey = date.toISOString().split('T')[0];
            if (!analytics.dailyRevenue[dayKey]) {
                analytics.dailyRevenue[dayKey] = 0;
            }
            analytics.dailyRevenue[dayKey] += payment.amount;
        });

        analytics.uniqueStudents = analytics.uniqueStudents.size;
        analytics.averagePayment = analytics.totalPayments > 0
            ? analytics.totalRevenue / analytics.totalPayments
            : 0;

        return analytics;

    } catch (error) {
        console.error('Get system payment analytics error:', error);
        throw error;
    }
};

/**
 * Get top paying students (for admin)
 * @param {number} limit - Number of top students to return
 * @returns {Array} Top students with payment totals
 */
const getTopPayingStudents = async (limit = 10) => {
    try {
        const snapshot = await db.collection('payments').get();

        const studentPayments = {};

        snapshot.forEach(doc => {
            const payment = doc.data();
            if (!studentPayments[payment.userId]) {
                studentPayments[payment.userId] = {
                    userId: payment.userId,
                    studentName: payment.studentName,
                    studentEmail: payment.studentEmail,
                    totalAmount: 0,
                    paymentCount: 0
                };
            }
            studentPayments[payment.userId].totalAmount += payment.amount;
            studentPayments[payment.userId].paymentCount++;
        });

        // Convert to array and sort
        const topStudents = Object.values(studentPayments)
            .sort((a, b) => b.totalAmount - a.totalAmount)
            .slice(0, limit);

        return topStudents;

    } catch (error) {
        console.error('Get top paying students error:', error);
        throw error;
    }
};

module.exports = {
    getUserPaymentAnalytics,
    getSystemPaymentAnalytics,
    getTopPayingStudents
};
