const express = require('express');
const router = express.Router();
const { query } = require('../database/db');
const { authMiddleware } = require('../middleware/auth');

// Get timetable for student/teacher
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    let timetable;
    
    if (req.user.role === 'student') {
      timetable = await query(`SELECT t.*, u.name as teacher_name FROM timetable t
         LEFT JOIN users u ON t.teacher_id = u.id
         WHERE t.department = $1 AND t.year = $2 AND t.section = $3
         ORDER BY 
           CASE t.day_of_week
             WHEN 'Monday' THEN 1
             WHEN 'Tuesday' THEN 2
             WHEN 'Wednesday' THEN 3
             WHEN 'Thursday' THEN 4
             WHEN 'Friday' THEN 5
             WHEN 'Saturday' THEN 6
             ELSE 7
           END,
           t.start_time`, [req.user.department, req.user.year, req.user.section]
      );
    } else if (req.user.role === 'teacher') {
      timetable = await query(`SELECT * FROM timetable WHERE teacher_id = $1
         ORDER BY 
           CASE day_of_week
             WHEN 'Monday' THEN 1
             WHEN 'Tuesday' THEN 2
             WHEN 'Wednesday' THEN 3
             WHEN 'Thursday' THEN 4
             WHEN 'Friday' THEN 5
             WHEN 'Saturday' THEN 6
             ELSE 7
           END,
           start_time`, [req.user.id]
      );
    }

    res.json({ success: true, data: timetable });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
