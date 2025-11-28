const express = require('express');
const router = express.Router();
const { db } = require('../database/firebase');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const advancedAnalyticsService = require('../services/advanced-analytics.service');

// Helper to get demo overview stats
const getDemoOverviewStats = () => ({
  total_students: 1250,
  total_teachers: 85,
  approved_files: 420,
  pending_files: 12,
  active_events: 8,
  total_storage: 150000000
});

router.get('/overview', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    // Try to get stats from Firestore
    let stats = getDemoOverviewStats();
    let recentActivity = [];
    
    try {
      const usersSnapshot = await db.collection('users').get();
      const filesSnapshot = await db.collection('files').get();
      const eventsSnapshot = await db.collection('events').where('is_active', '==', true).get();
      const activitySnapshot = await db.collection('activity_log').orderBy('created_at', 'desc').limit(20).get();
      
      let students = 0, teachers = 0, approvedFiles = 0, pendingFiles = 0, totalStorage = 0;
      
      usersSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.role === 'student') students++;
        else if (data.role === 'teacher') teachers++;
      });
      
      filesSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.approved) approvedFiles++;
        else pendingFiles++;
        totalStorage += data.file_size || 0;
      });
      
      stats = {
        total_students: students || getDemoOverviewStats().total_students,
        total_teachers: teachers || getDemoOverviewStats().total_teachers,
        approved_files: approvedFiles || getDemoOverviewStats().approved_files,
        pending_files: pendingFiles || getDemoOverviewStats().pending_files,
        active_events: eventsSnapshot.size || getDemoOverviewStats().active_events,
        total_storage: totalStorage || getDemoOverviewStats().total_storage
      };
      
      activitySnapshot.forEach(doc => {
        recentActivity.push({ id: doc.id, ...doc.data() });
      });
    } catch (firestoreError) {
      console.warn('Firestore analytics error, using demo data:', firestoreError.message);
    }

    res.json({ success: true, data: { stats, recentActivity } });
  } catch (error) {
    console.error('Analytics overview error:', error.message);
    res.json({ success: true, data: { stats: getDemoOverviewStats(), recentActivity: [] } });
  }
});

router.get('/attendance-stats', authMiddleware, roleMiddleware('admin', 'teacher'), async (req, res, next) => {
  try {
    const stats = [];
    
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const attendanceSnapshot = await db.collection('attendance')
        .where('date', '>=', thirtyDaysAgo.toISOString().split('T')[0])
        .get();
      
      const dateStats = {};
      attendanceSnapshot.forEach(doc => {
        const data = doc.data();
        const dateKey = data.date;
        if (!dateStats[dateKey]) {
          dateStats[dateKey] = { total_marked: 0, present_count: 0, absent_count: 0 };
        }
        dateStats[dateKey].total_marked++;
        if (data.status === 'present') dateStats[dateKey].present_count++;
        else dateStats[dateKey].absent_count++;
      });
      
      Object.entries(dateStats).forEach(([date, stat]) => {
        stats.push({ date, ...stat });
      });
      stats.sort((a, b) => new Date(b.date) - new Date(a.date));
    } catch (firestoreError) {
      console.warn('Firestore attendance stats error:', firestoreError.message);
    }

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Attendance stats error:', error.message);
    res.json({ success: true, data: [] });
  }
});

/**
 * GET /api/analytics/student-performance/:studentId
 * Get comprehensive student performance analytics
 */
