const express = require('express');
const router = express.Router();
const { query } = require('../database/db');
const { varyStudentSnapshot } = require('../services/demoData.service');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// Upload marks
router.post('/upload', authMiddleware, roleMiddleware('teacher', 'admin'), async (req, res, next) => {
  try {
    const { student_id, subject, exam_type, marks_obtained, total_marks, exam_date, remarks } = req.body;
    
    const result = await query('INSERT INTO marks (student_id, subject, exam_type, marks_obtained, total_marks, exam_date, uploaded_by, remarks) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id', [student_id, subject, exam_type, marks_obtained, total_marks, exam_date, req.user.id, remarks]
    );

    res.json({ success: true, message: 'Marks uploaded successfully', data: { id: result[0].id } });
  } catch (error) {
    next(error);
  }
});

// Get student marks
router.get('/student/:id', authMiddleware, async (req, res, next) => {
  try {
    const marks = await query('SELECT * FROM marks WHERE student_id = $1 ORDER BY exam_date DESC', [req.params.id]
    );
    
    const summary = await query(`SELECT subject, exam_type, AVG(marks_obtained) as avg_marks, AVG(total_marks) as avg_total
       FROM marks WHERE student_id = $1 GROUP BY subject, exam_type`, [req.params.id]
    );

    if (req.variationSeed) {
      const varied = varyStudentSnapshot({ marks, summary }, req.variationSeed);
      return res.json({ success: true, data: { marks: varied.marks, summary: varied.summary || summary } });
    }
    res.json({ success: true, data: { marks, summary } });
  } catch (error) {
    next(error);
  }
});

/**
 * Get marks summary for charts and visualizations
 */
router.get('/summary', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const filter = req.query.filter || 'semester';

    // Get trend data (performance over time)
    const trendData = await query(`
      SELECT 
        CONCAT(exam_type, ' - ', subject) as examName,
        marks_obtained as marksObtained,
        (SELECT AVG(m2.marks_obtained) 
         FROM marks m2 
         WHERE m2.exam_type = m1.exam_type 
         AND m2.subject = m1.subject) as classAverage,
        exam_date
      FROM marks m1
      WHERE student_id = $1
      ORDER BY exam_date DESC
      LIMIT 10
    `, [userId]);

    // Get subject-wise marks for radar chart
    const subjectMarks = await query(`
      SELECT 
        subject,
        AVG((marks_obtained / total_marks) * 100) as marks
      FROM marks
      WHERE student_id = $1
      GROUP BY subject
    `, [userId]);

    // Get class average for comparison
    const classAverage = await query(`
      SELECT 
        subject,
        AVG((marks_obtained / total_marks) * 100) as marks
      FROM marks
      WHERE subject IN (SELECT DISTINCT subject FROM marks WHERE student_id = $1)
      GROUP BY subject
    `, [userId]);

    // Get grade distribution
    const allMarks = await query(`
      SELECT (marks_obtained / total_marks) * 100 as percentage
      FROM marks
      WHERE student_id = $1
    `, [userId]);

    const gradeDistribution = [
      { grade: 'A (90-100)', count: allMarks.filter(m => m.percentage >= 90).length },
      { grade: 'B (80-89)', count: allMarks.filter(m => m.percentage >= 80 && m.percentage < 90).length },
      { grade: 'C (70-79)', count: allMarks.filter(m => m.percentage >= 70 && m.percentage < 80).length },
      { grade: 'D (60-69)', count: allMarks.filter(m => m.percentage >= 60 && m.percentage < 70).length },
      { grade: 'F (<60)', count: allMarks.filter(m => m.percentage < 60).length }
    ];

    // Get semester-wise SGPA
    const semesterData = await query(`
      SELECT 
        semester,
        AVG((marks_obtained / total_marks) * 10) as sgpa,
        COUNT(DISTINCT subject) as credits
      FROM marks
      WHERE student_id = $1
      GROUP BY semester
      ORDER BY semester
    `, [userId]);

    // Calculate CGPA
    const cgpaResult = await query(`
      SELECT AVG((marks_obtained / total_marks) * 10) as cgpa
      FROM marks
      WHERE student_id = $1
    `, [userId]);

    const cgpa = cgpaResult[0]?.cgpa || 0;

    res.json({
      success: true,
      data: {
        trendData,
        subjectMarks,
        classAverage,
        gradeDistribution,
        semesterData,
        cgpa
      }
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
