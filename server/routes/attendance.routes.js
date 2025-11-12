const express = require('express');
const router = express.Router();
const { query } = require('../database/db');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const { emitToClass } = require('../socket/socket');
const { varyStudentSnapshot } = require('../services/demoData.service');

// Mark attendance
router.post('/mark', authMiddleware, roleMiddleware('teacher', 'admin'), async (req, res, next) => {
  try {
    const { student_id, subject, date, status, remarks } = req.body;
    // Upsert emulation for Postgres: try update, if no row, insert
    const updated = await query(
      'UPDATE attendance SET status = $1, remarks = $2, marked_by = $3 WHERE student_id = $4 AND subject = $5 AND date = $6 RETURNING id',
      [status, remarks || null, req.user.id, student_id, subject, date]
    );
    if (updated.length === 0) {
      await query(
        'INSERT INTO attendance (student_id, subject, date, status, marked_by, remarks) VALUES ($1, $2, $3, $4, $5, $6)',
        [student_id, subject, date, status, req.user.id, remarks || null]
      );
    }

    const students = await query('SELECT department, year, section FROM users WHERE id = $1', [student_id]);
    if (students.length > 0) {
      const s = students[0];
      emitToClass(s.department, s.year, s.section, 'attendance:update', { student_id, subject, date, status });
    }

    res.json({ success: true, message: 'Attendance marked successfully' });
  } catch (error) {
    next(error);
  }
});

// Get student attendance
router.get('/student/:id', authMiddleware, async (req, res, next) => {
  try {
    const attendance = await query('SELECT * FROM attendance WHERE student_id = $1 ORDER BY date DESC', [req.params.id]
    );
    
    const summary = await query(`SELECT subject, 
       COUNT(*) as total_classes,
       SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_count,
       ROUND(SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as percentage
       FROM attendance WHERE student_id = $1 GROUP BY subject`, [req.params.id]
    );

    if (req.variationSeed) {
      const varied = varyStudentSnapshot({ summary }, req.variationSeed);
      return res.json({ success: true, data: { records: attendance, summary: varied.summary } });
    }
    res.json({ success: true, data: { records: attendance, summary } });
  } catch (error) {
    next(error);
  }
});

/**
 * Get attendance summary for charts and visualizations
 */
router.get('/summary', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get heatmap data (last 12 weeks)
    const twelveWeeksAgo = new Date();
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

    const heatmapData = await query(`
      SELECT 
        date,
        EXTRACT(DOW FROM date) as dayOfWeek,
        status
      FROM attendance
      WHERE student_id = $1 AND date >= $2
      ORDER BY date ASC
    `, [userId, twelveWeeksAgo.toISOString().split('T')[0]]);

    // Get subject-wise attendance
    const subjectWise = await query(`
      SELECT 
        subject,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent,
        ROUND(SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as percentage
      FROM attendance
      WHERE student_id = $1
      GROUP BY subject
      ORDER BY percentage ASC
    `, [userId]);

    // Get overall stats
    const overallStats = await query(`
      SELECT 
        COUNT(*) as totalClasses,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent,
        ROUND(SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as percentage
      FROM attendance
      WHERE student_id = $1
    `, [userId]);

    res.json({
      success: true,
      data: {
        heatmapData,
        subjectWise,
        overall: overallStats[0] || {}
      }
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