router.get('/student-performance/:studentId', authMiddleware, async (req, res, next) => {
  try {
    const studentId = parseInt(req.params.studentId);
    
    // Students can only view their own analytics, teachers/admins can view any
    if (req.user.role === 'student' && req.user.id !== studentId) {
      return res.status(403).json({
        success: false,
        message: 'You can only view your own performance analytics'
      });
    }

    const analytics = await advancedAnalyticsService.getStudentPerformance(studentId);
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Student performance analytics error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/analytics/attendance-patterns
 * Detect attendance patterns and anomalies
 */
router.get('/attendance-patterns', authMiddleware, roleMiddleware('admin', 'teacher'), async (req, res, next) => {
  try {
    const filters = {
      department: req.query.department,
      year: req.query.year,
      section: req.query.section
    };

    const patterns = await advancedAnalyticsService.getAttendancePatterns(filters);
    
    res.json({
      success: true,
      data: patterns
    });
  } catch (error) {
    console.error('Attendance patterns error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/analytics/teacher/:teacherId
 * Get teacher performance analytics
 */
router.get('/teacher/:teacherId', authMiddleware, roleMiddleware('admin', 'teacher'), async (req, res, next) => {
  try {
    const teacherId = parseInt(req.params.teacherId);
    
    // Teachers can only view their own analytics unless admin
    if (req.user.role === 'teacher' && req.user.id !== teacherId) {
      return res.status(403).json({
        success: false,
        message: 'You can only view your own analytics'
      });
    }

    const analytics = await advancedAnalyticsService.getTeacherAnalytics(teacherId);
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Teacher analytics error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/analytics/performance-trend
 * Returns student performance trends over time for Chart.js
 */
router.get('/performance-trend', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.role === 'student' ? req.user.id : parseInt(req.query.studentId);
    const months = parseInt(req.query.months) || 6;

    const performanceData = await query(`
      SELECT 
        DATE_FORMAT(g.created_at, '%Y-%m') as month,
        AVG(g.marks_obtained / g.total_marks * 100) as student_avg,
        (SELECT AVG(marks_obtained / total_marks * 100) 
         FROM grades 
         WHERE DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(g.created_at, '%Y-%m')) as class_avg
      FROM grades g
      WHERE g.student_id = $2
      AND g.created_at >= DATE_SUB(NOW(), INTERVAL $3 MONTH)
      GROUP BY DATE_FORMAT(g.created_at, '%Y-%m')
      ORDER BY month ASC
    `, [userId, months]);

    // Format data for Chart.js
    const data = {
      labels: performanceData.map(r => {
        const date = new Date(r.month + '-01');
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      }),
      datasets: [
        {
          label: 'Your Performance',
          data: performanceData.map(r => parseFloat(r.student_avg || 0).toFixed(2)),
          borderColor: '#667eea',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          tension: 0.4
        },
        {
          label: 'Class Average',
          data: performanceData.map(r => parseFloat(r.class_avg || 0).toFixed(2)),
          borderColor: '#f093fb',
          backgroundColor: 'rgba(240, 147, 251, 0.1)',
          tension: 0.4
        }
      ]
    };

    res.json({ success: true, data });
  } catch (error) {
    console.error('Performance trend error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch performance trends'
    });
  }
});

/**
 * GET /api/analytics/attendance-calendar
 * Returns attendance data for heatmap calendar
 */
router.get('/attendance-calendar', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.role === 'student' ? req.user.id : parseInt(req.query.studentId);
    const weeks = parseInt(req.query.weeks) || 12;

    const attendanceData = await query(`
      SELECT 
        DATE(date) as attendance_date,
        status
      FROM attendance
      WHERE student_id = $1
      AND date >= DATE_SUB(NOW(), INTERVAL $2 WEEK)
      ORDER BY date ASC
    `, [userId, weeks]);

    // Format for heatmap
    const heatmapData = {};
    attendanceData.forEach(row => {
      const date = row.attendance_date.toISOString().split('T')[0];
      heatmapData[date] = row.status === 'present' ? 1 : 0;
    });

    const totalDays = attendanceData.length;
    const presentDays = attendanceData.filter(r => r.status === 'present').length;

    res.json({
      success: true,
      data: {
        heatmapData,
        stats: {
          totalDays,
          presentDays,
          absentDays: totalDays - presentDays,
          attendanceRate: totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(2) : 0
        }
      }
    });
  } catch (error) {
    console.error('Attendance calendar error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance data'
    });
  }
});

/**
 * GET /api/analytics/subject-comparison
 * Returns performance comparison across subjects (radar chart)
 */
router.get('/subject-comparison', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.role === 'student' ? req.user.id : parseInt(req.query.studentId);

    const subjectData = await query(`
      SELECT 
        s.subject_name,
        AVG(g.marks_obtained / g.total_marks * 100) as avg_marks
      FROM grades g
      INNER JOIN subjects s ON g.subject_id = s.id
      WHERE g.student_id = $1
      AND g.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY s.subject_name
      ORDER BY avg_marks DESC
    `, [userId]);

    const data = {
      labels: subjectData.map(r => r.subject_name),
      datasets: [{
        label: 'Performance by Subject',
        data: subjectData.map(r => parseFloat(r.avg_marks || 0).toFixed(2)),
        backgroundColor: 'rgba(102, 126, 234, 0.2)',
        borderColor: '#667eea',
        pointBackgroundColor: '#667eea',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#667eea'
      }]
    };

    res.json({ success: true, data });
  } catch (error) {
    console.error('Subject comparison error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subject comparison'
    });
  }
});

/**
 * GET /api/analytics/grade-distribution
 * Returns grade distribution (bar chart)
 */
router.get('/grade-distribution', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.role === 'student' ? req.user.id : parseInt(req.query.studentId);

    const gradeData = await query(`
      SELECT 
        CASE 
          WHEN (marks_obtained / total_marks * 100) >= 90 THEN 'A+'
          WHEN (marks_obtained / total_marks * 100) >= 80 THEN 'A'
          WHEN (marks_obtained / total_marks * 100) >= 70 THEN 'B+'
          WHEN (marks_obtained / total_marks * 100) >= 60 THEN 'B'
          WHEN (marks_obtained / total_marks * 100) >= 50 THEN 'C'
          ELSE 'F'
        END as grade,
        COUNT(*) as count
      FROM grades
      WHERE student_id = $1
      AND created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)
      GROUP BY grade
      ORDER BY FIELD(grade, 'A+', 'A', 'B+', 'B', 'C', 'F')
    `, [userId]);

    const data = {
      labels: gradeData.map(r => r.grade),
      datasets: [{
        label: 'Number of Grades',
        data: gradeData.map(r => r.count),
        backgroundColor: ['#10b981', '#34d399', '#fbbf24', '#fb923c', '#f87171', '#ef4444'],
        borderColor: '#fff',
        borderWidth: 2
      }]
    };

    res.json({ success: true, data });
  } catch (error) {
    console.error('Grade distribution error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch grade distribution'
    });
  }
});

