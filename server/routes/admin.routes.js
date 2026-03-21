const express = require('express');
const router = express.Router();
const { query } = require('../database/db');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const bcrypt = require('bcrypt');
const parityService = require('../services/mobile-parity.service');

// Departments statistics
router.get('/departments', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    // Get distinct departments with stats
    const departments = await query(`
      SELECT 
        department as code,
        department as name,
        (SELECT name FROM users WHERE role = 'teacher' AND department = u.department LIMIT 1) as hod,
        COUNT(CASE WHEN role = 'student' THEN 1 END) as total_students,
        COUNT(CASE WHEN role = 'teacher' THEN 1 END) as total_teachers,
        0 as active_courses
      FROM users u
      WHERE department IS NOT NULL
      GROUP BY department
      ORDER BY department
    `);

    res.json({ success: true, data: departments });
  } catch (error) {
    next(error);
  }
});

// Dashboard statistics
router.get('/stats', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const stats = await query(`
      SELECT 
        (SELECT COUNT(DISTINCT department) FROM users WHERE department IS NOT NULL) as total_departments,
        (SELECT COUNT(*) FROM users WHERE role = 'student') as total_students,
        (SELECT COUNT(*) FROM users WHERE role = 'teacher') as total_teachers,
        (SELECT COUNT(*) FROM users WHERE role = 'admin') as total_admins,
        (SELECT COUNT(*) FROM files) as total_files,
        (SELECT COUNT(*) FROM assignments) as total_assignments,
        (SELECT COUNT(*) FROM events) as total_events,
        (SELECT COUNT(*) FROM announcements) as total_announcements
    `);
    const row = stats[0] || {};

    res.json({
      success: true,
      data: {
        ...row,
        totalDepartments: row.total_departments || 0,
        totalStudents: row.total_students || 0,
        totalTeachers: row.total_teachers || 0,
        totalAdmins: row.total_admins || 0,
        totalFiles: row.total_files || 0,
        totalAssignments: row.total_assignments || 0,
        totalEvents: row.total_events || 0,
        totalAnnouncements: row.total_announcements || 0,
        avgAttendance: 78,
        departments: []
      }
    });
  } catch (error) {
    next(error);
  }
});

// User management
router.get('/users', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const { role, department, page = 1, limit = 50 } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    const offset = (pageNum - 1) * limitNum;

    let whereClause = '';
    let params = [];

    let paramCount = 1;

    if (role) {
      whereClause += ` WHERE role = $${paramCount++}`;
      params.push(role);
    }
    if (department) {
      whereClause += (whereClause ? ' AND' : ' WHERE') + ` department = $${paramCount++}`;
      params.push(department);
    }

    // Use direct values for LIMIT and OFFSET instead of placeholders
    const users = await query(`SELECT id, name, registration_number, email, phone_number, role, department, year, section, is_active, created_at 
       FROM users ${whereClause} ORDER BY created_at DESC LIMIT ${limitNum} OFFSET ${offset}`,
      params
    );

    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
});

router.post('/users', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const { name, registration_number, email, password, phone_number, department, year, section, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await query(
      'INSERT INTO users (name, registration_number, email, password, phone_number, department, year, section, role) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
      [name, registration_number, email, hashedPassword, phone_number, department, year, section, role]
    );

    res.status(201).json({ success: true, message: 'User created successfully', data: { id: result[0].id } });
  } catch (error) {
    next(error);
  }
});

router.put('/users/:id/toggle-active', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    await query('UPDATE users SET is_active = NOT is_active WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'User status updated' });
  } catch (error) {
    next(error);
  }
});

// Approvals queue
router.get('/approvals/files', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const files = await query(
      `SELECT f.*, u.name as uploaded_by_name FROM files f
       LEFT JOIN users u ON f.uploaded_by = u.id
       WHERE f.approved = FALSE ORDER BY f.created_at DESC LIMIT 100`
    );
    res.json({ success: true, data: files });
  } catch (error) {
    next(error);
  }
});

router.get('/approvals', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const files = await query(
      `SELECT f.*, u.name as uploaded_by_name FROM files f
       LEFT JOIN users u ON f.uploaded_by = u.id
       WHERE f.approved = FALSE ORDER BY f.created_at DESC LIMIT 100`
    );
    res.json({ success: true, data: files });
  } catch (error) {
    next(error);
  }
});

// Activity logs
router.get('/logs', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const { limit = 100 } = req.query;
    const logs = await query(
      `SELECT al.*, u.name as user_name FROM activity_log al
       LEFT JOIN users u ON al.user_id = u.id
       ORDER BY al.created_at DESC LIMIT $1`, [parseInt(limit)]
    );
    res.json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
});

router.get('/activity-log', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const { limit = 100 } = req.query;
    const logs = await query(
      `SELECT al.*, u.name as user_name FROM activity_log al
       LEFT JOIN users u ON al.user_id = u.id
       ORDER BY al.created_at DESC LIMIT $1`,
      [parseInt(limit, 10)]
    );
    res.json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
});

router.get('/announcements', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const data = await parityService.getAnnouncements();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post('/announcements', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const data = await parityService.createAnnouncement(req.body, req.user);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get('/settings', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    res.json({ success: true, data: parityService.getSettings() });
  } catch (error) {
    next(error);
  }
});

router.put('/settings', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const data = parityService.updateSettings(req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
