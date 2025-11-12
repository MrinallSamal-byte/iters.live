const express = require('express');
const router = express.Router();
const { query } = require('../database/db');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// Create assignment
router.post('/', authMiddleware, roleMiddleware('teacher', 'admin'), async (req, res, next) => {
  try {
    const { title, description, subject, department, year, total_marks, deadline, attachment_id } = req.body;
    
    const result = await query('INSERT INTO assignments (title, description, subject, department, year, total_marks, deadline, created_by, attachment_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id', [title, description, subject, department, year, total_marks, deadline, req.user.id, attachment_id]
    );

    res.status(201).json({ success: true, message: 'Assignment created successfully', data: { id: result[0].id } });
  } catch (error) {
    next(error);
  }
});

// Get assignments for student
router.get('/student', authMiddleware, roleMiddleware('student'), async (req, res, next) => {
  try {
    const assignments = await query(`SELECT a.*, 
       (SELECT status FROM assignment_submissions WHERE assignment_id = a.id AND student_id = $1) as submission_status
       FROM assignments a 
       WHERE a.department = $2 AND a.year = $3 AND a.is_active = TRUE
       ORDER BY a.deadline ASC`, [req.user.id, req.user.department, req.user.year]
    );
    res.json({ success: true, data: assignments });
  } catch (error) {
    next(error);
  }
});

// Submit assignment
router.post('/:id/submit', authMiddleware, roleMiddleware('student'), async (req, res, next) => {
  try {
    const { submission_text, file_id } = req.body;
    
    await query('INSERT INTO assignment_submissions (assignment_id, student_id, submission_text, file_id) VALUES ($1, $2, $3, $4) ON DUPLICATE KEY UPDATE submission_text = $5, file_id = $6, submitted_at = NOW() RETURNING id', [req.params.id, req.user.id, submission_text, file_id, submission_text, file_id]
    );

    res.json({ success: true, message: 'Assignment submitted successfully' });
  } catch (error) {
    next(error);
  }
});

// Grade submission
router.post('/:id/grade', authMiddleware, roleMiddleware('teacher', 'admin'), async (req, res, next) => {
  try {
    const { student_id, marks_obtained, feedback } = req.body;
    
    await query('UPDATE assignment_submissions SET marks_obtained = $1, feedback = $2, graded_by = $3, graded_at = NOW(), status = "graded" WHERE assignment_id = $4 AND student_id = $5', [marks_obtained, feedback, req.user.id, req.params.id, student_id]
    );

    res.json({ success: true, message: 'Assignment graded successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * Get assignment statistics for charts
 */
router.get('/statistics', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get submission timeline (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const submissionTimeline = await query(`
      SELECT 
        DATE(submitted_at) as date,
        COUNT(*) as count
      FROM assignment_submissions
      WHERE student_id = $1 AND submitted_at >= $2
      GROUP BY DATE(submitted_at)
      ORDER BY date ASC
    `, [userId, thirtyDaysAgo.toISOString().split('T')[0]]);

    // Get overall statistics
    const overallStats = await query(`
      SELECT 
        COUNT(DISTINCT a.id) as totalAssignments,
        COUNT(DISTINCT s.id) as submitted,
        COUNT(DISTINCT CASE WHEN s.status = 'graded' THEN s.id END) as graded,
        AVG(s.marks_obtained) as averageMarks
      FROM assignments a
      LEFT JOIN assignment_submissions s ON a.id = s.assignment_id AND s.student_id = $1
      WHERE a.department = $2 AND a.year = $3
    `, [userId, req.user.department, req.user.year]);

    // Get subject-wise performance
    const subjectPerformance = await query(`
      SELECT 
        a.subject,
        COUNT(DISTINCT a.id) as totalAssignments,
        COUNT(DISTINCT s.id) as submitted,
        AVG(s.marks_obtained) as averageMarks
      FROM assignments a
      LEFT JOIN assignment_submissions s ON a.id = s.assignment_id AND s.student_id = $1
      WHERE a.department = $2 AND a.year = $3
      GROUP BY a.subject
    `, [userId, req.user.department, req.user.year]);

    res.json({
      success: true,
      data: {
        submissionTimeline,
        overall: overallStats[0] || {},
        subjectPerformance
      }
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;

/**
 * MCQ Answer Key & Auto-Grading
 * Adds endpoints for configuring MCQ answer keys and auto-grading submissions
 */

// Save or update MCQ answer key for an assignment
router.post('/:id/answer-key', authMiddleware, roleMiddleware('teacher', 'admin'), async (req, res, next) => {
  try {
    const assignmentId = Number(req.params.id);
    const { answerKey, totalPoints = 0, passPercentage = 40 } = req.body; // answerKey: [{questionId, correctAnswer, points}]
    if (!Array.isArray(answerKey) || answerKey.length === 0) {
      return res.status(400).json({ success: false, message: 'answerKey array is required' });
    }

    // Store in a table column if exists; otherwise store in auxiliary table assignment_answer_keys
    await query(`
      CREATE TABLE IF NOT EXISTS assignment_answer_keys (
        id INT AUTO_INCREMENT PRIMARY KEY,
        assignment_id INT NOT NULL,
        answer_key JSON NOT NULL,
        total_points INT DEFAULT 0,
        pass_percentage INT DEFAULT 40,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY (assignment_id)
      )`);

    await query(
      `INSERT INTO assignment_answer_keys (assignment_id, answer_key, total_points, pass_percentage)
       VALUES ($1, $2, $3, $4) ON DUPLICATE KEY UPDATE answer_key = VALUES(answer_key), total_points = VALUES(total_points), pass_percentage = VALUES(pass_percentage)`, [assignmentId, JSON.stringify(answerKey), Number(totalPoints), Number(passPercentage)]
    );

    res.json({ success: true, message: 'Answer key saved' });
  } catch (error) {
    next(error);
  }
});

// Auto-grade all MCQ submissions for an assignment
router.post('/:id/auto-grade', authMiddleware, roleMiddleware('teacher', 'admin'), async (req, res, next) => {
  try {
    const assignmentId = Number(req.params.id);

    const keys = await query('SELECT * FROM assignment_answer_keys WHERE assignment_id = $1', [assignmentId]);
    if (keys.length === 0) return res.status(404).json({ success: false, message: 'Answer key not configured' });
    const key = keys[0];
    let answerKey = [];
    try { answerKey = JSON.parse(key.answer_key || '[]'); } catch { answerKey = []; }

    // Expect assignment_submissions to contain a JSON column with answers: { questionId: answer }
    const submissions = await query(`SELECT id, student_id, submission_answers FROM assignment_submissions WHERE assignment_id = $1`, [assignmentId]
    );

    let graded = 0;
    for (const s of submissions) {
      let answers = {};
      try { answers = JSON.parse(s.submission_answers || '{}'); } catch { answers = {}; }
      let score = 0; const results = [];
      for (const q of answerKey) {
        const correct = String(answers[q.questionId]) === String(q.correctAnswer);
        if (correct) score += Number(q.points || 0);
        results.push({ id: q.questionId, correct });
      }
      await query(`UPDATE assignment_submissions SET marks_obtained = $1, feedback = $2, graded_by = $3, graded_at = NOW(), status = 'graded' WHERE id = $4`, [score, JSON.stringify({ auto: true, results }), req.user.id, s.id]
      );
      graded++;
    }

    res.json({ success: true, message: 'Auto-grading complete', data: { graded } });
  } catch (error) {
    next(error);
  }
});
