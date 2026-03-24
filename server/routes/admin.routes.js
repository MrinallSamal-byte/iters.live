const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { auth, db } = require('../database/firebase');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const parityService = require('../services/mobile-parity.service');
const {
  createRecord,
  listRecords,
  updateRecord
} = require('../services/firebase-data.service');

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// Departments statistics
router.get('/departments', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const users = await listRecords('users');
    const grouped = new Map();

    for (const user of users) {
      if (!user.department) continue;
      if (!grouped.has(user.department)) {
        grouped.set(user.department, {
          code: user.department,
          name: user.department,
          hod: null,
          total_students: 0,
          total_teachers: 0,
          active_courses: 0
        });
      }

      const item = grouped.get(user.department);
      if (user.role === 'student') item.total_students += 1;
      if (user.role === 'teacher') {
        item.total_teachers += 1;
        if (!item.hod) {
          item.hod = user.name || null;
        }
      }
    }

    res.json({
      success: true,
      data: Array.from(grouped.values()).sort((left, right) => left.name.localeCompare(right.name))
    });
  } catch (error) {
    next(error);
  }
});

// Dashboard statistics
router.get('/stats', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const [users, assignments, events, files] = await Promise.all([
      listRecords('users'),
      listRecords('assignments'),
      listRecords('events'),
      listRecords('files')
    ]);

    const announcements = await parityService.getAnnouncements();
    const departments = new Set(users.map((user) => user.department).filter(Boolean));

    const data = {
      total_departments: departments.size,
      total_students: users.filter((user) => user.role === 'student').length,
      total_teachers: users.filter((user) => user.role === 'teacher').length,
      total_admins: users.filter((user) => user.role === 'admin').length,
      total_files: files.length,
      total_assignments: assignments.length,
      total_events: events.filter((event) => event.is_active !== false).length,
      total_announcements: announcements.length
    };

    res.json({
      success: true,
      data: {
        ...data,
        totalDepartments: data.total_departments,
        totalStudents: data.total_students,
        totalTeachers: data.total_teachers,
        totalAdmins: data.total_admins,
        totalFiles: data.total_files,
        totalAssignments: data.total_assignments,
        totalEvents: data.total_events,
        totalAnnouncements: data.total_announcements,
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
    const pageNum = toNumber(page, 1);
    const limitNum = toNumber(limit, 50);
    const offset = (pageNum - 1) * limitNum;

    const filters = [];
    if (role) filters.push({ field: 'role', value: role });
    if (department) filters.push({ field: 'department', value: department });

    const users = await listRecords('users', {
      filters,
      orderBy: [{ field: 'created_at', direction: 'desc' }]
    });

    res.json({
      success: true,
      data: users.slice(offset, offset + limitNum).map((user) => ({
        id: user.id,
        name: user.name,
        registration_number: user.registration_number,
        email: user.email,
        phone_number: user.phone_number || null,
        role: user.role,
        department: user.department || null,
        year: user.year ?? null,
        section: user.section || null,
        is_active: user.is_active !== false,
        created_at: user.created_at || null
      }))
    });
  } catch (error) {
    next(error);
  }
});

router.post('/users', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const {
      name,
      registration_number,
      email,
      password,
      phone_number,
      department,
      year,
      section,
      role
    } = req.body;

    const hashedPassword = await bcrypt.hash(password, 12);
    const payload = {
      name,
      registration_number,
      email,
      password: hashedPassword,
      phone_number: phone_number || null,
      department: department || null,
      year: year ?? null,
      section: section || null,
      role,
      is_active: true,
      created_at: new Date().toISOString(),
      last_login: null
    };

    await createRecord('users', payload, { id: registration_number });
    await db.collection('users').doc(registration_number).set(payload, { merge: true });

    try {
      await auth.createUser({
        uid: registration_number,
        email,
        password
      });
    } catch (authError) {
      console.warn('Failed to create Firebase Auth user for admin-created account:', authError.message);
    }

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: { id: registration_number }
    });
  } catch (error) {
    next(error);
  }
});

router.put('/users/:id/toggle-active', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const users = await listRecords('users', {
      filters: [{ field: 'id', value: req.params.id }]
    });
    const user = users[0];

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await updateRecord('users', req.params.id, {
      is_active: !(user.is_active !== false)
    });
    await db.collection('users').doc(req.params.id).set({
      is_active: !(user.is_active !== false),
      updated_at: new Date().toISOString()
    }, { merge: true });

    res.json({ success: true, message: 'User status updated' });
  } catch (error) {
    next(error);
  }
});

// Approvals queue
router.get('/approvals/files', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const users = await listRecords('users');
    const userNameById = new Map(users.map((user) => [user.id, user.name]));
    const files = await listRecords('files', {
      filters: [{ field: 'approved', value: false }],
      orderBy: [{ field: 'created_at', direction: 'desc' }]
    });

    res.json({
      success: true,
      data: files.slice(0, 100).map((file) => ({
        ...file,
        uploaded_by_name: userNameById.get(file.uploaded_by) || null
      }))
    });
  } catch (error) {
    next(error);
  }
});

router.get('/approvals', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const users = await listRecords('users');
    const userNameById = new Map(users.map((user) => [user.id, user.name]));
    const files = await listRecords('files', {
      filters: [{ field: 'approved', value: false }],
      orderBy: [{ field: 'created_at', direction: 'desc' }]
    });

    res.json({
      success: true,
      data: files.slice(0, 100).map((file) => ({
        ...file,
        uploaded_by_name: userNameById.get(file.uploaded_by) || null
      }))
    });
  } catch (error) {
    next(error);
  }
});

// Activity logs
router.get('/logs', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const { limit = 100 } = req.query;
    const users = await listRecords('users');
    const userNameById = new Map(users.map((user) => [user.id, user.name]));
    const logs = await listRecords('activity_log', {
      orderBy: [{ field: 'created_at', direction: 'desc' }],
      limit: toNumber(limit, 100)
    });

    res.json({
      success: true,
      data: logs.map((log) => ({
        ...log,
        user_name: userNameById.get(log.user_id) || null
      }))
    });
  } catch (error) {
    next(error);
  }
});

router.get('/activity-log', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const { limit = 100 } = req.query;
    const users = await listRecords('users');
    const userNameById = new Map(users.map((user) => [user.id, user.name]));
    const logs = await listRecords('activity_log', {
      orderBy: [{ field: 'created_at', direction: 'desc' }],
      limit: toNumber(limit, 100)
    });

    res.json({
      success: true,
      data: logs.map((log) => ({
        ...log,
        user_name: userNameById.get(log.user_id) || null
      }))
    });
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
    const data = await parityService.getSettings();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.put('/settings', authMiddleware, roleMiddleware('admin'), async (req, res, next) => {
  try {
    const data = await parityService.updateSettings(req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