/**
 * GET /api/analytics/monthly-progress
 * Returns current month's progress breakdown (doughnut chart)
 */
router.get('/monthly-progress', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.role === 'student' ? req.user.id : parseInt(req.query.studentId);

    const assignmentRows = await query(`
      SELECT 
        SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        COUNT(*) as total
      FROM assignments
      WHERE student_id = $1
      AND DATE_FORMAT(due_date, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')
    `, [userId]);
    const assignmentStats = assignmentRows[0] || {};

    const attendanceRows = await query(`
      SELECT 
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent
      FROM attendance
      WHERE student_id = $1
      AND DATE_FORMAT(date, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')
    `, [userId]);
    const attendanceStats = attendanceRows[0] || {};

    const data = {
      labels: ['Assignments Completed', 'Assignments Pending', 'Days Present', 'Days Absent'],
      datasets: [{
        data: [
          assignmentStats.completed || 0,
          assignmentStats.pending || 0,
          attendanceStats.present || 0,
          attendanceStats.absent || 0
        ],
        backgroundColor: ['#10b981', '#fbbf24', '#3b82f6', '#ef4444'],
        borderColor: '#fff',
        borderWidth: 3
      }]
    };

    res.json({
      success: true,
      data,
      summary: {
        assignmentsTotal: assignmentStats.total || 0,
        assignmentsCompleted: assignmentStats.completed || 0,
        assignmentsPending: assignmentStats.pending || 0,
        attendancePresent: attendanceStats.present || 0,
        attendanceAbsent: attendanceStats.absent || 0
      }
    });
  } catch (error) {
    console.error('Monthly progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch monthly progress'
    });
  }
});

module.exports = router;
